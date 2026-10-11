# AQUARYA - Architecture & Implementation Plan

## 1. Project Overview
A single-page, award-winning portfolio grade WebGL/WebGPU experience featuring a playful, procedurally generated 3D cartoon shark swimming continuously in mid-air inside a pastel, luminous, dreamlike "Air Aquarium".

## 2. File Architecture
```
aquarya/
├── index.html              # Clean semantic HTML, Google Fonts, accessible canvas, UI overlays
├── package.json            # Vite + Three.js latest stable
├── vite.config.js          # Build & server config
├── styles.css              # Editorial styling, Fraunces serif, JetBrains Mono, responsive layout
├── src/
│   ├── main.js             # Core bootstrap, WebGPU/WebGL renderer selection, loop, resize
│   ├── shark.js            # 100% procedural 3D cartoon shark model, toon materials, inverted hull outline
│   ├── physics.js          # Segmented spine dynamics, spring-damper drag, autonomous 3D swim curves
│   ├── environment.js      # Luminous sky gradient, floating air motes with wake physics, god rays, blob shadow
│   ├── interaction.js      # Unified pointer events (touch & mouse), raycasting, drag plane, ripples
│   └── ui.js               # Editorial layout, palette selector, sliders, telemetry, skeleton debug
└── README.md               # Documentation and Vercel deployment guide
```

## 3. Spine Physics & Chain Dynamics
- **Chain of 10 vertebrae**: Head -> Thorax -> Abdomen -> Pre-caudal -> Tail fin.
- **Autonomous swimming**: 3D Lissajous trajectory with gentle roll banking, pitch following velocity, and continuous sine wave undulation ($f \approx 1.2\text{ Hz}$) that amplifies toward the tail.
- **Interactive Drag & Drop**:
  - Raycast identifies the nearest segment (snout, belly, tail).
  - Spring-damper constraint connects the grabbed segment to the projected pointer in 3D space.
  - Forward & backward distance-relaxation causes realistic bending, thrashing, and secondary fin flutters.
- **Release Momentum**:
  - Velocity tracking (~80ms moving window).
  - Inertial release with air drag followed by smooth steering re-entry into autonomous swim trajectory.

## 4. Procedural Cartoon Shark & Toon Outline
- **100% Procedural Model**: Chubby torpedo body, large rounded snout, beveled fins, glossy expressive eyes with blink timer and gaze tracking, cute toothy smile, soft pink blush cheeks.
- **Toon Shading & Countershading**:
  - Upper body color (Ocean Blue `#5B8DEF`, Coral Pink `#F48B8B`, Mint Green `#62C4A2`).
  - Warm cream belly (`#FCF5E8`).
  - 3-band cel step lighting with soft rim highlight.
- **Inverted Hull Outline**:
  - Expanded duplicate backface geometry with constant screen-space offset in navy ink tone (`#1E294A`).

## 5. Step-by-Step Implementation Roadmap
- **Step (a)**: Core setup, Vite config, Three.js renderer with WebGPU/WebGL fallback, static procedural shark model with toon materials and inverted hull outline.
- **Step (b)**: Spine chain physics, continuous sinusoidal body wave, autonomous 3D swim trajectory, breathing bobbing.
- **Step (c)**: Environment, sky gradient, floating air motes with velocity wake interaction, soft volumetric light rays, dynamic blob shadow.
- **Step (d)**: Pointer interaction (hover curiosity, raycast grab, spring-damper drag, inertia release, empty click air ripples).
- **Step (e)**: Editorial UI, typography, color palette switcher, physics sliders, mobile bottom-sheet, telemetry, build verification, and git push.
