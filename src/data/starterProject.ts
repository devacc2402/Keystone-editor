import type {
  BlendMode,
  Layer,
  MediaAsset,
  ShapeKind,
  StudioProject,
  TransformProps,
  Vec2,
} from '../types/studio';
import { EASING_PRESET_HANDLES } from '../utils/interpolation';

const LAYER_COLORS = [
  '#5B7CFA',
  '#F59E0B',
  '#10B981',
  '#EC4899',
  '#8B5CF6',
  '#06B6D4',
];

export function nextLayerColor(index: number): string {
  return LAYER_COLORS[index % LAYER_COLORS.length];
}

export function createDefaultTransform(
  compWidth: number,
  compHeight: number
): TransformProps {
  return {
    anchor: { animated: false, staticValue: [0, 0], keyframes: [] },
    position: {
      animated: false,
      staticValue: [compWidth / 2, compHeight / 2],
      keyframes: [],
    },
    scale: { animated: false, staticValue: [100, 100], keyframes: [] },
    rotation: { animated: false, staticValue: 0, keyframes: [] },
    opacity: { animated: false, staticValue: 100, keyframes: [] },
  };
}

export function createShapeLayer(
  kind: ShapeKind,
  compWidth: number,
  compHeight: number,
  durationFrames: number,
  index: number
): Layer {
  const id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const names: Record<ShapeKind, string> = {
    rect: 'Rectangle',
    ellipse: 'Ellipse',
    star: 'Star',
  };
  return {
    id,
    name: `${names[kind]} ${index + 1}`,
    type: 'shape',
    parentId: null,
    inFrame: 0,
    outFrame: durationFrames,
    visible: true,
    locked: false,
    solo: false,
    blendMode: 'source-over',
    colorLabel: nextLayerColor(index),
    expanded: false,
    transform: createDefaultTransform(compWidth, compHeight),
    shapeProps: {
      kind,
      width: kind === 'star' ? 280 : 320,
      height: kind === 'star' ? 280 : 320,
      fillColor: kind === 'ellipse' ? '#F59E0B' : '#5B7CFA',
      fillOpacity: 100,
      strokeColor: '#FFFFFF',
      strokeWidth: 0,
      cornerRadius: kind === 'rect' ? 28 : 0,
      points: 5,
      innerRadiusRatio: 0.48,
    },
  };
}

export function createTextLayer(
  compWidth: number,
  compHeight: number,
  durationFrames: number,
  index: number,
  content = 'Motion Title'
): Layer {
  const id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    name: `Text ${index + 1}`,
    type: 'text',
    parentId: null,
    inFrame: 0,
    outFrame: durationFrames,
    visible: true,
    locked: false,
    solo: false,
    blendMode: 'source-over',
    colorLabel: nextLayerColor(index),
    expanded: false,
    transform: createDefaultTransform(compWidth, compHeight),
    textProps: {
      content,
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 96,
      fontWeight: 700,
      color: '#F8FAFC',
      align: 'center',
      lineHeight: 1.15,
      letterSpacing: -1,
    },
  };
}

export function createSolidLayer(
  compWidth: number,
  compHeight: number,
  durationFrames: number,
  index: number,
  color = '#1E293B'
): Layer {
  const id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    name: `Solid ${index + 1}`,
    type: 'solid',
    parentId: null,
    inFrame: 0,
    outFrame: durationFrames,
    visible: true,
    locked: false,
    solo: false,
    blendMode: 'source-over',
    colorLabel: nextLayerColor(index),
    expanded: false,
    transform: createDefaultTransform(compWidth, compHeight),
    solidProps: {
      color,
      width: compWidth,
      height: compHeight,
    },
  };
}

export function createMediaLayer(
  asset: MediaAsset,
  compWidth: number,
  compHeight: number,
  durationFrames: number,
  index: number
): Layer {
  const id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const transform = createDefaultTransform(compWidth, compHeight);
  // Auto-fit oversized assets cleanly to composition
  const fitRatio = Math.min(
    1,
    (compWidth * 0.75) / Math.max(1, asset.width),
    (compHeight * 0.75) / Math.max(1, asset.height)
  );
  const pct = Math.round(fitRatio * 100);
  transform.scale.staticValue = [pct, pct];

  return {
    id,
    name: asset.name.replace(/\.[^/.]+$/, ''),
    type: asset.kind,
    parentId: null,
    inFrame: 0,
    outFrame: durationFrames,
    visible: true,
    locked: false,
    solo: false,
    blendMode: 'source-over' as BlendMode,
    colorLabel: nextLayerColor(index),
    expanded: false,
    transform,
    mediaProps: {
      assetId: asset.id,
      width: asset.width,
      height: asset.height,
      mediaOffsetFrame: 0,
    },
  };
}

export function createBlankProject(): StudioProject {
  return {
    version: 1,
    id: `proj_${Date.now()}`,
    name: 'Untitled Comp',
    assets: [],
    composition: {
      id: 'comp_1',
      name: 'Main Comp',
      width: 1920,
      height: 1080,
      fps: 30,
      durationFrames: 150,
      backgroundColor: '#0E121A',
      workAreaStart: 0,
      workAreaEnd: 150,
      layers: [],
    },
  };
}

function kf<T>(
  id: string,
  frame: number,
  value: T,
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' = 'easeInOut'
) {
  return {
    id,
    frame,
    value,
    easing,
    bezierHandles: { ...EASING_PRESET_HANDLES[easing] },
  };
}

export function createStarterProject(): StudioProject {
  const titleLayer: Layer = {
    id: 'layer_title',
    name: 'Headline Title',
    type: 'text',
    parentId: null,
    inFrame: 12,
    outFrame: 150,
    visible: true,
    locked: false,
    solo: false,
    blendMode: 'source-over',
    colorLabel: '#5B7CFA',
    expanded: true,
    transform: {
      anchor: { animated: false, staticValue: [0, 0], keyframes: [] },
      position: {
        animated: true,
        staticValue: [960, 505],
        keyframes: [
          kf<Vec2>('k_t_p1', 12, [960, 575], 'easeOut'),
          kf<Vec2>('k_t_p2', 42, [960, 505], 'easeInOut'),
          kf<Vec2>('k_t_p3', 120, [960, 505], 'easeIn'),
          kf<Vec2>('k_t_p4', 145, [960, 445], 'easeOut'),
        ],
      },
      scale: {
        animated: true,
        staticValue: [100, 100],
        keyframes: [
          kf<Vec2>('k_t_s1', 12, [88, 88], 'easeOut'),
          kf<Vec2>('k_t_s2', 42, [100, 100], 'easeInOut'),
        ],
      },
      rotation: { animated: false, staticValue: 0, keyframes: [] },
      opacity: {
        animated: true,
        staticValue: 100,
        keyframes: [
          kf('k_t_o1', 12, 0, 'easeOut'),
          kf('k_t_o2', 32, 100, 'linear'),
          kf('k_t_o3', 124, 100, 'easeIn'),
          kf('k_t_o4', 145, 0, 'easeOut'),
        ],
      },
    },
    textProps: {
      content: 'KEYSTONE MOTION',
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 108,
      fontWeight: 700,
      color: '#F8FAFC',
      align: 'center',
      lineHeight: 1.1,
      letterSpacing: 4,
    },
  };

  const subtitleLayer: Layer = {
    id: 'layer_subtitle',
    name: 'Subtitle Tagline',
    type: 'text',
    parentId: null,
    inFrame: 24,
    outFrame: 145,
    visible: true,
    locked: false,
    solo: false,
    blendMode: 'source-over',
    colorLabel: '#10B981',
    expanded: false,
    transform: {
      anchor: { animated: false, staticValue: [0, 0], keyframes: [] },
      position: {
        animated: true,
        staticValue: [960, 610],
        keyframes: [
          kf<Vec2>('k_sub_p1', 24, [960, 650], 'easeOut'),
          kf<Vec2>('k_sub_p2', 52, [960, 610], 'easeInOut'),
        ],
      },
      scale: { animated: false, staticValue: [100, 100], keyframes: [] },
      rotation: { animated: false, staticValue: 0, keyframes: [] },
      opacity: {
        animated: true,
        staticValue: 100,
        keyframes: [
          kf('k_sub_o1', 24, 0, 'easeOut'),
          kf('k_sub_o2', 44, 85, 'linear'),
          kf('k_sub_o3', 124, 85, 'easeIn'),
          kf('k_sub_o4', 142, 0, 'easeOut'),
        ],
      },
    },
    textProps: {
      content: '2D KEYFRAME & CURVE COMPOSITOR',
      fontFamily: 'DM Sans',
      fontSize: 30,
      fontWeight: 500,
      color: '#94A3B8',
      align: 'center',
      lineHeight: 1.2,
      letterSpacing: 8,
    },
  };

  const accentBarLayer: Layer = {
    id: 'layer_bar',
    name: 'Accent Bar',
    type: 'shape',
    parentId: null,
    inFrame: 6,
    outFrame: 150,
    visible: true,
    locked: false,
    solo: false,
    blendMode: 'source-over',
    colorLabel: '#F59E0B',
    expanded: false,
    transform: {
      anchor: { animated: false, staticValue: [0, 0], keyframes: [] },
      position: { animated: false, staticValue: [960, 395], keyframes: [] },
      scale: {
        animated: true,
        staticValue: [100, 100],
        keyframes: [
          kf<Vec2>('k_bar_s1', 6, [0, 100], 'easeOut'),
          kf<Vec2>('k_bar_s2', 36, [100, 100], 'easeInOut'),
          kf<Vec2>('k_bar_s3', 122, [100, 100], 'easeIn'),
          kf<Vec2>('k_bar_s4', 144, [0, 100], 'easeOut'),
        ],
      },
      rotation: { animated: false, staticValue: 0, keyframes: [] },
      opacity: { animated: false, staticValue: 100, keyframes: [] },
    },
    shapeProps: {
      kind: 'rect',
      width: 240,
      height: 10,
      fillColor: '#5B7CFA',
      fillOpacity: 100,
      strokeColor: '#FFFFFF',
      strokeWidth: 0,
      cornerRadius: 5,
      points: 5,
      innerRadiusRatio: 0.5,
    },
  };

  const orbitRingLayer: Layer = {
    id: 'layer_ring',
    name: 'Orbital Ring',
    type: 'shape',
    parentId: null,
    inFrame: 0,
    outFrame: 150,
    visible: true,
    locked: false,
    solo: false,
    blendMode: 'screen',
    colorLabel: '#8B5CF6',
    expanded: false,
    transform: {
      anchor: { animated: false, staticValue: [0, 0], keyframes: [] },
      position: { animated: false, staticValue: [960, 540], keyframes: [] },
      scale: {
        animated: true,
        staticValue: [100, 100],
        keyframes: [
          kf<Vec2>('k_ring_s1', 0, [65, 65], 'easeOut'),
          kf<Vec2>('k_ring_s2', 45, [100, 100], 'easeInOut'),
          kf<Vec2>('k_ring_s3', 149, [108, 108], 'easeOut'),
        ],
      },
      rotation: {
        animated: true,
        staticValue: 0,
        keyframes: [
          kf('k_ring_r1', 0, -24, 'easeInOut'),
          kf('k_ring_r2', 149, 24, 'easeInOut'),
        ],
      },
      opacity: {
        animated: true,
        staticValue: 45,
        keyframes: [
          kf('k_ring_o1', 0, 0, 'easeOut'),
          kf('k_ring_o2', 25, 38, 'linear'),
          kf('k_ring_o3', 125, 38, 'easeIn'),
          kf('k_ring_o4', 149, 0, 'easeOut'),
        ],
      },
    },
    shapeProps: {
      kind: 'ellipse',
      width: 780,
      height: 780,
      fillColor: '#5B7CFA',
      fillOpacity: 8,
      strokeColor: '#5B7CFA',
      strokeWidth: 3,
      cornerRadius: 0,
      points: 5,
      innerRadiusRatio: 0.5,
    },
  };

  const backdropLayer: Layer = {
    id: 'layer_bg',
    name: 'Studio Backdrop',
    type: 'solid',
    parentId: null,
    inFrame: 0,
    outFrame: 150,
    visible: true,
    locked: true,
    solo: false,
    blendMode: 'source-over',
    colorLabel: '#06B6D4',
    expanded: false,
    transform: createDefaultTransform(1920, 1080),
    solidProps: {
      color: '#0E131F',
      width: 1920,
      height: 1080,
    },
  };

  return {
    version: 1,
    id: 'starter_keystone_v1',
    name: 'Studio Opener',
    assets: [],
    composition: {
      id: 'comp_main',
      name: 'Studio Opener',
      width: 1920,
      height: 1080,
      fps: 30,
      durationFrames: 150,
      backgroundColor: '#0B0E16',
      workAreaStart: 0,
      workAreaEnd: 150,
      layers: [
        titleLayer,
        subtitleLayer,
        accentBarLayer,
        orbitRingLayer,
        backdropLayer,
      ],
    },
  };
}
