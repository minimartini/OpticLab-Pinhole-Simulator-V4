
import React, { useState, useEffect } from 'react';
import { CameraConfig, ApertureConfig, SimulationResult, CAMERA_PRESETS, EXIFData, WorkerMetadata } from '../types';
import { calculatePinholeExposure } from '../utils/exposureCalculator';

interface CameraLCDProps {
  camera: CameraConfig;
  aperture: ApertureConfig;
  simResult: SimulationResult;
  sourceEXIF: EXIFData | null;
  onConfigClick: () => void;
  simMeta?: WorkerMetadata | null; 
}

const CameraLCD: React.FC<CameraLCDProps> = ({
  camera, aperture, simResult, sourceEXIF, onConfigClick, simMeta
}) => {
  // Manual form visibility
  const [isEditing, setIsEditing] = useState(false);
  
  // Close manual form if a new file is loaded
  useEffect(() => {
      setIsEditing(false);
  }, [sourceEXIF]);

  const [manualEXIF, setManualEXIF] = useState<Required<EXIFData>>({
    fNumber: 8.0,
    exposureTime: 1/125,
    iso: 100,
    focalLength: 50,
    make: '',
    model: ''
  });

  // Determine active data: Source EXIF > Manual Defaults
  // If we are editing, we are looking at/modifying manual values, but we might want to initialize them from source?
  // Simpler: If sourceEXIF exists and we are NOT editing, use source.
  // If we start editing, we default to manual values (or could copy source to manual).
  // For this request: "ignore and enter default values" implies if no EXIF, use defaults.
  
  const effectiveEXIF: Required<EXIFData> = {
      fNumber: (sourceEXIF && !isEditing) ? (sourceEXIF.fNumber || 8) : manualEXIF.fNumber,
      exposureTime: (sourceEXIF && !isEditing) ? (sourceEXIF.exposureTime || 1/125) : manualEXIF.exposureTime,
      iso: (sourceEXIF && !isEditing) ? (sourceEXIF.iso || 100) : manualEXIF.iso,
      focalLength: (sourceEXIF && !isEditing) ? (sourceEXIF.focalLength || 50) : manualEXIF.focalLength,
      make: sourceEXIF?.make || '',
      model: sourceEXIF?.model || ''
  };

  // Safe Calculation
  let exposure = null;
  if (effectiveEXIF.fNumber > 0 && effectiveEXIF.exposureTime > 0 && effectiveEXIF.iso > 0) {
      exposure = calculatePinholeExposure(effectiveEXIF, camera, aperture, simResult);
  }

  const currentPreset = CAMERA_PRESETS.find(p => p.id === camera.modelName);

  return (
    <div className="border-2 border-white/20 rounded-xl bg-gradient-to-br from-zinc-900 to-black overflow-hidden shadow-2xl mb-4">
      {/* Top Bar */}
      <div className="bg-black/60 backdrop-blur-sm px-3 py-2 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-[10px] font-bold text-gray-400 tracking-widest font-mono uppercase">
            {currentPreset?.name || 'CUSTOM'} <span className="text-science-400">{camera.focalLength}mm</span>
          </span>
        </div>
        <button 
          onClick={onConfigClick}
          className="text-gray-500 hover:text-science-400 transition-colors"
          title="Configure Camera Body"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* LCD Screen */}
      <div className="p-4 bg-gradient-to-b from-[#3d4d3d] to-[#2a3a2a] font-mono shadow-inner min-h-[140px] flex flex-col justify-center">
        
        {/* Manual Entry Form */}
        {isEditing && (
          <div className="mb-3 p-2 bg-black/40 rounded space-y-2 border border-black/20 shadow-inner">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[7px] text-[#90b090] block mb-1 uppercase font-bold">Aperture (f/)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={manualEXIF.fNumber || ''}
                  onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setManualEXIF(p => ({...p, fNumber: isNaN(val) ? 0 : val}));
                  }}
                  className="w-full bg-black/50 border border-[#b8d4b8]/30 rounded px-1 py-1 text-xs text-[#d4f4d4] focus:outline-none focus:border-[#b8d4b8] text-center"
                />
              </div>
              <div>
                <label className="text-[7px] text-[#90b090] block mb-1 uppercase font-bold">Shutter (1/s)</label>
                <input 
                  type="number"
                  placeholder="125"
                  // Show inverse for editing convenience if < 1
                  defaultValue={manualEXIF.exposureTime < 1 ? Math.round(1/manualEXIF.exposureTime) : manualEXIF.exposureTime}
                  onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      // Assume user enters denominator for fractions (e.g. 125 for 1/125) unless very small
                      if (!isNaN(val) && val !== 0) {
                          setManualEXIF(p => ({...p, exposureTime: val > 30 ? 1/val : val})); // heuristic
                      }
                  }}
                  className="w-full bg-black/50 border border-[#b8d4b8]/30 rounded px-1 py-1 text-xs text-[#d4f4d4] focus:outline-none focus:border-[#b8d4b8] text-center"
                />
              </div>
              <div>
                <label className="text-[7px] text-[#90b090] block mb-1 uppercase font-bold">ISO</label>
                <input 
                  type="number"
                  value={manualEXIF.iso || ''}
                  onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setManualEXIF(p => ({...p, iso: isNaN(val) ? 0 : val}));
                  }}
                  className="w-full bg-black/50 border border-[#b8d4b8]/30 rounded px-1 py-1 text-xs text-[#d4f4d4] focus:outline-none focus:border-[#b8d4b8] text-center"
                />
              </div>
            </div>
          </div>
        )}

        {/* Display Data */}
        <div className="mb-3">
            <div className="flex justify-between items-end mb-2 border-b border-[#b8d4b8]/20 pb-1">
                <div className="text-[9px] text-[#90b090] tracking-wide opacity-80 flex items-center gap-1">
                    {sourceEXIF && !isEditing ? "ORIGINAL SCENE METERING" : "MANUAL METERING"}
                </div>
                <button 
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-[9px] text-[#b8d4b8] hover:text-[#e4ffe4] hover:bg-[#b8d4b8]/20 px-1.5 py-0.5 rounded transition-colors uppercase tracking-wider font-bold"
                >
                    {isEditing ? 'DONE' : 'EDIT'}
                </button>
            </div>
            
            <div className={`flex items-baseline justify-between text-[#d4f4d4] font-mono transition-opacity ${isEditing ? 'opacity-50 blur-[1px]' : 'opacity-100'}`}>
                <span className="text-xl font-bold">f/{effectiveEXIF.fNumber?.toFixed(1)}</span>
                <span className="text-sm">
                    {effectiveEXIF.exposureTime! < 1 
                    ? `1/${Math.round(1/effectiveEXIF.exposureTime!)}`
                    : `${effectiveEXIF.exposureTime}s`
                    }
                </span>
                <span className="text-sm">ISO {effectiveEXIF.iso}</span>
            </div>
        </div>

        {/* Calculated Pinhole Equivalent */}
        {exposure ? (
            <div className="animate-fadeIn">
            <div className="text-[9px] text-[#b8d4b8] mb-1 tracking-wide flex items-center gap-2 opacity-80 border-b border-[#b8d4b8]/20 pb-1">
                PINHOLE EQUIVALENT
            </div>
            <div className="flex items-baseline justify-between text-[#e4ffe4] mb-2 mt-2">
                <span className="text-xl font-bold">T/{exposure.pinholeT.toFixed(0)}</span>
                <span className="text-lg font-bold text-[#ffb8b8]">
                {exposure.pinholeTimeDisplay}
                </span>
                <span className="text-sm">ISO {camera.iso}</span>
            </div>

            {/* Reciprocity Failure */}
            {exposure.reciprocityDisplay && (
                <div className="bg-amber-900/20 border border-amber-700/30 rounded p-2 mb-2">
                <div className="text-[9px] text-amber-400 mb-1 flex items-center gap-1 font-bold">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    RECIPROCITY FAILURE (FILM)
                </div>
                <div className="text-xs text-amber-200">
                    Corrected Time: <span className="font-bold text-amber-100">{exposure.reciprocityDisplay}</span>
                </div>
                </div>
            )}

            {/* Warning Messages */}
            {exposure.warningMessage && (
                <div className="bg-red-900/20 border border-red-700/30 rounded p-2 text-[9px] text-red-300 flex items-start gap-2">
                    <span className="text-lg leading-3">⚠</span>
                    {exposure.warningMessage}
                </div>
            )}
            </div>
        ) : (
            <div className="text-center py-2 text-[#90b090] text-[10px] opacity-50 italic">
                INVALID PARAMETERS
            </div>
        )}
      </div>

      {/* Bottom Info Bar */}
      <div className="bg-black/60 px-3 py-1.5 flex justify-between items-center text-[8px] font-mono border-t border-white/10">
        <span className="text-gray-500">SENSOR: {camera.sensorWidth}×{camera.sensorHeight}mm</span>
        {simMeta ? (
            <span className="text-cyan-400 font-bold flex gap-1">
                WAVE: {simMeta.method === 'ASM' ? 'NEAR FIELD (ASM)' : 'FAR FIELD (FRESNEL)'}
            </span>
        ) : (
            <span className={simResult.isDiffractionLimited ? 'text-amber-500' : 'text-science-400'}>
              {simResult.isDiffractionLimited ? 'DIFFRACTION LIMITED' : 'GEOMETRY LIMITED'}
            </span>
        )}
      </div>
    </div>
  );
};

export default CameraLCD;
