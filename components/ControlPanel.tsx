
import React, { useState, useEffect, useRef } from 'react';
import { CameraConfig, ApertureConfig, ApertureType, SimulationResult, CAMERA_PRESETS, MultiDotPattern, ProductionItem, EXIFData, WorkerMetadata } from '../types';
import AperturePreview from './AperturePreview';
import ProductionModal from './ProductionModal';
import SettingsModal from './SettingsModal';
import CameraLCD from './CameraLCD';
import { PHYSICS_CONSTANTS } from '../utils/physics';
import { generateBlueprintSVG } from '../utils/export';

interface ControlPanelProps {
  camera: CameraConfig;
  setCamera: React.Dispatch<React.SetStateAction<CameraConfig>>;
  aperture: ApertureConfig;
  setAperture: React.Dispatch<React.SetStateAction<ApertureConfig>>;
  simResult: SimulationResult;
  isProcessing: boolean;
  onSimulate: () => void;
  onCancel: () => void; 
  exposure: number;
  setExposure: (n: number) => void;
  sourceIntensity: number; 
  setSourceIntensity: (n: number) => void;
  subjectDistance: number;
  setSubjectDistance: (n: number) => void;
  sourceEXIF: EXIFData | null;
  simMeta?: WorkerMetadata | null; 
}

// Icons
const ChevronDown = ({className}: {className?: string}) => <svg className={`w-3 h-3 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
const ChevronUp = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>;
const ApertureIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>; 
const PlusIcon = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const GearIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const CubeIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
const InfoIcon = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const UploadIcon = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
const ClipboardIcon = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
const CheckIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
const DesignIcon = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>;
const DownloadIconSmall = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;


// --- CURVE PRESETS ---
const CURVE_PRESETS: (Partial<ApertureConfig> & { name: string })[] = [
    { name: "Lissajous: Figure 8", type: ApertureType.LISSAJOUS, lissajousRX: 1, lissajousRY: 2, lissajousDelta: 90 },
    { name: "Lissajous: Knot (3:2)", type: ApertureType.LISSAJOUS, lissajousRX: 3, lissajousRY: 2, lissajousDelta: 90 },
    { name: "Spiral: Galaxy (Multi-Arm)", type: ApertureType.SPIRAL, spiralArms: 3, spiralTurns: 2 },
    { name: "Ripple: Flower (5 Petal)", type: ApertureType.ROSETTE, rosettePetals: 5, slitHeight: 2.0 },
];

// --- UI COMPONENTS ---
const PanelModule: React.FC<{ 
    title: string; 
    icon?: React.ReactNode; 
    children: React.ReactNode; 
    isOpen?: boolean;
    onToggle?: () => void;
    className?: string;
    action?: React.ReactNode;
}> = ({ title, icon, children, isOpen, onToggle, className = "", action }) => (
    <div className={`border border-white/5 rounded-xl bg-zinc-900/90 shadow-lg overflow-hidden mb-4 transition-all duration-300 backdrop-blur-md ${className}`}>
        {onToggle ? (
            <button onClick={onToggle} className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-2 text-science-400">
                    {icon}
                    <span className="text-xs font-bold tracking-widest uppercase text-gray-300 font-display">{title}</span>
                </div>
                <div className="flex items-center gap-2">
                    {action}
                    <div className="text-gray-500">{isOpen ? <ChevronUp /> : <ChevronDown />}</div>
                </div>
            </button>
        ) : (
            <div className="flex items-center justify-between p-3 border-b border-white/5 bg-black/20">
                <div className="flex items-center gap-2">
                    <div className="text-science-400">{icon}</div>
                    <span className="text-xs font-bold tracking-widest uppercase text-gray-300 font-display">{title}</span>
                </div>
                {action}
            </div>
        )}
        {(isOpen === undefined || isOpen) && <div className="p-4 space-y-4">{children}</div>}
    </div>
);

const HybridInput: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (val: number) => void;
    unit?: string;
    disabled?: boolean;
    logarithmic?: boolean;
    defaultValue?: number;
}> = ({ label, value, min, max, step, onChange, unit, disabled, logarithmic, defaultValue }) => {
    const toLog = (val: number) => Math.log10(Math.max(1, val));
    const fromLog = (val: number) => Math.pow(10, val);
    const sliderValue = logarithmic ? toLog(value) : value;
    const sliderMin = logarithmic ? toLog(min) : min;
    const sliderMax = logarithmic ? toLog(max) : max;
    const sliderStep = logarithmic ? 0.01 : step;

    const handleDoubleClick = () => {
        if (defaultValue !== undefined) onChange(defaultValue);
    };

    return (
        <div className={`space-y-1 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wide font-display">{label}</label>
            </div>
            <div className="flex items-center gap-2">
                <input 
                    type="range" min={sliderMin} max={sliderMax} step={sliderStep} value={sliderValue} 
                    onChange={e => { const v = parseFloat(e.target.value); onChange(logarithmic ? fromLog(v) : v); }} 
                    onDoubleClick={handleDoubleClick}
                    title={defaultValue !== undefined ? `Double-click to reset to ${defaultValue}` : undefined}
                    disabled={disabled}
                    className="flex-grow accent-science-500 h-1 bg-gray-800 rounded-full appearance-none cursor-pointer hover:bg-gray-700 transition-colors disabled:opacity-50" 
                />
                <div className="relative w-16">
                    <input 
                        type="number" 
                        value={parseFloat(value.toFixed(4))}
                        onChange={(e) => { const val = parseFloat(e.target.value); if (!isNaN(val)) onChange(val); }}
                        disabled={disabled}
                        className="w-full bg-black/40 border border-white/10 rounded px-1.5 py-1 text-right text-xs font-mono text-science-400 focus:border-science-500 outline-none disabled:text-gray-500"
                    />
                    {unit && <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[9px] text-gray-600 pointer-events-none">{unit}</span>}
                </div>
            </div>
        </div>
    );
};

const SelectControl: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <div className="relative group">
        <select {...props} className={`w-full appearance-none bg-black/40 border border-white/10 text-gray-200 text-xs rounded p-2 outline-none focus:border-science-500/50 focus:ring-1 focus:ring-science-500/20 transition-all ${props.className}`} />
        <div className="absolute right-2 top-2.5 pointer-events-none text-gray-500 group-hover:text-science-400"><ChevronDown /></div>
    </div>
);

// --- 3D Neon Toggle Switch ---
const ProSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
    <div className="flex items-center gap-3 select-none">
        {/* Fixed Width Label Container to prevent jitter */}
        <div className="w-6 flex justify-end">
            <span className={`text-[10px] font-bold font-display tracking-widest transition-all duration-500 ${checked ? 'text-science-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]' : 'text-gray-600'}`}>
                PRO
            </span>
        </div>
        <button 
            onClick={() => onChange(!checked)}
            className="relative w-11 h-6 bg-[#09090b] rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.05)] border border-white/5 transition-colors cursor-pointer group focus:outline-none overflow-hidden"
            title="Toggle Professional Mode"
        >
            {/* Subtle Texture for Track */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:3px_3px]"></div>
            
            {/* Thumb */}
            <div 
                className={`absolute top-[3px] left-[3px] w-[16px] h-[16px] rounded-full shadow-md transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                    checked 
                    ? 'translate-x-5 bg-science-400 shadow-[0_0_12px_2px_rgba(56,189,248,0.6),inset_0_1px_4px_rgba(255,255,255,0.9)] border-none' 
                    : 'translate-x-0 bg-gradient-to-b from-zinc-500 to-zinc-700 border border-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.5)] group-hover:from-zinc-400 group-hover:to-zinc-600'
                }`}
            >
                {/* Physical nib detail */}
                {!checked && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-zinc-800/40 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]"></div>}
            </div>
        </button>
    </div>
);

const ControlPanel: React.FC<ControlPanelProps> = ({
  camera, setCamera, aperture, setAperture, simResult, isProcessing, onSimulate, onCancel, exposure, setExposure, sourceIntensity, setSourceIntensity, sourceEXIF, simMeta
}) => {
  const [isProductionOpen, setIsProductionOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false); 
  const [isCameraConfigOpen, setIsCameraConfigOpen] = useState(false); 
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
  const [targetEquiv, setTargetEquiv] = useState(35); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateCam = (k: keyof CameraConfig, v: any) => setCamera(p => ({ ...p, [k]: v }));
  
  // Custom aperture update that handles conditional resets (Spider Vanes)
  const updateAp = (k: keyof ApertureConfig, v: any) => {
      setAperture(prev => {
          const next = { ...prev, [k]: v };
          return next;
      });
  };

  const diag35 = 43.27;
  const diagSensor = Math.sqrt(Math.pow(camera.sensorWidth, 2) + Math.pow(camera.sensorHeight, 2));
  const cropFactor = diagSensor > 0 ? diag35 / diagSensor : 1;

  // --- AUTO-OPTIMIZATION EFFECT ---
  useEffect(() => {
      const lambda = (camera.wavelength || 550) * PHYSICS_CONSTANTS.WAVELENGTH_TO_MM;
      // Global optimal value based on Rayleigh criterion for the current setup
      const optimal = PHYSICS_CONSTANTS.RAYLEIGH_FACTOR * Math.sqrt(camera.focalLength * lambda);
      const optimalVal = parseFloat(optimal.toFixed(3));

      setAperture(prev => {
          const updates: Partial<ApertureConfig> = {};
          switch(prev.type) {
              case ApertureType.PINHOLE:
              case ApertureType.FIBONACCI: 
                  updates.diameter = optimalVal; 
                  break;
              
              case ApertureType.POLYGON:
                  if (prev.polygonType === 'LINED') {
                      updates.slitWidth = optimalVal;
                  }
                  break;

              case ApertureType.MULTI_DOT:
              case ApertureType.RANDOM:
                  // For multi-dots, the optimal resolution element size is the pinhole size
                  updates.diameter = optimalVal;
                  break;

              case ApertureType.SLIT:
              case ApertureType.CROSS:
              case ApertureType.SLIT_ARRAY:
              case ApertureType.WAVES:
              case ApertureType.YIN_YANG:
              case ApertureType.LISSAJOUS:
              case ApertureType.SPIRAL:
              case ApertureType.ROSETTE: 
              case ApertureType.ZIGZAG: 
                  updates.slitWidth = optimalVal; 
                  if (!prev.diameter || prev.diameter < 5) updates.diameter = Math.min(25, diagSensor * 0.8); 
                  break;
              
              case ApertureType.DOT_SLIT: 
                  updates.slitWidth = optimalVal; 
                  updates.innerDiameter = optimalVal; 
                  break;
              
              case ApertureType.ZONE_PLATE:
              case ApertureType.PHOTON_SIEVE: 
                  updates.diameter = parseFloat((2 * Math.sqrt((prev.zones || 10) * lambda * camera.focalLength)).toFixed(3)); 
                  break;
              
              case ApertureType.ANNULAR: 
                  updates.diameter = parseFloat((optimal * 6).toFixed(3)); 
                  updates.innerDiameter = parseFloat((optimal * 4).toFixed(3)); 
                  break;
              
              case ApertureType.URA: 
                  updates.diameter = parseFloat((optimal * (prev.uraRank || 13)).toFixed(3)); 
                  break;
              
              case ApertureType.LITHO_OPC: 
                  updates.slitWidth = parseFloat((optimal * 0.5).toFixed(3)); 
                  updates.diameter = parseFloat((optimal * 4.0).toFixed(3)); 
                  break;
          }
          return { ...prev, ...updates };
      });
  }, [aperture.type, camera.focalLength, camera.wavelength, diagSensor]);

  // Calculate generic optimal diameter for default values prop
  const lambdaVal = (camera.wavelength || 550) * PHYSICS_CONSTANTS.WAVELENGTH_TO_MM;
  const genericOptimal = parseFloat((PHYSICS_CONSTANTS.RAYLEIGH_FACTOR * Math.sqrt(camera.focalLength * lambdaVal)).toFixed(3));

  const handlePresetChange = (id: string) => {
    const p = CAMERA_PRESETS.find(x => x.id === id);
    if (p) {
        const newFocal = Math.max(p.flange + 10, 50); // Default safe focal length
        const lambda = (camera.wavelength || 550) * 1e-6;
        const optimal = PHYSICS_CONSTANTS.RAYLEIGH_FACTOR * Math.sqrt(newFocal * lambda);
        
        setCamera(prev => ({ 
            ...prev, 
            modelName: p.id, 
            focalLength: newFocal, 
            sensorWidth: p.sensorW, 
            sensorHeight: p.sensorH, 
            flangeDistance: p.flange 
        }));
        
        setAperture(prev => ({ ...prev, diameter: parseFloat(optimal.toFixed(3)) }));
    }
  };

  const addToProductionQueue = () => {
      setProductionItems(prev => [...prev, { id: Date.now().toString(), name: `${aperture.type} ${productionItems.length + 1}`, aperture: { ...aperture }, camera: { ...camera } }]);
  };

  const handleCurvePreset = (idxStr: string) => {
      const idx = parseInt(idxStr);
      if (idx >= 0 && idx < CURVE_PRESETS.length) {
          const { name, ...config } = CURVE_PRESETS[idx];
          setAperture(prev => ({ ...prev, ...config }));
      }
  };

  const handleMaskUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => { if (evt.target?.result) updateAp('maskImage', evt.target.result as string); };
      reader.readAsDataURL(file);
  };

  const handlePaste = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) throw new Error("Clipboard API not supported");
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.some(type => type.startsWith('image/'))) {
          const blob = await item.getType(item.types.find(type => type.startsWith('image/'))!);
          const reader = new FileReader();
          reader.onload = (e) => { if(e.target?.result) updateAp('maskImage', e.target.result as string); };
          reader.readAsDataURL(blob);
          return;
        }
      }
      alert("No image found on clipboard");
    } catch (err: any) {
      alert("Clipboard access blocked. Use Import.");
    }
  };

  const optimizeDoubleSlit = () => {
      const optimalWidth = simResult.optimalDiameter;
      const lambdaMm = (camera.wavelength || 550) * 1e-6;
      const f = camera.focalLength;
      const targetFringeSpacing = 0.3; // mm
      const optimalSeparation = (lambdaMm * f) / targetFringeSpacing;
      setAperture(prev => ({ ...prev, slitWidth: parseFloat(optimalWidth.toFixed(4)), spread: parseFloat(optimalSeparation.toFixed(3)), diameter: Math.max(5.0, camera.sensorHeight * 1.1), count: 2 }));
  };

  const exportImmediate = () => {
      const svg = generateBlueprintSVG(aperture, camera, {
          format: 'SVG',
          addBridges: true,
          inverted: false,
          bridgeSizeMm: 0.5,
          sheetWidth: 100, sheetHeight: 100, itemSize: 0, spacing: 0, showLabels: false,
          // Added missing properties to match ExportConfig
          plateType: 'SQUARE',
          kerf: 0,
          nesting: false,
          cutMarks: false,
          cutPlateOutline: false
      });
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opticlab_${aperture.type}_${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const isCustomCamera = camera.modelName === 'custom';
  const currentPreset = CAMERA_PRESETS.find(p => p.id === camera.modelName);
  const isFractalMode = aperture.type === ApertureType.FRACTAL || aperture.type === ApertureType.SIERPINSKI_TRIANGLE;
  const isDotSize = [ApertureType.MULTI_DOT, ApertureType.RANDOM, ApertureType.FIBONACCI].includes(aperture.type);
  const isMathCurve = [ApertureType.LISSAJOUS, ApertureType.SPIRAL, ApertureType.ROSETTE].includes(aperture.type);
  const isPinhole = aperture.type === ApertureType.PINHOLE;
  // REMOVED ApertureType.POLYGON from isTotalDiameter to prevent duplicate sliders
  const isTotalDiameter = [ApertureType.ZONE_PLATE, ApertureType.PHOTON_SIEVE, ApertureType.ANNULAR, ApertureType.STAR, ApertureType.URA, ApertureType.FREEFORM, ApertureType.DIFFRACTION_GRATING].includes(aperture.type);

  const renderApertureSpecifics = () => {
     switch (aperture.type) {
      case ApertureType.POLYGON:
        return ( 
            <div className="space-y-4 pt-2 border-t border-white/5">
                <div>
                  <label className="text-gray-500 text-[10px] uppercase font-bold block mb-1 font-display">Style</label>
                  <SelectControl value={aperture.polygonType || 'FILLED'} onChange={(e) => updateAp('polygonType', e.target.value)}>
                    <option value="FILLED">Solid / Filled</option>
                    <option value="LINED">Wireframe / Line</option>
                  </SelectControl>
                </div>
                {aperture.polygonType === 'LINED' && (
                    <HybridInput label="Line Thickness" value={aperture.slitWidth || 0.2} min={0.01} max={5.0} step={0.01} onChange={v => updateAp('slitWidth', v)} unit="mm" defaultValue={genericOptimal} />
                )}
                <div><label className="text-gray-500 text-[10px] uppercase font-bold block mb-1 font-display">Sides</label><div className="flex bg-black/40 p-1 rounded border border-white/10 gap-1">{[3, 4, 5, 6, 8].map(n => (<button key={n} onClick={() => updateAp('polygonSides', n)} className={`flex-1 py-1 text-[10px] rounded transition-all ${(aperture.polygonSides === n || (!aperture.polygonSides && n === 6)) ? 'bg-science-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>{n}</button>))}</div></div>
                <HybridInput label="Outer Diameter" value={aperture.diameter} min={1.0} max={Math.max(10, diagSensor)} step={0.5} onChange={v => updateAp('diameter', v)} unit="mm" />
                
                {/* Spider Vanes - Moved back to Pro Mode */}
                {isAdvanced && (
                    <div className="p-3 bg-red-900/10 border border-red-900/30 rounded mt-4">
                        <label className="text-[10px] uppercase font-bold text-red-400 block mb-2 tracking-wide font-display">Obstructions (Spider Vanes)</label>
                        <div className="space-y-3">
                            <HybridInput label="Strut Count" value={aperture.spiderVanes || 0} min={0} max={8} step={1} onChange={v => updateAp('spiderVanes', v)} defaultValue={0} />
                            {(aperture.spiderVanes || 0) > 0 && (<>
                                <HybridInput label="Strut Width" value={aperture.spiderWidth || 0.05} min={0.01} max={2.0} step={0.01} onChange={v => updateAp('spiderWidth', v)} unit="mm" defaultValue={genericOptimal} />
                                <HybridInput label="Strut Rotation" value={aperture.spiderRotation || 0} min={0} max={360} step={1} onChange={v => updateAp('spiderRotation', v)} unit="°" defaultValue={0} />
                            </>)}
                        </div>
                    </div>
                )}
            </div> 
        );
      case ApertureType.DIFFRACTION_GRATING:
        return ( <div className="space-y-4 pt-2 border-t border-white/5"><div className="flex justify-between items-center bg-cyan-950/20 p-2 rounded border border-cyan-900/30"><span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wide font-display">Grating Module</span><span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded border border-cyan-500/30">Coarse Simulation</span></div><div><label className="text-gray-500 text-[10px] uppercase font-bold block mb-1 font-display">Orientation</label><SelectControl value={aperture.gratingType || 'VERTICAL'} onChange={(e) => updateAp('gratingType', e.target.value)}><option value="VERTICAL">Vertical Lines</option><option value="HORIZONTAL">Horizontal Lines</option><option value="GRID">Crossed Grid</option></SelectControl></div><HybridInput label="Line Density" value={aperture.gratingDensity || 5} min={0.5} max={20} step={0.5} onChange={v => updateAp('gratingDensity', v)} unit="lines/mm" defaultValue={5} /><HybridInput label="Outer Diameter" value={aperture.diameter} min={1.0} max={Math.max(10, diagSensor)} step={0.5} onChange={v => updateAp('diameter', v)} unit="mm" /></div> );
      case ApertureType.ZONE_PLATE:
      case ApertureType.PHOTON_SIEVE:
        return ( <div className="space-y-4 pt-2 border-t border-white/5"><HybridInput label="Number of Zones" value={aperture.zones || 10} min={1} max={50} step={1} onChange={v => updateAp('zones', v)} defaultValue={10} /></div> );
      case ApertureType.SLIT:
      case ApertureType.CROSS:
        return ( <div className="space-y-4 pt-2 border-t border-white/5"><HybridInput label="Line Thickness" value={aperture.slitWidth || 0.2} min={0.01} max={5.0} step={0.01} onChange={v => updateAp('slitWidth', v)} unit="mm" defaultValue={genericOptimal} /><button onClick={() => updateAp('slitWidth', parseFloat(simResult.optimalDiameter.toFixed(3)))} className="w-full bg-science-950/40 text-science-400 border border-science-900/50 py-1.5 text-[10px] rounded hover:bg-science-900/60 transition-colors uppercase font-medium tracking-wide">Set Optimal: {simResult.optimalDiameter.toFixed(3)}mm</button><HybridInput label="Length / Size" value={aperture.diameter} min={1.0} max={Math.max(10, diagSensor)} step={0.5} onChange={v => updateAp('diameter', v)} unit="mm" /></div> );
      case ApertureType.ZIGZAG:
        return ( 
            <div className="space-y-4 pt-2 border-t border-white/5">
                <HybridInput label="Line Thickness" value={aperture.slitWidth || 0.2} min={0.01} max={5.0} step={0.01} onChange={v => updateAp('slitWidth', v)} unit="mm" defaultValue={genericOptimal} />
                <HybridInput label="Segments" value={aperture.count || 5} min={1} max={50} step={1} onChange={v => updateAp('count', v)} defaultValue={5} />
                <HybridInput label="Amplitude" value={aperture.slitHeight || 2.0} min={0.1} max={Math.max(10, diagSensor)} step={0.1} onChange={v => updateAp('slitHeight', v)} unit="mm" />
                <HybridInput label="Width" value={aperture.diameter} min={1.0} max={Math.max(10, diagSensor)} step={0.5} onChange={v => updateAp('diameter', v)} unit="mm" />
            </div> 
        );
      case ApertureType.DOT_SLIT:
        return ( <div className="space-y-4 pt-2 border-t border-white/5"><HybridInput label="Dot Diameter" value={aperture.innerDiameter || 0.2} min={0.01} max={3.0} step={0.01} onChange={v => updateAp('innerDiameter', v)} unit="mm" defaultValue={genericOptimal} /><HybridInput label="Slit Thickness" value={aperture.slitWidth || 0.2} min={0.01} max={3.0} step={0.01} onChange={v => updateAp('slitWidth', v)} unit="mm" defaultValue={genericOptimal} /><HybridInput label="Slit Length" value={aperture.diameter} min={1.0} max={20.0} step={0.5} onChange={v => updateAp('diameter', v)} unit="mm" /><HybridInput label="Separation" value={aperture.spread || 1.0} min={0.1} max={20.0} step={0.1} onChange={v => updateAp('spread', v)} unit="mm" /></div> );
      case ApertureType.SLIT_ARRAY:
          return ( <div className="space-y-4 pt-2 border-t border-white/5"><div className="flex justify-between items-center bg-cyan-950/20 p-2 rounded border border-cyan-900/30"><span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wide font-display">Young's Setup</span><button onClick={optimizeDoubleSlit} className="text-[9px] bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded hover:bg-cyan-500/30 border border-cyan-500/30 transition-colors">Auto-Optimize</button></div><HybridInput label="Slit Count" value={aperture.count || 2} min={2} max={20} step={1} onChange={v => updateAp('count', v)} defaultValue={2} /><div className="space-y-2"><HybridInput label="Slit Width" value={aperture.slitWidth || 0.1} min={0.005} max={2.0} step={0.005} onChange={v => updateAp('slitWidth', v)} unit="mm" defaultValue={genericOptimal} /><button onClick={() => updateAp('slitWidth', parseFloat(simResult.optimalDiameter.toFixed(3)))} className="w-full bg-white/5 text-science-400 border border-white/10 py-1 text-[9px] rounded hover:bg-white/10 transition-colors uppercase">Optimal Width: {simResult.optimalDiameter.toFixed(3)}mm</button></div><HybridInput label="Separation" value={aperture.spread || 0.5} min={0.05} max={Math.min(20, diagSensor)} step={0.05} onChange={v => updateAp('spread', v)} unit="mm" /><HybridInput label="Total Height" value={aperture.diameter} min={1.0} max={Math.max(10, diagSensor)} step={0.5} onChange={v => updateAp('diameter', v)} unit="mm" /></div> );
      case ApertureType.URA: return ( <div className="space-y-4 pt-2 border-t border-white/5"><div className="bg-science-900/10 border border-science-900/30 p-2 rounded text-[9px] text-science-200"><strong className="block text-science-400 mb-1 flex items-center gap-1"><InfoIcon /> Coded Aperture</strong>Uniformly Redundant Arrays allow X-ray/Gamma imaging.</div><div><div className="flex justify-between mb-1"><label className="text-[10px] uppercase font-bold text-gray-500 font-display">URA Rank (Prime)</label><span className="font-mono text-xs text-science-400">{aperture.uraRank || 13}</span></div><input type="range" min="0" max="5" step="1" value={[5, 7, 11, 13, 17, 19].indexOf(aperture.uraRank || 13)} onChange={e => { const ranks = [5, 7, 11, 13, 17, 19]; updateAp('uraRank', ranks[parseInt(e.target.value)]); }} className="w-full accent-science-500 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer" /><div className="flex justify-between text-[8px] text-gray-600 mt-1 font-mono"><span>5</span><span>7</span><span>11</span><span>13</span><span>17</span><span>19</span></div></div></div> );
      case ApertureType.LISSAJOUS: return ( <div className="space-y-4 pt-2 border-t border-white/5"><div className="grid grid-cols-2 gap-3"><div className="space-y-1"><label className="text-gray-500 text-[10px] uppercase font-bold font-display">Freq X</label><input type="number" min="1" max="20" value={aperture.lissajousRX || 3} onChange={e => updateAp('lissajousRX', parseInt(e.target.value))} className="w-full bg-black/40 border border-white/10 p-1.5 rounded text-xs text-white outline-none focus:border-science-500" /></div><div className="space-y-1"><label className="text-gray-500 text-[10px] uppercase font-bold font-display">Freq Y</label><input type="number" min="1" max="20" value={aperture.lissajousRY || 2} onChange={e => updateAp('lissajousRY', parseInt(e.target.value))} className="w-full bg-black/40 border border-white/10 p-1.5 rounded text-xs text-white outline-none focus:border-science-500" /></div></div><HybridInput label="Phase Shift" value={aperture.lissajousDelta || 0} min={0} max={360} step={1} onChange={v => updateAp('lissajousDelta', v)} unit="°" defaultValue={0} /><HybridInput label="Line Thickness" value={aperture.slitWidth || 0.1} min={0.01} max={5.0} step={0.01} onChange={v => updateAp('slitWidth', v)} unit="mm" defaultValue={genericOptimal} /><HybridInput label="Scale / Size" value={aperture.diameter} min={1.0} max={Math.max(10, diagSensor)} step={0.5} onChange={v => updateAp('diameter', v)} unit="mm" /></div> );
      case ApertureType.SPIRAL: return ( <div className="space-y-4 pt-2 border-t border-white/5"><HybridInput label="Turns" value={aperture.spiralTurns || 3} min={1} max={20} step={0.5} onChange={v => updateAp('spiralTurns', v)} defaultValue={3} /><HybridInput label="Arms" value={aperture.spiralArms || 1} min={1} max={12} step={1} onChange={v => updateAp('spiralArms', v)} defaultValue={1} /><HybridInput label="Line Thickness" value={aperture.slitWidth || 0.1} min={0.01} max={5.0} step={0.01} onChange={v => updateAp('slitWidth', v)} unit="mm" defaultValue={genericOptimal} /><HybridInput label="Scale / Size" value={aperture.diameter} min={1.0} max={Math.max(10, diagSensor)} step={0.5} onChange={v => updateAp('diameter', v)} unit="mm" /></div> );
      case ApertureType.ROSETTE: return ( <div className="space-y-4 pt-2 border-t border-white/5"><HybridInput label="Petals / Ripples" value={aperture.rosettePetals || 5} min={3} max={50} step={1} onChange={v => updateAp('rosettePetals', v)} defaultValue={5} /><HybridInput label="Amplitude" value={aperture.slitHeight || 1.0} min={0.1} max={10.0} step={0.1} onChange={v => updateAp('slitHeight', v)} unit="mm" /><HybridInput label="Line Thickness" value={aperture.slitWidth || 0.1} min={0.01} max={5.0} step={0.01} onChange={v => updateAp('slitWidth', v)} unit="mm" defaultValue={genericOptimal} /><HybridInput label="Base Scale" value={aperture.diameter} min={1.0} max={Math.max(10, diagSensor)} step={0.5} onChange={v => updateAp('diameter', v)} unit="mm" /></div> );
      case ApertureType.WAVES: case ApertureType.YIN_YANG: return ( 
        <div className="space-y-4 pt-2 border-t border-white/5">
            <HybridInput label="Line Thickness" value={aperture.slitWidth || 0.1} min={0.01} max={5.0} step={0.01} onChange={v => updateAp('slitWidth', v)} unit="mm" defaultValue={genericOptimal} />
            <button onClick={() => updateAp('slitWidth', parseFloat(simResult.optimalDiameter.toFixed(3)))} className="w-full bg-white/5 text-science-400 border border-white/10 py-1 text-[9px] rounded hover:bg-white/10 transition-colors uppercase">Set Optimal Width</button>
            <HybridInput label="Wave Amplitude" value={aperture.slitHeight || 2.0} min={0.5} max={Math.max(10.0, diagSensor * 1.1)} step={0.1} onChange={v => updateAp('slitHeight', v)} unit="mm" />
            <HybridInput label="Wave Count" value={aperture.count || 2} min={1} max={10} step={1} onChange={v => updateAp('count', v)} defaultValue={2} />
            {aperture.type === ApertureType.YIN_YANG && (
                <HybridInput label="Dot Size" value={aperture.innerDiameter || 0.2} min={0.05} max={5.0} step={0.05} onChange={v => updateAp('innerDiameter', v)} unit="mm" defaultValue={genericOptimal} />
            )}
            <HybridInput label="Total Width" value={aperture.diameter} min={1.0} max={Math.max(10, diagSensor)} step={0.5} onChange={v => updateAp('diameter', v)} unit="mm" />
        </div> 
      );
      case ApertureType.LITHO_OPC: return ( <div className="space-y-4 pt-2 border-t border-white/5"><HybridInput label="Main Feature Size" value={aperture.diameter} min={0.05} max={5.0} step={0.05} onChange={v => updateAp('diameter', v)} unit="mm" /><HybridInput label="SRAF Size" value={aperture.slitWidth || 0.05} min={0.01} max={5.0} step={0.01} onChange={v => updateAp('slitWidth', v)} unit="mm" /><HybridInput label="SRAF Distance" value={aperture.spread || 1.0} min={0.1} max={5.0} step={0.1} onChange={v => updateAp('spread', v)} unit="mm" /></div> );
      case ApertureType.ANNULAR: case ApertureType.STAR: return ( <div className="space-y-4 pt-2 border-t border-white/5"><HybridInput label="Inner Diameter" value={aperture.innerDiameter || aperture.diameter * 0.5} min={0.01} max={aperture.diameter} step={0.01} onChange={v => updateAp('innerDiameter', v)} unit="mm" />{aperture.type === ApertureType.STAR && (<HybridInput label="Points" value={aperture.spikes || 5} min={3} max={20} step={1} onChange={v => updateAp('spikes', v)} defaultValue={5} />)}</div> );
      case ApertureType.MULTI_DOT: case ApertureType.FIBONACCI: case ApertureType.RANDOM: return ( <div className="space-y-4 pt-2 border-t border-white/5">{aperture.type === ApertureType.MULTI_DOT && (<div><label className="text-gray-500 text-[10px] uppercase font-bold block mb-1 font-display">Pattern Type</label><SelectControl value={aperture.multiDotPattern} onChange={(e) => updateAp('multiDotPattern', e.target.value)}>{Object.values(MultiDotPattern).map(p => <option key={p} value={p}>{p}</option>)}</SelectControl></div>)}<HybridInput label="Count" value={aperture.count || 10} min={1} max={500} step={1} onChange={v => updateAp('count', v)} defaultValue={10} /><HybridInput label="Dot Size" value={aperture.diameter} min={0.05} max={3.0} step={0.01} onChange={v => updateAp('diameter', v)} unit="mm" defaultValue={genericOptimal} /><HybridInput label="Spread Area" value={aperture.spread || 2.0} min={0.5} max={Math.min(30.0, diagSensor)} step={0.1} onChange={v => updateAp('spread', v)} unit="mm" /></div> );
      case ApertureType.FRACTAL: case ApertureType.SIERPINSKI_TRIANGLE: return ( <div className="space-y-4 pt-2 border-t border-white/5"><HybridInput label="Iterations" value={aperture.iteration || 3} min={1} max={6} step={1} onChange={v => updateAp('iteration', v)} defaultValue={3} /><HybridInput label="Size" value={aperture.spread || 5.0} min={1.0} max={Math.min(30.0, diagSensor)} step={0.5} onChange={v => updateAp('spread', v)} unit="mm" /></div> );
      case ApertureType.FREEFORM: return ( <div className="space-y-4 pt-2 border-t border-white/5"><HybridInput label="Brush Size" value={aperture.brushSize || 0.5} min={0.1} max={10.0} step={0.1} onChange={v => updateAp('brushSize', v)} unit="mm" defaultValue={0.5} /><HybridInput label="Canvas Size" value={aperture.diameter} min={5} max={Math.max(100, diagSensor)} step={1} onChange={v => updateAp('diameter', v)} unit="mm" /><div className="flex gap-2 pt-1"><button onClick={() => updateAp('customPath', [])} className="flex-1 bg-red-500/10 text-red-400 py-1.5 text-[10px] rounded border border-red-500/20 hover:bg-red-500/20 transition-colors uppercase font-bold">Clear</button><button onClick={() => { const pts = []; for(let i=0; i<10; i++) pts.push({x: (Math.random()-0.5), y: (Math.random()-0.5)}); updateAp('customPath', pts); }} className="flex-1 bg-white/5 text-gray-300 py-1.5 text-[10px] rounded border border-white/10 hover:bg-white/10 transition-colors uppercase font-bold">Randomize</button></div></div> );
      case ApertureType.CUSTOM: return ( 
        <div className="space-y-4 pt-2 border-t border-white/5">
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="text-gray-500 text-[10px] uppercase font-bold font-display">Mask Image</label>
                    <div className="flex gap-1">
                        <button onClick={handlePaste} className="bg-white/5 text-gray-300 px-2 py-1 rounded text-[10px] border border-white/10 hover:bg-white/10 flex items-center gap-1"><ClipboardIcon /></button>
                        <button onClick={() => fileInputRef.current?.click()} className="bg-science-900/30 text-science-300 px-2 py-1 rounded text-[10px] border border-science-700/50 hover:bg-science-900/50 flex items-center gap-1"><UploadIcon /> IMPORT</button>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleMaskUpload} className="hidden" accept="image/*" />
                </div>
                {aperture.maskImage ? (
                    <div className="relative aspect-square w-16 bg-black border border-white/20 rounded-lg overflow-hidden mx-auto mb-2 shadow-lg">
                        <img src={aperture.maskImage} className="object-cover w-full h-full opacity-80" alt="Mask" />
                    </div>
                ) : (
                    <div className="text-[10px] text-gray-600 text-center italic mb-2 py-4 border border-dashed border-white/10 rounded">No image loaded</div>
                )}
            </div>
            <HybridInput label="Threshold" value={aperture.maskThreshold ?? 128} min={0} max={255} step={1} onChange={v => updateAp('maskThreshold', v)} defaultValue={128} />
            <HybridInput label="Physical Size" value={aperture.diameter} min={1.0} max={Math.max(10, diagSensor)} step={0.5} onChange={v => updateAp('diameter', v)} unit="mm" />
            <label className="flex items-center gap-3 text-gray-400 cursor-pointer p-2 bg-white/5 rounded border border-white/10 hover:bg-white/10 transition-colors">
                <div className="relative">
                    <input type="checkbox" checked={aperture.maskInvert || false} onChange={e => updateAp('maskInvert', e.target.checked)} className="sr-only peer" />
                    <div className="w-8 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-science-500"></div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide font-display">Invert Mask</span>
            </label>
        </div> 
      );
      default: return null;
    }
  };

  const flangeDist = camera.flangeDistance || 0;
  const extension = Math.max(0, camera.focalLength - flangeDist);

  return (
    <>
    <div className="w-full md:w-96 bg-noise bg-black border-r border-white/10 flex flex-col h-full overflow-y-auto text-sm backdrop-blur-sm shadow-2xl relative z-20">
      
      {/* Header */}
      <div className="p-5 border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-30 flex justify-between items-center">
        <h1 className="text-xl font-bold text-science-400 tracking-tighter flex items-center gap-2 font-display">
            <span>⦿</span> OpticLab <span className="text-gray-600 font-medium text-xs tracking-widest ml-1 opacity-70">V2.3</span>
        </h1>
        <div className="flex items-center gap-2">
            <ProSwitch checked={isAdvanced} onChange={setIsAdvanced} />
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
                title="Configuration"
            >
                <GearIcon />
            </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        
        {/* 1. Camera Body Module (Standalone, no box) */}
        <div className="mb-2">
            <CameraLCD 
              camera={camera}
              aperture={aperture}
              simResult={simResult}
              sourceEXIF={sourceEXIF}
              onConfigClick={() => setIsCameraConfigOpen(true)}
              simMeta={simMeta}
            />
        </div>

        {/* 2. Aperture & Simulation Controls */}
        <PanelModule 
            title="Aperture & Simulation" 
            icon={<ApertureIcon />} 
            className="border-science-900/30 bg-science-950/5"
            action={
                <div className="flex gap-1">
                    <button onClick={exportImmediate} className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 border border-transparent hover:border-white/20 transition-colors uppercase font-bold font-display text-gray-400 hover:text-white`} title="Quick Export">
                        <DownloadIconSmall />
                    </button>
                    <button onClick={addToProductionQueue} className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded hover:bg-emerald-900/60 border transition-colors uppercase font-bold font-display ${!isAdvanced ? 'hidden' : 'bg-emerald-900/40 text-emerald-400 border-emerald-800/50'}`} title="Queue">
                        <PlusIcon /> Queue
                    </button>
                </div>
            }
        >
          {/* 2.1 Visualization (No Overlay) */}
          <div className="mb-4 overflow-hidden rounded-lg border border-white/10 shadow-2xl shadow-black relative bg-[#18181b]">
             <AperturePreview aperture={aperture} camera={camera} onUpdateAperture={(u) => setAperture(p => ({...p, ...u}))} />
          </div>

          {/* 2.2 Engine Toggle & Explanation */}
          <div className="mb-4 bg-white/5 border border-white/5 rounded-lg overflow-hidden">
             <div className="flex border-b border-white/5">
                <button 
                    onClick={() => updateAp('engine', 'GEOMETRIC')}
                    className={`flex-1 text-[9px] font-bold py-2 uppercase tracking-wide transition-all ${aperture.engine === 'GEOMETRIC' ? 'bg-amber-600/80 text-white' : 'hover:bg-white/5 text-gray-500'}`}
                >
                    PARTICLE
                </button>
                <div className="w-[1px] bg-white/10"></div>
                <button 
                    onClick={() => updateAp('engine', 'WAVE')}
                    className={`flex-1 text-[9px] font-bold py-2 uppercase tracking-wide transition-all ${aperture.engine === 'WAVE' ? 'bg-indigo-600/80 text-white' : 'hover:bg-white/5 text-gray-500'}`}
                >
                    WAVE
                </button>
             </div>
             <div className="p-3 text-[10px] text-gray-400 leading-relaxed">
                {aperture.engine === 'GEOMETRIC' 
                    ? "Particle mode (Geometric Optics). Photons travel in straight lines. Fast, sharp shapes, no interference." 
                    : "Wave mode (Diffraction). Simulates interference, fringes, and Airy disks. Physically accurate for pinholes."}
             </div>
          </div>

          <div className="space-y-4">
            
            {/* 2.3 Aperture Type */}
            <div>
                <label className="text-science-300 text-[10px] uppercase font-bold block mb-1.5 tracking-wide font-display">Aperture Type</label>
                <div className="relative group">
                    <select 
                        value={aperture.type} 
                        onChange={(e) => updateAp('type', e.target.value as ApertureType)} 
                        className="w-full appearance-none bg-science-900/10 border-2 border-science-500/30 text-science-100 text-sm font-bold rounded-lg p-3 outline-none focus:border-science-400 transition-all shadow-[0_0_15px_rgba(14,165,233,0.1)] hover:border-science-500/50 cursor-pointer font-sans"
                    >
                        <optgroup label="Standard"><option value={ApertureType.PINHOLE}>Pinhole</option><option value={ApertureType.SLIT}>Slit</option><option value={ApertureType.CROSS}>Cross</option><option value={ApertureType.ANNULAR}>Annular</option><option value={ApertureType.POLYGON}>Polygon</option></optgroup>
                        
                        {isAdvanced && (
                            <>
                            <optgroup label="Diffractive"><option value={ApertureType.ZONE_PLATE}>Zone Plate</option><option value={ApertureType.PHOTON_SIEVE}>Photon Sieve</option><option value={ApertureType.URA}>URA (Coded)</option><option value={ApertureType.SLIT_ARRAY}>Double Slit</option><option value={ApertureType.DOT_SLIT}>Dot + Slit</option><option value={ApertureType.DIFFRACTION_GRATING}>Diffraction Grating</option><option value={ApertureType.LITHO_OPC}>Litho OPC</option></optgroup>
                            <optgroup label="Math Curves"><option value={ApertureType.LISSAJOUS}>Lissajous</option><option value={ApertureType.SPIRAL}>Spiral</option><option value={ApertureType.ROSETTE}>Rosette</option><option value={ApertureType.ZIGZAG}>ZigZag</option></optgroup>
                            <optgroup label="Patterns"><option value={ApertureType.MULTI_DOT}>Multi-Dot</option><option value={ApertureType.FIBONACCI}>Fibonacci</option><option value={ApertureType.RANDOM}>Random</option><option value={ApertureType.STAR}>Star</option><option value={ApertureType.FRACTAL}>Fractal</option><option value={ApertureType.SIERPINSKI_TRIANGLE}>Sierpinski</option></optgroup>
                            <optgroup label="Custom"><option value={ApertureType.WAVES}>Waves</option><option value={ApertureType.YIN_YANG}>Yin Yang</option><option value={ApertureType.FREEFORM}>Freeform</option><option value={ApertureType.CUSTOM}>Custom Mask</option></optgroup>
                            </>
                        )}
                    </select>
                    <div className="absolute right-3 top-3.5 pointer-events-none text-science-400 group-hover:text-science-200 transition-colors">
                        <ChevronDown className="w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* 2.4 Specific Parameters */}
            {isMathCurve && aperture.type !== ApertureType.ZIGZAG && (
                 <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded">
                    <label className="text-indigo-300 text-[10px] uppercase font-bold block mb-1 font-display">Preset Config</label>
                    <SelectControl onChange={(e) => handleCurvePreset(e.target.value)} defaultValue="-1">
                        <option value="-1" disabled>Select Curve...</option>
                        {CURVE_PRESETS.map((p, idx) => (
                            <option key={idx} value={idx}>{p.name}</option>
                        ))}
                    </SelectControl>
                 </div>
            )}

            {!isFractalMode && (
                <div className="space-y-4">
                    {isPinhole && (
                        <div>
                            <HybridInput label="Pinhole Diameter" value={aperture.diameter} min={0.05} max={2.0} step={0.01} onChange={v => updateAp('diameter', v)} unit="mm" defaultValue={genericOptimal} />
                            <button onClick={() => updateAp('diameter', parseFloat(simResult.optimalDiameter.toFixed(3)))} className="w-full mt-2 bg-science-900/20 text-science-400 border border-science-800/30 py-1.5 text-[10px] rounded hover:bg-science-900/40 transition-colors uppercase font-bold font-display">Set Optimal: {simResult.optimalDiameter.toFixed(3)}mm</button>
                        </div>
                    )}
                    {isDotSize && (
                        <div>
                            <HybridInput label="Dot Diameter" value={aperture.diameter} min={0.05} max={3.0} step={0.01} onChange={v => updateAp('diameter', v)} unit="mm" defaultValue={genericOptimal} />
                             <button onClick={() => updateAp('diameter', parseFloat(simResult.optimalDiameter.toFixed(3)))} className="w-full mt-2 bg-science-900/20 text-science-400 border border-science-800/30 py-1.5 text-[10px] rounded hover:bg-science-900/40 transition-colors uppercase font-bold font-display">Set Optimal: {simResult.optimalDiameter.toFixed(3)}mm</button>
                        </div>
                    )}
                    {isTotalDiameter && (
                        <div>
                            <HybridInput label="Total Diameter" value={aperture.diameter} min={1.0} max={Math.max(10.0, diagSensor)} step={0.1} onChange={v => updateAp('diameter', v)} unit="mm" />
                            {aperture.type !== ApertureType.FREEFORM && (<button onClick={() => updateAp('diameter', parseFloat(diagSensor.toFixed(2)))} className="w-full mt-2 bg-emerald-900/20 text-emerald-400 border border-emerald-900/30 py-1.5 text-[10px] rounded hover:bg-emerald-900/40 transition-colors uppercase font-bold font-display">Fit Sensor: {diagSensor.toFixed(1)}mm</button>)}
                        </div>
                    )}
                </div>
            )}
                
            {renderApertureSpecifics()}
            
            {isAdvanced && (
                <div className="pt-2 border-t border-white/5 space-y-3">
                    <HybridInput label="Rotation" value={aperture.rotation || 0} min={0} max={360} step={1} onChange={v => updateAp('rotation', v)} unit="°" defaultValue={0} />
                </div>
            )}

            {/* 2.5 Render Button */}
            <button onClick={isProcessing ? onCancel : onSimulate} className={`w-full py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-2xl uppercase tracking-widest border font-display ${isProcessing ? 'bg-red-900/20 text-red-400 border-red-900/50 animate-pulse' : 'bg-science-600 text-white hover:bg-science-500 border-science-400/30 hover:shadow-science-500/20'}`}>
                {isProcessing ? 'Processing FFT...' : 'Render Simulation'}
            </button>

            {/* 2.6 ISO / Brightness Group (Hidden in Basic) */}
            {isAdvanced && (
                <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="bg-black/20 rounded-lg p-3 border border-white/5 space-y-4">
                        {/* No Header */}
                        <div className="space-y-4">
                            <HybridInput 
                            label="ISO Sensitivity" 
                            value={camera.iso} 
                            min={100} max={25600} step={100} 
                            onChange={(v) => updateCam('iso', v)}
                            defaultValue={100}
                            />
                            <HybridInput 
                            label="Exposure Comp (EV)" 
                            value={exposure} 
                            min={-3.0} max={3.0} step={0.1} 
                            onChange={setExposure} 
                            defaultValue={0}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* 2.7 Point Source Group */}
            <div className="mt-2 bg-black/20 rounded-lg p-3 border border-white/5">
                <label className="flex items-center gap-3 cursor-pointer">
                   <div className="relative"><input type="checkbox" checked={aperture.centerDot || false} onChange={e => updateAp('centerDot', e.target.checked)} className="sr-only peer" /><div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div></div>
                   <div>
                       <span className="text-[10px] font-bold uppercase tracking-wide font-display text-gray-200 block">Point Source Mode</span>
                       <span className="text-[9px] text-gray-500 block">Visualize PSF (No Image)</span>
                   </div>
               </label>
               
               {aperture.centerDot && (
                    <div className="pt-3 animate-fadeIn border-t border-white/5 mt-2">
                         <HybridInput label="Source Intensity" value={sourceIntensity} min={1} max={1000} step={10} logarithmic onChange={setSourceIntensity} defaultValue={10} />
                    </div>
               )}
            </div>
          </div>
        </PanelModule>

        {isAdvanced && (
            <button onClick={() => setIsProductionOpen(true)} className="w-full mt-4 flex items-center justify-center gap-2 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold uppercase tracking-widest transition-colors font-display"><CubeIcon /> OpticFab Lab {productionItems.length > 0 && <span className="bg-science-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-mono">{productionItems.length}</span>}</button>
        )}
      </div>
    </div>
    
    {/* --- CAMERA CONFIG MODAL (Restored) --- */}
    {isCameraConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setIsCameraConfigOpen(false)}>
            <div className="bg-[#0a0a0a] border border-white/10 w-full max-w-sm rounded-xl p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2"><span className="text-xs font-bold text-science-400 flex items-center gap-2 uppercase tracking-widest font-display">Body Configuration</span><button onClick={() => setIsCameraConfigOpen(false)} className="text-gray-400 hover:text-white"><CheckIcon /></button></div>
                <div className="space-y-4">
                    <div><label className="text-gray-500 text-[10px] uppercase font-bold block mb-1 font-display">Preset Model</label><SelectControl value={camera.modelName || 'custom'} onChange={(e) => handlePresetChange(e.target.value)}><optgroup label="Digital">{CAMERA_PRESETS.filter(p => p.type === 'Digital').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup><optgroup label="Film / Analog">{CAMERA_PRESETS.filter(p => p.type === 'Film').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup><option value="custom">Custom / Homemade</option></SelectControl></div>
                    <div className="grid grid-cols-2 gap-2"><div className={`p-2 bg-black/40 rounded border border-white/10 ${!isCustomCamera ? 'opacity-50' : ''}`}><label className="text-[9px] text-gray-500 block mb-1 font-bold">Sensor W (mm)</label><input type="number" disabled={!isCustomCamera} value={camera.sensorWidth} onChange={e => updateCam('sensorWidth', parseFloat(e.target.value))} className="w-full bg-transparent text-xs text-white outline-none font-mono" /></div><div className={`p-2 bg-black/40 rounded border border-white/10 ${!isCustomCamera ? 'opacity-50' : ''}`}><label className="text-[9px] text-gray-500 block mb-1 font-bold">Sensor H (mm)</label><input type="number" disabled={!isCustomCamera} value={camera.sensorHeight} onChange={e => updateCam('sensorHeight', parseFloat(e.target.value))} className="w-full bg-transparent text-xs text-white outline-none font-mono" /></div></div>
                    <HybridInput label="Focal Length (Depth)" value={camera.focalLength} min={Math.max(1, flangeDist)} max={300} step={1} onChange={v => updateCam('focalLength', v)} unit="mm" defaultValue={50} />
                    
                    {/* Reciprocity Field - Only for Film/Custom */}
                    {(isCustomCamera || currentPreset?.type === 'Film') && (
                        <div className="pt-2 border-t border-white/10 mt-2">
                            <HybridInput 
                                label="Reciprocity (Schwarzschild)" 
                                value={camera.reciprocityPower ?? 1.33} 
                                min={1.0} max={2.0} step={0.01} 
                                onChange={(v) => updateCam('reciprocityPower', v)} 
                                unit="p"
                                defaultValue={1.33}
                            />
                            <div className="text-[8px] text-gray-500 mt-1 italic">
                                Compensates for long exposure failure on film (t = t_measured^p). Standard B&W ≈ 1.33.
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between text-[9px] text-gray-600 font-mono px-1 border-t border-white/10 pt-2 mt-2"><span>Flange: {flangeDist}mm</span><span className={extension === 0 ? 'text-red-500' : 'text-gray-500'}>Ext: {extension.toFixed(1)}mm</span></div>
                    {isCustomCamera && (<div className="mt-4 p-3 bg-cyan-900/10 rounded border border-cyan-900/30 space-y-3"><div className="flex items-center gap-2 mb-2 border-b border-cyan-900/30 pb-2 text-cyan-500"><DesignIcon /> <span className="text-[10px] uppercase font-bold font-display">Design Assistant</span></div><div><label className="text-cyan-700 text-[9px] uppercase font-bold block mb-1">Target Equiv.</label><div className="flex gap-2"><div className="bg-black/40 border border-cyan-900/30 p-1.5 rounded flex-1"><input type="number" value={targetEquiv} onChange={(e) => setTargetEquiv(parseFloat(e.target.value))} className="w-full bg-transparent text-xs text-cyan-200 outline-none font-mono" /></div><button onClick={() => updateCam('focalLength', targetEquiv / cropFactor)} className="bg-cyan-900/30 text-cyan-400 border border-cyan-800 px-3 rounded text-[9px] hover:bg-cyan-900/50 uppercase font-bold font-display">Set</button></div></div></div>)}
                </div>
            </div>
        </div>
    )}

    <ProductionModal isOpen={isProductionOpen} onClose={() => setIsProductionOpen(false)} items={productionItems} onRemoveItem={(id) => setProductionItems(p => p.filter(x => x.id !== id))} />
    <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} camera={camera} setCamera={setCamera} aperture={aperture} setAperture={setAperture} />
    </>
  );
};

export default ControlPanel;
