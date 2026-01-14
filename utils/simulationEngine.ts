
export const WORKER_SOURCE = `
// --- CONSTANTS ---
const ApertureType = {
  PINHOLE: 'PINHOLE',
  POLYGON: 'POLYGON', 
  ZONE_PLATE: 'ZONE_PLATE', 
  PHOTON_SIEVE: 'PHOTON_SIEVE',
  SLIT: 'SLIT', 
  CROSS: 'CROSS', 
  SLIT_ARRAY: 'SLIT_ARRAY', 
  DIFFRACTION_GRATING: 'DIFFRACTION_GRATING',
  RANDOM: 'RANDOM', 
  ANNULAR: 'ANNULAR',
  MULTI_DOT: 'MULTI_DOT', 
  STAR: 'STAR', 
  WAVES: 'WAVES', 
  YIN_YANG: 'YIN_YANG',
  URA: 'URA', 
  FREEFORM: 'FREEFORM', 
  FIBONACCI: 'FIBONACCI', 
  FRACTAL: 'FRACTAL',
  SIERPINSKI_TRIANGLE: 'SIERPINSKI_TRIANGLE', 
  LITHO_OPC: 'LITHO_OPC', 
  LISSAJOUS: 'LISSAJOUS', 
  SPIRAL: 'SPIRAL', 
  ROSETTE: 'ROSETTE', 
  ZIGZAG: 'ZIGZAG',
  DOT_SLIT: 'DOT_SLIT',
  CUSTOM: 'CUSTOM'
};

const MultiDotPattern = {
  RING: 'RING',
  LINE: 'LINE',
  GRID: 'GRID',
  RANDOM: 'RANDOM',
  CONCENTRIC: 'CONCENTRIC'
};

const PHYSICS_CONSTANTS = {
  WAVELENGTH_TO_MM: 1e-6,
  SPECTRAL_WAVELENGTHS: [640, 590, 530, 490, 450], 
  SPECTRAL_COLORS: [
      [1.0, 0.0, 0.0], // Red
      [1.0, 0.6, 0.0], // Orange/Amber
      [0.0, 1.0, 0.0], // Green
      [0.0, 0.8, 1.0], // Cyan
      [0.2, 0.0, 1.0]  // Blue/Violet
  ]
};

// --- HELPER FUNCTIONS (Post-Processing) ---

const resizeImageData = (input, targetWidth) => {
    const scale = targetWidth / input.width;
    const targetHeight = Math.round(input.height * scale);
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    
    const srcCanvas = new OffscreenCanvas(input.width, input.height);
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.putImageData(input, 0, 0);
    
    ctx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight);
    return ctx.getImageData(0, 0, targetWidth, targetHeight);
};

const applyVignetting = (data, focalLengthMm, sensorWidthMm) => {
    const { width, height, data: pixels } = data;
    const pixelsPerMm = width / sensorWidthMm;
    const centerX = width / 2;
    const centerY = height / 2;
    const f2 = focalLengthMm * focalLengthMm;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dx = (x - centerX) / pixelsPerMm;
            const dy = (y - centerY) / pixelsPerMm;
            const r2 = dx * dx + dy * dy;
            
            // Cos^4 Law for natural vignetting
            const cosTheta = focalLengthMm / Math.sqrt(f2 + r2);
            const cos4 = cosTheta * cosTheta * cosTheta * cosTheta;
            
            const idx = (y * width + x) * 4;
            pixels[idx] *= cos4;
            pixels[idx + 1] *= cos4;
            pixels[idx + 2] *= cos4;
        }
    }
};

const applySensorNoise = (data, iso) => {
    const pixels = data.data;
    const isoFactor = Math.max(0, iso - 100);
    
    // Noise model parameters
    const readNoiseStdDev = (isoFactor / 3200) * 2.0; 
    const shotNoiseFactor = (isoFactor / 1600) * 1.5; 

    // Gaussian generator (Box-Muller transform)
    const randn_bm = () => {
        let u = 0, v = 0;
        while(u === 0) u = Math.random();
        while(v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };

    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i+3] === 0) continue; 

        // Monochromatic Noise Calculation
        // We generate a single random value for the pixel (Luminance noise)
        // instead of separate R,G,B values (which creates Color noise).
        const n = randn_bm();

        // Calculate Pixel Luminance (approximate)
        const luma = pixels[i] * 0.299 + pixels[i+1] * 0.587 + pixels[i+2] * 0.114;

        // Signal Dependent Noise (Shot Noise scales with sqrt of signal)
        const noiseDelta = n * (readNoiseStdDev + Math.sqrt(luma) * shotNoiseFactor);

        // Apply same delta to all channels to preserve Hue
        pixels[i]   = Math.min(255, Math.max(0, pixels[i]   + noiseDelta));
        pixels[i+1] = Math.min(255, Math.max(0, pixels[i+1] + noiseDelta));
        pixels[i+2] = Math.min(255, Math.max(0, pixels[i+2] + noiseDelta));
    }
};

// --- FFT LIBRARY (Cooley-Tukey Radix-2) ---
class ComplexArray {
    constructor(n) {
        this.n = n;
        this.real = new Float32Array(n);
        this.imag = new Float32Array(n);
    }
}

const FFT = {
    transform: (out, inverse) => {
        const n = out.n;
        const bits = Math.log2(n);
        for (let i = 0; i < n; i++) {
            let rev = 0, val = i;
            for (let j = 0; j < bits; j++) { rev = (rev << 1) | (val & 1); val >>= 1; }
            if (rev > i) {
                const tr = out.real[i], ti = out.imag[i];
                out.real[i] = out.real[rev]; out.imag[i] = out.imag[rev];
                out.real[rev] = tr; out.imag[rev] = ti;
            }
        }
        for (let s = 1; s <= bits; s++) {
            const m = 1 << s, m2 = m >> 1;
            const theta = (inverse ? -2 : 2) * Math.PI / m;
            const wR_base = Math.cos(theta), wI_base = Math.sin(theta);
            for (let k = 0; k < n; k += m) {
                let wR = 1, wI = 0;
                for (let j = 0; j < m2; j++) {
                    const idx = k + j + m2;
                    const tR = wR * out.real[idx] - wI * out.imag[idx];
                    const tI = wR * out.imag[idx] + wI * out.real[idx];
                    const uR = out.real[k+j], uI = out.imag[k+j];
                    out.real[k+j] = uR + tR; out.imag[k+j] = uI + tI;
                    out.real[idx] = uR - tR; out.imag[idx] = uI - tI;
                    const nextWR = wR * wR_base - wI * wI_base;
                    wI = wR * wI_base + wI * wR_base; wR = nextWR;
                }
            }
        }
        if (inverse) {
            for(let i=0; i<n; i++) { out.real[i] /= n; out.imag[i] /= n; }
        }
    },
    fft2D: (cArr, w, h, inverse) => {
        for(let y=0; y<h; y++) {
            const row = new ComplexArray(w);
            const off = y*w;
            for(let x=0; x<w; x++) { row.real[x] = cArr.real[off+x]; row.imag[x] = cArr.imag[off+x]; }
            FFT.transform(row, inverse);
            for(let x=0; x<w; x++) { cArr.real[off+x] = row.real[x]; cArr.imag[off+x] = row.imag[x]; }
        }
        for(let x=0; x<w; x++) {
            const col = new ComplexArray(h);
            for(let y=0; y<h; y++) { col.real[y] = cArr.real[y*w+x]; col.imag[y] = cArr.imag[y*w+x]; }
            FFT.transform(col, inverse);
            for(let y=0; y<h; y++) { cArr.real[y*w+x] = col.real[y]; cArr.imag[y*w+x] = col.imag[y]; }
        }
    },
    fftShift: (cArr, w, h) => {
        const halfW = w >>> 1;
        const halfH = h >>> 1;
        const tempR = new Float32Array(w*h);
        const tempI = new Float32Array(w*h);
        for(let y=0; y<h; y++) {
            for(let x=0; x<w; x++) {
                const newX = (x + halfW) % w;
                const newY = (y + halfH) % h;
                const iOld = y*w + x;
                const iNew = newY*w + newX;
                tempR[iNew] = cArr.real[iOld];
                tempI[iNew] = cArr.imag[iOld];
            }
        }
        cArr.real.set(tempR);
        cArr.imag.set(tempI);
    },
    multiply: (a, b) => {
        const n = a.n;
        const res = new ComplexArray(n);
        for(let i=0; i<n; i++) {
            res.real[i] = a.real[i]*b.real[i] - a.imag[i]*b.imag[i];
            res.imag[i] = a.real[i]*b.imag[i] + a.imag[i]*b.real[i];
        }
        return res;
    }
};

const drawAperture = (ctx, scale, aperture, maskBitmap, focalLength) => {
  ctx.save();
  ctx.rotate((aperture.rotation || 0) * Math.PI / 180);
  const radiusPx = (aperture.diameter * scale) / 2;
  ctx.fillStyle = '#fff';
  
  const minDraw = 0.0; 

  let seed = aperture.seed || 12345;
  const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

  if (aperture.type === ApertureType.PINHOLE) {
      ctx.beginPath(); ctx.arc(0, 0, Math.max(minDraw, radiusPx), 0, Math.PI * 2); ctx.fill();
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
        if (maskBitmap) {
            const size = aperture.diameter * scale;
            ctx.drawImage(maskBitmap, -size/2, -size/2, size, size);
        } else {
             ctx.fillRect(-radiusPx, -radiusPx, radiusPx*2, radiusPx*2);
        }
  }
  else if (aperture.type === ApertureType.SLIT) {
      const sw = (aperture.slitWidth || 0.2) * scale;
      const sh = (aperture.diameter || 5.0) * scale; 
      ctx.fillRect(-sh/2, -sw/2, sh, sw);
  }
  else if (aperture.type === ApertureType.CROSS) {
      const w = (aperture.slitWidth || 0.5) * scale;
      const len = (aperture.diameter) * scale; 
      ctx.fillRect(-w/2, -len/2, w, len);
      ctx.fillRect(-len/2, -w/2, len, w);
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
  else if (aperture.type === ApertureType.WAVES || aperture.type === ApertureType.YIN_YANG) {
          const width = (aperture.diameter || 10) * scale;
          const thickness = (aperture.slitWidth || 0.1) * scale;
          const amplitude = (aperture.slitHeight || 2.0) * scale;
          const waves = aperture.count || 1;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = thickness; ctx.strokeStyle = '#fff';
          ctx.beginPath();
          const steps = 100 * waves;
          let first = true;
          for (let i=0; i<=steps; i++) {
              const xNorm = i/steps; 
              const x = (xNorm - 0.5) * width;
              const angle = xNorm * Math.PI * 2 * waves;
              const y = (amplitude/2) * Math.sin(angle);
              if (first) { ctx.moveTo(x,y); first=false; } else ctx.lineTo(x,y);
          }
          ctx.stroke();
          if (aperture.type === ApertureType.YIN_YANG) {
               const dotR = (aperture.innerDiameter || 0.2) * scale / 2;
               ctx.fillStyle = '#fff';
               for(let w=0; w<waves; w++) {
                   const peakXNorm = (w + 0.25) / waves; const troughXNorm = (w + 0.75) / waves;
                   const px = (peakXNorm - 0.5) * width; const tx = (troughXNorm - 0.5) * width;
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
         ctx.lineCap = 'round'; ctx.lineJoin = 'miter'; ctx.lineWidth = thickness; ctx.strokeStyle = '#fff';
         ctx.beginPath();
         const stepX = width / segments;
         const startX = -width / 2;
         ctx.moveTo(startX, height/2);
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
         ctx.beginPath(); ctx.arc(-dist/2, 0, dotR, 0, Math.PI*2); ctx.fill();
         ctx.fillRect(dist/2 - slitW/2, -slitL/2, slitW, slitL);
  }
  else if (aperture.type === ApertureType.LISSAJOUS) {
             const rx = aperture.lissajousRX || 3;
             const ry = aperture.lissajousRY || 2;
             const delta = (aperture.lissajousDelta || 0) * (Math.PI/180);
             const r = (aperture.diameter * scale) / 2;
             const thickness = (aperture.slitWidth || 0.1) * scale;
             ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = thickness; ctx.strokeStyle = '#fff';
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
             ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = thickness; ctx.strokeStyle = '#fff';
             const angleStep = (Math.PI*2) / arms;
             for(let a=0; a<arms; a++) {
                 const startAngle = a * angleStep;
                 ctx.beginPath();
                 const steps = 100 * turns;
                 for(let i=0; i<=steps; i++) {
                     const t = i/steps; 
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
             const amp = (aperture.slitHeight || rBase * 0.3) * scale; 
             const thickness = (aperture.slitWidth || 0.1) * scale;
             ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = thickness; ctx.strokeStyle = '#fff';
             ctx.beginPath();
             const steps = 360;
             for(let i=0; i<=steps; i++) {
                 const theta = (i/steps) * Math.PI * 2;
                 const r = rBase + amp * Math.cos(petals * theta);
                 const x = r * Math.cos(theta);
                 const y = r * Math.sin(theta);
                 if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
             }
             ctx.closePath(); ctx.stroke();
  }
  else if (aperture.type === ApertureType.ANNULAR) {
          const rOut = radiusPx;
          const id = aperture.innerDiameter !== undefined ? aperture.innerDiameter : aperture.diameter * 0.5;
          const rIn = (id * scale) / 2;
          ctx.beginPath(); 
          ctx.arc(0, 0, Math.max(minDraw, rOut), 0, Math.PI*2); 
          ctx.arc(0, 0, Math.max(0, rIn), 0, Math.PI*2, true); 
          ctx.fill();
  }
  else if (aperture.type === ApertureType.ZONE_PLATE) {
        const lambda = 0.00055; 
        const maxN = Math.floor(Math.pow(aperture.diameter/2, 2) / (lambda * focalLength));
        const safeMaxN = Math.min(maxN, 3000); 
        for (let n = Math.max(1, maxN); n >= Math.max(1, maxN - safeMaxN); n--) {
            const r_px = Math.sqrt(n * lambda * focalLength) * scale;
            ctx.beginPath(); ctx.arc(0, 0, r_px, 0, Math.PI * 2);
            ctx.fillStyle = n % 2 === 1 ? '#fff' : '#000';
            ctx.fill();
        }
  }
  else if (aperture.type === ApertureType.PHOTON_SIEVE) {
       const sieveZones = aperture.zones || 15;
       const lambda = 0.00055;
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
  else if (aperture.type === ApertureType.MULTI_DOT) {
        const count = Math.max(1, aperture.count || 8);
        const spread = (aperture.spread || 2.0) * scale; 
        const dotR = (aperture.diameter || 0.2) * scale / 2;
        const pattern = aperture.multiDotPattern || MultiDotPattern.RING;
        if (aperture.centerDot) { ctx.beginPath(); ctx.arc(0, 0, dotR, 0, Math.PI*2); ctx.fill(); }
        if (pattern === MultiDotPattern.RING) {
            for(let i=0; i<count; i++) { const theta = (i/count) * Math.PI*2; ctx.beginPath(); ctx.arc(spread*Math.cos(theta), spread*Math.sin(theta), dotR, 0, Math.PI*2); ctx.fill(); }
        } else if (pattern === MultiDotPattern.RANDOM) {
            for(let i=0; i<count; i++) { const r = spread * Math.sqrt(random()); const th = 2 * Math.PI * random(); ctx.beginPath(); ctx.arc(r*Math.cos(th), r*Math.sin(th), dotR, 0, Math.PI*2); ctx.fill(); }
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
            const drawCarpet = (x, y, s, depth) => {
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
             const drawTri = (v1, v2, v3, depth) => {
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
  else if (aperture.type === ApertureType.FREEFORM) {
         if (aperture.customPath && aperture.customPath.length > 0) {
              const ffScale = (aperture.diameter || 10) * scale; 
              ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = (aperture.brushSize || 0.5) * scale; ctx.strokeStyle = '#fff';
              ctx.beginPath();
              let penDown = false;
              for(let i=0; i<aperture.customPath.length; i++) {
                  const p = aperture.customPath[i];
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
  else if (aperture.type === ApertureType.RANDOM) {
        const rCount = aperture.count || 50;
        const rSpread = (aperture.spread || aperture.diameter) * scale / 2;
        const rSizeBase = (aperture.diameter || 0.1) * scale / 4;
        for(let i=0; i<rCount; i++) {
            const r = rSpread * Math.sqrt(random());
            const th = 2 * Math.PI * random();
            const s = rSizeBase * (0.8 + 0.4*random()); 
            ctx.beginPath(); ctx.arc(r*Math.cos(th), r*Math.sin(th), s, 0, Math.PI*2); ctx.fill();
        }
  }
  else {
      ctx.beginPath(); ctx.arc(0, 0, radiusPx, 0, Math.PI * 2); ctx.fill();
  }

  // --- DRAW SPIDER VANES (OBSTRUCTIONS) ---
  if (aperture.spiderVanes && aperture.spiderVanes > 0) {
      const numVanes = aperture.spiderVanes;
      const vaneWidth = (aperture.spiderWidth || 0.05) * scale;
      const maxDim = (aperture.diameter * scale) * 1.5;
      const globalRot = (aperture.spiderRotation || 0) * Math.PI / 180;
      ctx.fillStyle = '#000'; ctx.restore(); ctx.save(); ctx.rotate(globalRot);
      for(let i = 0; i < numVanes; i++) {
          const theta = (i * 2 * Math.PI) / numVanes;
          ctx.save(); ctx.rotate(theta); ctx.fillRect(-vaneWidth/2, 0, vaneWidth, maxDim); ctx.restore();
      }
  }
  ctx.restore();
};

self.onmessage = async (e) => {
  const { camera, aperture, imageData: sourceImageData, exposure, sourceIntensity, maskBitmap, diffractionBlur } = e.data;
  const report = (label, pct) => self.postMessage({ type: 'progress', label, value: pct });

  try {
      report('Initializing Physics Engine...', 5);
      
      let simInput = sourceImageData;
      
      const outWidth = aperture.resolution || 1024;
      const aspect = camera.sensorHeight / camera.sensorWidth;
      const outHeight = Math.round(outWidth * aspect);
      const sensorWidthMm = camera.sensorWidth;
      const sensorHeightMm = camera.sensorHeight;
      const sensorPixelPitch = sensorWidthMm / outWidth; // mm/px
      const f = camera.focalLength;
      
      // Pre-scale input image to simulation resolution if needed
      // This ensures convolution happens at target res, not input res
      if (simInput && (simInput.width !== outWidth || simInput.height !== outHeight)) {
          simInput = resizeImageData(simInput, outWidth);
      }

      let wavelengths = [];
      let colors = [];
      let usedMethod = 'GEOMETRIC';
      
      if (aperture.useChromaticAberration || aperture.engine === 'WAVE') {
          wavelengths = PHYSICS_CONSTANTS.SPECTRAL_WAVELENGTHS.map(w => w * 1e-6); // mm
          colors = PHYSICS_CONSTANTS.SPECTRAL_COLORS;
      } else {
          const centerWl = (camera.wavelength || 550) * 1e-6;
          wavelengths = [centerWl, centerWl, centerWl];
          colors = [[1,0,0], [0,1,0], [0,0,1]];
      }
      
      const kernelBuffer = new Float32Array(outWidth * outHeight * 3);
      
      for(let idx = 0; idx < wavelengths.length; idx++) {
          const lambdaMm = wavelengths[idx];
          const colorWeights = colors[idx];
          
          if (aperture.engine === 'GEOMETRIC') {
             usedMethod = 'GEOMETRIC';
             const gCanvas = new OffscreenCanvas(outWidth, outHeight);
             const gCtx = gCanvas.getContext('2d');
             gCtx.fillStyle = '#000'; gCtx.fillRect(0,0,outWidth,outHeight);
             gCtx.translate(outWidth/2, outHeight/2);
             const pxPerMm = 1.0 / sensorPixelPitch;
             
             if (diffractionBlur > 0) {
                 const blurPx = diffractionBlur * pxPerMm * 0.5;
                 if (blurPx > 0.1) gCtx.filter = \`blur(\${blurPx}px)\`;
             }

             drawAperture(gCtx, pxPerMm, aperture, maskBitmap, f);
             
             const gData = gCtx.getImageData(0,0,outWidth,outHeight).data;
             for(let i=0; i<outWidth*outHeight; i++) {
                 const val = gData[i*4+1] / 255.0; 
                 if (val > 0) {
                     kernelBuffer[i*3] += val * colorWeights[0];
                     kernelBuffer[i*3+1] += val * colorWeights[1];
                     kernelBuffer[i*3+2] += val * colorWeights[2];
                 }
             }

          } else {
             // WAVE OPTICS (ASM / Fresnel) logic...
             const apSize = Math.max(aperture.diameter, aperture.spread || 0, aperture.slitWidth || 0);
             const sensorMax = Math.max(sensorWidthMm, sensorHeightMm);
             const requiredN = Math.max(2048, Math.pow(2, Math.ceil(Math.log2(outWidth * 1.5))));
             const maxN = Math.min(requiredN, 4096); 
             const minL1 = Math.max(apSize * 1.5, 0.5); 
             const L2_at_minL1 = (maxN * lambdaMm * f) / minL1;
             
             const useASM = L2_at_minL1 < (sensorMax * 0.5);
             usedMethod = useASM ? 'ASM' : 'FRESNEL';
             const N = useASM ? Math.min(requiredN, 2048) : maxN;
             const simulationL = Math.max(apSize, sensorMax) * 1.5; 
             
             if (useASM) {
                 const apCanvas = new OffscreenCanvas(N, N);
                 const apCtx = apCanvas.getContext('2d');
                 apCtx.fillStyle = '#000'; apCtx.fillRect(0,0,N,N);
                 apCtx.translate(N/2, N/2);
                 const pxPerMm_ASM = N / simulationL;
                 drawAperture(apCtx, pxPerMm_ASM, aperture, maskBitmap, f);
                 const apData = apCtx.getImageData(0,0,N,N).data;
                 
                 const field = new ComplexArray(N*N);
                 for(let i=0; i<N*N; i++) {
                     field.real[i] = apData[i*4+1] / 255.0;
                     field.imag[i] = 0;
                 }
                 
                 FFT.fftShift(field, N, N);
                 FFT.fft2D(field, N, N, false);
                 FFT.fftShift(field, N, N);
                 
                 const df = 1.0 / simulationL; 
                 const z = f;
                 const k = 1.0 / lambdaMm;
                 const k2 = k*k;
                 const halfN = N/2;
                 
                 for(let y=0; y<N; y++) {
                     const fy = (y - halfN) * df;
                     const fy2 = fy*fy;
                     for(let x=0; x<N; x++) {
                         const fx = (x - halfN) * df;
                         const fx2 = fx*fx;
                         const idx = y*N + x;
                         if (fx2 + fy2 < k2) {
                             const root = Math.sqrt(k2 - fx2 - fy2);
                             const phase = 2 * Math.PI * z * root;
                             const cosP = Math.cos(phase);
                             const sinP = Math.sin(phase);
                             const re = field.real[idx];
                             const im = field.imag[idx];
                             field.real[idx] = re*cosP - im*sinP;
                             field.imag[idx] = re*sinP + im*cosP;
                         } else {
                             field.real[idx] = 0;
                             field.imag[idx] = 0;
                         }
                     }
                 }
                 
                 FFT.fftShift(field, N, N);
                 FFT.fft2D(field, N, N, true);
                 FFT.fftShift(field, N, N);
                 
                 const intensity = new Float32Array(N*N);
                 let totalE = 0;
                 for(let i=0; i<N*N; i++) {
                     const m = field.real[i]**2 + field.imag[i]**2;
                     intensity[i] = m;
                     totalE += m;
                 }
                 if(totalE > 0) for(let i=0; i<N*N; i++) intensity[i] /= totalE;
                 
                 const center = N/2;
                 const outCenterX = outWidth/2;
                 const outCenterY = outHeight/2;
                 const ratio = sensorPixelPitch * pxPerMm_ASM; 
                 
                 for (let y = 0; y < outHeight; y++) {
                     for (let x = 0; x < outWidth; x++) {
                         const gx = center + (x - outCenterX) * ratio;
                         const gy = center + (y - outCenterY) * ratio;
                         
                         if (gx >= 0 && gx < N-1 && gy >= 0 && gy < N-1) {
                              const ix = Math.floor(gx); const iy = Math.floor(gy);
                              const val = intensity[iy*N + ix]; 
                              const kIdx = (y * outWidth + x) * 3;
                              kernelBuffer[kIdx] += val * colorWeights[0];
                              kernelBuffer[kIdx+1] += val * colorWeights[1];
                              kernelBuffer[kIdx+2] += val * colorWeights[2];
                         }
                     }
                 }

             } else {
                 // FRESNEL
                 const targetL1 = (N * lambdaMm * f) / (sensorMax * 1.05);
                 const L1 = Math.max(minL1, targetL1);
                 const L2 = (N * lambdaMm * f) / L1;
                 
                 const apCanvas = new OffscreenCanvas(N, N);
                 const apCtx = apCanvas.getContext('2d');
                 apCtx.fillStyle = '#000'; apCtx.fillRect(0,0,N,N);
                 apCtx.translate(N/2, N/2);
                 const pxPerMm_L1 = N / L1;
                 drawAperture(apCtx, pxPerMm_L1, aperture, maskBitmap, f);
                 const apData = apCtx.getImageData(0,0,N,N).data;
                 
                 const field = new ComplexArray(N*N);
                 const k_chirp = Math.PI / (lambdaMm * f);
                 const dx1 = L1 / N;
                 const halfN = N/2;
                 
                 for(let y=0; y<N; y++) {
                     const dy = (y - halfN) * dx1;
                     const dy2 = dy*dy;
                     for(let x=0; x<N; x++) {
                         const dx = (x - halfN) * dx1;
                         const r2 = dx*dx + dy2;
                         const phase = k_chirp * r2;
                         const amp = apData[(y*N+x)*4+1] / 255.0; 
                         const cosP = Math.cos(phase);
                         const sinP = Math.sin(phase);
                         const idx = y*N + x;
                         field.real[idx] = amp * cosP;
                         field.imag[idx] = amp * sinP;
                     }
                 }
                 
                 FFT.fftShift(field, N, N);
                 FFT.fft2D(field, N, N, false);
                 FFT.fftShift(field, N, N);
                 
                 const intensity = new Float32Array(N*N);
                 let totalE = 0;
                 for(let i=0; i<N*N; i++) {
                     const m = field.real[i]**2 + field.imag[i]**2;
                     intensity[i] = m;
                     totalE += m;
                 }
                 if(totalE > 0) for(let i=0; i<N*N; i++) intensity[i] /= totalE;
                 
                 const center = N/2;
                 const outCenterX = outWidth/2;
                 const outCenterY = outHeight/2;
                 const pxSize_L2 = L2 / N;
                 const ratio = sensorPixelPitch / pxSize_L2;
                 
                 for (let y = 0; y < outHeight; y++) {
                     for (let x = 0; x < outWidth; x++) {
                         const gx = center + (x - outCenterX) * ratio;
                         const gy = center + (y - outCenterY) * ratio;
                         if (gx >= 0 && gx < N-1 && gy >= 0 && gy < N-1) {
                              const ix = Math.floor(gx); const iy = Math.floor(gy);
                              const fx = gx - ix; const fy = gy - iy;
                              const v00 = intensity[iy*N + ix];
                              const v10 = intensity[iy*N + ix+1];
                              const v01 = intensity[(iy+1)*N + ix];
                              const v11 = intensity[(iy+1)*N + ix+1];
                              const val = (v00*(1-fx) + v10*fx)*(1-fy) + (v01*(1-fx) + v11*fx)*fy;
                              
                              const kIdx = (y * outWidth + x) * 3;
                              kernelBuffer[kIdx] += val * colorWeights[0];
                              kernelBuffer[kIdx+1] += val * colorWeights[1];
                              kernelBuffer[kIdx+2] += val * colorWeights[2];
                         }
                     }
                 }
             }
          }
      }
      
      const outputBuffer = new Float32Array(outWidth * outHeight * 3);
      const len = outWidth * outHeight;
      
      let sumR=0, sumG=0, sumB=0;
      for(let i=0; i<len; i++) {
          sumR += kernelBuffer[i*3];
          sumG += kernelBuffer[i*3+1];
          sumB += kernelBuffer[i*3+2];
      }
      const nR = sumR > 0 ? 1.0/sumR : 0;
      const nG = sumG > 0 ? 1.0/sumG : 0;
      const nB = sumB > 0 ? 1.0/sumB : 0;
      
      for(let i=0; i<len; i++) {
          kernelBuffer[i*3] *= nR;
          kernelBuffer[i*3+1] *= nG;
          kernelBuffer[i*3+2] *= nB;
      }

      let finalGain = 1.2 * Math.pow(2, exposure);

      if (aperture.centerDot) {
           const displayGain = sourceIntensity * 50000.0; 
           for(let i=0; i<len*3; i++) {
               outputBuffer[i] = kernelBuffer[i] * displayGain;
           }
      } else {
          if (simInput && simInput.width > 1) {
               report('Convolving Scene...', 70);
               const srcCanvas = new OffscreenCanvas(outWidth, outHeight);
               const srcCtx = srcCanvas.getContext('2d');
               srcCtx.putImageData(simInput, 0, 0); // Already resized
               const srcData = srcCtx.getImageData(0,0,outWidth,outHeight).data;
               
               const fftW = Math.pow(2, Math.ceil(Math.log2(outWidth)));
               const fftH = Math.pow(2, Math.ceil(Math.log2(outHeight)));
               const fftLen = fftW * fftH;
               
               const imgOffX = Math.floor((fftW - outWidth) / 2);
               const imgOffY = Math.floor((fftH - outHeight) / 2);
               
               for (let c = 0; c < 3; c++) {
                   const imgC = new ComplexArray(fftLen);
                   const kerC = new ComplexArray(fftLen);
                   
                   for(let fy=0; fy<fftH; fy++) {
                       let y = fy - imgOffY;
                       if (y < 0) y = 0; 
                       if (y >= outHeight) y = outHeight - 1;
                       for(let fx=0; fx<fftW; fx++) {
                           let x = fx - imgOffX;
                           if (x < 0) x = 0;
                           if (x >= outWidth) x = outWidth - 1;
                           const srcIdx = (y*outWidth + x) * 4;
                           imgC.real[fy*fftW + fx] = Math.pow(srcData[srcIdx+c] / 255.0, 2.2); 
                       }
                   }
                   
                   for(let y=0; y<outHeight; y++) {
                       for(let x=0; x<outWidth; x++) {
                           const fi = (y + imgOffY)*fftW + (x + imgOffX);
                           kerC.real[fi] = kernelBuffer[(y*outWidth+x)*3+c];
                       }
                   }

                   FFT.fftShift(kerC, fftW, fftH);
                   FFT.fft2D(imgC, fftW, fftH, false);
                   FFT.fft2D(kerC, fftW, fftH, false);
                   const resC = FFT.multiply(imgC, kerC);
                   FFT.fft2D(resC, fftW, fftH, true);
                   
                   for(let y=0; y<outHeight; y++) {
                       for(let x=0; x<outWidth; x++) {
                           const val = resC.real[(y + imgOffY)*fftW + (x + imgOffX)];
                           outputBuffer[(y*outWidth+x)*3 + c] = Math.max(0, val * finalGain);
                       }
                   }
                   report(\`Channel \${c+1}/3...\`, 70 + (c+1)*8);
               }
          }
      }

      report('Finalizing...', 95);
      const u8 = new Uint8ClampedArray(outWidth * outHeight * 4);
      for(let i=0; i < len; i++) {
          let r = outputBuffer[i*3];
          let g = outputBuffer[i*3+1];
          let b = outputBuffer[i*3+2];
          
          u8[i*4] = Math.min(255, Math.pow(r, 1/2.2) * 255);
          u8[i*4+1] = Math.min(255, Math.pow(g, 1/2.2) * 255);
          u8[i*4+2] = Math.min(255, Math.pow(b, 1/2.2) * 255);
          u8[i*4+3] = 255;
      }
      
      const finalImageData = new ImageData(u8, outWidth, outHeight);

      // --- APPLY POST PROCESSING (Noise & Vignette) ---
      if (aperture.useVignetting) {
          applyVignetting(finalImageData, camera.focalLength, camera.sensorWidth);
      }

      if (aperture.addSensorNoise && camera.iso > 100) {
          applySensorNoise(finalImageData, camera.iso);
      }
      
      const resultBitmap = await createImageBitmap(finalImageData);
      self.postMessage({ success: true, processed: resultBitmap, metadata: { method: usedMethod } }, [resultBitmap]);

  } catch (err) {
      console.error(err);
      self.postMessage({ success: false, error: err.toString() });
  } finally {
      if (maskBitmap) maskBitmap.close();
  }
};
`;
