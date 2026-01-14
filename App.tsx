
import React, { useState, useEffect, useRef } from 'react';
import exifr from 'exifr';
import ControlPanel from './components/ControlPanel';
import Viewport from './components/Viewport';
import { CameraConfig, ApertureConfig, ApertureType, SimulationResult, EXIFData, WorkerMetadata } from './types';
import { calculatePhysics, DEFAULT_WAVELENGTH } from './utils/physics';
import { generateLightSourceImage } from './utils/imageProcessing';
import { WORKER_SOURCE } from './utils/simulationEngine';

const App: React.FC = () => {
  const [camera, setCamera] = useState<CameraConfig>({
      focalLength: 50,
      sensorWidth: 35.9, // Nikon Z FX
      sensorHeight: 23.9,
      wavelength: DEFAULT_WAVELENGTH,
      iso: 100, 
      modelName: 'nikon_z',
      flangeDistance: 16.0
  });

  const [aperture, setAperture] = useState<ApertureConfig>({
      type: ApertureType.PINHOLE,
      diameter: 0.23, // Approx optimal for 50mm
      engine: 'WAVE', 
      resolution: 1024,
      useChromaticAberration: true, 
      useVignetting: true,
      addSensorNoise: true,
  });

  const [simResult, setSimResult] = useState<SimulationResult>({
      geometricBlur: 0,
      diffractionBlur: 0,
      totalBlur: 0,
      optimalDiameter: 0,
      fNumber: 0,
      tStop: 0,
      fovH: 0,
      fovV: 0,
      focalLength35mm: 0,
      maxFootprint: 0,
      isDiffractionLimited: false
  });

  const [simMeta, setSimMeta] = useState<WorkerMetadata | null>(null);

  const [originalImage, setOriginalImage] = useState<ImageData | null>(null);
  const [processedImage, setProcessedImage] = useState<ImageData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ label: string, value: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exposure, setExposure] = useState(0.0); // Default 0 EV
  const [sourceIntensity, setSourceIntensity] = useState(10.0); 
  
  // EXIF State
  const [sourceEXIF, setSourceEXIF] = useState<EXIFData | null>(null);
  
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
      const res = calculatePhysics(camera, aperture);
      setSimResult(res);
  }, [camera, aperture]);

  useEffect(() => {
      // Initial Optimization on load
      const lambda = (camera.wavelength || 550) * 1e-6;
      const optimal = 1.9 * Math.sqrt(camera.focalLength * lambda);
      setAperture(prev => ({...prev, diameter: parseFloat(optimal.toFixed(3))}));

      return () => {
        if (workerRef.current) {
          try {
            workerRef.current.terminate();
          } catch (err) {
            console.warn('Failed to terminate worker during unmount:', err);
          }
          workerRef.current = null;
        }
      };
  }, []);

  const handleUpload = async (file: File) => {
      try {
          const exif = await exifr.parse(file, ['FNumber', 'ExposureTime', 'ISOSpeedRatings', 'FocalLength', 'Make', 'Model']);
          if (exif) {
              setSourceEXIF({
                  fNumber: exif.FNumber,
                  exposureTime: exif.ExposureTime,
                  iso: exif.ISOSpeedRatings,
                  focalLength: exif.FocalLength,
                  make: exif.Make,
                  model: exif.Model
              });
          } else {
              setSourceEXIF(null);
          }
      } catch (err) {
          console.warn("EXIF extraction failed", err);
          setSourceEXIF(null);
      }

      const reader = new FileReader();
      reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
              // Auto-rotate sensor to match image orientation
              const isImgPortrait = img.height > img.width;
              const isSensorPortrait = camera.sensorHeight > camera.sensorWidth;
              
              if (isImgPortrait !== isSensorPortrait) {
                  // Only flip if they are strictly different (ignore square)
                  if (img.height !== img.width && camera.sensorHeight !== camera.sensorWidth) {
                      setCamera(prev => ({
                          ...prev,
                          sensorWidth: prev.sensorHeight,
                          sensorHeight: prev.sensorWidth
                      }));
                  }
              }

              const canvas = document.createElement('canvas');
              let w = img.width;
              let h = img.height;
              const maxDim = 2048;
              if (w > maxDim || h > maxDim) {
                  const scale = Math.min(maxDim/w, maxDim/h);
                  w *= scale;
                  h *= scale;
              }
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  ctx.drawImage(img, 0, 0, w, h);
                  setOriginalImage(ctx.getImageData(0, 0, w, h));
                  setProcessedImage(null);
                  setError(null);
              }
          };
          img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
  };

  const onSimulate = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bd3f41ad-e6bf-43db-a620-ebff8e5139e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:147',message:'onSimulate entry',data:{isProcessing},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (isProcessing) return;
      
      let sourceData = originalImage;
      if (!sourceData) {
          // Create a simple point light for fallback
          sourceData = generateLightSourceImage(800, 600, 0.5, camera.sensorWidth);
          setOriginalImage(sourceData);
      }

      setIsProcessing(true);
      setProgress({ label: 'Preparing Worker...', value: 0 });
      setError(null);
      setSimMeta(null);

      if (!workerRef.current) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/bd3f41ad-e6bf-43db-a620-ebff8e5139e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:162',message:'Creating new worker',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
          workerRef.current = new Worker(URL.createObjectURL(blob));
      }

      const worker = workerRef.current;
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bd3f41ad-e6bf-43db-a620-ebff8e5139e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:167',message:'Before setting handlers',data:{hasOnMessage:!!worker.onmessage,hasOnError:!!worker.onerror},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      let maskBitmap: ImageBitmap | undefined;
      if (aperture.type === ApertureType.CUSTOM && aperture.maskImage) {
           try {
               const resp = await fetch(aperture.maskImage);
               const blob = await resp.blob();
               maskBitmap = await createImageBitmap(blob);
               // #region agent log
               fetch('http://127.0.0.1:7242/ingest/bd3f41ad-e6bf-43db-a620-ebff8e5139e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:174',message:'Created maskBitmap',data:{width:maskBitmap.width,height:maskBitmap.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
               // #endregion
           } catch (e) {
               console.error("Failed to load mask", e);
           }
      }

      worker.onmessage = (e) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/bd3f41ad-e6bf-43db-a620-ebff8e5139e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:180',message:'Worker message received',data:{type:e.data.type,hasSuccess:e.data.success,hasProcessed:!!e.data.processed},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          if (e.data.type === 'progress') {
              setProgress(e.data);
          } else if (e.data.success) {
              const bmp = e.data.processed as ImageBitmap;
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/bd3f41ad-e6bf-43db-a620-ebff8e5139e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:184',message:'Processing ImageBitmap',data:{width:bmp.width,height:bmp.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
              // #endregion
              const canvas = document.createElement('canvas');
              canvas.width = bmp.width;
              canvas.height = bmp.height;
              const ctx = canvas.getContext('2d');
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/bd3f41ad-e6bf-43db-a620-ebff8e5139e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:189',message:'Canvas context check',data:{ctxIsNull:ctx===null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
              // #endregion
              ctx?.drawImage(bmp, 0, 0);
              setProcessedImage(ctx?.getImageData(0,0, bmp.width, bmp.height) || null);
              try {
                  bmp.close();
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/bd3f41ad-e6bf-43db-a620-ebff8e5139e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:190',message:'ImageBitmap closed',data:{width:bmp.width,height:bmp.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                  // #endregion
              } catch {
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/bd3f41ad-e6bf-43db-a620-ebff8e5139e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:190',message:'ImageBitmap close failed',data:{width:bmp.width,height:bmp.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                  // #endregion
              }
              
              if (e.data.metadata) {
                  setSimMeta(e.data.metadata);
              }
              
              setIsProcessing(false);
              setProgress(null);
          } else {
              setError(e.data.error || "Unknown Error");
              setIsProcessing(false);
              setProgress(null);
          }
      };
      
      worker.onerror = (e) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/bd3f41ad-e6bf-43db-a620-ebff8e5139e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:205',message:'Worker error handler',data:{message:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          setError("Worker Error: " + e.message);
          setIsProcessing(false);
      };

      worker.postMessage({
          camera,
          aperture,
          imageData: sourceData,
          exposure,
          sourceIntensity,
          maskBitmap,
          diffractionBlur: simResult.diffractionBlur // Pass physics result
      }, maskBitmap ? [maskBitmap] : undefined);
  };

  const handleDownload = () => {
      if (!processedImage) return;
      const canvas = document.createElement('canvas');
      canvas.width = processedImage.width;
      canvas.height = processedImage.height;
      const ctx = canvas.getContext('2d');
      ctx?.putImageData(processedImage, 0, 0);
      const link = document.createElement('a');
      link.download = `opticlab_sim_${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
  };

  return (
    <div className="flex flex-col-reverse md:flex-row h-screen w-screen overflow-hidden bg-black text-white selection:bg-science-500/30">
        <ControlPanel 
            camera={camera} setCamera={setCamera}
            aperture={aperture} setAperture={setAperture}
            simResult={simResult}
            isProcessing={isProcessing}
            onSimulate={onSimulate}
            onCancel={() => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/bd3f41ad-e6bf-43db-a620-ebff8e5139e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:242',message:'Cancel called',data:{hasWorker:!!workerRef.current,hasOnMessage:workerRef.current?!!workerRef.current.onmessage:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                if(workerRef.current) {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/bd3f41ad-e6bf-43db-a620-ebff8e5139e0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:243',message:'Terminating worker WITHOUT removing handlers',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                    // #endregion
                    workerRef.current.terminate();
                }
                workerRef.current = null;
                setIsProcessing(false);
                setProgress(null);
            }}
            exposure={exposure}
            setExposure={setExposure}
            sourceIntensity={sourceIntensity}
            setSourceIntensity={setSourceIntensity}
            subjectDistance={2000} // Dummy prop, unused by new physics engine
            setSubjectDistance={() => {}} 
            sourceEXIF={sourceEXIF}
            simMeta={simMeta}
        />
        <Viewport 
            originalImage={originalImage}
            processedImage={processedImage}
            onUpload={handleUpload}
            onClear={() => { setOriginalImage(null); setProcessedImage(null); }}
            isProcessing={isProcessing}
            progress={progress}
            error={error}
            onDownload={handleDownload}
        />
    </div>
  );
};

export default App;
