
import React from 'react';
import { CameraConfig, ApertureConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  camera: CameraConfig;
  setCamera: React.Dispatch<React.SetStateAction<CameraConfig>>;
  aperture: ApertureConfig;
  setAperture: React.Dispatch<React.SetStateAction<ApertureConfig>>;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, onClose, camera, setCamera, aperture, setAperture 
}) => {
  if (!isOpen) return null;

  const updateAp = (k: keyof ApertureConfig, v: any) => setAperture(p => ({ ...p, [k]: v }));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const updateCam = (k: keyof CameraConfig, v: any) => setCamera(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0a0a0a] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
            <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest flex items-center gap-2">
                <svg className="w-4 h-4 text-science-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                Advanced Configuration
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
            
            {/* Simulation Resolution */}
            <section>
                <h3 className="text-science-400 text-xs font-bold uppercase mb-3 border-b border-white/10 pb-1">Simulation Quality</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500 block mb-2 tracking-wide font-display">Output Resolution</label>
                        <div className="flex bg-black/40 p-1 rounded border border-white/10">
                            {[512, 1024, 2048].map((res) => (
                                <button 
                                    key={res}
                                    onClick={() => updateAp('resolution', res)}
                                    className={`flex-1 py-2 text-[10px] rounded transition-all font-mono font-bold ${aperture.resolution === res ? 'bg-science-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    {res}px
                                </button>
                            ))}
                        </div>
                        <div className="text-[9px] text-gray-500 mt-2 italic">
                            <span className="text-amber-500 font-bold">Note:</span> 2048px provides 4x detail but is significantly slower and memory intensive. Recommended for final export only.
                        </div>
                    </div>
                </div>
            </section>

            {/* Optical Effects */}
            <section>
                <h3 className="text-science-400 text-xs font-bold uppercase mb-3 border-b border-white/10 pb-1">Optical Effects</h3>
                
                <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 rounded border border-white/5 hover:border-white/20 transition-all">
                        <div className="relative"><input type="checkbox" checked={aperture.useChromaticAberration} onChange={e => updateAp('useChromaticAberration', e.target.checked)} className="sr-only peer" /><div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-science-600"></div></div>
                        <div>
                            <span className="text-xs font-bold text-gray-200 block">Chromatic Aberration</span>
                            <span className="text-[10px] text-gray-500 block leading-tight mt-0.5">Simulate wavelength-dependent diffraction (rainbow fringes). <span className="text-amber-500 font-bold">3x Slower.</span></span>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 rounded border border-white/5 hover:border-white/20 transition-all">
                        <div className="relative"><input type="checkbox" checked={aperture.useVignetting} onChange={e => updateAp('useVignetting', e.target.checked)} className="sr-only peer" /><div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-science-600"></div></div>
                        <div>
                            <span className="text-xs font-bold text-gray-200 block">Optical Vignetting</span>
                            <span className="text-[10px] text-gray-500 block leading-tight mt-0.5">Apply Cos⁴ light falloff towards the image corners. Physically accurate for flat sensors.</span>
                        </div>
                    </label>
                    
                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 rounded border border-white/5 hover:border-white/20 transition-all">
                        <div className="relative"><input type="checkbox" checked={aperture.addSensorNoise} onChange={e => updateAp('addSensorNoise', e.target.checked)} className="sr-only peer" /><div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-science-600"></div></div>
                        <div>
                            <span className="text-xs font-bold text-gray-200 block">Simulate Sensor Noise</span>
                            <span className="text-[10px] text-gray-500 block leading-tight mt-0.5">Add photon shot noise based on ISO sensitivity settings.</span>
                        </div>
                    </label>
                </div>
            </section>
        </div>
        
        <div className="p-4 border-t border-white/10 bg-black/20 text-center">
            <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-6 py-2 rounded-lg transition-colors border border-white/5 w-full uppercase tracking-widest">
                Return to Lab
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
