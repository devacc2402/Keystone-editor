import React from 'react';
import { Copy, Diamond, Timer, Trash2 } from 'lucide-react';
import type {
  BlendMode,
  Composition,
  Layer,
  TransformPropertyKey,
  Vec2,
} from '../types/studio';
import { evaluateLayerTransform } from '../utils/interpolation';
import { ScrubInput } from './ScrubInput';

interface InspectorPanelProps {
  composition: Composition;
  selectedLayer: Layer | null;
  currentFrame: number;
  onUpdateComposition: (patch: Partial<Composition>, recordHistory?: boolean) => void;
  onUpdateLayer: (
    layerId: string,
    updater: (layer: Layer) => Layer,
    recordHistory?: boolean
  ) => void;
  onTransformChange: (
    layerId: string,
    key: TransformPropertyKey,
    value: number | Vec2,
    recordHistory?: boolean
  ) => void;
  onToggleStopwatch: (layerId: string, key: TransformPropertyKey) => void;
  onAddKeyframe: (layerId: string, key: TransformPropertyKey) => void;
  onDuplicateLayer: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
}

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'difference', label: 'Difference' },
];

const FONT_FAMILIES = [
  'Plus Jakarta Sans',
  'DM Sans',
  'JetBrains Mono',
  'Georgia',
  'Impact',
];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  composition,
  selectedLayer,
  currentFrame,
  onUpdateComposition,
  onUpdateLayer,
  onTransformChange,
  onToggleStopwatch,
  onAddKeyframe,
  onDuplicateLayer,
  onDeleteLayer,
}) => {
  if (!selectedLayer) {
    return (
      <div className="p-4 space-y-5 overflow-y-auto studio-scroll h-full">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-100">
            Composition Settings
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Select a layer on stage or timeline to edit its properties.
          </p>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-medium text-slate-400">Presets</div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() =>
                onUpdateComposition({ width: 1920, height: 1080 })
              }
              className={`min-h-[36px] rounded-md border text-xs font-medium transition-colors ${
                composition.width === 1920 && composition.height === 1080
                  ? 'bg-[#5B7CFA]/15 border-[#5B7CFA] text-[#5B7CFA]'
                  : 'bg-[#0C0E12] border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              16:9 HD
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateComposition({ width: 1080, height: 1920 })
              }
              className={`min-h-[36px] rounded-md border text-xs font-medium transition-colors ${
                composition.width === 1080 && composition.height === 1920
                  ? 'bg-[#5B7CFA]/15 border-[#5B7CFA] text-[#5B7CFA]'
                  : 'bg-[#0C0E12] border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              9:16 Reel
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateComposition({ width: 1080, height: 1080 })
              }
              className={`min-h-[36px] rounded-md border text-xs font-medium transition-colors ${
                composition.width === 1080 && composition.height === 1080
                  ? 'bg-[#5B7CFA]/15 border-[#5B7CFA] text-[#5B7CFA]'
                  : 'bg-[#0C0E12] border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              1:1 Square
            </button>
          </div>
        </div>

        <div className="space-y-2.5 pt-2 border-t border-white/[0.08]">
          <div className="text-xs font-medium text-slate-400">Dimensions</div>
          <div className="grid grid-cols-2 gap-2">
            <ScrubInput
              label="W"
              value={composition.width}
              min={160}
              max={3840}
              step={2}
              precision={0}
              suffix="px"
              onChange={(w, rec) => onUpdateComposition({ width: w }, rec)}
            />
            <ScrubInput
              label="H"
              value={composition.height}
              min={160}
              max={3840}
              step={2}
              precision={0}
              suffix="px"
              onChange={(h, rec) => onUpdateComposition({ height: h }, rec)}
            />
          </div>
        </div>

        <div className="space-y-2.5 pt-2 border-t border-white/[0.08]">
          <div className="text-xs font-medium text-slate-400">
            Timing & Background
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ScrubInput
              label="FPS"
              value={composition.fps}
              min={10}
              max={60}
              step={1}
              precision={0}
              onChange={(fps, rec) => onUpdateComposition({ fps }, rec)}
            />
            <ScrubInput
              label="Frames"
              value={composition.durationFrames}
              min={30}
              max={1800}
              step={5}
              precision={0}
              onChange={(d, rec) =>
                onUpdateComposition(
                  {
                    durationFrames: d,
                    workAreaEnd: Math.min(composition.workAreaEnd, d),
                  },
                  rec
                )
              }
            />
          </div>
          <div className="flex items-center justify-between bg-[#0C0E12] border border-white/10 rounded-md px-3 min-h-[38px]">
            <span className="text-xs text-slate-300">Background Color</span>
            <input
              type="color"
              value={composition.backgroundColor}
              onChange={(e) =>
                onUpdateComposition({ backgroundColor: e.target.value })
              }
              className="w-7 h-6 rounded bg-transparent cursor-pointer border-0"
            />
          </div>
        </div>
      </div>
    );
  }

  const t = evaluateLayerTransform(selectedLayer, currentFrame);
  const potentialParents = composition.layers.filter(
    (l) => l.id !== selectedLayer.id
  );

  const renderPropRow = (
    propKey: TransformPropertyKey,
    label: string,
    controls: React.ReactNode
  ) => {
    const isAnimated = selectedLayer.transform[propKey].animated;
    const hasKfHere = selectedLayer.transform[propKey].keyframes.some(
      (k) => k.frame === currentFrame
    );
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleStopwatch(selectedLayer.id, propKey)}
              title={
                isAnimated
                  ? 'Disable keyframe animation'
                  : 'Enable keyframe animation'
              }
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                isAnimated
                  ? 'text-[#F59E0B] bg-[#F59E0B]/10'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Timer className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-medium text-slate-300">{label}</span>
          </div>

          <button
            type="button"
            onClick={() => onAddKeyframe(selectedLayer.id, propKey)}
            title="Add or update keyframe at current frame"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              hasKfHere
                ? 'text-[#F59E0B]'
                : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Diamond
              className="w-3.5 h-3.5"
              fill={hasKfHere ? 'currentColor' : 'none'}
            />
          </button>
        </div>
        {controls}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-5 overflow-y-auto studio-scroll h-full">
      {/* Layer Header */}
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          value={selectedLayer.name}
          onChange={(e) =>
            onUpdateLayer(
              selectedLayer.id,
              (l) => ({ ...l, name: e.target.value }),
              false
            )
          }
          className="font-display text-sm font-semibold text-slate-100 bg-transparent border border-transparent hover:border-white/10 focus:border-[#5B7CFA] rounded px-1.5 py-1 outline-none min-w-0 flex-1"
        />
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onDuplicateLayer(selectedLayer.id)}
            title="Duplicate Layer"
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteLayer(selectedLayer.id)}
            title="Delete Layer"
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Transform Section */}
      <div className="space-y-3 pt-2 border-t border-white/[0.08]">
        <div className="text-xs font-semibold text-slate-400">Transform</div>

        {renderPropRow(
          'position',
          'Position',
          <div className="grid grid-cols-2 gap-2">
            <ScrubInput
              label="X"
              value={t.position[0]}
              step={1}
              precision={1}
              onChange={(x, rec) =>
                onTransformChange(
                  selectedLayer.id,
                  'position',
                  [x, t.position[1]],
                  rec
                )
              }
            />
            <ScrubInput
              label="Y"
              value={t.position[1]}
              step={1}
              precision={1}
              onChange={(y, rec) =>
                onTransformChange(
                  selectedLayer.id,
                  'position',
                  [t.position[0], y],
                  rec
                )
              }
            />
          </div>
        )}

        {renderPropRow(
          'scale',
          'Scale',
          <div className="grid grid-cols-2 gap-2">
            <ScrubInput
              label="W"
              value={t.scale[0]}
              min={0}
              max={1000}
              step={1}
              precision={1}
              suffix="%"
              onChange={(sx, rec) =>
                onTransformChange(
                  selectedLayer.id,
                  'scale',
                  [sx, t.scale[1]],
                  rec
                )
              }
            />
            <ScrubInput
              label="H"
              value={t.scale[1]}
              min={0}
              max={1000}
              step={1}
              precision={1}
              suffix="%"
              onChange={(sy, rec) =>
                onTransformChange(
                  selectedLayer.id,
                  'scale',
                  [t.scale[0], sy],
                  rec
                )
              }
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            {renderPropRow(
              'rotation',
              'Rotation',
              <ScrubInput
                value={t.rotation}
                min={-3600}
                max={3600}
                step={1}
                precision={1}
                suffix="°"
                onChange={(rot, rec) =>
                  onTransformChange(selectedLayer.id, 'rotation', rot, rec)
                }
              />
            )}
          </div>
          <div>
            {renderPropRow(
              'opacity',
              'Opacity',
              <ScrubInput
                value={t.opacity}
                min={0}
                max={100}
                step={1}
                precision={0}
                suffix="%"
                onChange={(op, rec) =>
                  onTransformChange(selectedLayer.id, 'opacity', op, rec)
                }
              />
            )}
          </div>
        </div>

        {renderPropRow(
          'anchor',
          'Anchor Point',
          <div className="grid grid-cols-2 gap-2">
            <ScrubInput
              label="X"
              value={t.anchor[0]}
              step={1}
              precision={1}
              onChange={(ax, rec) =>
                onTransformChange(
                  selectedLayer.id,
                  'anchor',
                  [ax, t.anchor[1]],
                  rec
                )
              }
            />
            <ScrubInput
              label="Y"
              value={t.anchor[1]}
              step={1}
              precision={1}
              onChange={(ay, rec) =>
                onTransformChange(
                  selectedLayer.id,
                  'anchor',
                  [t.anchor[0], ay],
                  rec
                )
              }
            />
          </div>
        )}
      </div>

      {/* Type-Specific Properties */}
      {selectedLayer.type === 'shape' && selectedLayer.shapeProps && (
        <div className="space-y-3 pt-3 border-t border-white/[0.08]">
          <div className="text-xs font-semibold text-slate-400">
            Shape Style
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ScrubInput
              label="W"
              value={selectedLayer.shapeProps.width}
              min={4}
              max={4000}
              precision={0}
              onChange={(width, rec) =>
                onUpdateLayer(
                  selectedLayer.id,
                  (l) => ({
                    ...l,
                    shapeProps: { ...l.shapeProps!, width },
                  }),
                  rec
                )
              }
            />
            <ScrubInput
              label="H"
              value={selectedLayer.shapeProps.height}
              min={4}
              max={4000}
              precision={0}
              onChange={(height, rec) =>
                onUpdateLayer(
                  selectedLayer.id,
                  (l) => ({
                    ...l,
                    shapeProps: { ...l.shapeProps!, height },
                  }),
                  rec
                )
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between bg-[#0C0E12] border border-white/10 rounded-md px-2.5 min-h-[36px]">
              <span className="text-[11px] text-slate-400">Fill</span>
              <input
                type="color"
                value={selectedLayer.shapeProps.fillColor}
                onChange={(e) =>
                  onUpdateLayer(selectedLayer.id, (l) => ({
                    ...l,
                    shapeProps: { ...l.shapeProps!, fillColor: e.target.value },
                  }))
                }
                className="w-6 h-5 bg-transparent border-0 cursor-pointer"
              />
            </div>
            <ScrubInput
              label="Fill %"
              value={selectedLayer.shapeProps.fillOpacity}
              min={0}
              max={100}
              precision={0}
              suffix="%"
              onChange={(fillOpacity, rec) =>
                onUpdateLayer(
                  selectedLayer.id,
                  (l) => ({
                    ...l,
                    shapeProps: { ...l.shapeProps!, fillOpacity },
                  }),
                  rec
                )
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between bg-[#0C0E12] border border-white/10 rounded-md px-2.5 min-h-[36px]">
              <span className="text-[11px] text-slate-400">Stroke</span>
              <input
                type="color"
                value={selectedLayer.shapeProps.strokeColor}
                onChange={(e) =>
                  onUpdateLayer(selectedLayer.id, (l) => ({
                    ...l,
                    shapeProps: {
                      ...l.shapeProps!,
                      strokeColor: e.target.value,
                    },
                  }))
                }
                className="w-6 h-5 bg-transparent border-0 cursor-pointer"
              />
            </div>
            <ScrubInput
              label="Width"
              value={selectedLayer.shapeProps.strokeWidth}
              min={0}
              max={100}
              precision={0}
              suffix="px"
              onChange={(strokeWidth, rec) =>
                onUpdateLayer(
                  selectedLayer.id,
                  (l) => ({
                    ...l,
                    shapeProps: { ...l.shapeProps!, strokeWidth },
                  }),
                  rec
                )
              }
            />
          </div>

          {selectedLayer.shapeProps.kind === 'rect' && (
            <ScrubInput
              label="Radius"
              value={selectedLayer.shapeProps.cornerRadius}
              min={0}
              max={500}
              precision={0}
              suffix="px"
              onChange={(cornerRadius, rec) =>
                onUpdateLayer(
                  selectedLayer.id,
                  (l) => ({
                    ...l,
                    shapeProps: { ...l.shapeProps!, cornerRadius },
                  }),
                  rec
                )
              }
            />
          )}

          {selectedLayer.shapeProps.kind === 'star' && (
            <ScrubInput
              label="Points"
              value={selectedLayer.shapeProps.points}
              min={3}
              max={24}
              precision={0}
              onChange={(points, rec) =>
                onUpdateLayer(
                  selectedLayer.id,
                  (l) => ({
                    ...l,
                    shapeProps: { ...l.shapeProps!, points },
                  }),
                  rec
                )
              }
            />
          )}
        </div>
      )}

      {selectedLayer.type === 'text' && selectedLayer.textProps && (
        <div className="space-y-3 pt-3 border-t border-white/[0.08]">
          <div className="text-xs font-semibold text-slate-400">Typography</div>
          <textarea
            rows={2}
            value={selectedLayer.textProps.content}
            onChange={(e) =>
              onUpdateLayer(
                selectedLayer.id,
                (l) => ({
                  ...l,
                  textProps: { ...l.textProps!, content: e.target.value },
                }),
                false
              )
            }
            className="w-full bg-[#0C0E12] border border-white/10 focus:border-[#5B7CFA] rounded-md px-2.5 py-2 text-xs text-slate-100 outline-none resize-none"
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedLayer.textProps.fontFamily}
              onChange={(e) =>
                onUpdateLayer(selectedLayer.id, (l) => ({
                  ...l,
                  textProps: { ...l.textProps!, fontFamily: e.target.value },
                }))
              }
              className="bg-[#0C0E12] border border-white/10 rounded-md px-2 min-h-[36px] text-xs text-slate-200 outline-none"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <ScrubInput
              label="Size"
              value={selectedLayer.textProps.fontSize}
              min={8}
              max={400}
              precision={0}
              suffix="px"
              onChange={(fontSize, rec) =>
                onUpdateLayer(
                  selectedLayer.id,
                  (l) => ({
                    ...l,
                    textProps: { ...l.textProps!, fontSize },
                  }),
                  rec
                )
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between bg-[#0C0E12] border border-white/10 rounded-md px-2.5 min-h-[36px]">
              <span className="text-[11px] text-slate-400">Color</span>
              <input
                type="color"
                value={selectedLayer.textProps.color}
                onChange={(e) =>
                  onUpdateLayer(selectedLayer.id, (l) => ({
                    ...l,
                    textProps: { ...l.textProps!, color: e.target.value },
                  }))
                }
                className="w-6 h-5 bg-transparent border-0 cursor-pointer"
              />
            </div>
            <ScrubInput
              label="Tracking"
              value={selectedLayer.textProps.letterSpacing}
              min={-20}
              max={60}
              precision={0}
              onChange={(letterSpacing, rec) =>
                onUpdateLayer(
                  selectedLayer.id,
                  (l) => ({
                    ...l,
                    textProps: { ...l.textProps!, letterSpacing },
                  }),
                  rec
                )
              }
            />
          </div>

          <div className="grid grid-cols-3 gap-1 bg-[#0C0E12] border border-white/10 rounded-md p-1">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                type="button"
                onClick={() =>
                  onUpdateLayer(selectedLayer.id, (l) => ({
                    ...l,
                    textProps: { ...l.textProps!, align },
                  }))
                }
                className={`min-h-[28px] rounded text-[11px] font-medium capitalize transition-colors ${
                  selectedLayer.textProps?.align === align
                    ? 'bg-[#5B7CFA] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {align}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedLayer.type === 'solid' && selectedLayer.solidProps && (
        <div className="space-y-3 pt-3 border-t border-white/[0.08]">
          <div className="text-xs font-semibold text-slate-400">Solid</div>
          <div className="flex items-center justify-between bg-[#0C0E12] border border-white/10 rounded-md px-3 min-h-[38px]">
            <span className="text-xs text-slate-300">Solid Color</span>
            <input
              type="color"
              value={selectedLayer.solidProps.color}
              onChange={(e) =>
                onUpdateLayer(selectedLayer.id, (l) => ({
                  ...l,
                  solidProps: { ...l.solidProps!, color: e.target.value },
                }))
              }
              className="w-7 h-6 bg-transparent border-0 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Compositing & Parent */}
      <div className="space-y-3 pt-3 border-t border-white/[0.08]">
        <div className="text-xs font-semibold text-slate-400">Compositing</div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400">Blend Mode</span>
            <select
              value={selectedLayer.blendMode}
              onChange={(e) =>
                onUpdateLayer(selectedLayer.id, (l) => ({
                  ...l,
                  blendMode: e.target.value as BlendMode,
                }))
              }
              className="w-full bg-[#0C0E12] border border-white/10 rounded-md px-2 min-h-[36px] text-xs text-slate-200 outline-none"
            >
              {BLEND_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] text-slate-400">Parent Layer</span>
            <select
              value={selectedLayer.parentId || ''}
              onChange={(e) =>
                onUpdateLayer(selectedLayer.id, (l) => ({
                  ...l,
                  parentId: e.target.value || null,
                }))
              }
              className="w-full bg-[#0C0E12] border border-white/10 rounded-md px-2 min-h-[36px] text-xs text-slate-200 outline-none"
            >
              <option value="">None</option>
              {potentialParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ScrubInput
            label="In"
            value={selectedLayer.inFrame}
            min={0}
            max={selectedLayer.outFrame - 1}
            precision={0}
            suffix="f"
            onChange={(inFrame, rec) =>
              onUpdateLayer(
                selectedLayer.id,
                (l) => ({ ...l, inFrame }),
                rec
              )
            }
          />
          <ScrubInput
            label="Out"
            value={selectedLayer.outFrame}
            min={selectedLayer.inFrame + 1}
            max={composition.durationFrames}
            precision={0}
            suffix="f"
            onChange={(outFrame, rec) =>
              onUpdateLayer(
                selectedLayer.id,
                (l) => ({ ...l, outFrame }),
                rec
              )
            }
          />
        </div>
      </div>
    </div>
  );
};
