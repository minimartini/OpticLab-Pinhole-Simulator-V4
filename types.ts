
export enum ApertureType {
  PINHOLE = 'PINHOLE',
  POLYGON = 'POLYGON', 
  ZONE_PLATE = 'ZONE_PLATE',
  PHOTON_SIEVE = 'PHOTON_SIEVE',
  SLIT = 'SLIT',
  CROSS = 'CROSS',
  SLIT_ARRAY = 'SLIT_ARRAY',
  DIFFRACTION_GRATING = 'DIFFRACTION_GRATING', // New Module
  RANDOM = 'RANDOM',
  ANNULAR = 'ANNULAR',
  MULTI_DOT = 'MULTI_DOT',
  STAR = 'STAR',
  WAVES = 'WAVES', 
  YIN_YANG = 'YIN_YANG',
  URA = 'URA', 
  FREEFORM = 'FREEFORM',
  FIBONACCI = 'FIBONACCI',
  FRACTAL = 'FRACTAL',
  SIERPINSKI_TRIANGLE = 'SIERPINSKI_TRIANGLE',
  LITHO_OPC = 'LITHO_OPC',
  LISSAJOUS = 'LISSAJOUS',
  SPIRAL = 'SPIRAL',
  ROSETTE = 'ROSETTE',
  ZIGZAG = 'ZIGZAG', // New
  DOT_SLIT = 'DOT_SLIT', // New
  CUSTOM = 'CUSTOM' 
}

export enum MultiDotPattern {
  RING = 'RING',
  LINE = 'LINE',
  GRID = 'GRID',
  RANDOM = 'RANDOM',
  CONCENTRIC = 'CONCENTRIC'
}

export type SimulationEngine = 'GEOMETRIC' | 'WAVE';

export interface CameraConfig {
  focalLength: number;
  sensorWidth: number;
  sensorHeight: number;
  wavelength: number;
  iso: number;
  modelName?: string;
  flangeDistance?: number;
  reciprocityPower?: number; // Schwarzschild exponent (default 1.33)
}

export interface ApertureConfig {
  type: ApertureType;
  diameter: number; 
  innerDiameter?: number; 
  zones?: number;
  zonePlateProfile?: 'BINARY' | 'SINUSOIDAL' | 'SPIRAL'; 
  seed?: number;
  
  // Simulation Toggles
  engine: SimulationEngine; // New Toggle
  resolution?: number; // 512, 1024, 2048
  useChromaticAberration: boolean; 
  useVignetting: boolean;
  addSensorNoise: boolean; 
  
  // Dimensions
  slitWidth?: number; 
  slitHeight?: number; 
  
  // Polygon Config
  polygonSides?: number; 
  polygonType?: 'FILLED' | 'LINED'; // New option
  
  // Diffraction Grating Config
  gratingDensity?: number; // Lines per mm
  gratingType?: 'HORIZONTAL' | 'VERTICAL' | 'GRID';
  
  // Secondary Mirror / Spider Vanes (Obstructions)
  spiderVanes?: number; // Number of struts (0, 3, 4)
  spiderWidth?: number; // Thickness of struts
  spiderRotation?: number; // Rotation of struts independent of aperture

  // Multi-dot / Pattern
  multiDotPattern?: MultiDotPattern;
  count?: number;
  spread?: number; 
  centerDot?: boolean; // Controls Point Source Mode
  
  // URA / Coded Aperture
  uraRank?: number; 
  
  // Fractal / Star
  iteration?: number;
  rotation?: number;
  spikes?: number;

  // Math Curves
  lissajousRX?: number; 
  lissajousRY?: number; 
  lissajousDelta?: number; 
  spiralTurns?: number;
  spiralArms?: number;
  rosettePetals?: number; 
  
  // Freeform & Custom
  customPath?: {x: number, y: number}[];
  brushSize?: number;
  maskImage?: string | null; 
  maskThreshold?: number; 
  maskInvert?: boolean;
}

export interface SimulationResult {
  geometricBlur: number;
  diffractionBlur: number;
  totalBlur: number;
  optimalDiameter: number;
  fNumber: number; 
  tStop: number;   
  fovH: number;
  fovV: number;
  focalLength35mm: number;
  maxFootprint: number;
  isDiffractionLimited: boolean;
  fringeSpacing?: number; 
  interferenceRating?: string;
  effectiveDiameter: number; // For physics calculations
}

export interface WorkerMetadata {
  method: 'GEOMETRIC' | 'FRESNEL' | 'ASM';
  fov?: number;
  cutOffLimit?: number;
}

export interface ExportConfig {
  format: 'SVG' | 'DXF';
  addBridges: boolean;
  inverted: boolean;
  bridgeSizeMm: number;
  sheetWidth: number;
  sheetHeight: number;
  
  // Plate Configuration
  plateType: 'SQUARE' | 'RECT' | 'CIRCLE';
  itemSize: number; // Used for Square/Circle diameter
  itemHeight?: number; // Used for Rect height
  
  spacing: number;
  pngScale?: number;
  showLabels: boolean;
  
  // Manufacturing
  kerf: number; // Cut width compensation (mm)
  nesting: boolean; // Use optimized packing
  cutMarks: boolean; // Add crop marks
  cutPlateOutline: boolean; // Add cut path for the plate itself
}

export interface ProductionItem {
  id: string;
  name: string;
  aperture: ApertureConfig;
  camera: CameraConfig;
}

export interface Preset {
  id: string;
  name: string;
  flange: number;
  sensorW: number;
  sensorH: number;
  type: 'Digital' | 'Film' | 'Custom';
}

export interface EXIFData {
  fNumber?: number;
  exposureTime?: number; // seconds
  iso?: number;
  focalLength?: number;
  make?: string;
  model?: string;
}

export const CAMERA_PRESETS: Preset[] = [
  // Digital - Alphabetical
  { id: 'canon_ef', name: 'Canon EF (DSLR)', flange: 44.0, sensorW: 36, sensorH: 24, type: 'Digital' },
  { id: 'canon_rf', name: 'Canon RF (Mirrorless)', flange: 20.0, sensorW: 36, sensorH: 24, type: 'Digital' },
  { id: 'fuji_gfx', name: 'Fujifilm GFX (Medium Format)', flange: 26.7, sensorW: 43.8, sensorH: 32.9, type: 'Digital' },
  { id: 'fuji_x', name: 'Fujifilm X (APS-C)', flange: 17.7, sensorW: 23.6, sensorH: 15.6, type: 'Digital' },
  { id: 'hasselblad_xcd', name: 'Hasselblad XCD', flange: 18.14, sensorW: 43.8, sensorH: 32.9, type: 'Digital' },
  { id: 'l_mount', name: 'L-Mount (Leica/Pan/Sig)', flange: 20.0, sensorW: 36, sensorH: 24, type: 'Digital' },
  { id: 'leica_m', name: 'Leica M (Rangefinder)', flange: 27.8, sensorW: 36, sensorH: 24, type: 'Digital' },
  { id: 'mft', name: 'Micro 4/3', flange: 19.25, sensorW: 17.3, sensorH: 13, type: 'Digital' },
  { id: 'nikon_f', name: 'Nikon F (SLR)', flange: 46.5, sensorW: 36, sensorH: 24, type: 'Digital' },
  { id: 'nikon_z', name: 'Nikon Z (Mirrorless)', flange: 16.0, sensorW: 35.9, sensorH: 23.9, type: 'Digital' },
  { id: 'sony_e', name: 'Sony E (Mirrorless)', flange: 18.0, sensorW: 35.6, sensorH: 23.8, type: 'Digital' },
  
  // Film
  { id: 'film_35', name: '35mm Film Standard', flange: 0, sensorW: 36, sensorH: 24, type: 'Film' },
  { id: 'film_645', name: 'Medium Format 645', flange: 0, sensorW: 56, sensorH: 41.5, type: 'Film' },
  { id: 'film_6x6', name: 'Medium Format 6x6', flange: 0, sensorW: 56, sensorH: 56, type: 'Film' },
  { id: 'large_4x5', name: 'Large Format 4x5', flange: 0, sensorW: 102, sensorH: 127, type: 'Film' },
  { id: 'large_8x10', name: 'Large Format 8x10', flange: 0, sensorW: 203, sensorH: 254, type: 'Film' },
  
  // Custom
  { id: 'custom', name: 'Custom / Homemade', flange: 0, sensorW: 36, sensorH: 24, type: 'Custom' },
];
