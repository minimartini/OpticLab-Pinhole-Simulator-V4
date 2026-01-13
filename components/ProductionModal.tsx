
import React, { useState, useEffect } from 'react';
import { ProductionItem, ExportConfig } from '../types';
import { generateSheetSVG, generateBlueprintSVG } from '../utils/export';
import JSZip from 'jszip';
import { jsPDF } from "jspdf";

interface ProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ProductionItem[];
  onRemoveItem: (id: string) => void;
}

const DownloadIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
);

const TrashIcon = () => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
);

const ProductionModal: React.FC<ProductionModalProps> = ({ isOpen, onClose, items, onRemoveItem }) => {
  const [config, setConfig] = useState<ExportConfig>({
    format: 'SVG',
    addBridges: true,
    inverted: false, // Default: Laser Cut Mode
    bridgeSizeMm: 0.5,
    sheetWidth: 210, // A4
    sheetHeight: 297,
    itemSize: 50,
    itemHeight: 50,
    spacing: 5,
    pngScale: 2, 
    showLabels: false,
    
    // New Defaults
    plateType: 'SQUARE',
    kerf: 0.0,
    nesting: false,
    cutMarks: false,
    cutPlateOutline: true
  });

  const [svgPreview, setSvgPreview] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'SVG' | 'PNG' | 'PDF'>('SVG');

  useEffect(() => {
    if (isOpen) {
        const svg = generateSheetSVG(items, config);
        setSvgPreview(svg);
    }
  }, [items, config, isOpen]);

  const handleDownload = () => {
      if (!svgPreview || svgPreview.length < 50) return; 

      const blob = new Blob([svgPreview], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      if (exportFormat === 'SVG') {
          const a = document.createElement('a');
          a.href = url;
          a.download = `opticlab_sheet_${new Date().toISOString().slice(0,10)}.svg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } else if (exportFormat === 'PNG') {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const scale = config.pngScale || 2;
              const pxPerMm = 3.7795 * scale;
              canvas.width = config.sheetWidth * pxPerMm;
              canvas.height = config.sheetHeight * pxPerMm;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  // White BG for PNG always easier to read, unless 'Inverted' then black is good?
                  // User requested "White for Print/Neg".
                  if (config.inverted) {
                      ctx.fillStyle = 'white'; // Paper
                      ctx.fillRect(0,0, canvas.width, canvas.height);
                  } else {
                      // Laser preview usually transparent, but for PNG export let's use white for visibility 
                      // or standard transparent? Let's use transparent for versatility.
                      ctx.clearRect(0,0, canvas.width, canvas.height);
                  }
                  
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  const pngUrl = canvas.toDataURL('image/png');
                  const a = document.createElement('a');
                  a.href = pngUrl;
                  a.download = `opticlab_sheet_${new Date().toISOString().slice(0,10)}.png`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
              }
              URL.revokeObjectURL(url);
          };
          img.src = url;
      } else if (exportFormat === 'PDF') {
          const doc = new jsPDF({
              orientation: config.sheetWidth > config.sheetHeight ? 'l' : 'p',
              unit: 'mm',
              format: [config.sheetWidth, config.sheetHeight]
          });
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const scale = 3; 
              const pxPerMm = 3.7795 * scale;
              canvas.width = config.sheetWidth * pxPerMm;
              canvas.height = config.sheetHeight * pxPerMm;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  ctx.fillStyle = 'white'; // PDF page usually white
                  ctx.fillRect(0,0, canvas.width, canvas.height);
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  const imgData = canvas.toDataURL('image/jpeg', 0.95);
                  doc.addImage(imgData, 'JPEG', 0, 0, config.sheetWidth, config.sheetHeight);
                  doc.save(`opticlab_sheet_${new Date().toISOString().slice(0,10)}.pdf`);
              }
              URL.revokeObjectURL(url);
          };
          img.src = url;
      }
  };

  const handleZipExport = async () => {
      if (items.length === 0) return;
      const zip = new JSZip();
      const folder = zip.folder("opticlab_plates");
      
      items.forEach((item, index) => {
          const svg = generateBlueprintSVG(item.aperture, item.camera, {
              ...config,
              itemSize: config.itemSize || 0,
              spacing: 0
          });
          const safeName = item.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          folder?.file(`${index+1}_${safeName}_${item.aperture.type}.svg`, svg);
      });
      
      const content = await zip.generateAsync({type: "blob"});
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opticlab_batch_${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const downloadSingle = (item: ProductionItem) => {
      const svg = generateBlueprintSVG(item.aperture, item.camera, {
          ...config,
          itemSize: config.itemSize || 0,
          spacing: 0
      });
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opticlab_${item.name.replace(/\s+/g, '_')}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0a0a0a] border border-white/10 w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex overflow-hidden">
        
        {/* LEFT: Configuration & List */}
        <div className="w-80 border-r border-white/10 flex flex-col bg-white/5 shrink-0">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-sm font-bold text-science-400 uppercase tracking-widest">OpticFab Queue</h2>
                <div className="flex gap-2">
                    <button onClick={handleZipExport} className="text-[9px] bg-science-900/30 text-science-300 hover:bg-science-900/50 px-2 py-1 rounded border border-science-800/30 transition-colors uppercase font-bold" title="Download all as ZIP">ZIP</button>
                    <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-1 rounded border border-white/10">{items.length}</span>
                </div>
            </div>

            {/* Config Form */}
            <div className="p-4 border-b border-white/10 space-y-4 overflow-y-auto max-h-[50vh]">
                
                {/* 1. Manufacturing Mode */}
                <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold block mb-2">Process</label>
                    <div className="flex bg-black/40 p-1 rounded border border-white/10">
                        <button 
                            onClick={() => setConfig({...config, inverted: false, addBridges: true})}
                            className={`flex-1 py-1.5 text-[10px] rounded transition-all font-bold ${!config.inverted ? 'bg-red-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            LASER CUT
                        </button>
                        <button 
                            onClick={() => setConfig({...config, inverted: true, addBridges: false})}
                            className={`flex-1 py-1.5 text-[10px] rounded transition-all font-bold ${config.inverted ? 'bg-white text-black shadow' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            PRINT / NEG
                        </button>
                    </div>
                </div>

                {/* 2. Plate Setup */}
                <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold block mb-2">Plate Geometry</label>
                    <div className="flex gap-2 mb-2">
                        <button onClick={() => setConfig({...config, plateType: 'SQUARE'})} className={`flex-1 py-1 text-[9px] border rounded ${config.plateType==='SQUARE' ? 'bg-white/10 border-white text-white' : 'border-white/10 text-gray-500'}`}>SQUARE</button>
                        <button onClick={() => setConfig({...config, plateType: 'RECT'})} className={`flex-1 py-1 text-[9px] border rounded ${config.plateType==='RECT' ? 'bg-white/10 border-white text-white' : 'border-white/10 text-gray-500'}`}>RECT</button>
                        <button onClick={() => setConfig({...config, plateType: 'CIRCLE'})} className={`flex-1 py-1 text-[9px] border rounded ${config.plateType==='CIRCLE' ? 'bg-white/10 border-white text-white' : 'border-white/10 text-gray-500'}`}>CIRCLE</button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[9px] text-gray-500 block mb-1">{config.plateType === 'CIRCLE' ? 'Diameter' : 'Width'} (mm)</label>
                            <input type="number" value={config.itemSize} onChange={e => setConfig({...config, itemSize: parseFloat(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white" />
                        </div>
                        {config.plateType === 'RECT' && (
                            <div>
                                <label className="text-[9px] text-gray-500 block mb-1">Height (mm)</label>
                                <input type="number" value={config.itemHeight || config.itemSize} onChange={e => setConfig({...config, itemHeight: parseFloat(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white" />
                            </div>
                        )}
                        <div>
                            <label className="text-[9px] text-gray-500 block mb-1">Kerf (mm)</label>
                            <input type="number" step="0.01" value={config.kerf} onChange={e => setConfig({...config, kerf: parseFloat(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-amber-200 border-amber-900/30" />
                        </div>
                    </div>
                </div>

                {/* 3. Sheet Layout */}
                <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold block mb-2">Sheet Layout</label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                            <label className="text-[9px] text-gray-500 block mb-1">Sheet W</label>
                            <input type="number" value={config.sheetWidth} onChange={e => setConfig({...config, sheetWidth: parseFloat(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white" />
                        </div>
                        <div>
                            <label className="text-[9px] text-gray-500 block mb-1">Sheet H</label>
                            <input type="number" value={config.sheetHeight} onChange={e => setConfig({...config, sheetHeight: parseFloat(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white" />
                        </div>
                        <div>
                            <label className="text-[9px] text-gray-500 block mb-1">Spacing</label>
                            <input type="number" value={config.spacing} onChange={e => setConfig({...config, spacing: parseFloat(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white" />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer bg-black/20 p-1.5 rounded border border-white/5 hover:border-white/10">
                            <input type="checkbox" checked={config.nesting} onChange={e => setConfig({...config, nesting: e.target.checked})} className="accent-science-500" />
                            <span className="text-[10px] text-gray-300 font-bold uppercase">Auto-Nest {config.plateType === 'CIRCLE' && '(Hex)'}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-black/20 p-1.5 rounded border border-white/5 hover:border-white/10">
                            <input type="checkbox" checked={config.cutPlateOutline} onChange={e => setConfig({...config, cutPlateOutline: e.target.checked})} className="accent-science-500" />
                            <span className="text-[10px] text-gray-300 font-bold uppercase">Cut Plate Outline</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-black/20 p-1.5 rounded border border-white/5 hover:border-white/10">
                            <input type="checkbox" checked={config.cutMarks} onChange={e => setConfig({...config, cutMarks: e.target.checked})} className="accent-science-500" />
                            <span className="text-[10px] text-gray-300 font-bold uppercase">Add Sheet Crop Marks</span>
                        </label>
                    </div>
                </div>

                {/* 4. Options */}
                <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold block mb-2">Options</label>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer bg-black/20 p-1.5 rounded border border-white/5 hover:border-white/10">
                            <input type="checkbox" checked={config.showLabels} onChange={e => setConfig({...config, showLabels: e.target.checked})} className="accent-science-500" />
                            <span className="text-[10px] text-gray-300 font-bold uppercase">Include Labels</span>
                        </label>
                        {!config.inverted && (
                            <div>
                                <label className="text-[9px] text-gray-500 uppercase block mb-1">Bridge Size (mm)</label>
                                <input type="number" step="0.1" value={config.bridgeSizeMm} onChange={e => setConfig({...config, bridgeSizeMm: parseFloat(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Queue List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {items.length === 0 && (
                    <div className="text-center py-10 text-gray-600 text-xs italic">Queue is empty.</div>
                )}
                {items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-black/20 p-2 rounded border border-white/5 group hover:border-science-500/30 transition-colors">
                        <div className="overflow-hidden mr-2">
                            <div className="text-xs font-bold text-gray-300 truncate">{item.name}</div>
                            <div className="text-[10px] text-gray-500 font-mono truncate">{item.aperture.type} • {item.aperture.diameter}mm</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => downloadSingle(item)} className="text-gray-500 hover:text-science-400 p-1 rounded hover:bg-white/5" title="Export this item">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </button>
                            <button onClick={() => onRemoveItem(item.id)} className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-white/5" title="Remove">
                                <TrashIcon />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* RIGHT: Preview & Actions */}
        <div className="flex-1 flex flex-col bg-[#111] relative h-full">
            {/* Header Toolbar */}
            <div className="shrink-0 flex justify-between items-center p-4 bg-white/5 border-b border-white/10">
                <div className="flex items-center gap-4">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Sheet Export Format:</span>
                    <div className="flex bg-black/40 p-1 rounded border border-white/10">
                        {['SVG', 'PNG', 'PDF'].map((fmt) => (
                            <button 
                                key={fmt}
                                onClick={() => setExportFormat(fmt as any)}
                                className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${exportFormat === fmt ? 'bg-science-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                {fmt}
                            </button>
                        ))}
                    </div>
                </div>
                <button className="text-[10px] text-red-400 hover:text-red-300 underline" onClick={() => items.forEach(i => onRemoveItem(i.id))}>Clear All</button>
            </div>

            {/* Scrollable Preview Area */}
            {/* Fix: removed items-center/justify-center, added m-auto to child */}
            <div className={`flex-1 overflow-auto flex p-8 relative ${config.inverted ? 'bg-gray-200' : 'bg-black'}`}>
                <div 
                    className="shadow-2xl transition-all duration-500 origin-center relative border border-gray-500/20 m-auto"
                    style={{ 
                        width: `${config.sheetWidth}mm`, 
                        height: `${config.sheetHeight}mm`,
                        minWidth: `${config.sheetWidth}mm`,
                        minHeight: `${config.sheetHeight}mm`,
                        // If Inverted (Print): White BG. If Laser: Black/Dark BG.
                        backgroundColor: config.inverted ? 'white' : '#050505'
                    }}
                    dangerouslySetInnerHTML={{ __html: svgPreview }}
                />
            </div>
            
            {/* Footer Action Bar */}
            <div className="shrink-0 p-4 bg-black border-t border-white/10 flex items-center justify-between z-10 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
                <div className="text-[10px] text-gray-500 font-mono flex gap-3">
                    <span>SHEET: {config.sheetWidth}x{config.sheetHeight}mm</span>
                    <span className={config.inverted ? 'text-white' : 'text-red-400'}>{config.inverted ? 'PRINT (INVERTED)' : 'LASER CUT'}</span>
                    {config.kerf > 0 && <span className="text-amber-500">KERF: {config.kerf}mm</span>}
                </div>
                <div className="flex gap-2 justify-center absolute left-1/2 -translate-x-1/2">
                     <button onClick={onClose} className="px-6 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold border border-white/10 transition-colors">
                        CLOSE LAB
                    </button>
                    <button onClick={handleDownload} className="px-6 py-2 rounded-lg bg-science-600 hover:bg-science-500 text-white text-xs font-bold shadow-lg shadow-science-900/50 flex items-center gap-2 transition-colors">
                        <DownloadIcon /> EXPORT SHEET ({exportFormat})
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionModal;
