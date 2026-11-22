export type Vec2 = [number, number];

export type LayerType = 'shape' | 'text' | 'image' | 'video' | 'solid' | 'null';

export type ShapeKind = 'rect' | 'ellipse' | 'star';

export type BlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'difference';

export type EasingPreset =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'hold'
  | 'custom';

export interface BezierHandles {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Keyframe<T> {
  id: string;
  frame: number;
  value: T;
  easing: EasingPreset;
  bezierHandles: BezierHandles;
}

export interface AnimatableProperty<T> {
  animated: boolean;
  staticValue: T;
  keyframes: Keyframe<T>[];
}

export type TransformPropertyKey =
  | 'anchor'
  | 'position'
  | 'scale'
  | 'rotation'
  | 'opacity';

export interface TransformProps {
  anchor: AnimatableProperty<Vec2>;
  position: AnimatableProperty<Vec2>;
  scale: AnimatableProperty<Vec2>;
  rotation: AnimatableProperty<number>;
  opacity: AnimatableProperty<number>;
}

export interface ShapeProps {
  kind: ShapeKind;
  width: number;
  height: number;
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  cornerRadius: number;
  points: number;
  innerRadiusRatio: number;
}

export interface TextProps {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  color: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  letterSpacing: number;
}

export interface SolidProps {
  color: string;
  width: number;
  height: number;
}

export interface MediaLayerProps {
  assetId: string;
  width: number;
  height: number;
  mediaOffsetFrame: number;
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  parentId: string | null;
  inFrame: number;
  outFrame: number;
  visible: boolean;
  locked: boolean;
  solo: boolean;
  blendMode: BlendMode;
  colorLabel: string;
  expanded: boolean;
  transform: TransformProps;
  shapeProps?: ShapeProps;
  textProps?: TextProps;
  solidProps?: SolidProps;
  mediaProps?: MediaLayerProps;
}

export interface MediaAsset {
  id: string;
  name: string;
  kind: 'image' | 'video';
  mimeType: string;
  url: string;
  width: number;
  height: number;
  durationSec?: number;
  dataUrl?: string;
}

export interface Composition {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  backgroundColor: string;
  workAreaStart: number;
  workAreaEnd: number;
  layers: Layer[];
}

export interface StudioProject {
  version: number;
  id: string;
  name: string;
  composition: Composition;
  assets: MediaAsset[];
}

export type ToolMode = 'select' | 'hand';

export type MobileTab = 'timeline' | 'graph' | 'inspector' | 'media';

export type DesktopSideTab = 'inspector' | 'media';

export type TimelineViewMode = 'timeline' | 'graph';

export type ExportFormat = 'webm' | 'mp4' | 'gif' | 'json';

export interface SelectedKeyframeRef {
  layerId: string;
  property: TransformPropertyKey;
  keyframeId: string;
}
