import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Diamond,
  Eye,
  EyeOff,
  Lock,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Spline,
  Timer,
  Trash2,
  Unlock,
} from 'lucide-react';
import type {
  Composition,
  EasingPreset,
  Layer,
  SelectedKeyframeRef,
  TimelineViewMode,
  TransformPropertyKey,
} from '../types/studio';
import { formatTimecode } from '../utils/interpolation';
import { BezierGraphEditor } from './BezierGraphEditor';

interface TimelineDockProps {
  composition: Composition;
  currentFrame: number;
  onSeekFrame: (frame: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  loopPlayback: boolean;
  onToggleLoop: () => void;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  selectedKeyframe: SelectedKeyframeRef | null;
  onSelectKeyframe: (ref: SelectedKeyframeRef | null) => void;
  activeGraphProperty: TransformPropertyKey;
  onSelectGraphProperty: (prop: TransformPropertyKey) => void;
  viewMode: TimelineViewMode;
  onChangeViewMode?: (mode: TimelineViewMode) => void;
  hideModeSwitch?: boolean;
  onUpdateLayer: (
    layerId: string,
    updater: (layer: Layer) => Layer,
    recordHistory?: boolean
  ) => void;
  onMoveLayerOrder: (layerId: string, dir: 'up' | 'down') => void;
  onToggleStopwatch: (layerId: string, key: TransformPropertyKey) => void;
  onAddKeyframe: (layerId: string, key: TransformPropertyKey) => void;
  onMoveKeyframe: (
    layerId: string,
    key: TransformPropertyKey,
    keyframeId: string,
    targetFrame: number,
    recordHistory?: boolean
  ) => void;
  onDeleteKeyframe: (
    layerId: string,
    key: TransformPropertyKey,
    keyframeId: string
  ) => void;
  onUpdateKeyframeEasing: (
    layerId: string,
    key: TransformPropertyKey,
    keyframeId: string,
    easing: EasingPreset,
    handles?: { x1: number; y1: number; x2: number; y2: number },
    recordHistory?: boolean
  ) => void;
}

const TRACK_PROPS: { key: TransformPropertyKey; label: string }[] = [
  { key: 'position', label: 'Position' },
  { key: 'scale', label: 'Scale' },
  { key: 'rotation', label: 'Rotation' },
  { key: 'opacity', label: 'Opacity' },
  { key: 'anchor', label: 'Anchor' },
];

export const TimelineDock: React.FC<TimelineDockProps> = ({
  composition,
  currentFrame,
  onSeekFrame,
  isPlaying,
  onTogglePlay,
  loopPlayback,
  onToggleLoop,
  selectedLayerId,
  onSelectLayer,
  selectedKeyframe,
  onSelectKeyframe,
  activeGraphProperty,
  onSelectGraphProperty,
  viewMode,
  onChangeViewMode,
  hideModeSwitch = false,
  onUpdateLayer,
  onMoveLayerOrder,
  onToggleStopwatch,
  onAddKeyframe,
  onMoveKeyframe,
  onDeleteKeyframe,
  onUpdateKeyframeEasing,
}) => {
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const [draggingState, setDraggingState] = useState<
    | { kind: 'playhead' }
    | {
        kind: 'bar';
        layerId: string;
        edge: 'move' | 'in' | 'out';
        startX: number;
        origIn: number;
        origOut: number;
      }
    | {
        kind: 'keyframe';
        layerId: string;
        propKey: TransformPropertyKey;
        kfId: string;
        startX: number;
        origFrame: number;
      }
    | null
  >(null);

  const duration = Math.max(1, composition.durationFrames);

  const clientXToFrame = (clientX: number) => {
    const el = trackContainerRef.current;
    if (!el) return currentFrame;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * duration);
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingState) return;
    if (draggingState.kind === 'playhead') {
      onSeekFrame(clientXToFrame(e.clientX));
      return;
    }

    const el = trackContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const deltaFrames = Math.round(
      ((e.clientX - draggingState.startX) / Math.max(1, rect.width)) * duration
    );

    if (draggingState.kind === 'bar') {
      const { layerId, edge, origIn, origOut } = draggingState;
      const len = origOut - origIn;
      if (edge === 'move') {
        const nextIn = Math.max(0, Math.min(duration - len, origIn + deltaFrames));
        onUpdateLayer(
          layerId,
          (l) => ({ ...l, inFrame: nextIn, outFrame: nextIn + len }),
          false
        );
      } else if (edge === 'in') {
        const nextIn = Math.max(0, Math.min(origOut - 1, origIn + deltaFrames));
        onUpdateLayer(layerId, (l) => ({ ...l, inFrame: nextIn }), false);
      } else {
        const nextOut = Math.min(
          duration,
          Math.max(origIn + 1, origOut + deltaFrames)
        );
        onUpdateLayer(layerId, (l) => ({ ...l, outFrame: nextOut }), false);
      }
      return;
    }

    if (draggingState.kind === 'keyframe') {
      onMoveKeyframe(
        draggingState.layerId,
        draggingState.propKey,
        draggingState.kfId,
        draggingState.origFrame + deltaFrames,
        false
      );
    }
  };

  const handleTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingState) return;
    if (draggingState.kind === 'bar') {
      const layer = composition.layers.find(
        (l) => l.id === draggingState.layerId
      );
      if (layer) {
        onUpdateLayer(
          layer.id,
          (l) => ({ ...l, inFrame: layer.inFrame, outFrame: layer.outFrame }),
          true
        );
      }
    } else if (draggingState.kind === 'keyframe') {
      const layer = composition.layers.find(
        (l) => l.id === draggingState.layerId
      );
      const kf = layer?.transform[draggingState.propKey].keyframes.find(
        (k) => k.id === draggingState.kfId
      );
      if (kf) {
        onMoveKeyframe(
          draggingState.layerId,
          draggingState.propKey,
          draggingState.kfId,
          kf.frame,
          true
        );
      }
    }
    setDraggingState(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const selectedLayer =
    composition.layers.find((l) => l.id === selectedLayerId) ?? null;

  const activeKfObject = selectedKeyframe
    ? composition.layers
        .find((l) => l.id === selectedKeyframe.layerId)
        ?.transform[selectedKeyframe.property].keyframes.find(
          (k) => k.id === selectedKeyframe.keyframeId
        ) ?? null
    : null;

  const rulerStep = duration <= 120 ? 15 : duration <= 300 ? 30 : 60;
  const ticks: number[] = [];
  for (let f = 0; f <= duration; f += rulerStep) ticks.push(f);

  return (
    <div className="h-full flex flex-col bg-[#14171D] select-none min-h-0">
      {/* Transport Bar */}
      <div className="shrink-0 h-11 px-3 border-b border-white/[0.08] flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onSeekFrame(0)}
            title="Go to Start"
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSeekFrame(Math.max(0, currentFrame - 1))}
            title="Previous Frame"
            className="px-2 h-8 rounded-md text-[11px] font-mono text-slate-300 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            -1f
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            title="Play / Pause (Space)"
            className="w-9 h-8 rounded-md bg-[#5B7CFA] hover:bg-[#4C6DF2] text-white flex items-center justify-center transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onSeekFrame(Math.min(duration, currentFrame + 1))}
            title="Next Frame"
            className="px-2 h-8 rounded-md text-[11px] font-mono text-slate-300 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            +1f
          </button>
          <button
            type="button"
            onClick={() => onSeekFrame(duration)}
            title="Go to End"
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleLoop}
            title="Toggle Loop Playback"
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
              loopPlayback
                ? 'text-[#5B7CFA] bg-[#5B7CFA]/15'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          <div className="ml-2 pl-2 border-l border-white/10 flex items-center gap-2 shrink-0">
            <span className="font-mono text-xs tabular-nums text-[#5B7CFA] font-semibold">
              {formatTimecode(currentFrame, composition.fps)}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-slate-400 hidden sm:inline">
              {currentFrame}f / {duration}f
            </span>
          </div>
        </div>

        {/* Right side: Selected Keyframe Quick Actions OR Timeline/Graph Switch */}
        <div className="flex items-center gap-2 shrink-0">
          {selectedKeyframe && activeKfObject && (
            <div className="flex items-center gap-1.5 bg-[#0C0E12] border border-white/10 rounded-md px-2 py-0.5 shrink-0">
              <span className="text-[11px] text-[#F59E0B] font-medium whitespace-nowrap">
                {activeKfObject.frame}f
              </span>
              <select
                value={activeKfObject.easing}
                onChange={(e) =>
                  onUpdateKeyframeEasing(
                    selectedKeyframe.layerId,
                    selectedKeyframe.property,
                    selectedKeyframe.keyframeId,
                    e.target.value as EasingPreset
                  )
                }
                className="bg-transparent text-[11px] text-slate-200 outline-none cursor-pointer"
              >
                <option value="linear">Linear</option>
                <option value="easeIn">Ease In</option>
                <option value="easeOut">Ease Out</option>
                <option value="easeInOut">Ease In Out</option>
                <option value="hold">Hold</option>
                <option value="custom">Custom</option>
              </select>
              <button
                type="button"
                onClick={() =>
                  onDeleteKeyframe(
                    selectedKeyframe.layerId,
                    selectedKeyframe.property,
                    selectedKeyframe.keyframeId
                  )
                }
                title="Delete Keyframe"
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-400"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {!hideModeSwitch && onChangeViewMode && (
            <div className="flex items-center bg-[#0C0E12] border border-white/10 rounded-lg p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => onChangeViewMode('timeline')}
                className={`px-2.5 min-h-[28px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'timeline'
                    ? 'bg-[#5B7CFA] text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Timeline
              </button>
              <button
                type="button"
                onClick={() => onChangeViewMode('graph')}
                className={`px-2.5 min-h-[28px] rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                  viewMode === 'graph'
                    ? 'bg-[#5B7CFA] text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <Spline className="w-3.5 h-3.5" />
                <span>Graph</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body: Graph Editor OR Multi-Track Keyframe Timeline */}
      {viewMode === 'graph' ? (
        <div className="flex-1 min-h-0">
          <BezierGraphEditor
            layer={selectedLayer}
            activeProperty={activeGraphProperty}
            onSelectProperty={onSelectGraphProperty}
            durationFrames={duration}
            currentFrame={currentFrame}
            onSeekFrame={onSeekFrame}
            onUpdateKeyframeEasing={onUpdateKeyframeEasing}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex overflow-y-auto studio-scroll">
          {/* Left Layer Tree Column */}
          <div className="w-[155px] sm:w-[240px] lg:w-[290px] shrink-0 border-r border-white/[0.08] bg-[#14171D]">
            {/* Ruler spacer */}
            <div className="h-7 px-3 border-b border-white/[0.08] flex items-center justify-between text-[11px] font-medium text-slate-400 sticky top-0 z-20 bg-[#14171D]">
              <span>Layers</span>
              <span className="font-mono tabular-nums">
                {composition.layers.length}
              </span>
            </div>

            {composition.layers.length === 0 ? (
              <div className="p-4 text-xs text-slate-400">
                No layers yet. Use Shape, Text, or Media above to add one.
              </div>
            ) : (
              composition.layers.map((layer, index) => {
                const isSelected = layer.id === selectedLayerId;
                return (
                  <div key={layer.id}>
                    <div
                      onClick={() => onSelectLayer(layer.id)}
                      className={`h-9 px-2 border-b border-white/[0.05] flex items-center justify-between gap-1 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#5B7CFA]/15'
                          : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateLayer(
                              layer.id,
                              (l) => ({ ...l, expanded: !l.expanded }),
                              false
                            );
                          }}
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white shrink-0"
                        >
                          {layer.expanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span
                          className="w-1.5 h-4 rounded-sm shrink-0"
                          style={{ backgroundColor: layer.colorLabel }}
                        />
                        <span
                          className={`text-xs truncate ${
                            isSelected
                              ? 'text-white font-medium'
                              : 'text-slate-300'
                          }`}
                        >
                          {layer.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        {isSelected && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onMoveLayerOrder(layer.id, 'up');
                              }}
                              disabled={index === 0}
                              title="Move Layer Up"
                              className="hidden sm:flex w-6 h-6 rounded items-center justify-center text-slate-400 hover:text-white disabled:opacity-25"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onMoveLayerOrder(layer.id, 'down');
                              }}
                              disabled={
                                index === composition.layers.length - 1
                              }
                              title="Move Layer Down"
                              className="hidden sm:flex w-6 h-6 rounded items-center justify-center text-slate-400 hover:text-white disabled:opacity-25"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateLayer(layer.id, (l) => ({
                              ...l,
                              visible: !l.visible,
                            }));
                          }}
                          title="Toggle Visibility"
                          className={`w-6 h-6 rounded flex items-center justify-center ${
                            layer.visible
                              ? 'text-slate-300 hover:text-white'
                              : 'text-slate-600'
                          }`}
                        >
                          {layer.visible ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateLayer(layer.id, (l) => ({
                              ...l,
                              locked: !l.locked,
                            }));
                          }}
                          title="Toggle Lock"
                          className={`w-6 h-6 rounded flex items-center justify-center ${
                            layer.locked
                              ? 'text-[#F59E0B]'
                              : 'text-slate-500 hover:text-slate-200'
                          }`}
                        >
                          {layer.locked ? (
                            <Lock className="w-3 h-3" />
                          ) : (
                            <Unlock className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Transform Track Labels */}
                    {layer.expanded &&
                      TRACK_PROPS.map((tp) => {
                        const prop = layer.transform[tp.key];
                        const hasKfHere = prop.keyframes.some(
                          (k) => k.frame === currentFrame
                        );
                        return (
                          <div
                            key={tp.key}
                            onClick={() => {
                              onSelectLayer(layer.id);
                              onSelectGraphProperty(tp.key);
                            }}
                            className="h-7 pl-8 pr-2 bg-[#101318] border-b border-white/[0.04] flex items-center justify-between gap-1 cursor-pointer hover:bg-white/[0.03]"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleStopwatch(layer.id, tp.key);
                                }}
                                title="Toggle Animation"
                                className={`w-5 h-5 rounded flex items-center justify-center ${
                                  prop.animated
                                    ? 'text-[#F59E0B]'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                <Timer className="w-3 h-3" />
                              </button>
                              <span className="text-[11px] text-slate-400 truncate">
                                {tp.label}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddKeyframe(layer.id, tp.key);
                              }}
                              title="Add Keyframe at Current Frame"
                              className={`w-5 h-5 rounded flex items-center justify-center ${
                                hasKfHere
                                  ? 'text-[#F59E0B]'
                                  : 'text-slate-600 hover:text-slate-300'
                              }`}
                            >
                              <Diamond
                                className="w-2.5 h-2.5"
                                fill={hasKfHere ? 'currentColor' : 'none'}
                              />
                            </button>
                          </div>
                        );
                      })}
                  </div>
                );
              })
            )}
          </div>

          {/* Right Track & Keyframe Area */}
          <div
            ref={trackContainerRef}
            onPointerMove={handleTrackPointerMove}
            onPointerUp={handleTrackPointerUp}
            className="flex-1 min-w-[260px] relative bg-[#0C0E12] touch-none"
          >
            {/* Interactive Frame Ruler */}
            <div
              onPointerDown={(e) => {
                trackContainerRef.current?.setPointerCapture(e.pointerId);
                setDraggingState({ kind: 'playhead' });
                onSeekFrame(clientXToFrame(e.clientX));
              }}
              className="h-7 border-b border-white/[0.08] bg-[#14171D] sticky top-0 z-20 cursor-ew-resize"
            >
              {ticks.map((f) => {
                const leftPct = (f / duration) * 100;
                return (
                  <div
                    key={f}
                    style={{ left: `${leftPct}%` }}
                    className="absolute top-0 bottom-0 border-l border-white/10 pl-1 flex items-center pointer-events-none"
                  >
                    <span className="font-mono text-[10px] tabular-nums text-slate-400">
                      {f}f
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Layer Bars & Keyframe Rows */}
            {composition.layers.map((layer) => {
              const leftPct = (layer.inFrame / duration) * 100;
              const widthPct = Math.max(
                1.5,
                ((layer.outFrame - layer.inFrame) / duration) * 100
              );
              const isSelected = layer.id === selectedLayerId;

              return (
                <div key={layer.id}>
                  <div className="h-9 border-b border-white/[0.05] relative flex items-center">
                    {/* In/Out Layer Duration Bar */}
                    <div
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: `${layer.colorLabel}33`,
                        borderColor: isSelected
                          ? '#5B7CFA'
                          : `${layer.colorLabel}88`,
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onSelectLayer(layer.id);
                        trackContainerRef.current?.setPointerCapture(
                          e.pointerId
                        );
                        setDraggingState({
                          kind: 'bar',
                          layerId: layer.id,
                          edge: 'move',
                          startX: e.clientX,
                          origIn: layer.inFrame,
                          origOut: layer.outFrame,
                        });
                      }}
                      className="absolute h-5 rounded border cursor-grab active:cursor-grabbing flex items-center justify-between overflow-hidden"
                    >
                      {/* Left Trim Handle */}
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onSelectLayer(layer.id);
                          trackContainerRef.current?.setPointerCapture(
                            e.pointerId
                          );
                          setDraggingState({
                            kind: 'bar',
                            layerId: layer.id,
                            edge: 'in',
                            startX: e.clientX,
                            origIn: layer.inFrame,
                            origOut: layer.outFrame,
                          });
                        }}
                        className="w-2.5 h-full cursor-ew-resize hover:bg-white/25 shrink-0"
                      />
                      {/* Right Trim Handle */}
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onSelectLayer(layer.id);
                          trackContainerRef.current?.setPointerCapture(
                            e.pointerId
                          );
                          setDraggingState({
                            kind: 'bar',
                            layerId: layer.id,
                            edge: 'out',
                            startX: e.clientX,
                            origIn: layer.inFrame,
                            origOut: layer.outFrame,
                          });
                        }}
                        className="w-2.5 h-full cursor-ew-resize hover:bg-white/25 shrink-0"
                      />
                    </div>
                  </div>

                  {/* Expanded Property Keyframe Tracks */}
                  {layer.expanded &&
                    TRACK_PROPS.map((tp) => {
                      const prop = layer.transform[tp.key];
                      return (
                        <div
                          key={tp.key}
                          className="h-7 bg-[#0A0C10] border-b border-white/[0.04] relative flex items-center"
                        >
                          {prop.keyframes.map((kf) => {
                            const kfLeft = (kf.frame / duration) * 100;
                            const isKfSelected =
                              selectedKeyframe?.keyframeId === kf.id;
                            return (
                              <button
                                key={kf.id}
                                type="button"
                                style={{ left: `${kfLeft}%` }}
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  onSelectLayer(layer.id);
                                  onSelectGraphProperty(tp.key);
                                  onSelectKeyframe({
                                    layerId: layer.id,
                                    property: tp.key,
                                    keyframeId: kf.id,
                                  });
                                  onSeekFrame(kf.frame);
                                  trackContainerRef.current?.setPointerCapture(
                                    e.pointerId
                                  );
                                  setDraggingState({
                                    kind: 'keyframe',
                                    layerId: layer.id,
                                    propKey: tp.key,
                                    kfId: kf.id,
                                    startX: e.clientX,
                                    origFrame: kf.frame,
                                  });
                                }}
                                title={`${tp.label} @ ${kf.frame}f (${kf.easing})`}
                                className="absolute -translate-x-1/2 w-5 h-5 flex items-center justify-center cursor-ew-resize"
                              >
                                <span
                                  className={`w-2.5 h-2.5 rotate-45 block border ${
                                    isKfSelected
                                      ? 'bg-white border-[#5B7CFA] scale-125'
                                      : 'bg-[#F59E0B] border-[#0C0E12]'
                                  }`}
                                />
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                </div>
              );
            })}

            {/* Playhead Needle */}
            <div
              style={{ left: `${(currentFrame / duration) * 100}%` }}
              className="absolute top-0 bottom-0 w-px bg-[#5B7CFA] pointer-events-none z-30"
            >
              <div className="w-3 h-3 -ml-[5.5px] bg-[#5B7CFA] rounded-b-sm" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
