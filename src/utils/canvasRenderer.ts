import type { Composition, Layer, Vec2 } from '../types/studio';
import {
  applyMat2D,
  EASING_PRESET_HANDLES,
  evaluateLayerTransform,
  getLayerBaseDimensions,
  getLayerWorldMatrix,
  hasAnySoloLayer,
  invertMat2D,
  isLayerActiveAtFrame,
  type Mat2D,
} from './interpolation';

export interface MediaCache {
  images: Map<string, HTMLImageElement>;
  videos: Map<string, HTMLVideoElement>;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(Math.max(0, r), Math.min(w, h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawStarPath(
  ctx: CanvasRenderingContext2D,
  points: number,
  outerRx: number,
  outerRy: number,
  innerRatio: number
) {
  const count = Math.max(3, Math.round(points));
  const step = Math.PI / count;
  ctx.beginPath();
  for (let i = 0; i < count * 2; i++) {
    const angle = i * step - Math.PI / 2;
    const isOuter = i % 2 === 0;
    const rx = isOuter ? outerRx : outerRx * innerRatio;
    const ry = isOuter ? outerRy : outerRy * innerRatio;
    const px = Math.cos(angle) * rx;
    const py = Math.sin(angle) * ry;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawTextLayer(ctx: CanvasRenderingContext2D, layer: Layer) {
  const tp = layer.textProps;
  if (!tp) return;
  const lines = (tp.content || '').split('\n');
  const lineH = tp.fontSize * tp.lineHeight;
  const totalH = lines.length * lineH;

  ctx.font = `${tp.fontWeight} ${tp.fontSize}px "${tp.fontFamily}", "DM Sans", sans-serif`;
  ctx.fillStyle = tp.color;
  ctx.textAlign = tp.align;
  ctx.textBaseline = 'middle';

  const { width } = getLayerBaseDimensions(layer);
  const startY = -totalH / 2 + lineH / 2;
  let anchorX = 0;
  if (tp.align === 'left') anchorX = -width / 2;
  else if (tp.align === 'right') anchorX = width / 2;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const y = startY + i * lineH;
    if (tp.letterSpacing !== 0 && typeof ctx.letterSpacing === 'string') {
      ctx.letterSpacing = `${tp.letterSpacing}px`;
    }
    ctx.fillText(line, anchorX, y);
  }
  if (typeof ctx.letterSpacing === 'string') {
    ctx.letterSpacing = '0px';
  }
}

export function renderCompositionToContext(
  ctx: CanvasRenderingContext2D,
  comp: Composition,
  frame: number,
  mediaCache: MediaCache,
  options?: {
    showNullGuides?: boolean;
    selectedLayerId?: string | null;
  }
) {
  ctx.save();
  ctx.fillStyle = comp.backgroundColor || '#0D1017';
  ctx.fillRect(0, 0, comp.width, comp.height);

  const layersById = new Map<string, Layer>();
  for (const l of comp.layers) layersById.set(l.id, l);
  const anySolo = hasAnySoloLayer(comp.layers);

  // Render bottom-to-top (end of array to index 0)
  for (let i = comp.layers.length - 1; i >= 0; i--) {
    const layer = comp.layers[i];
    if (!isLayerActiveAtFrame(layer, frame, anySolo)) continue;

    const evaluated = evaluateLayerTransform(layer, frame);
    if (evaluated.opacity <= 0.001) continue;

    const mat = getLayerWorldMatrix(layer.id, layersById, frame);

    ctx.save();
    ctx.transform(mat[0], mat[1], mat[2], mat[3], mat[4], mat[5]);
    ctx.globalAlpha = Math.max(0, Math.min(1, evaluated.opacity / 100));
    ctx.globalCompositeOperation = layer.blendMode || 'source-over';

    if (layer.type === 'shape' && layer.shapeProps) {
      const sp = layer.shapeProps;
      const hw = sp.width / 2;
      const hh = sp.height / 2;
      if (sp.kind === 'rect') {
        drawRoundedRectPath(ctx, -hw, -hh, sp.width, sp.height, sp.cornerRadius);
      } else if (sp.kind === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.max(1, hw), Math.max(1, hh), 0, 0, Math.PI * 2);
      } else {
        drawStarPath(ctx, sp.points, hw, hh, sp.innerRadiusRatio);
      }

      if (sp.fillOpacity > 0) {
        ctx.save();
        ctx.globalAlpha *= sp.fillOpacity / 100;
        ctx.fillStyle = sp.fillColor;
        ctx.fill();
        ctx.restore();
      }
      if (sp.strokeWidth > 0) {
        ctx.strokeStyle = sp.strokeColor;
        ctx.lineWidth = sp.strokeWidth;
        ctx.stroke();
      }
    } else if (layer.type === 'solid' && layer.solidProps) {
      ctx.fillStyle = layer.solidProps.color;
      ctx.fillRect(
        -layer.solidProps.width / 2,
        -layer.solidProps.height / 2,
        layer.solidProps.width,
        layer.solidProps.height
      );
    } else if (layer.type === 'text') {
      drawTextLayer(ctx, layer);
    } else if (layer.type === 'image' && layer.mediaProps) {
      const img = mediaCache.images.get(layer.mediaProps.assetId);
      const w = layer.mediaProps.width;
      const h = layer.mediaProps.height;
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else {
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(-w / 2, -h / 2, w, h);
      }
    } else if (layer.type === 'video' && layer.mediaProps) {
      const video = mediaCache.videos.get(layer.mediaProps.assetId);
      const w = layer.mediaProps.width;
      const h = layer.mediaProps.height;
      if (video && video.readyState >= 2) {
        ctx.drawImage(video, -w / 2, -h / 2, w, h);
      } else {
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(-w / 2, -h / 2, w, h);
      }
    } else if (
      layer.type === 'null' &&
      options?.showNullGuides &&
      options.selectedLayerId === layer.id
    ) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(-60, -60, 120, 120);
    }

    ctx.restore();
  }

  ctx.restore();
}

export interface LayerGizmoGeometry {
  corners: [Vec2, Vec2, Vec2, Vec2]; // TL, TR, BR, BL in stage viewport pixels
  topMid: Vec2;
  rotateHandle: Vec2;
  anchorPoint: Vec2;
  worldMatrix: Mat2D;
}

export function computeLayerGizmo(
  layer: Layer,
  layersById: Map<string, Layer>,
  frame: number,
  compToViewport: (p: Vec2) => Vec2
): LayerGizmoGeometry {
  const mat = getLayerWorldMatrix(layer.id, layersById, frame);
  const { width, height } = getLayerBaseDimensions(layer);
  const hw = width / 2;
  const hh = height / 2;

  const tl = compToViewport(applyMat2D(mat, [-hw, -hh]));
  const tr = compToViewport(applyMat2D(mat, [hw, -hh]));
  const br = compToViewport(applyMat2D(mat, [hw, hh]));
  const bl = compToViewport(applyMat2D(mat, [-hw, hh]));

  const topMid: Vec2 = [(tl[0] + tr[0]) / 2, (tl[1] + tr[1]) / 2];
  const dx = tr[0] - tl[0];
  const dy = tr[1] - tl[1];
  const len = Math.hypot(dx, dy) || 1;
  // Outward normal above top edge
  const nx = dy / len;
  const ny = -dx / len;
  const rotateHandle: Vec2 = [topMid[0] + nx * 28, topMid[1] + ny * 28];

  const t = evaluateLayerTransform(layer, frame);
  const anchorPoint = compToViewport(applyMat2D(mat, t.anchor));

  return {
    corners: [tl, tr, br, bl],
    topMid,
    rotateHandle,
    anchorPoint,
    worldMatrix: mat,
  };
}

export function hitTestLayersAtCompPoint(
  comp: Composition,
  frame: number,
  compPoint: Vec2
): Layer | null {
  const layersById = new Map<string, Layer>();
  for (const l of comp.layers) layersById.set(l.id, l);
  const anySolo = hasAnySoloLayer(comp.layers);

  for (const layer of comp.layers) {
    if (layer.locked) continue;
    if (!isLayerActiveAtFrame(layer, frame, anySolo)) continue;
    const mat = getLayerWorldMatrix(layer.id, layersById, frame);
    const inv = invertMat2D(mat);
    if (!inv) continue;

    const local = applyMat2D(inv, compPoint);
    const { width, height } = getLayerBaseDimensions(layer);
    const hw = Math.max(24, width / 2);
    const hh = Math.max(24, height / 2);

    if (
      local[0] >= -hw &&
      local[0] <= hw &&
      local[1] >= -hh &&
      local[1] <= hh
    ) {
      return layer;
    }
  }
  return null;
}

export { EASING_PRESET_HANDLES };
