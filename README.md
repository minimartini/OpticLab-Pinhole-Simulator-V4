
# OpticLab: Advanced Pinhole & Diffraction Simulator

**OpticLab** is a scientifically accurate web-based simulator for pinhole photography, diffractive optics, and computational imaging. It calculates the Point Spread Function (PSF) of arbitrary aperture shapes using Wave Optics (Fourier Transforms) and simulates the resulting image on a camera sensor.

![OpticLab Screenshot](https://via.placeholder.com/800x400?text=OpticLab+Simulator)

## Features

### 🔬 Physics Engine
*   **Dual Modes:** 
    *   `Particle (Geometric)`: Fast, ray-tracing approximation for sharpness preview.
    *   `Wave (Diffraction)`: Full scalar diffraction simulation using **Angular Spectrum Method (ASM)** and **Scaled Fresnel Transform**.
*   **Polychromatic Simulation:** Simulates Red, Green, Blue, Cyan, and Amber wavelengths independently to reconstruct accurate chromatic aberration and diffraction fringes.
*   **Arbitrary Apertures:** Pinholes, Zone Plates, Photon Sieves, Binary Stars, Fractals, and Custom Masks.

### 📷 Camera Simulation
*   **Sensor Modeling:** Accurate dimensions for Full Frame (35mm), Medium Format (GFX/Hasselblad), APS-C, and Large Format.
*   **Exposure Calculation:** Real-time T-Stop calculation and Schwarzschild reciprocity failure compensation for analog film.
*   **ISO Noise:** Photon shot noise simulation based on ISO sensitivity.
*   **Vignetting:** Cos⁴ falloff simulation for wide-angle pinholes.

### 🏭 Manufacturing & Export
*   **OpticFab Lab:** Batch export tool for laser cutting or 3D printing.
*   **Formats:** SVG (Vector Cut) and PNG (High-Res Lithography masks).
*   **Kerf Compensation:** Automatic offset adjustment for laser beam width.
*   **Nesting:** Hexagonal packing algorithm to optimize material usage.

## Technical Stack

*   **Frontend:** React 18, TypeScript, Tailwind CSS.
*   **Simulation:** Web Workers for non-blocking UI. 
*   **Math:** Custom FFT implementation (Cooley-Tukey Radix-2).
*   **Graphics:** OffscreenCanvas for high-performance pixel manipulation.

## Installation

This project is designed as a modular single-page application.

1.  **Dependencies:** Ensure you have `react`, `react-dom`, `tailwindcss` available.
2.  **Run:** The project is configured for environments like StackBlitz or standard Vite setups.

```bash
npm install
npm run dev
```

## Usage Guide

1.  **Configure Camera:** Select a preset (e.g., Canon RF, Large Format 4x5) or define custom sensor dimensions and flange distance.
2.  **Design Aperture:** Choose a type (Pinhole, Zone Plate, etc.). Adjust diameter and parameters.
    *   *Tip:* Use the "Optimal" button to set the diameter based on the Rayleigh criterion for the current focal length.
3.  **Simulate:**
    *   Upload an image to the Viewport.
    *   Click "Render Simulation".
    *   Switch to "PRO" mode to enable Diffraction/Wave engine for realistic interference patterns.
4.  **Export:**
    *   Open "OpticFab Lab" (Cube icon).
    *   Add apertures to queue.
    *   Configure sheet size, kerf, and nesting.
    *   Download SVG/PDF.

## License

MIT License. Free for educational and personal use.
