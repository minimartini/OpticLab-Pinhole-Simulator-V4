
import React, { useEffect, useRef } from 'react';

interface ViewportProps {
  originalImage: ImageData | null;
  processedImage: ImageData | null;
  onUpload: (file: File) => void;
  onClear: () => void;
  isProcessing: boolean;
  onDownload?: () => void;
  error?: string | null;
  progress?: { label: string, value: number } | null;
}

const TrashIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const DownloadIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const Viewport: React.FC<ViewportProps> = ({ 
    originalImage, processedImage, onUpload, onClear, isProcessing, onDownload, error, progress 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = processedImage || originalImage;

    if (imgData && imgData.width > 0 && imgData.height > 0) {
      canvas.width = imgData.width;
      canvas.height = imgData.height;
      ctx.putImageData(imgData, 0, 0);
    } else {
        // Clear canvas
        canvas.width = 800; 
        canvas.height = 600;
        ctx.clearRect(0,0, canvas.width, canvas.height);
        
        // Technical placeholder
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0,0, canvas.width, canvas.height);
        
        // Draw centered crosshair
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy);
        ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20);
        ctx.stroke();
        
        ctx.fillStyle = "#444";
        ctx.textAlign = "center";
        ctx.font = "12px 'JetBrains Mono', monospace";
        ctx.fillText("SENSOR EMPTY", canvas.width/2, canvas.height/2 + 40);
        ctx.fillStyle = "#333";
        ctx.font = "10px 'Inter', sans-serif";
        ctx.fillText("LOAD IMAGE TO BEGIN", canvas.width/2, canvas.height/2 + 55);
    }
  }, [originalImage, processedImage]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
          onUpload(file);
      }
    }
  };

  return (
    <div 
      className="flex-1 bg-mono-950 bg-tech-grid relative overflow-hidden flex flex-col items-center justify-center p-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Top Toolbar */}
      <div className="absolute top-6 z-10 flex gap-2 backdrop-blur-md bg-black/60 p-1.5 rounded-full border border-white/10 shadow-xl">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="bg-white/10 hover:bg-white/20 text-gray-200 text-xs px-4 py-2 rounded-full border border-white/5 transition-all shadow-lg font-medium"
        >
          Load Image
        </button>
        
        {onDownload && (processedImage || originalImage) && (
            <button 
                onClick={onDownload}
                className="bg-science-900/30 hover:bg-science-900/50 text-science-300 text-xs px-3 py-2 rounded-full border border-science-700/30 transition-all flex items-center gap-1"
                title="Save Result"
            >
                <DownloadIcon /> Save
            </button>
        )}

        {originalImage && (
            <button 
              onClick={onClear}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs px-3 py-2 rounded-full border border-red-500/20 transition-all flex items-center gap-1"
              title="Clear Sensor"
            >
              <TrashIcon />
            </button>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*"
          onChange={(e) => {
              if (e.target.files?.[0]) {
                  onUpload(e.target.files[0]);
                  e.target.value = '';
              }
          }}
        />
      </div>

      {/* Main Canvas Container */}
      <div className="relative border border-white/5 bg-black shadow-2xl shadow-black rounded-sm max-w-full max-h-full flex items-center justify-center">
        {/* Sensor Frame Marks (Corner Brackets) */}
        <div className="absolute top-[-1px] left-[-1px] w-4 h-4 border-t border-l border-science-500/50 z-10"></div>
        <div className="absolute top-[-1px] right-[-1px] w-4 h-4 border-t border-r border-science-500/50 z-10"></div>
        <div className="absolute bottom-[-1px] left-[-1px] w-4 h-4 border-b border-l border-science-500/50 z-10"></div>
        <div className="absolute bottom-[-1px] right-[-1px] w-4 h-4 border-b border-r border-science-500/50 z-10"></div>

        <canvas 
            ref={canvasRef} 
            className="max-w-full max-h-[85vh] w-auto h-auto object-contain block bg-[#050505]"
            style={{ imageRendering: 'pixelated' }} 
        />
        
        {isProcessing && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm z-20 transition-all duration-300">
                <div className="w-64 space-y-3">
                    <div className="flex justify-between items-end">
                        <div className="text-science-400 font-mono text-xs tracking-widest animate-pulse">
                            {progress?.label || "INITIALIZING..."}
                        </div>
                        <div className="text-science-500 font-bold text-xs">{Math.round(progress?.value || 0)}%</div>
                    </div>
                    <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-science-500 shadow-[0_0_10px_rgba(14,165,233,0.5)] transition-all duration-300 ease-out"
                            style={{ width: `${progress?.value || 0}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        )}
      </div>
      
      {/* Error Toast */}
      {error && (
          <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-red-900/90 text-white px-4 py-3 rounded-lg border border-red-500 shadow-2xl backdrop-blur-md z-50 flex items-center gap-3">
              <svg className="w-5 h-5 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>
                  <div className="text-xs font-bold text-red-200 uppercase">System Alert</div>
                  <div className="text-sm font-medium">{error}</div>
              </div>
          </div>
      )}

      <div className="absolute bottom-6 left-6 text-[10px] text-gray-700 font-mono select-none">
          SENSOR_READOUT::ACTIVE
      </div>
    </div>
  );
};

export default Viewport;