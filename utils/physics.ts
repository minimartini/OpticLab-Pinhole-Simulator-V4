
import { ApertureConfig, ApertureType, MultiDotPattern, CameraConfig, SimulationResult } from '../types';

export const DEFAULT_WAVELENGTH = 550;

/**
 * Physical constants used for optical calculations.
 */
export const PHYSICS_CONSTANTS = {
  WAVELENGTH_TO_MM: 1e-6, // Conversion factor from nm to mm
  RGB_WAVELENGTHS: [640, 540, 460], // Approximate centers for R, G, B channels
  // 5-Channel Spectrum for higher color fidelity in spectral simulations
  SPECTRAL_WAVELENGTHS: [640, 590, 530, 490, 450],
  AIRY_DISK_FACTOR: 2.44, // Factor for first null of Airy disk (2 * 1.22)
  RAYLEIGH_FACTOR: 1.9, // Empirical factor for optimal pinhole diameter (Lord Rayleigh)
  DEFAULT_ZONES: 10
};

/**
 * Generates a Uniformly Redundant Array (URA) grid for Coded Aperture imaging.
 * Based on quadratic residues modulo a prime rank.
 * @param rank - The prime number rank of the array (e.g., 13, 19).
 * @returns Int8Array where 1 is open, 0 is closed.
 */
const generateURA = (rank: number) => {
    const p = rank;
    const grid = new Int8Array(p * p);
    
    // Legendre symbol / Quadratic Residue calculation
    const isQuadraticResidue = (n: number, m: number) => {
        if (n === 0) return 0;
        for (let x = 1; x < m; x++) {
            if ((x * x) % m === n) return 1;
        }
        return -1;
    };

    for (let i = 0; i < p; i++) {
        for (let j = 0; j < p; j++) {
            if (i === 0) {
                 grid[i*p + j] = 0;
            } else if (j === 0) {
                 grid[i*p + j] = 1;
            } else {
                 const C_i = isQuadraticResidue(i, p);
                 const C_j = isQuadraticResidue(j, p);
                 // Twin prime construction usually, here using a simplified M-sequence variant logic
                 grid[i*p + j] = (C_i * C_j) === 1 ? 1 : 0;
            }
        }
    }
    return grid;
};

/**
 * Calculates the exact open surface area of the aperture in mm².
 * Used for T-Stop (transmission) calculations.
 */
export const calculateOpenArea = (aperture: ApertureConfig): number => {
    const d = Math.max(0, aperture.diameter);
    const r = d / 2;

    if (aperture.type === ApertureType.PINHOLE) {
        return Math.PI * r * r;
    }
    else if (aperture.type === ApertureType.POLYGON) {
        const n = aperture.polygonSides || 6;
        if (aperture.polygonType === 'LINED') {
            // Area of the "stroke" only
            const perimeter = n * d * Math.sin(Math.PI / n);
            return perimeter * (aperture.slitWidth || 0.2);
        }
        // Area of regular polygon = (1/2) * n * r^2 * sin(2pi/n)
        return 0.5 * n * r * r * Math.sin((2 * Math.PI) / n);
    }
    else if (aperture.type === ApertureType.ZONE_PLATE) {
        // Fresnel Zone plates are roughly 50% open
        return (Math.PI * r * r) / 2;
    }
    else if (aperture.type === ApertureType.PHOTON_SIEVE) {
        // Photon sieves are less efficient than zone plates due to gaps between holes
        return (Math.PI * r * r) * 0.35;
    }
    else if (aperture.type === ApertureType.DIFFRACTION_GRATING) {
        // Assuming 50% duty cycle (Ronchi Ruling)
        return (Math.PI * r * r) * 0.5;
    }
    else if (aperture.type === ApertureType.SLIT) {
        return (aperture.slitWidth || 0.2) * (aperture.diameter || 5.0);
    }
    else if (aperture.type === ApertureType.SLIT_ARRAY) {
        const n = aperture.count || 2;
        const w = aperture.slitWidth || 0.2;
        const h = aperture.diameter || 5.0;
        return n * w * h;
    }
    else if (aperture.type === ApertureType.CROSS) {
        const cw = aperture.slitWidth || 0.2;
        const l = aperture.diameter || 5.0;
        // Subtract center overlap to avoid double counting
        return (2 * cw * l) - (cw * cw);
    }
    else if (aperture.type === ApertureType.ANNULAR) {
        const rOut = d / 2;
        const rIn = (aperture.innerDiameter || d * 0.5) / 2;
        return Math.PI * (Math.max(0, rOut * rOut - rIn * rIn));
    }
    else if (aperture.type === ApertureType.MULTI_DOT || aperture.type === ApertureType.RANDOM || aperture.type === ApertureType.FIBONACCI) {
        const count = aperture.count || 1;
        const dotR = (aperture.diameter || 0.2) / 2;
        return count * Math.PI * dotR * dotR;
    }
    else if (aperture.type === ApertureType.URA) {
        // Approx 50% open
        return (d * d) * 0.5; 
    }
    else if (aperture.type === ApertureType.WAVES || aperture.type === ApertureType.YIN_YANG) {
        const width = aperture.diameter || 10;
        const amp = aperture.slitHeight || 2.0;
        const waves = aperture.count || 1;
        const thick = aperture.slitWidth || 0.1;
        // Arc length approximation
        const len = Math.sqrt(width**2 + (2*waves*amp)**2); 
        let area = len * thick;
        if (aperture.type === ApertureType.YIN_YANG) {
            const dR = (aperture.innerDiameter || 0.2)/2;
            area += (waves * 2) * (Math.PI * dR * dR);
        }
        return area;
    }
    else if (aperture.type === ApertureType.LITHO_OPC) {
         const cd = aperture.diameter || 1.0; 
         const srafW = aperture.slitWidth || cd*0.25;
         const h = cd * 5; 
         return (cd * h) + (2 * srafW * h); 
    }
    else if (aperture.type === ApertureType.FRACTAL) {
        // Menger sponge / Sierpinski carpet approximation (8/9 removed per iter)
        const initialArea = (aperture.spread || 10) ** 2;
        const iter = aperture.iteration || 3;
        return initialArea * Math.pow(8/9, iter);
    }
    else if (aperture.type === ApertureType.SIERPINSKI_TRIANGLE) {
         const s = aperture.spread || 5.0;
         const triArea = (Math.sqrt(3)/4) * s * s;
         return triArea * Math.pow(3/4, aperture.iteration || 3);
    }
    else if (aperture.type === ApertureType.LISSAJOUS || aperture.type === ApertureType.SPIRAL || aperture.type === ApertureType.ROSETTE) {
         // Rough estimation based on path length
         return (aperture.diameter * 3) * (aperture.slitWidth || 0.1); 
    }
    else if (aperture.type === ApertureType.ZIGZAG) {
         const w = aperture.diameter || 5;
         const h = aperture.slitHeight || 2.0;
         const thick = aperture.slitWidth || 0.2;
         const segments = aperture.count || 5;
         const segW = w / segments;
         const segLen = Math.sqrt(segW**2 + h**2);
         return segments * segLen * thick;
    }
    else if (aperture.type === ApertureType.DOT_SLIT) {
         const dotR = (aperture.innerDiameter || 0.2)/2;
         const slitW = aperture.slitWidth || 0.2;
         const slitL = aperture.diameter || 5;
         return (Math.PI * dotR * dotR) + (slitW * slitL);
    }
    else if (aperture.type === ApertureType.FREEFORM) {
        return (d * d) * 0.1; // Estimate
    }
    else if (aperture.type === ApertureType.CUSTOM) {
        return (d * d) * 0.5; // Estimate
    }

    return Math.PI * r * r;
};

/**
 * Main physics engine entry point.
 * Calculates blur sizes, optimal diameters, T-stops, and diffraction limits.
 */
export const calculatePhysics = (camera: CameraConfig, aperture: ApertureConfig): SimulationResult => {
  const focalLength = Math.max(0.1, camera.focalLength);
  const wavelength = Math.max(380, camera.wavelength);
  const lambda = wavelength * PHYSICS_CONSTANTS.WAVELENGTH_TO_MM;

  // --- 1. Transmission (T-Stop) ---
  const openAreaMm2 = calculateOpenArea(aperture);
  // Equivalent diameter of a circle with the same area
  const equivalentDiameterExposure = 2 * Math.sqrt(Math.max(0, openAreaMm2) / Math.PI);
  // T-Stop = f / D_effective
  const tStop = focalLength / Math.max(0.001, equivalentDiameterExposure);

  // --- 2. Geometric Resolution (Depth of Field) ---
  // Determine the "critical dimension" that restricts light and causes diffraction.
  // For a slit, this is width. For a pinhole, it's diameter.
  let criticalDimension = aperture.diameter;
  
  if ([ApertureType.SLIT, ApertureType.CROSS, ApertureType.WAVES, ApertureType.SLIT_ARRAY, 
       ApertureType.LISSAJOUS, ApertureType.SPIRAL, ApertureType.ROSETTE, ApertureType.ZIGZAG, ApertureType.DOT_SLIT].includes(aperture.type)) {
      criticalDimension = aperture.slitWidth || 0.1;
  } else if (aperture.type === ApertureType.POLYGON && aperture.polygonType === 'LINED') {
      criticalDimension = aperture.slitWidth || 0.1;
  } else if (aperture.type === ApertureType.LITHO_OPC) {
      criticalDimension = aperture.diameter || 0.1; 
  } else if (aperture.type === ApertureType.URA) {
      const rank = aperture.uraRank || 13;
      criticalDimension = aperture.diameter / rank; 
  } else if (aperture.type === ApertureType.DIFFRACTION_GRATING) {
      const linesPerMm = Math.max(0.1, aperture.gratingDensity || 2);
      criticalDimension = (1.0 / linesPerMm) * 0.5; 
  } else if (aperture.type === ApertureType.ANNULAR) {
      criticalDimension = aperture.diameter;
  }
  
  criticalDimension = Math.max(0.0001, criticalDimension);
  
  // f-number based on critical dimension (diffraction limit driver)
  const fNumber = focalLength / criticalDimension;

  // Geometric Blur = aperture size (in projection approximation)
  const geometricBlur = criticalDimension; 
  
  // Diffraction Blur (Airy Disk diameter) = 2.44 * lambda * f/#
  const diffractionBlur = PHYSICS_CONSTANTS.AIRY_DISK_FACTOR * lambda * fNumber;
  
  // RSS approximation for total blur
  const totalBlur = Math.sqrt(Math.pow(geometricBlur, 2) + Math.pow(diffractionBlur, 2));

  // --- 3. Optimization ---
  // Rayleigh Criterion: D_opt = 1.9 * sqrt(f * lambda)
  let optimalDiameter = PHYSICS_CONSTANTS.RAYLEIGH_FACTOR * Math.sqrt(focalLength * lambda);
  
  // Zone plates optimize differently: D = 2 * sqrt(N * f * lambda)
  if ([ApertureType.ZONE_PLATE, ApertureType.PHOTON_SIEVE].includes(aperture.type)) {
    const N = Math.max(1, aperture.zones || PHYSICS_CONSTANTS.DEFAULT_ZONES);
    optimalDiameter = 2 * Math.sqrt(N * focalLength * lambda);
  }

  // --- 4. Field of View ---
  const diagSensor = Math.sqrt(camera.sensorWidth**2 + camera.sensorHeight**2);
  const diag35 = 43.266;
  const cropFactor = diagSensor > 0 ? diag35 / diagSensor : 1;

  // --- 5. Manufacturing Footprint ---
  let maxFootprint = aperture.diameter * 1.5;
  if ([ApertureType.FRACTAL, ApertureType.SIERPINSKI_TRIANGLE, ApertureType.MULTI_DOT, ApertureType.FIBONACCI].includes(aperture.type)) {
      maxFootprint = (aperture.spread || 10) * 1.2;
  } else if ([ApertureType.WAVES, ApertureType.YIN_YANG].includes(aperture.type)) {
      const amp = aperture.slitHeight || 2.0;
      const width = aperture.diameter || 10.0;
      maxFootprint = Math.max(width, amp) * 1.2;
  } else if (aperture.type === ApertureType.ZIGZAG) {
      const amp = aperture.slitHeight || 2.0;
      const width = aperture.diameter || 5.0;
      maxFootprint = Math.max(width, amp) * 1.2;
  } else if (aperture.type === ApertureType.DOT_SLIT) {
      maxFootprint = (aperture.spread || 2.0) + (aperture.diameter || 5);
  }

  // --- 6. Interference Analysis ---
  let fringeSpacing = 0;
  let interferenceRating = "";
  // Young's Double Slit equation: y = (lambda * L) / d
  if (aperture.type === ApertureType.SLIT_ARRAY || aperture.type === ApertureType.DOT_SLIT) {
      const d = aperture.spread || 1.0; 
      if (d > 0) {
          fringeSpacing = (lambda * focalLength) / d; 
          if (fringeSpacing < 0.005) interferenceRating = "Microscopic";
          else if (fringeSpacing < 0.02) interferenceRating = "Very Weak";
          else if (fringeSpacing < 0.1) interferenceRating = "Visible";
          else if (fringeSpacing < 1.0) interferenceRating = "Strong";
          else interferenceRating = "Very Wide";
      }
  } else if (aperture.type === ApertureType.DIFFRACTION_GRATING) {
      const density = aperture.gratingDensity || 10;
      const d = 1.0 / density;
      fringeSpacing = (lambda * focalLength) / d;
      interferenceRating = "Spectroscopic";
  }
  
  const isDiffractionLimited = diffractionBlur >= (geometricBlur * 0.9);

  return {
    geometricBlur,
    diffractionBlur,
    totalBlur,
    optimalDiameter,
    fNumber, 
    tStop, 
    fovH: 2 * Math.atan(camera.sensorWidth / (2 * focalLength)) * (180 / Math.PI),
    fovV: 2 * Math.atan(camera.sensorHeight / (2 * focalLength)) * (180 / Math.PI),
    focalLength35mm: focalLength * cropFactor,
    maxFootprint,
    isDiffractionLimited,
    fringeSpacing,
    interferenceRating,
    effectiveDiameter: criticalDimension
  };
};

/**
 * Draws the aperture shape onto a Canvas context.
 * Used for both Preview UI and Physics Engine (FFT input).
 */
export const drawAperture = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  scale: number,
  aperture: ApertureConfig,
  wavelength: number,
  focalLength: number,
  maskBitmap?: ImageBitmap
) => {
  ctx.save();
  ctx.rotate((aperture.rotation || 0) * Math.PI / 180);
  const lambda = wavelength * PHYSICS_CONSTANTS.WAVELENGTH_TO_MM;
  const radiusPx = (aperture.diameter * scale) / 2;
  ctx.fillStyle = '#fff';

  let seed = aperture.seed || 12345;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  if (aperture.type === ApertureType.PINHOLE) {
      ctx.beginPath(); ctx.arc(0, 0, radiusPx, 0, Math.PI * 2); ctx.fill();
  }
  else if (aperture.type === ApertureType.POLYGON) {
        const sides = Math.max(3, aperture.polygonSides || 6);
        ctx.beginPath();
        for (let i = 0; i <= sides; i++) {
            const theta = (i * 2 * Math.PI) / sides;
            const x = radiusPx * Math.cos(theta - Math.PI/2);
            const y = radiusPx * Math.sin(theta - Math.PI/2);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        
        if (aperture.polygonType === 'LINED') {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = (aperture.slitWidth || 0.2) * scale;
            ctx.stroke();
        } else {
            ctx.fill();
        }
  }
  else if (aperture.type === ApertureType.CUSTOM) {
        if (!maskBitmap) {
            ctx.strokeStyle = '#333';
            ctx.strokeRect(-radiusPx, -radiusPx, radiusPx*2, radiusPx*2);
        }
  }
  else if (aperture.type === ApertureType.DIFFRACTION_GRATING) {
        ctx.beginPath(); ctx.arc(0, 0, radiusPx, 0, Math.PI * 2); ctx.clip();
        
        const linesPerMm = Math.max(0.1, aperture.gratingDensity || 5);
        const pitchPx = (1.0 / linesPerMm) * scale;
        const lineThickness = pitchPx * 0.5; // 50% duty cycle
        
        const type = aperture.gratingType || 'VERTICAL';
        
        const drawLines = (angle: number) => {
            ctx.save();
            ctx.rotate(angle);
            const count = Math.ceil((radiusPx * 2) / pitchPx);
            const start = -radiusPx;
            
            for(let i=0; i<count; i++) {
                ctx.fillRect(start + i*pitchPx, -radiusPx, lineThickness, radiusPx*2);
            }
            ctx.restore();
        };

        if (type === 'VERTICAL' || type === 'GRID') {
            drawLines(0);
        }
        if (type === 'HORIZONTAL' || type === 'GRID') {
            drawLines(Math.PI/2);
        }
  }
  else if (aperture.type === ApertureType.URA) {
            const rank = aperture.uraRank || 13;
            const cellSize = (aperture.diameter * scale) / rank;
            const grid = generateURA(rank);
            const offset = (aperture.diameter * scale) / 2;
            
            for(let i=0; i<rank; i++) {
                for(let j=0; j<rank; j++) {
                    if (grid[i*rank + j] === 1) {
                        ctx.fillRect(j*cellSize - offset, i*cellSize - offset, cellSize, cellSize);
                    }
                }
            }
  }
  else if (aperture.type === ApertureType.ZONE_PLATE) {
      const maxN = Math.floor(Math.pow(aperture.diameter/2, 2) / (lambda * focalLength));
      const safeMaxN = Math.min(maxN, 3000); 

      if (aperture.zonePlateProfile === 'SPIRAL') {
          const maxR = (aperture.diameter * scale) / 2;
          const stepSize = 0.5; 
          for(let r=0; r<maxR; r+=stepSize) {
               for(let theta=0; theta<Math.PI*2; theta+=0.05) {
                   const r_mm = r / scale;
                   const phase = (Math.PI * r_mm * r_mm) / (lambda * focalLength) + theta;
                   const val = Math.cos(phase) > 0 ? 1 : 0;
                   if (val) {
                       ctx.fillStyle = '#fff';
                       ctx.fillRect(r*Math.cos(theta), r*Math.sin(theta), 1.5, 1.5);
                   }
               }
          }
      } 
      else if (aperture.zonePlateProfile === 'SINUSOIDAL') {
          const maxR = (aperture.diameter * scale) / 2;
          const stepSize = 0.5; 
          for(let r=0; r<maxR; r+=stepSize) {
               const r_mm = r / scale;
               const phase = (Math.PI * r_mm * r_mm) / (lambda * focalLength);
               const transmission = (1 + Math.cos(phase)) / 2;
               
               ctx.beginPath();
               ctx.arc(0, 0, r, 0, Math.PI*2);
               ctx.strokeStyle = `rgba(255, 255, 255, ${transmission})`;
               ctx.lineWidth = stepSize + 0.1;
               ctx.stroke();
          }
      } else {
          for (let n = Math.max(1, maxN); n >= Math.max(1, maxN - safeMaxN); n--) {
            const r_px = Math.sqrt(n * lambda * focalLength) * scale;
            ctx.beginPath(); ctx.arc(0, 0, r_px, 0, Math.PI * 2);
            ctx.fillStyle = n % 2 === 1 ? '#fff' : '#000';
            ctx.fill();
          }
      }
  }
  else if (aperture.type === ApertureType.PHOTON_SIEVE) {
       const sieveZones = aperture.zones || 15;
       const maxSieveR = aperture.diameter / 2;
       for (let n = 1; n <= sieveZones * 4; n++) {
           const r_center_mm = Math.sqrt((n + 0.5) * lambda * focalLength);
           const r_width_mm = Math.sqrt((n + 1) * lambda * focalLength) - Math.sqrt(n * lambda * focalLength);
           if (r_center_mm > maxSieveR) break;
           if (n % 2 === 0) continue;
           const hole_d = 1.53 * r_width_mm; 
           const hole_r_px = (hole_d * scale) / 2;
           if (hole_r_px < 0.2) continue; 
           const r_px = r_center_mm * scale;
           const circumference = 2 * Math.PI * r_center_mm;
           const numHoles = Math.floor((circumference / (hole_d * 1.5))); 
           for(let k=0; k<numHoles; k++) {
               const theta = (k / numHoles) * Math.PI * 2 + (random() * 0.5);
               ctx.beginPath(); ctx.arc(r_px * Math.cos(theta), r_px * Math.sin(theta), hole_r_px, 0, Math.PI*2); ctx.fill();
           }
       }
  }
  else if (aperture.type === ApertureType.SLIT) {
      const sw = (aperture.slitWidth || 0.2) * scale;
      const sh = (aperture.diameter || 5.0) * scale; 
      ctx.fillRect(-sh/2, -sw/2, sh, sw);
  }
  else if (aperture.type === ApertureType.SLIT_ARRAY) {
           const n = Math.max(2, aperture.count || 2);
           const w = (aperture.slitWidth || 0.1) * scale;
           const h = (aperture.diameter || 5.0) * scale;
           const spacing = (aperture.spread || 0.5) * scale; 
           
           const totalWidth = (n - 1) * spacing;
           const startX = -totalWidth / 2;
           
           for(let i=0; i<n; i++) {
               ctx.fillRect(startX + i*spacing - w/2, -h/2, w, h);
           }
  }
  else if (aperture.type === ApertureType.CROSS) {
          const w = (aperture.slitWidth || 0.5) * scale;
          const len = (aperture.diameter) * scale; 
          ctx.fillRect(-w/2, -len/2, w, len);
          ctx.fillRect(-len/2, -w/2, len, w);
  }
  else if (aperture.type === ApertureType.ANNULAR) {
          const rOut = (aperture.diameter * scale) / 2;
          const id = aperture.innerDiameter !== undefined ? aperture.innerDiameter : aperture.diameter * 0.5;
          const rIn = (id * scale) / 2;
          ctx.beginPath(); 
          ctx.arc(0, 0, Math.max(0, rOut), 0, Math.PI*2); 
          ctx.arc(0, 0, Math.max(0, rIn), 0, Math.PI*2, true); 
          ctx.fill();
  }
  else if (aperture.type === ApertureType.WAVES || aperture.type === ApertureType.YIN_YANG) {
          const width = (aperture.diameter || 10) * scale;
          const thickness = (aperture.slitWidth || 0.1) * scale;
          const amplitude = (aperture.slitHeight || 2.0) * scale;
          const waves = aperture.count || 1;
          
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.lineWidth = thickness;
          ctx.strokeStyle = '#fff';
          
          ctx.beginPath();
          const steps = 100 * waves;
          let first = true;
          for (let i=0; i<=steps; i++) {
              const xNorm = i/steps; 
              const x = (xNorm - 0.5) * width;
              const angle = xNorm * Math.PI * 2 * waves;
              const y = (amplitude/2) * Math.sin(angle);
              if (first) { ctx.moveTo(x,y); first=false; }
              else ctx.lineTo(x,y);
          }
          ctx.stroke();

          if (aperture.type === ApertureType.YIN_YANG) {
               const dotR = (aperture.innerDiameter || 0.2) * scale / 2;
               ctx.fillStyle = '#fff';
               for(let w=0; w<waves; w++) {
                   const peakXNorm = (w + 0.25) / waves;
                   const troughXNorm = (w + 0.75) / waves;
                   const px = (peakXNorm - 0.5) * width;
                   const tx = (troughXNorm - 0.5) * width;
                   ctx.beginPath(); ctx.arc(px, 0, dotR, 0, Math.PI*2); ctx.fill();
                   ctx.beginPath(); ctx.arc(tx, 0, dotR, 0, Math.PI*2); ctx.fill();
               }
          }
  }
  else if (aperture.type === ApertureType.ZIGZAG) {
         const width = (aperture.diameter || 5) * scale;
         const height = (aperture.slitHeight || 2.0) * scale;
         const segments = Math.max(1, aperture.count || 5);
         const thickness = (aperture.slitWidth || 0.2) * scale;
         
         ctx.lineCap = 'round';
         ctx.lineJoin = 'miter';
         ctx.lineWidth = thickness;
         ctx.strokeStyle = '#fff';
         
         ctx.beginPath();
         
         const stepX = width / segments;
         const startX = -width / 2;
         
         ctx.moveTo(startX, height/2); // Start bottom-left relative
         
         for(let i=1; i<=segments; i++) {
             const x = startX + i * stepX;
             const y = (i % 2 === 0) ? height/2 : -height/2;
             ctx.lineTo(x, y);
         }
         ctx.stroke();
  }
  else if (aperture.type === ApertureType.DOT_SLIT) {
         const dotR = (aperture.innerDiameter || 0.2) * scale / 2;
         const slitW = (aperture.slitWidth || 0.2) * scale;
         const slitL = (aperture.diameter || 5) * scale;
         const dist = (aperture.spread || 1.0) * scale;
         
         // Left: Dot
         ctx.beginPath();
         ctx.arc(-dist/2, 0, dotR, 0, Math.PI*2);
         ctx.fill();
         
         // Right: Slit (Vertical)
         ctx.fillRect(dist/2 - slitW/2, -slitL/2, slitW, slitL);
  }
  else if (aperture.type === ApertureType.LITHO_OPC) {
             const cd = (aperture.diameter || 1.0) * scale; 
             const height = cd * 5; 
             ctx.fillRect(-cd/2, -height/2, cd, height);
             const srafWidth = (aperture.slitWidth || cd*0.25) * scale;
             const srafDist = (aperture.spread || 1.0) * scale; 
             const leftX = -cd/2 - srafDist - srafWidth;
             const rightX = cd/2 + srafDist;
             ctx.fillRect(leftX, -height/2, srafWidth, height);
             ctx.fillRect(rightX, -height/2, srafWidth, height);
  }
  else if (aperture.type === ApertureType.MULTI_DOT) {
            const count = Math.max(1, aperture.count || 8);
            const spread = (aperture.spread || 2.0) * scale; 
            const dotR = (aperture.diameter || 0.2) * scale / 2;
            const pattern = aperture.multiDotPattern || MultiDotPattern.RING;
            
            if (aperture.centerDot) {
                ctx.beginPath(); ctx.arc(0, 0, dotR, 0, Math.PI*2); ctx.fill();
            }

            if (pattern === MultiDotPattern.RING) {
                for(let i=0; i<count; i++) {
                    const theta = (i/count) * Math.PI*2;
                    ctx.beginPath(); ctx.arc(spread*Math.cos(theta), spread*Math.sin(theta), dotR, 0, Math.PI*2); ctx.fill();
                }
            } else if (pattern === MultiDotPattern.GRID) {
                const side = Math.ceil(Math.sqrt(count));
                const spacing = spread * 2 / Math.max(1, side - 1);
                const start = -(side-1)*spacing/2;
                let drawn = 0;
                for(let r=0; r<side; r++) {
                    for(let c=0; c<side; c++) {
                        if(drawn >= count) break;
                        ctx.beginPath(); ctx.arc(start + c*spacing, start + r*spacing, dotR, 0, Math.PI*2); ctx.fill();
                        drawn++;
                    }
                }
            } else if (pattern === MultiDotPattern.CONCENTRIC) {
                const rings = 5;
                for(let r=1; r<=rings; r++) {
                     const rad = (r/rings) * spread;
                     const dotsInThisRing = Math.max(3, Math.floor(count * (r/((rings*(rings+1))/2)))); 
                     for(let k=0; k<dotsInThisRing; k++) {
                         const th = (k/dotsInThisRing) * Math.PI*2 + (r % 2) * (Math.PI/dotsInThisRing);
                         ctx.beginPath(); ctx.arc(rad*Math.cos(th), rad*Math.sin(th), dotR, 0, Math.PI*2); ctx.fill();
                     }
                }
            } else if (pattern === MultiDotPattern.RANDOM) {
                 for(let i=0; i<count; i++) {
                      const r = spread * Math.sqrt(random());
                      const th = 2 * Math.PI * random();
                      ctx.beginPath(); ctx.arc(r*Math.cos(th), r*Math.sin(th), dotR, 0, Math.PI*2); ctx.fill();
                 }
            } else if (pattern === MultiDotPattern.LINE) {
                 const step = (spread * 2) / Math.max(1, count - 1);
                 const start = -spread;
                 for(let i=0; i<count; i++) {
                     ctx.beginPath(); ctx.arc(start + i*step, 0, dotR, 0, Math.PI*2); ctx.fill();
                 }
            }
  }
  else if (aperture.type === ApertureType.FIBONACCI) {
      const points = aperture.count || 50;
      const maxRad = (aperture.spread || 2.0) * scale;
      const fDotR = (aperture.diameter || 0.1) * scale / 2;
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < points; i++) {
         const r = maxRad * Math.sqrt(i / points);
         const theta = i * goldenAngle;
         ctx.beginPath(); ctx.arc(r * Math.cos(theta), r * Math.sin(theta), fDotR, 0, Math.PI*2); ctx.fill();
      }
  }
  else if (aperture.type === ApertureType.STAR) {
            const spikes = aperture.spikes || 5;
            const outerRadius = (aperture.diameter * scale) / 2;
            const irVal = aperture.innerDiameter !== undefined ? aperture.innerDiameter : aperture.diameter * 0.4;
            const innerRadius = (irVal * scale) / 2;
            let rot = Math.PI / 2 * 3;
            const step = Math.PI / spikes;
            ctx.beginPath();
            ctx.moveTo(0, -outerRadius); 
            for (let i = 0; i < spikes; i++) {
                ctx.lineTo(Math.cos(rot) * outerRadius, Math.sin(rot) * outerRadius);
                rot += step;
                ctx.lineTo(Math.cos(rot) * innerRadius, Math.sin(rot) * innerRadius);
                rot += step;
            }
            ctx.lineTo(0, -outerRadius);
            ctx.closePath();
            ctx.fill();
  }
  else if (aperture.type === ApertureType.FRACTAL) {
            const fSize = (aperture.spread || 10) * scale;
            const iter = Math.min(5, aperture.iteration || 3);
            const drawCarpet = (x: number, y: number, s: number, depth: number) => {
                if (depth === 0) {
                    ctx.fillRect(x - s/2, y - s/2, s, s);
                    return;
                }
                const newS = s / 3;
                if (newS < 0.5) { ctx.fillRect(x - s/2, y - s/2, s, s); return; }
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue; 
                        drawCarpet(x + dx * newS, y + dy * newS, newS, depth - 1);
                    }
                }
            };
            drawCarpet(0, 0, fSize, iter);
  }
  else if (aperture.type === ApertureType.SIERPINSKI_TRIANGLE) {
             const sTrSize = (aperture.spread || 5.0) * scale;
             const sTrIter = Math.min(6, aperture.iteration || 3);
             const R = sTrSize / Math.sqrt(3);
             const p1 = { x: 0, y: -R };
             const p2 = { x: sTrSize/2, y: R/2 };
             const p3 = { x: -sTrSize/2, y: R/2 };
             const drawTri = (v1: {x:number, y:number}, v2: {x:number, y:number}, v3: {x:number, y:number}, depth: number) => {
                 if (depth === 0) {
                     ctx.beginPath();
                     ctx.moveTo(v1.x, v1.y);
                     ctx.lineTo(v2.x, v2.y);
                     ctx.lineTo(v3.x, v3.y);
                     ctx.fill();
                     return;
                 }
                 const m12 = { x: (v1.x + v2.x)/2, y: (v1.y + v2.y)/2 };
                 const m23 = { x: (v2.x + v3.x)/2, y: (v2.y + v3.y)/2 };
                 const m31 = { x: (v3.x + v1.x)/2, y: (v3.y + v1.y)/2 };
                 const dist = Math.sqrt((v1.x-v2.x)**2 + (v1.y-v2.y)**2);
                 if (dist < 1) { 
                     ctx.beginPath();
                     ctx.moveTo(v1.x, v1.y);
                     ctx.lineTo(v2.x, v2.y);
                     ctx.lineTo(v3.x, v3.y);
                     ctx.fill();
                     return;
                 }
                 drawTri(v1, m12, m31, depth - 1);
                 drawTri(m12, v2, m23, depth - 1);
                 drawTri(m31, m23, v3, depth - 1);
             };
             drawTri(p1, p2, p3, sTrIter);
  }
  else if (aperture.type === ApertureType.LISSAJOUS) {
             const rx = aperture.lissajousRX || 3;
             const ry = aperture.lissajousRY || 2;
             const delta = (aperture.lissajousDelta || 0) * (Math.PI/180);
             const r = (aperture.diameter * scale) / 2;
             const thickness = (aperture.slitWidth || 0.1) * scale;
             
             ctx.lineCap = 'round';
             ctx.lineJoin = 'round';
             ctx.lineWidth = thickness;
             ctx.strokeStyle = '#fff';
             
             ctx.beginPath();
             const steps = 500;
             for(let i=0; i<=steps; i++) {
                 const t = (i/steps) * Math.PI * 2;
                 const x = r * Math.sin(rx * t + delta);
                 const y = r * Math.sin(ry * t);
                 if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
             }
             ctx.stroke();
  }
  else if (aperture.type === ApertureType.SPIRAL) {
             const arms = Math.max(1, aperture.spiralArms || 1);
             const turns = aperture.spiralTurns || 3;
             const maxR = (aperture.diameter * scale) / 2;
             const thickness = (aperture.slitWidth || 0.1) * scale;
             
             ctx.lineCap = 'round';
             ctx.lineJoin = 'round';
             ctx.lineWidth = thickness;
             ctx.strokeStyle = '#fff';
             
             const angleStep = (Math.PI*2) / arms;
             
             for(let a=0; a<arms; a++) {
                 const startAngle = a * angleStep;
                 ctx.beginPath();
                 const steps = 100 * turns;
                 for(let i=0; i<=steps; i++) {
                     const t = i/steps; // 0 to 1
                     const r = t * maxR;
                     const theta = startAngle + (t * Math.PI * 2 * turns);
                     const x = r * Math.cos(theta);
                     const y = r * Math.sin(theta);
                     if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
                 }
                 ctx.stroke();
             }
  }
  else if (aperture.type === ApertureType.ROSETTE) {
             const petals = aperture.rosettePetals || 5;
             const rBase = (aperture.diameter * scale) / 2;
             const amp = (aperture.slitHeight || rBase * 0.3) * scale; // Amplitude as 'slitHeight'
             const thickness = (aperture.slitWidth || 0.1) * scale;
             
             ctx.lineCap = 'round';
             ctx.lineJoin = 'round';
             ctx.lineWidth = thickness;
             ctx.strokeStyle = '#fff';
             
             ctx.beginPath();
             const steps = 360;
             for(let i=0; i<=steps; i++) {
                 const theta = (i/steps) * Math.PI * 2;
                 // r = R + A * cos(k*theta)
                 const r = rBase + amp * Math.cos(petals * theta);
                 const x = r * Math.cos(theta);
                 const y = r * Math.sin(theta);
                 if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
             }
             ctx.closePath();
             ctx.stroke();
  }
  else if (aperture.type === ApertureType.RANDOM) {
        const rCount = aperture.count || 50;
        const rSpread = (aperture.spread || aperture.diameter) * scale / 2;
        const rSizeBase = (aperture.diameter || 0.1) * scale / 4;
        for(let i=0; i<rCount; i++) {
            const r = rSpread * Math.sqrt(random());
            const th = 2 * Math.PI * random();
            const s = rSizeBase * (0.5 + 1.5*random()); 
            ctx.beginPath(); ctx.arc(r*Math.cos(th), r*Math.sin(th), s, 0, Math.PI*2); ctx.fill();
        }
  }
  else if (aperture.type === ApertureType.FREEFORM) {
         if (aperture.customPath && aperture.customPath.length > 0) {
              const ffScale = (aperture.diameter || 10) * scale; 
              ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = (aperture.brushSize || 0.5) * scale; ctx.strokeStyle = '#fff';
              ctx.beginPath();
              let penDown = false;
              for(let i=0; i<aperture.customPath.length; i++) {
                  const p = aperture.customPath[i];
                  // IMPORTANT: null check for pen up
                  if (p.x === null || p.y === null || isNaN(p.x)) { 
                      penDown = false; 
                      ctx.stroke(); 
                      ctx.beginPath(); 
                      continue; 
                  }
                  const px = p.x * (ffScale/2); const py = p.y * (ffScale/2);
                  if (!penDown) { ctx.moveTo(px, py); penDown = true; } else { ctx.lineTo(px, py); }
              }
              ctx.stroke();
         }
  }
  else {
      // Default
      ctx.beginPath(); ctx.arc(0, 0, radiusPx, 0, Math.PI * 2); ctx.fill();
  }

  // --- DRAW SPIDER VANES (OBSTRUCTIONS) ---
  if (aperture.spiderVanes && aperture.spiderVanes > 0) {
      const numVanes = aperture.spiderVanes;
      const vaneWidth = (aperture.spiderWidth || 0.05) * scale;
      const maxDim = (aperture.diameter * scale) * 1.5; // Ensure they go past the edge
      const globalRot = (aperture.spiderRotation || 0) * Math.PI / 180;
      
      ctx.fillStyle = '#000'; // Obstruction is black
      
      // We restore the context first to remove the main aperture rotation
      // then apply the independent spider rotation
      ctx.restore(); 
      ctx.save();
      ctx.rotate(globalRot);

      for(let i = 0; i < numVanes; i++) {
          const theta = (i * 2 * Math.PI) / numVanes;
          ctx.save();
          ctx.rotate(theta);
          // Draw a rectangle from center outwards
          ctx.fillRect(-vaneWidth/2, 0, vaneWidth, maxDim);
          ctx.restore();
      }
  }

  ctx.restore();
};

export const generateKernel = (camera: CameraConfig, aperture: ApertureConfig, wavelength: number, pixelsPerMm: number, maskBitmap?: ImageBitmap): Float32Array => {
    // Stub: Logic moved to worker for full image FFT.
    // This allows for future client-side light kernels if needed, but for now it's a placeholder.
    return new Float32Array(0); 
};
