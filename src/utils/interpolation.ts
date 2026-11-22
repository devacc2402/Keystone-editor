import type {
  AnimatableProperty,
  BezierHandles,
  EasingPreset,
  Keyframe,
  Layer,
  TransformPropertyKey,
  Vec2,
} from '../types/studio';

export const EASING_PRESET_HANDLES: Record<
  Exclude<EasingPreset, 'custom' | 'hold'>,
  BezierHandles
> = {
  linear: { x1: 0, y1: 0, x2: 1, y2: 1 },
  easeIn: { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  easeOut: { x1: 0, y1: 0, x2: 0.58, y2: 1 },
  easeInOut: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
};

export function sampleCubicBezierY(
  t: number,
  handles: BezierHandles
): number {
  const { x1, y1, x2, y2 } = handles;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (x1 === y1 && x2 === y2) return t;

  const sampleCurveX = (u: number) =>
    ((1 - 3 * x2 + 3 * x1) * u + (3 * x2 - 6 * x1)) * u * u + 3 * x1 * u;
  const sampleCurveY = (u: number) =>
    ((1 - 3 * y2 + 3 * y1) * u + (3 * y2 - 6 * y1)) * u * u + 3 * y1 * u;
  const sampleDerivativeX = (u: number) =>
    (3 * (1 - 3 * x2 + 3 * x1) * u + 2 * (3 * x2 - 6 * x1)) * u + 3 * x1;

  // Newton-Raphson with binary search fallback
  let u = t;
  for (let i = 0; i < 8; i++) {
    const err = sampleCurveX(u) - t;
    if (Math.abs(err) < 1e-6) {
      return sampleCurveY(u);
    }
    const dx = sampleDerivativeX(u);
    if (Math.abs(dx) < 1e-6) break;
    u -= err / dx;
  }

  let lo = 0;
  let hi = 1;
  u = t;
  for (let i = 0; i < 16; i++) {
    const x = sampleCurveX(u);
    if (Math.abs(x - t) < 1e-6) break;
    if (t > x) lo = u;
    else hi = u;
    u = (lo + hi) * 0.5;
  }

  return sampleCurveY(u);
}

export function evaluateProperty<T extends number | Vec2>(
  prop: AnimatableProperty<T>,
  frame: number
): T {
  if (!prop.animated || prop.keyframes.length === 0) {
    return prop.staticValue;
  }

  const kfs = prop.keyframes;
  if (kfs.length === 1 || frame <= kfs[0].frame) {
    return kfs[0].value;
  }
  const last = kfs[kfs.length - 1];
  if (frame >= last.frame) {
    return last.value;
  }

  for (let i = 0; i < kfs.length - 1; i++) {
    const k0 = kfs[i];
    const k1 = kfs[i + 1];
    if (frame >= k0.frame && frame <= k1.frame) {
      if (k0.easing === 'hold' || k1.frame === k0.frame) {
        return k0.value;
      }
      const rawT = (frame - k0.frame) / (k1.frame - k0.frame);
      const easedT = sampleCubicBezierY(rawT, k0.bezierHandles);

      if (typeof k0.value === 'number' && typeof k1.value === 'number') {
        return (k0.value + (k1.value - k0.value) * easedT) as T;
      }

      const v0 = k0.value as Vec2;
      const v1 = k1.value as Vec2;
      return [
        v0[0] + (v1[0] - v0[0]) * easedT,
        v0[1] + (v1[1] - v0[1]) * easedT,
      ] as T;
    }
  }

  return last.value;
}

export interface EvaluatedTransform {
  anchor: Vec2;
  position: Vec2;
  scale: Vec2;
  rotation: number;
  opacity: number;
}

export function evaluateLayerTransform(
  layer: Layer,
  frame: number
): EvaluatedTransform {
  return {
    anchor: evaluateProperty(layer.transform.anchor, frame),
    position: evaluateProperty(layer.transform.position, frame),
    scale: evaluateProperty(layer.transform.scale, frame),
    rotation: evaluateProperty(layer.transform.rotation, frame),
    opacity: Math.max(
      0,
      Math.min(100, evaluateProperty(layer.transform.opacity, frame))
    ),
  };
}

// 2D affine matrix [a, b, c, d, e, f] matching DOMMatrix / CanvasRenderingContext2D.transform
export type Mat2D = [number, number, number, number, number, number];

export function multiplyMat2D(m1: Mat2D, m2: Mat2D): Mat2D {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

export function invertMat2D(m: Mat2D): Mat2D | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-8) return null;
  const invDet = 1 / det;
  return [
    m[3] * invDet,
    -m[1] * invDet,
    -m[2] * invDet,
    m[0] * invDet,
    (m[2] * m[5] - m[3] * m[4]) * invDet,
    (m[1] * m[4] - m[0] * m[5]) * invDet,
  ];
}

export function applyMat2D(m: Mat2D, p: Vec2): Vec2 {
  return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
}

export function getLocalMatrix(t: EvaluatedTransform): Mat2D {
  const rad = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = t.scale[0] / 100;
  const sy = t.scale[1] / 100;
  const ax = t.anchor[0];
  const ay = t.anchor[1];
  const px = t.position[0];
  const py = t.position[1];

  // T(position) * R(rotation) * S(scale) * T(-anchor)
  const a = cos * sx;
  const b = sin * sx;
  const c = -sin * sy;
  const d = cos * sy;
  const e = px - (a * ax + c * ay);
  const f = py - (b * ax + d * ay);
  return [a, b, c, d, e, f];
}

export function getLayerWorldMatrix(
  layerId: string,
  layersById: Map<string, Layer>,
  frame: number,
  visited = new Set<string>()
): Mat2D {
  const layer = layersById.get(layerId);
  if (!layer || visited.has(layerId)) return [1, 0, 0, 1, 0, 0];
  visited.add(layerId);

  const local = getLocalMatrix(evaluateLayerTransform(layer, frame));
  if (!layer.parentId) return local;
  const parentMat = getLayerWorldMatrix(
    layer.parentId,
    layersById,
    frame,
    visited
  );
  return multiplyMat2D(parentMat, local);
}

export function getLayerBaseDimensions(layer: Layer): {
  width: number;
  height: number;
  centerOrigin: boolean;
} {
  if (layer.type === 'shape' && layer.shapeProps) {
    return {
      width: layer.shapeProps.width,
      height: layer.shapeProps.height,
      centerOrigin: true,
    };
  }
  if (layer.type === 'solid' && layer.solidProps) {
    return {
      width: layer.solidProps.width,
      height: layer.solidProps.height,
      centerOrigin: true,
    };
  }
  if ((layer.type === 'image' || layer.type === 'video') && layer.mediaProps) {
    return {
      width: layer.mediaProps.width,
      height: layer.mediaProps.height,
      centerOrigin: true,
    };
  }
  if (layer.type === 'text' && layer.textProps) {
    const lines = (layer.textProps.content || 'Text').split('\n');
    const maxChars = Math.max(1, ...lines.map((l) => l.length));
    const estWidth = Math.max(
      80,
      maxChars * layer.textProps.fontSize * 0.62 +
        Math.max(0, maxChars - 1) * layer.textProps.letterSpacing
    );
    const estHeight = Math.max(
      layer.textProps.fontSize * 1.2,
      lines.length * layer.textProps.fontSize * layer.textProps.lineHeight
    );
    return { width: estWidth, height: estHeight, centerOrigin: true };
  }
  return { width: 120, height: 120, centerOrigin: true };
}

export function getPropertyScalarPreview(
  prop: AnimatableProperty<number | Vec2>,
  frame: number
): number {
  const v = evaluateProperty(prop, frame);
  if (typeof v === 'number') return v;
  return v[0];
}

export function upsertKeyframeAtFrame<T extends number | Vec2>(
  prop: AnimatableProperty<T>,
  frame: number,
  value: T,
  easing: EasingPreset = 'easeInOut'
): AnimatableProperty<T> {
  const existingIdx = prop.keyframes.findIndex((k) => k.frame === frame);
  const handles =
    easing === 'hold' || easing === 'custom'
      ? { x1: 0.42, y1: 0, x2: 0.58, y2: 1 }
      : EASING_PRESET_HANDLES[easing];

  if (existingIdx >= 0) {
    const next = [...prop.keyframes];
    next[existingIdx] = {
      ...next[existingIdx],
      value,
    };
    return { ...prop, animated: true, keyframes: next };
  }

  const newKf: Keyframe<T> = {
    id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    frame,
    value,
    easing,
    bezierHandles: { ...handles },
  };

  const next = [...prop.keyframes, newKf].sort((a, b) => a.frame - b.frame);
  return { ...prop, animated: true, keyframes: next };
}

export function formatTimecode(frame: number, fps: number): string {
  const safeFps = Math.max(1, Math.round(fps));
  const clamped = Math.max(0, Math.round(frame));
  const ff = clamped % safeFps;
  const totalSec = Math.floor(clamped / safeFps);
  const ss = totalSec % 60;
  const mm = Math.floor(totalSec / 60) % 60;
  const hh = Math.floor(totalSec / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

export function hasAnySoloLayer(layers: Layer[]): boolean {
  return layers.some((l) => l.solo);
}

export function isLayerActiveAtFrame(
  layer: Layer,
  frame: number,
  anySolo: boolean
): boolean {
  if (!layer.visible) return false;
  if (anySolo && !layer.solo) return false;
  return frame >= layer.inFrame && frame <= layer.outFrame;
}

export function getAnimatableProperty(
  layer: Layer,
  key: TransformPropertyKey
): AnimatableProperty<number | Vec2> {
  return layer.transform[key] as AnimatableProperty<number | Vec2>;
}
