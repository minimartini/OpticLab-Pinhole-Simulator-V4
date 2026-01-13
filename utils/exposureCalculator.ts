

import { CameraConfig, ApertureConfig, SimulationResult, CAMERA_PRESETS, EXIFData } from '../types';

interface ExposureData {
  // Input (from EXIF or manual)
  originalF: number;
  originalTime: number; // in seconds
  originalISO: number;
  
  // Output (calculated)
  pinholeT: number;
  pinholeTime: number;
  pinholeTimeDisplay: string;
  reciprocityTime?: number;
  reciprocityDisplay?: string;
  warningMessage?: string;
}

export const calculatePinholeExposure = (
  sourceExif: Required<EXIFData>,
  camera: CameraConfig,
  aperture: ApertureConfig,
  simResult: SimulationResult
): ExposureData => {
  
  // 1. Calculate EV of original scene (EV100 based)
  // EV_s = log2(N^2 / t) - log2(ISO/100)
  const originalEV100 = Math.log2(Math.pow(sourceExif.fNumber, 2) / sourceExif.exposureTime) - Math.log2(sourceExif.iso / 100);
  
  // 2. Adjust for Target Camera ISO
  // EV_target = EV100 + log2(TargetISO/100)
  // But we need the exposure time for the specific T-stop at this ISO.
  // t = N^2 / (2^EV_target) -> No, standard formula is 2^EV = N^2/t * (100/ISO)
  
  // Let's stick to Light Value (LV) logic which is simpler:
  // Light hitting sensor is constant. 
  // Target Time = (Target_T^2 / Source_f^2) * Source_Time * (Source_ISO / Target_ISO)
  
  const fStopRatioSq = Math.pow(simResult.tStop, 2) / Math.pow(sourceExif.fNumber, 2);
  const isoRatio = sourceExif.iso / camera.iso;
  
  let pinholeTime = sourceExif.exposureTime * fStopRatioSq * isoRatio;
  
  // 3. Pinhole T-stop (for display)
  const pinholeT = simResult.tStop;
  
  // 4. Apply reciprocity failure for film cameras
  let reciprocityTime: number | undefined;
  let reciprocityDisplay: string | undefined;
  
  const currentPreset = CAMERA_PRESETS.find(p => p.id === camera.modelName);
  const isFilm = currentPreset?.type === 'Film' || camera.modelName === 'custom';
  
  if (isFilm && pinholeTime > 1) {
    // Schwarzschild's law approximation: t_actual = t_predicted^p
    // Use configurable power or default to 1.33 (standard B&W)
    const p = camera.reciprocityPower || 1.33;
    reciprocityTime = Math.pow(pinholeTime, p);
    reciprocityDisplay = formatTime(reciprocityTime);
  }
  
  // 5. Format display strings
  const pinholeTimeDisplay = formatTime(pinholeTime);
  
  // 6. Generate warnings
  let warningMessage: string | undefined;
  if (pinholeTime > 30) {
    warningMessage = "⚠️ Long exposure - use tripod & cable release";
  }
  if (pinholeTime > 300) {
    warningMessage = "⚠️ Very long exposure - consider ND filter or higher ISO";
  }
  
  return {
    originalF: sourceExif.fNumber,
    originalTime: sourceExif.exposureTime,
    originalISO: sourceExif.iso,
    pinholeT,
    pinholeTime,
    pinholeTimeDisplay,
    reciprocityTime,
    reciprocityDisplay,
    warningMessage
  };
};

const formatTime = (seconds: number): string => {
  if (seconds < 0.0001) {
     return "1/10000s+";
  } else if (seconds < 1) {
    return `1/${Math.round(1/seconds)}s`;
  } else if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
};