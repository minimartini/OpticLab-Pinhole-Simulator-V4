


import React, { useRef, useEffect, useState } from 'react';
import { ApertureConfig, ApertureType, CameraConfig } from '../types';
import { drawAperture } from '../utils/physics';

interface AperturePreviewProps {
  aperture: ApertureConfig;
  camera: CameraConfig;
  onUpdateAperture?: (updates: Partial<ApertureConfig>) => void;
}

const AperturePreview: React.FC<AperturePreviewProps> = ({ 
    aperture, 
    camera, 
    onUpdateAperture
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [maskImgElement, setMaskImgElement] = useState<HTMLImageElement | null>(null);
  
  // Force update trigger for drawing smoothness
  const [, forceUpdate] = useState(0);

  // Local buffer for drawing to prevent React render lag
  const drawingBuffer = useRef<{x: number, y: number}[]>([]);

  // Load the mask image when URL changes
  useEffect(() => {
      if (aperture.type === ApertureType.CUSTOM && aperture.maskImage) {
          const img = new Image();
          img.src = aperture.maskImage;
          img.onload = () => setMaskImgElement(img);
      } else {
          setMaskImgElement(null);
      }
  }, [aperture.type, aperture.maskImage]);
  
  // Sync buffer on prop change
  useEffect(() => {
      if (aperture.customPath) {
          drawingBuffer.current = [...aperture.customPath];
      } else {
          drawingBuffer.current = [];
      }
  }, [aperture.customPath]);

  // Helper to get drawing params
  const getDrawParams = (canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const size = Math.min(width, height);
      
      let maxDimension = aperture.diameter;
      
      // Fix: Ensure spread is used for calculating bounds on pattern types
      if (aperture.type === ApertureType.MULTI_DOT || aperture.type === ApertureType.FIBONACCI || aperture.type === ApertureType.RANDOM) {
           maxDimension = Math.max(aperture.diameter, (aperture.spread || 2.0) * 2.2);
      } else if (aperture.type === ApertureType.FRACTAL || aperture.type === ApertureType.SIERPINSKI_TRIANGLE) {
           maxDimension = (aperture.spread || 10) * 1.5;
      } else if (aperture.type === ApertureType.FREEFORM) {
           maxDimension = (aperture.diameter || 10) * 1.2;
      } else if (aperture.type === ApertureType.WAVES || aperture.type === ApertureType.YIN_YANG) {
           const w = aperture.diameter || 10;
           const h = aperture.slitHeight || 2.0;
           maxDimension = Math.max(w, h) * 1.5;
      } else if (aperture.type === ApertureType.SLIT || aperture.type === ApertureType.CROSS || aperture.type === ApertureType.ZIGZAG) {
           maxDimension = (aperture.diameter || 5) * 1.3;
      } else if (aperture.type === ApertureType.ANNULAR) {
           maxDimension = aperture.diameter * 1.2;
      } else if (aperture.type === ApertureType.DOT_SLIT) {
           const dist = aperture.spread || 1.0;
           maxDimension = Math.max(aperture.diameter, dist * 2.5);
      }
      
      const targetPx = size * 0.85; 
      const safeDimension = Math.max(0.1, maxDimension);
      const scale = targetPx / safeDimension;
      
      const radiusPx = (safeDimension * scale) / 2;
      return { width, height, scale, radiusPx, maxDimension };
  };

  // Main Draw Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Background - minimalist dark gray
    ctx.fillStyle = '#18181b'; 
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    // Subtle crosshair
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY); ctx.lineTo(rect.width, centerY);
    ctx.moveTo(centerX, 0); ctx.lineTo(centerX, rect.height);
    ctx.stroke();

    const { scale } = getDrawParams(canvas);
    
    ctx.translate(centerX, centerY);
    
    if (aperture.type === ApertureType.CUSTOM && maskImgElement) {
        const diameterPx = aperture.diameter * scale;
        const radiusPx = diameterPx / 2;
        const tempC = document.createElement('canvas');
        tempC.width = diameterPx;
        tempC.height = diameterPx;
        const tempCtx = tempC.getContext('2d');
        if (tempCtx) {
            tempCtx.save();
            tempCtx.translate(radiusPx, radiusPx);
            tempCtx.rotate((aperture.rotation || 0) * Math.PI / 180);
            tempCtx.translate(-radiusPx, -radiusPx);
            tempCtx.drawImage(maskImgElement, 0, 0, diameterPx, diameterPx);
            tempCtx.restore();

            const idata = tempCtx.getImageData(0,0, diameterPx, diameterPx);
            const data = idata.data;
            const thresh = aperture.maskThreshold ?? 128;
            const invert = aperture.maskInvert || false;

            for(let i=0; i<data.length; i+=4) {
                const avg = (data[i] + data[i+1] + data[i+2]) / 3;
                let val = avg > thresh ? 255 : 0;
                if (invert) val = 255 - val;
                data[i] = val; data[i+1] = val; data[i+2] = val; data[i+3] = 255; 
            }
            tempCtx.putImageData(idata, 0, 0);
            
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'rgba(14, 165, 233, 0.4)';
            ctx.drawImage(tempC, -radiusPx, -radiusPx);
            ctx.shadowBlur = 0;
        }
    } else {
        // Special drawing for Freeform using local buffer if drawing
        // NOTE: We pass the drawingBuffer explicitly to drawAperture if we are in drawing mode
        if (aperture.type === ApertureType.FREEFORM && isDrawing) {
             const tempAp = { ...aperture, customPath: drawingBuffer.current };
             drawAperture(ctx, scale, tempAp, camera.wavelength, camera.focalLength);
        } else {
             ctx.shadowBlur = 15;
             ctx.shadowColor = 'rgba(14, 165, 233, 0.4)';
             drawAperture(ctx, scale, aperture, camera.wavelength, camera.focalLength);
             ctx.shadowBlur = 0;
        }
    }
    
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // Scale Bar
    const barWidthPx = 1.0 * scale; 
    
    ctx.fillStyle = '#71717a';
    ctx.fillRect(12, rect.height - 22, barWidthPx, 2);
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`1mm`, 12, rect.height - 28);
    
    if (aperture.type === ApertureType.FREEFORM) {
        ctx.textAlign = 'right';
        ctx.fillStyle = isDrawing ? '#0ea5e9' : '#71717a';
        ctx.fillText(isDrawing ? "DRAWING..." : "DRAW: CLICK & DRAG", rect.width - 12, 20);
    } else if (aperture.type === ApertureType.CUSTOM) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#71717a';
        ctx.fillText("CUSTOM IMPORT", rect.width - 12, 20);
    }

  }, [aperture, camera, isDrawing, maskImgElement]); // Intentionally exclude forceUpdate from deps, we trigger re-render by state change

  const processDrawEvent = (x: number, y: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { width, height, scale } = getDrawParams(canvas);
      const radiusPx = (aperture.diameter * scale) / 2;
      const nx = (x - width/2) / radiusPx;
      const ny = (y - height/2) / radiusPx;
      drawingBuffer.current.push({x: nx, y: ny});
      forceUpdate(prev => prev + 1);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (aperture.type !== ApertureType.FREEFORM || !onUpdateAperture) return;
      setIsDrawing(true);
      const rect = canvasRef.current!.getBoundingClientRect();
      processDrawEvent(e.clientX - rect.left, e.clientY - rect.top);
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDrawing || aperture.type !== ApertureType.FREEFORM) return;
      const rect = canvasRef.current!.getBoundingClientRect();
      processDrawEvent(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      if (aperture.type !== ApertureType.FREEFORM || !onUpdateAperture) return;
      e.preventDefault(); // Prevent scrolling
      setIsDrawing(true);
      const rect = canvasRef.current!.getBoundingClientRect();
      const touch = e.touches[0];
      processDrawEvent(touch.clientX - rect.left, touch.clientY - rect.top);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (!isDrawing || aperture.type !== ApertureType.FREEFORM) return;
      e.preventDefault();
      const rect = canvasRef.current!.getBoundingClientRect();
      const touch = e.touches[0];
      processDrawEvent(touch.clientX - rect.left, touch.clientY - rect.top);
  };

  const handleEnd = () => {
      if (!isDrawing) return;
      setIsDrawing(false);
      if (onUpdateAperture) {
          onUpdateAperture({ customPath: [...drawingBuffer.current] });
      }
  };

  return (
    <div className="relative group">
        <canvas 
            ref={canvasRef} 
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleEnd}
            style={{ width: '100%', height: '300px' }}
            className={`block bg-[#18181b] ${aperture.type === ApertureType.FREEFORM ? 'cursor-crosshair' : 'cursor-default'}`}
        />
    </div>
  );
};

export default AperturePreview;