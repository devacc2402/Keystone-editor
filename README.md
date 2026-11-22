# Keystone Motion Studio

An open-source, browser-based 2D motion graphics and keyframe animation studio built for **Desktop** and **iPad**. Compose vector shapes, typography, and uploaded images or videos on a deterministic HTML5 2D Canvas, animate properties with a multi-track keyframe timeline and cubic-bezier graph editor, and export directly in the browser to Video, Animated GIF, or JSON project files.

## Features

- **2D Layer Compositor**: Create **Shape** (`Rectangle`, `Ellipse`, `Star`), **Text**, **Solid**, and **Image / Video** media layers with blend modes (`Normal`, `Multiply`, `Screen`, `Overlay`, `Darken`, `Lighten`, `Color Dodge`, `Difference`) and parent-child layer linking.
- **Interactive Stage Viewport**: Pan and zoom canvas with direct layer selection, drag-to-move, corner scale handles, rotation handle, and anchor-point crosshair.
- **Keyframe Timeline**: Multi-track timeline with frame ruler scrubbing, draggable/trimmable In/Out layer bars, visibility and lock toggles, layer ordering, and expandable transform keyframe tracks (`Position`, `Scale`, `Rotation`, `Opacity`, `Anchor Point`).
- **Bezier Graph Editor**: Interactive curve editor with draggable cubic-bezier tangent handles and one-click easing presets (`Linear`, `Ease In`, `Ease Out`, `Ease In Out`, `Hold`).
- **Adaptive Desktop & iPad Layout**:
  - **Desktop (`>= 1024px`)**: Multi-panel studio with resizable right `Inspector` / `Media` dock and bottom `Timeline` / `Graph` dock.
  - **iPad & Tablet (`< 1024px`)**: Persistent stage viewport paired with a touch-friendly tabbed workspace (`Timeline`, `Graph`, `Inspector`, `Media`), unified pointer events, and horizontal scrubbable numeric inputs.
- **Browser Export & Local Persistence**:
  - Auto-saves active work locally via **IndexedDB** (with `localStorage` fallback).
  - Export and import portable `.json` project files.
  - Render compositions frame-by-frame in the browser to **WebM / MP4** video (`MediaRecorder`) or **Animated GIF** (built-in pure TypeScript GIF89a encoder).
- **Undo / Redo & Fullscreen**: 50-step immutable undo/redo history and a top-bar fullscreen mode toggle.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Space` | Play / Pause composition |
| `V` | Select & Transform tool |
| `H` | Hand / Pan canvas tool |
| `←` / `→` | Step 1 frame back / forward |
| `Shift + ←` / `Shift + →` | Step 10 frames back / forward |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Delete` / `Backspace` | Delete selected keyframe |

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation & Development

```bash
npm install
npm run dev
```

The development server runs at `http://localhost:3000`.

### Build & Typecheck

```bash
npm run lint
npm run build
npm run preview
```

## Architecture Overview

- **Deterministic Frame Evaluator (`src/utils/interpolation.ts`)**: Computes interpolated scalar/vector transform values using cubic-bezier curves and solves 2D affine parent-child world matrices for any frame `t`.
- **Canvas Renderer (`src/utils/canvasRenderer.ts`)**: Renders compositions identically across live stage scrubbing, real-time playback, and offline frame-by-frame export.
- **Studio State (`src/store/useStudioStore.ts`)**: Central React hook managing compositions, 50-step Undo/Redo history, playback loop, media cache synchronization, and IndexedDB persistence.
- **GIF Encoder (`src/utils/gifEncoder.ts`)**: Pure TypeScript GIF89a encoder with 256-color quantization and LZW compression for zero-dependency client-side GIF rendering.

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request for bug fixes, performance improvements, or new compositing features.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-improvement`)
3. Run `npm run lint` and `npm run build` to verify everything compiles cleanly
4. Commit your changes and open a pull request

## License

Licensed under the **Apache License 2.0**.
