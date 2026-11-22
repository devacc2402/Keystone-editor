import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type {
  Composition,
  Layer,
  ToolMode,
  TransformPropertyKey,
  Vec2,
} from '../types/studio';
import {
  computeLayerGizmo,
  hitTestLayersAtCompPoint,
  renderCompositionToContext,
  type MediaCache,
} from '../utils/canvasRenderer';
import {
  evaluateLayerTransform,
  getLayerWorldMatrix,
  invertMat2D,
  applyMat2D,
} from '../utils/interpolation';

interface StageViewportProps {
  composition: Composition;
  currentFrame: number;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  activeTool: ToolMode;
  mediaCacheRef: React.MutableRefObject<MediaCache>;
  mediaRevision: number;
  onTransformChange: (
    layerId: string,
    key: TransformPropertyKey,
    value: number | Vec2,
    recordHistory?: boolean
  ) => void;
}

type DragInteraction =
  | {
      kind: 'pan';
      startClientX: number;
      startClientY: number;
      startPanX: number;
      startPanY: number;
    }
  | {
      kind: 'move';
      layerId: string;
      startComp: Vec2;
      startPos: Vec2;
    }
  | {
      kind: 'scale';
      layerId: string;
      centerViewport: Vec2;
      startDist: number;
      startScale: Vec2;
    }
  | {
      kind: 'rotate';
      layerId: string;
      centerViewport: Vec2;
      startAngle: number;
      startRotation: number;
    };

export const StageViewport: React.FC<StageViewportProps> = ({
  composition,
  currentFrame,
  selectedLayerId,
  onSelectLayer,
  activeTool,
  mediaCacheRef,
  mediaRevision,
  onTransformChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 500 });
  const [zoomMode, setZoomMode] = useState<'fit' | 'custom'>('fit');
  const [customZoom, setCustomZoom] = useState<number>(0.5);
  const [pan, setPan] = useState<Vec2>([0, 0]);
  const [spaceDown, setSpaceDown] = useState(false);

  const dragRef = useRef<DragInteraction | null>(null);

  // Observe stage container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ w: rect.width, h: rect.height });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Spacebar temporary pan
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        setSpaceDown(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const fitZoom = Math.max(
    0.1,
    Math.min(
      (containerSize.w - 48) / composition.width,
      (containerSize.h - 48) / composition.height
    )
  );
  const activeZoom = zoomMode === 'fit' ? fitZoom : customZoom;

  const compToViewport = useCallback(
    (p: Vec2): Vec2 => {
      const originX =
        containerSize.w / 2 - (composition.width * activeZoom) / 2 + pan[0];
      const originY =
        containerSize.h / 2 - (composition.height * activeZoom) / 2 + pan[1];
      return [originX + p[0] * activeZoom, originY + p[1] * activeZoom];
    },
    [activeZoom, composition.height, composition.width, containerSize.h, containerSize.w, pan]
  );

  const viewportToComp = useCallback(
    (p: Vec2): Vec2 => {
      const originX =
        containerSize.w / 2 - (composition.width * activeZoom) / 2 + pan[0];
      const originY =
        containerSize.h / 2 - (composition.height * activeZoom) / 2 + pan[1];
      return [(p[0] - originX) / activeZoom, (p[1] - originY) / activeZoom];
    },
    [activeZoom, composition.height, composition.width, containerSize.h, containerSize.w, pan]
  );

  // Render composition + crisp gizmo overlays
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(containerSize.w));
    const h = Math.max(1, Math.floor(containerSize.h));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Draw subtle dark studio grid backdrop
    ctx.fillStyle = '#0C0E12';
    ctx.fillRect(0, 0, w, h);

    const originX = w / 2 - (composition.width * activeZoom) / 2 + pan[0];
    const originY = h / 2 - (composition.height * activeZoom) / 2 + pan[1];

    // Drop shadow behind composition frame
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 28;
    ctx.fillStyle = composition.backgroundColor || '#0D1017';
    ctx.fillRect(
      originX,
      originY,
      composition.width * activeZoom,
      composition.height * activeZoom
    );
    ctx.restore();

    // Clip composition bounds
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      originX,
      originY,
      composition.width * activeZoom,
      composition.height * activeZoom
    );
    ctx.clip();
    ctx.translate(originX, originY);
    ctx.scale(activeZoom, activeZoom);
    renderCompositionToContext(
      ctx,
      composition,
      currentFrame,
      mediaCacheRef.current,
      {
        showNullGuides: true,
        selectedLayerId,
      }
    );
    ctx.restore();

    // Subtle hairline border around composition frame
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      originX + 0.5,
      originY + 0.5,
      composition.width * activeZoom - 1,
      composition.height * activeZoom - 1
    );

    // Draw gizmo for selected visible unlocked layer
    const selectedLayer = composition.layers.find(
      (l) => l.id === selectedLayerId
    );
    if (selectedLayer && selectedLayer.visible) {
      const layersById = new Map<string, Layer>();
      for (const l of composition.layers) layersById.set(l.id, l);

      const gizmo = computeLayerGizmo(
        selectedLayer,
        layersById,
        currentFrame,
        compToViewport
      );

      const [tl, tr, br, bl] = gizmo.corners;

      // Bounding box
      ctx.strokeStyle = '#5B7CFA';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tl[0], tl[1]);
      ctx.lineTo(tr[0], tr[1]);
      ctx.lineTo(br[0], br[1]);
      ctx.lineTo(bl[0], bl[1]);
      ctx.closePath();
      ctx.stroke();

      // Rotate stem & handle
      if (!selectedLayer.locked) {
        ctx.beginPath();
        ctx.moveTo(gizmo.topMid[0], gizmo.topMid[1]);
        ctx.lineTo(gizmo.rotateHandle[0], gizmo.rotateHandle[1]);
        ctx.stroke();

        ctx.fillStyle = '#0C0E12';
        ctx.beginPath();
        ctx.arc(gizmo.rotateHandle[0], gizmo.rotateHandle[1], 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Corner scale handles
        for (const c of gizmo.corners) {
          ctx.fillStyle = '#FFFFFF';
          ctx.strokeStyle = '#5B7CFA';
          ctx.lineWidth = 1.5;
          ctx.fillRect(c[0] - 5, c[1] - 5, 10, 10);
          ctx.strokeRect(c[0] - 5, c[1] - 5, 10, 10);
        }
      }

      // Anchor crosshair
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(gizmo.anchorPoint[0], gizmo.anchorPoint[1], 5, 0, Math.PI * 2);
      ctx.moveTo(gizmo.anchorPoint[0] - 8, gizmo.anchorPoint[1]);
      ctx.lineTo(gizmo.anchorPoint[0] + 8, gizmo.anchorPoint[1]);
      ctx.moveTo(gizmo.anchorPoint[0], gizmo.anchorPoint[1] - 8);
      ctx.lineTo(gizmo.anchorPoint[0], gizmo.anchorPoint[1] + 8);
      ctx.stroke();
    }

    ctx.restore();
  }, [
    activeZoom,
    compToViewport,
    composition,
    containerSize.h,
    containerSize.w,
    currentFrame,
    mediaCacheRef,
    mediaRevision,
    pan,
    selectedLayerId,
  ]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;
    e.currentTarget.setPointerCapture(e.pointerId);

    if (activeTool === 'hand' || spaceDown || e.button === 1) {
      dragRef.current = {
        kind: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan[0],
        startPanY: pan[1],
      };
      return;
    }

    // Check active layer gizmo handles first
    const selectedLayer = composition.layers.find(
      (l) => l.id === selectedLayerId
    );
    if (selectedLayer && selectedLayer.visible && !selectedLayer.locked) {
      const layersById = new Map<string, Layer>();
      for (const l of composition.layers) layersById.set(l.id, l);

      const gizmo = computeLayerGizmo(
        selectedLayer,
        layersById,
        currentFrame,
        compToViewport
      );
      const hitRadius = e.pointerType === 'touch' ? 22 : 13;

      const t = evaluateLayerTransform(selectedLayer, currentFrame);
      const centerComp = applyMat2D(gizmo.worldMatrix, [0, 0]);
      const centerViewport = compToViewport(centerComp);

      // Rotate handle hit
      if (
        Math.hypot(vx - gizmo.rotateHandle[0], vy - gizmo.rotateHandle[1]) <=
        hitRadius
      ) {
        const startAngle = Math.atan2(
          vy - centerViewport[1],
          vx - centerViewport[0]
        );
        dragRef.current = {
          kind: 'rotate',
          layerId: selectedLayer.id,
          centerViewport,
          startAngle,
          startRotation: t.rotation,
        };
        return;
      }

      // Corner scale handles hit
      for (const corner of gizmo.corners) {
        if (Math.hypot(vx - corner[0], vy - corner[1]) <= hitRadius) {
          const startDist = Math.max(
            10,
            Math.hypot(vx - centerViewport[0], vy - centerViewport[1])
          );
          dragRef.current = {
            kind: 'scale',
            layerId: selectedLayer.id,
            centerViewport,
            startDist,
            startScale: t.scale,
          };
          return;
        }
      }
    }

    // Layer body hit-testing
    const compPt = viewportToComp([vx, vy]);
    const hit = hitTestLayersAtCompPoint(composition, currentFrame, compPt);
    if (hit) {
      onSelectLayer(hit.id);
      const t = evaluateLayerTransform(hit, currentFrame);
      dragRef.current = {
        kind: 'move',
        layerId: hit.id,
        startComp: compPt,
        startPos: t.position,
      };
    } else {
      onSelectLayer(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;

    if (drag.kind === 'pan') {
      setPan([
        drag.startPanX + (e.clientX - drag.startClientX),
        drag.startPanY + (e.clientY - drag.startClientY),
      ]);
      return;
    }

    if (drag.kind === 'move') {
      const compPt = viewportToComp([vx, vy]);
      let dx = compPt[0] - drag.startComp[0];
      let dy = compPt[1] - drag.startComp[1];

      // Convert world delta into parent local space if parented
      const layer = composition.layers.find((l) => l.id === drag.layerId);
      if (layer?.parentId) {
        const layersById = new Map<string, Layer>();
        for (const l of composition.layers) layersById.set(l.id, l);
        const pMat = getLayerWorldMatrix(layer.parentId, layersById, currentFrame);
        const inv = invertMat2D(pMat);
        if (inv) {
          const localA = applyMat2D(inv, drag.startComp);
          const localB = applyMat2D(inv, compPt);
          dx = localB[0] - localA[0];
          dy = localB[1] - localA[1];
        }
      }

      onTransformChange(
        drag.layerId,
        'position',
        [Math.round(drag.startPos[0] + dx), Math.round(drag.startPos[1] + dy)],
        false
      );
      return;
    }

    if (drag.kind === 'scale') {
      const dist = Math.max(
        4,
        Math.hypot(vx - drag.centerViewport[0], vy - drag.centerViewport[1])
      );
      const ratio = dist / drag.startDist;
      const nextX = Math.max(2, Math.round(drag.startScale[0] * ratio));
      const nextY = Math.max(2, Math.round(drag.startScale[1] * ratio));
      onTransformChange(drag.layerId, 'scale', [nextX, nextY], false);
      return;
    }

    if (drag.kind === 'rotate') {
      const curAngle = Math.atan2(
        vy - drag.centerViewport[1],
        vx - drag.centerViewport[0]
      );
      const degDelta = ((curAngle - drag.startAngle) * 180) / Math.PI;
      onTransformChange(
        drag.layerId,
        'rotation',
        Math.round(drag.startRotation + degDelta),
        false
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!drag || drag.kind === 'pan') return;

    // Commit final transform to Undo history
    const layer = composition.layers.find((l) => l.id === drag.layerId);
    if (!layer) return;
    const t = evaluateLayerTransform(layer, currentFrame);
    if (drag.kind === 'move') {
      onTransformChange(drag.layerId, 'position', t.position, true);
    } else if (drag.kind === 'scale') {
      onTransformChange(drag.layerId, 'scale', t.scale, true);
    } else if (drag.kind === 'rotate') {
      onTransformChange(drag.layerId, 'rotation', t.rotation, true);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoomMode('custom');
      setCustomZoom((z) =>
        Math.max(0.1, Math.min(3, (zoomMode === 'fit' ? fitZoom : z) * factor))
      );
    } else {
      setPan((p) => [p[0] - e.deltaX * 0.5, p[1] - e.deltaY * 0.5]);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-h-0 min-w-0 bg-[#0C0E12] overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className={`w-full h-full block touch-none ${
          activeTool === 'hand' || spaceDown ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
      />

      {/* Clean single compact zoom control anchored bottom-left */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-[#14171D]/90 backdrop-blur-sm border border-white/10 rounded-lg p-1">
        <button
          type="button"
          onClick={() => {
            setZoomMode('custom');
            setCustomZoom(Math.max(0.15, activeZoom * 0.8));
          }}
          title="Zoom Out"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-300 transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setZoomMode('fit');
            setPan([0, 0]);
          }}
          title="Fit Composition to Viewport"
          className="px-2 h-7 flex items-center gap-1 rounded hover:bg-white/10 font-mono text-[11px] tabular-nums text-slate-200 whitespace-nowrap"
        >
          <Maximize2 className="w-3 h-3 text-slate-400" />
          <span>{Math.round(activeZoom * 100)}%</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setZoomMode('custom');
            setCustomZoom(Math.min(3, activeZoom * 1.25));
          }}
          title="Zoom In"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-300 transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
