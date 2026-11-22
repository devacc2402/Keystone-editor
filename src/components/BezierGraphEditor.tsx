import React, { useRef, useState } from 'react';
import type {
  BezierHandles,
  EasingPreset,
  Layer,
  TransformPropertyKey,
} from '../types/studio';
import {
  EASING_PRESET_HANDLES,
  getAnimatableProperty,
  getPropertyScalarPreview,
  sampleCubicBezierY,
} from '../utils/interpolation';

interface BezierGraphEditorProps {
  layer: Layer | null;
  activeProperty: TransformPropertyKey;
  onSelectProperty: (prop: TransformPropertyKey) => void;
  durationFrames: number;
  currentFrame: number;
  onSeekFrame: (frame: number) => void;
  onUpdateKeyframeEasing: (
    layerId: string,
    key: TransformPropertyKey,
    keyframeId: string,
    easing: EasingPreset,
    handles?: BezierHandles,
    recordHistory?: boolean
  ) => void;
}

const PROPS: { key: TransformPropertyKey; label: string }[] = [
  { key: 'position', label: 'Position' },
  { key: 'scale', label: 'Scale' },
  { key: 'rotation', label: 'Rotation' },
  { key: 'opacity', label: 'Opacity' },
  { key: 'anchor', label: 'Anchor' },
];

const PRESETS: { id: EasingPreset; label: string }[] = [
  { id: 'linear', label: 'Linear' },
  { id: 'easeIn', label: 'Ease In' },
  { id: 'easeOut', label: 'Ease Out' },
  { id: 'easeInOut', label: 'Ease In Out' },
  { id: 'hold', label: 'Hold' },
];

export const BezierGraphEditor: React.FC<BezierGraphEditorProps> = ({
  layer,
  activeProperty,
  onSelectProperty,
  durationFrames,
  currentFrame,
  onSeekFrame,
  onUpdateKeyframeEasing,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeSegmentIdx, setActiveSegmentIdx] = useState<number>(0);
  const dragHandleRef = useRef<{
    segmentIdx: number;
    handle: 'h1' | 'h2';
  } | null>(null);

  if (!layer) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-400 px-6 text-center">
        Select a layer to inspect and edit its animation curve.
      </div>
    );
  }

  const prop = getAnimatableProperty(layer, activeProperty);
  const keyframes = prop.keyframes;

  // Determine value bounds for Y axis
  const rawVals = keyframes.map((k) =>
    typeof k.value === 'number' ? k.value : k.value[0]
  );
  const fallbackVal = getPropertyScalarPreview(prop, currentFrame);
  const minVal = rawVals.length > 0 ? Math.min(...rawVals) : fallbackVal - 50;
  const maxVal = rawVals.length > 0 ? Math.max(...rawVals) : fallbackVal + 50;
  const span = Math.max(10, maxVal - minVal);
  const yMin = minVal - span * 0.15;
  const yMax = maxVal + span * 0.15;

  const W = 800;
  const H = 200;
  const padX = 28;
  const padY = 20;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const frameToX = (f: number) =>
    padX + (f / Math.max(1, durationFrames)) * innerW;
  const valToY = (v: number) =>
    padY + innerH - ((v - yMin) / Math.max(1e-5, yMax - yMin)) * innerH;

  const safeSegIdx = Math.min(
    Math.max(0, activeSegmentIdx),
    Math.max(0, keyframes.length - 2)
  );
  const activeK0 = keyframes[safeSegIdx];
  const activeK1 = keyframes[safeSegIdx + 1];

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragHandleRef.current;
    if (!drag || !svgRef.current) return;
    const k0 = keyframes[drag.segmentIdx];
    const k1 = keyframes[drag.segmentIdx + 1];
    if (!k0 || !k1) return;

    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;

    const x0 = frameToX(k0.frame);
    const x1 = frameToX(k1.frame);
    const v0 = typeof k0.value === 'number' ? k0.value : k0.value[0];
    const v1 = typeof k1.value === 'number' ? k1.value : k1.value[0];
    const y0 = valToY(v0);
    const y1 = valToY(v1);

    const normX = Math.max(
      0.01,
      Math.min(0.99, (sx - x0) / Math.max(1, x1 - x0))
    );
    const dy = y1 - y0;
    const normY =
      Math.abs(dy) < 2
        ? 0.5
        : Math.max(-0.5, Math.min(1.5, (sy - y0) / dy));

    const nextHandles: BezierHandles =
      drag.handle === 'h1'
        ? { ...k0.bezierHandles, x1: normX, y1: normY }
        : { ...k0.bezierHandles, x2: normX, y2: normY };

    onUpdateKeyframeEasing(
      layer.id,
      activeProperty,
      k0.id,
      'custom',
      nextHandles,
      false
    );
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragHandleRef.current;
    dragHandleRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (drag) {
      const k0 = keyframes[drag.segmentIdx];
      if (k0) {
        onUpdateKeyframeEasing(
          layer.id,
          activeProperty,
          k0.id,
          k0.easing,
          k0.bezierHandles,
          true
        );
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0C0E12]">
      {/* Graph Property & Easing Bar */}
      <div className="shrink-0 px-3 py-2 bg-[#14171D] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {PROPS.map((p) => {
            const pAnimated = layer.transform[p.key].animated;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onSelectProperty(p.key)}
                className={`px-2.5 min-h-[30px] rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  activeProperty === p.key
                    ? 'bg-[#5B7CFA] text-white'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                }`}
              >
                <span>{p.label}</span>
                {pAnimated && (
                  <span
                    className={`text-[10px] font-mono ${
                      activeProperty === p.key
                        ? 'text-white/90'
                        : 'text-[#F59E0B]'
                    }`}
                  >
                    ({layer.transform[p.key].keyframes.length})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeK0 && activeK1 && (
          <div className="flex items-center gap-1 overflow-x-auto">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onUpdateKeyframeEasing(
                    layer.id,
                    activeProperty,
                    activeK0.id,
                    preset.id,
                    preset.id === 'hold' || preset.id === 'custom'
                      ? activeK0.bezierHandles
                      : { ...EASING_PRESET_HANDLES[preset.id] },
                    true
                  )
                }
                className={`px-2.5 min-h-[30px] rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeK0.easing === preset.id
                    ? 'bg-[#F59E0B]/15 border-[#F59E0B] text-[#F59E0B]'
                    : 'bg-[#0C0E12] border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Curve Canvas */}
      {keyframes.length < 2 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="text-xs font-medium text-slate-300">
            Add at least 2 keyframes on {layer.name} · {activeProperty}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Arm the stopwatch in Inspector or Timeline and set two frame values
            to shape its bezier curve here.
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 relative p-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full h-full touch-none select-none"
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
          >
            {/* Horizontal grid lines */}
            {[0.2, 0.5, 0.8].map((r) => {
              const y = padY + innerH * r;
              return (
                <line
                  key={r}
                  x1={padX}
                  x2={W - padX}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
              );
            })}

            {/* Playhead line */}
            <line
              x1={frameToX(currentFrame)}
              x2={frameToX(currentFrame)}
              y1={padY}
              y2={H - padY}
              stroke="#5B7CFA"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              className="cursor-ew-resize"
              onPointerDown={() => onSeekFrame(currentFrame)}
            />

            {/* Curve segments */}
            {keyframes.slice(0, -1).map((k0, i) => {
              const k1 = keyframes[i + 1];
              const x0 = frameToX(k0.frame);
              const x1 = frameToX(k1.frame);
              const v0 = typeof k0.value === 'number' ? k0.value : k0.value[0];
              const v1 = typeof k1.value === 'number' ? k1.value : k1.value[0];
              const y0 = valToY(v0);
              const y1 = valToY(v1);

              let d = '';
              if (k0.easing === 'hold') {
                d = `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1}`;
              } else {
                const steps = 28;
                const pts: string[] = [];
                for (let s = 0; s <= steps; s++) {
                  const t = s / steps;
                  const eased = sampleCubicBezierY(t, k0.bezierHandles);
                  const px = x0 + (x1 - x0) * t;
                  const py = y0 + (y1 - y0) * eased;
                  pts.push(`${s === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`);
                }
                d = pts.join(' ');
              }

              const isSegActive = i === safeSegIdx;
              return (
                <g key={k0.id}>
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    className="cursor-pointer"
                    onPointerDown={() => setActiveSegmentIdx(i)}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={isSegActive ? '#F59E0B' : '#64748B'}
                    strokeWidth={isSegActive ? 2.5 : 1.75}
                  />
                </g>
              );
            })}

            {/* Active Segment Bezier Handles */}
            {activeK0 && activeK1 && activeK0.easing !== 'hold' && (() => {
              const x0 = frameToX(activeK0.frame);
              const x1 = frameToX(activeK1.frame);
              const v0 =
                typeof activeK0.value === 'number'
                  ? activeK0.value
                  : activeK0.value[0];
              const v1 =
                typeof activeK1.value === 'number'
                  ? activeK1.value
                  : activeK1.value[0];
              const y0 = valToY(v0);
              const y1 = valToY(v1);

              const h1x = x0 + (x1 - x0) * activeK0.bezierHandles.x1;
              const h1y = y0 + (y1 - y0) * activeK0.bezierHandles.y1;
              const h2x = x0 + (x1 - x0) * activeK0.bezierHandles.x2;
              const h2y = y0 + (y1 - y0) * activeK0.bezierHandles.y2;

              return (
                <g>
                  <line
                    x1={x0}
                    y1={y0}
                    x2={h1x}
                    y2={h1y}
                    stroke="#F59E0B"
                    strokeOpacity={0.6}
                    strokeWidth={1.5}
                  />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={h2x}
                    y2={h2y}
                    stroke="#F59E0B"
                    strokeOpacity={0.6}
                    strokeWidth={1.5}
                  />
                  <circle
                    cx={h1x}
                    cy={h1y}
                    r={7}
                    fill="#0C0E12"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    className="cursor-grab active:cursor-grabbing"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      svgRef.current?.setPointerCapture(e.pointerId);
                      dragHandleRef.current = {
                        segmentIdx: safeSegIdx,
                        handle: 'h1',
                      };
                    }}
                  />
                  <circle
                    cx={h2x}
                    cy={h2y}
                    r={7}
                    fill="#0C0E12"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    className="cursor-grab active:cursor-grabbing"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      svgRef.current?.setPointerCapture(e.pointerId);
                      dragHandleRef.current = {
                        segmentIdx: safeSegIdx,
                        handle: 'h2',
                      };
                    }}
                  />
                </g>
              );
            })()}

            {/* Keyframe Nodes */}
            {keyframes.map((kf, idx) => {
              const x = frameToX(kf.frame);
              const val = typeof kf.value === 'number' ? kf.value : kf.value[0];
              const y = valToY(val);
              return (
                <rect
                  key={kf.id}
                  x={x - 5}
                  y={y - 5}
                  width={10}
                  height={10}
                  transform={`rotate(45 ${x} ${y})`}
                  fill="#F59E0B"
                  stroke="#0C0E12"
                  strokeWidth={1.5}
                  className="cursor-pointer"
                  onPointerDown={() => {
                    onSeekFrame(kf.frame);
                    setActiveSegmentIdx(Math.min(idx, keyframes.length - 2));
                  }}
                />
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};
