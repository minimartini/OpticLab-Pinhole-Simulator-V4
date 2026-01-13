
import React, { useRef, useEffect } from 'react';
import { ApertureConfig, CameraConfig, SimulationResult } from '../types';

interface PSFPreviewProps {
  aperture: ApertureConfig;
  camera: CameraConfig;
  simResult: SimulationResult;
  kernel?: Float32Array | null;
}

const PSFPreview: React.FC<PSFPreviewProps> = ({ aperture, camera, simResult, kernel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasSize = 240; 
    const dpr = window.devicePixelRatio || 1;
    
    if (canvas.width !== canvasSize * dpr) {
        canvas.width = canvasSize * dpr;
        canvas.height = canvasSize * dpr;
        ctx.scale(dpr, dpr);
    }
    
    // Clear
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0,0, canvasSize, canvasSize);

    if (!kernel || kernel.length === 0) {
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.font = '10px monospace';
        ctx.fillText("WAITING FOR DATA", canvasSize/2, canvasSize/2);
        return;
    }

    // Kernel is RGB Float32Array. We visualize intensity (Green channel).
    const len = kernel.length / 3;
    // Calculate aspect based on buffer size vs 1024 width standard
    const kWidth = 1024;
    const kHeight = len / kWidth;
    
    // Create temp buffer
    const kCanvas = document.createElement('canvas');
    kCanvas.width = kWidth;
    kCanvas.height = kHeight;
    const kCtx = kCanvas.getContext('2d');
    if(!kCtx) return;
    
    const kImgData = kCtx.createImageData(kWidth, kHeight);
    const kData = kImgData.data;

    let maxVal = 0;
    
    // 1. Pass: Find Max
    for(let i=0; i<len; i++) {
        if (kernel[i*3+1] > maxVal) maxVal = kernel[i*3+1];
    }
    
    // 2. Pass: Write & Find Bounding Box
    let minX = kWidth, maxX = 0, minY = kHeight, maxY = 0;
    const threshold = maxVal * 0.005; // 0.5% threshold for visibility

    const logScale = (val: number) => {
        const v = Math.max(0, val);
        const factor = 5000; 
        if (maxVal === 0) return 0;
        return Math.log(1 + v * factor) / Math.log(1 + maxVal * factor);
    };

    for (let i = 0; i < len; i++) {
        const val = kernel[i*3 + 1];
        
        // Update Bounds
        if (val > threshold) {
            const x = i % kWidth;
            const y = Math.floor(i / kWidth);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }

        const logVal = logScale(val);
        // Thermal map
        let r=0, g=0, b=0;
        if (logVal < 0.3) { b = (logVal/0.3)*255; }
        else if (logVal < 0.6) { b = 255; r = ((logVal-0.3)/0.3)*255; }
        else { r = 255; b = (1-(logVal-0.6)/0.4)*255; g = ((logVal-0.6)/0.4)*255; }

        kData[i*4] = r; kData[i*4+1] = g; kData[i*4+2] = b; kData[i*4+3] = 255;
    }
    
    kCtx.putImageData(kImgData, 0, 0);

    // 3. Draw Scaled Crop
    let cropW = maxX - minX;
    let cropH = maxY - minY;
    
    // Handle "Empty" or "Full" cases
    if (cropW <= 0 || cropH <= 0) { 
        cropW = 100; cropH = 100; minX = kWidth/2 - 50; minY = kHeight/2 - 50; 
    }
    
    // Pad by 20%
    const pad = Math.max(cropW, cropH) * 0.2;
    let sX = minX - pad;
    let sY = minY - pad;
    let sW = cropW + pad*2;
    let sH = cropH + pad*2;
    
    // Clamp
    if (sW < 10) sW = 10; if (sH < 10) sH = 10;
    
    // Maintain Aspect Ratio of Canvas (Square)
    const dim = Math.max(sW, sH);
    const cX = sX + sW/2;
    const cY = sY + sH/2;
    
    sX = cX - dim/2;
    sY = cY - dim/2;
    sW = dim; sH = dim;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(kCanvas, sX, sY, sW, sH, 0, 0, canvasSize, canvasSize);

    // Overlay Info
    ctx.fillStyle = '#71717a';
    ctx.font = '9px "JetBrains Mono"';
    ctx.fillText("PSF ENERGY DISTRIBUTION", 8, 15);
    
    const zoom = kWidth / sW;
    ctx.textAlign = 'right';
    ctx.fillText(`ZOOM x${zoom.toFixed(1)}`, canvasSize - 8, 15);

  }, [kernel]);

  return (
    <div className="relative group bg-black border border-white/10 rounded-lg shadow-2xl overflow-hidden mb-4">
        <canvas 
            ref={canvasRef} 
            style={{ width: '100%', height: '240px' }}
            className="block"
        />
        <div className="absolute inset-0 ring-1 ring-inset ring-white/5 rounded-lg pointer-events-none"></div>
    </div>
  );
};

export default PSFPreview;
