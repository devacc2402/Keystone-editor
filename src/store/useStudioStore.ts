import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createBlankProject,
  createMediaLayer,
  createShapeLayer,
  createSolidLayer,
  createStarterProject,
  createTextLayer,
} from '../data/starterProject';
import type {
  Composition,
  EasingPreset,
  Keyframe,
  Layer,
  MediaAsset,
  SelectedKeyframeRef,
  ShapeKind,
  StudioProject,
  ToolMode,
  TransformPropertyKey,
  Vec2,
} from '../types/studio';
import type { MediaCache } from '../utils/canvasRenderer';
import {
  EASING_PRESET_HANDLES,
  evaluateProperty,
  upsertKeyframeAtFrame,
} from '../utils/interpolation';
import {
  fileToDataUrl,
  loadProjectFromIndexedDB,
  saveProjectToIndexedDB,
} from '../utils/storage';

const MAX_HISTORY = 50;

export function useStudioStore() {
  const [project, setProject] = useState<StudioProject>(() =>
    createStarterProject()
  );
  const [historyPast, setHistoryPast] = useState<StudioProject[]>([]);
  const [historyFuture, setHistoryFuture] = useState<StudioProject[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    'layer_title'
  );
  const [activeGraphProperty, setActiveGraphProperty] =
    useState<TransformPropertyKey>('position');
  const [selectedKeyframe, setSelectedKeyframe] =
    useState<SelectedKeyframeRef | null>(null);

  const [currentFrame, setCurrentFrame] = useState<number>(24);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loopPlayback, setLoopPlayback] = useState<boolean>(true);
  const [activeTool, setActiveTool] = useState<ToolMode>('select');
  const [hydrated, setHydrated] = useState<boolean>(false);

  const mediaCacheRef = useRef<MediaCache>({
    images: new Map(),
    videos: new Map(),
  });
  const [mediaRevision, setMediaRevision] = useState<number>(0);

  // Load persisted project on mount
  useEffect(() => {
    let cancelled = false;
    loadProjectFromIndexedDB().then((saved) => {
      if (cancelled) return;
      if (saved) {
        setProject(saved);
        setSelectedLayerId(saved.composition.layers[0]?.id ?? null);
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-save debounced to IndexedDB
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      void saveProjectToIndexedDB(project);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [project, hydrated]);

  // Synchronize HTMLImageElement and HTMLVideoElement cache for assets
  useEffect(() => {
    const cache = mediaCacheRef.current;
    const activeIds = new Set(project.assets.map((a) => a.id));

    for (const key of cache.images.keys()) {
      if (!activeIds.has(key)) cache.images.delete(key);
    }
    for (const key of cache.videos.keys()) {
      if (!activeIds.has(key)) {
        const v = cache.videos.get(key);
        if (v) v.src = '';
        cache.videos.delete(key);
      }
    }

    for (const asset of project.assets) {
      if (asset.kind === 'image' && !cache.images.has(asset.id)) {
        const img = new Image();
        img.onload = () => setMediaRevision((r) => r + 1);
        img.src = asset.url;
        cache.images.set(asset.id, img);
      } else if (asset.kind === 'video' && !cache.videos.has(asset.id)) {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.onloadeddata = () => setMediaRevision((r) => r + 1);
        video.src = asset.url;
        cache.videos.set(asset.id, video);
      }
    }
  }, [project.assets]);

  // Sync video elements to currentFrame when scrubbing or playing
  useEffect(() => {
    const fps = project.composition.fps || 30;
    for (const layer of project.composition.layers) {
      if (layer.type !== 'video' || !layer.mediaProps) continue;
      const video = mediaCacheRef.current.videos.get(layer.mediaProps.assetId);
      if (!video || video.readyState < 1) continue;

      const localFrame =
        currentFrame - layer.inFrame + layer.mediaProps.mediaOffsetFrame;
      const targetSec = Math.max(
        0,
        Math.min(video.duration || 0, localFrame / fps)
      );
      if (Math.abs(video.currentTime - targetSec) > 0.04) {
        video.currentTime = targetSec;
      }
    }
  }, [currentFrame, project.composition]);

  // Playback loop via requestAnimationFrame
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let lastTime = performance.now();
    let accFrame = currentFrame;

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const fps = project.composition.fps || 30;
      const start = project.composition.workAreaStart;
      const end = Math.max(start + 1, project.composition.workAreaEnd);

      accFrame += dt * fps;
      if (accFrame >= end) {
        if (loopPlayback) {
          accFrame = start + ((accFrame - start) % (end - start));
        } else {
          setCurrentFrame(end);
          setIsPlaying(false);
          return;
        }
      }
      setCurrentFrame(Math.floor(accFrame));
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    isPlaying,
    loopPlayback,
    project.composition.fps,
    project.composition.workAreaStart,
    project.composition.workAreaEnd,
  ]);

  const commitProject = useCallback(
    (updater: (prev: StudioProject) => StudioProject, recordHistory = true) => {
      setProject((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        if (recordHistory) {
          setHistoryPast((past) => [...past.slice(-(MAX_HISTORY - 1)), prev]);
          setHistoryFuture([]);
        }
        return next;
      });
    },
    []
  );

  const undo = useCallback(() => {
    setHistoryPast((past) => {
      if (past.length === 0) return past;
      const previous = past[past.length - 1];
      setProject((current) => {
        setHistoryFuture((future) => [current, ...future]);
        return previous;
      });
      return past.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setHistoryFuture((future) => {
      if (future.length === 0) return future;
      const next = future[0];
      setProject((current) => {
        setHistoryPast((past) => [...past, current]);
        return next;
      });
      return future.slice(1);
    });
  }, []);

  const updateComposition = useCallback(
    (patch: Partial<Composition>, recordHistory = true) => {
      commitProject(
        (prev) => ({
          ...prev,
          name: patch.name ?? prev.name,
          composition: { ...prev.composition, ...patch },
        }),
        recordHistory
      );
    },
    [commitProject]
  );

  const updateLayer = useCallback(
    (
      layerId: string,
      updater: (layer: Layer) => Layer,
      recordHistory = true
    ) => {
      commitProject(
        (prev) => ({
          ...prev,
          composition: {
            ...prev.composition,
            layers: prev.composition.layers.map((l) =>
              l.id === layerId ? updater(l) : l
            ),
          },
        }),
        recordHistory
      );
    },
    [commitProject]
  );

  const setLayerTransformValue = useCallback(
    (
      layerId: string,
      key: TransformPropertyKey,
      value: number | Vec2,
      recordHistory = true
    ) => {
      updateLayer(
        layerId,
        (layer) => {
          const prop = layer.transform[key];
          if (prop.animated) {
            const updatedProp = upsertKeyframeAtFrame(
              prop as never,
              currentFrame,
              value as never
            );
            return {
              ...layer,
              transform: { ...layer.transform, [key]: updatedProp },
            };
          }
          return {
            ...layer,
            transform: {
              ...layer.transform,
              [key]: { ...prop, staticValue: value },
            },
          };
        },
        recordHistory
      );
    },
    [currentFrame, updateLayer]
  );

  const togglePropertyStopwatch = useCallback(
    (layerId: string, key: TransformPropertyKey) => {
      updateLayer(layerId, (layer) => {
        const prop = layer.transform[key];
        if (prop.animated) {
          const currentVal = evaluateProperty(prop as never, currentFrame);
          return {
            ...layer,
            transform: {
              ...layer.transform,
              [key]: {
                animated: false,
                staticValue: currentVal,
                keyframes: [],
              },
            },
          };
        }

        const nextProp = upsertKeyframeAtFrame(
          { ...prop, animated: true } as never,
          currentFrame,
          prop.staticValue as never,
          'easeInOut'
        );
        return {
          ...layer,
          expanded: true,
          transform: { ...layer.transform, [key]: nextProp },
        };
      });
      setActiveGraphProperty(key);
    },
    [currentFrame, updateLayer]
  );

  const addKeyframeAtCurrentFrame = useCallback(
    (layerId: string, key: TransformPropertyKey) => {
      updateLayer(layerId, (layer) => {
        const prop = layer.transform[key];
        const currentVal = evaluateProperty(prop as never, currentFrame);
        const nextProp = upsertKeyframeAtFrame(
          prop as never,
          currentFrame,
          currentVal as never,
          'easeInOut'
        );
        return {
          ...layer,
          expanded: true,
          transform: { ...layer.transform, [key]: nextProp },
        };
      });
      setActiveGraphProperty(key);
    },
    [currentFrame, updateLayer]
  );

  const moveKeyframe = useCallback(
    (
      layerId: string,
      key: TransformPropertyKey,
      keyframeId: string,
      targetFrame: number,
      recordHistory = true
    ) => {
      const clamped = Math.max(
        0,
        Math.min(project.composition.durationFrames, Math.round(targetFrame))
      );
      updateLayer(
        layerId,
        (layer) => {
          const prop = layer.transform[key];
          const moved = prop.keyframes
            .map((kf) =>
              kf.id === keyframeId ? { ...kf, frame: clamped } : kf
            )
            .sort((a, b) => a.frame - b.frame);
          return {
            ...layer,
            transform: {
              ...layer.transform,
              [key]: { ...prop, keyframes: moved },
            },
          };
        },
        recordHistory
      );
    },
    [project.composition.durationFrames, updateLayer]
  );

  const deleteKeyframe = useCallback(
    (layerId: string, key: TransformPropertyKey, keyframeId: string) => {
      updateLayer(layerId, (layer) => {
        const prop = layer.transform[key];
        const remaining = prop.keyframes.filter((k) => k.id !== keyframeId);
        return {
          ...layer,
          transform: {
            ...layer.transform,
            [key]: {
              ...prop,
              animated: remaining.length > 0,
              staticValue:
                remaining.length === 0
                  ? evaluateProperty(prop as never, currentFrame)
                  : prop.staticValue,
              keyframes: remaining,
            },
          },
        };
      });
      setSelectedKeyframe((cur) =>
        cur?.keyframeId === keyframeId ? null : cur
      );
    },
    [currentFrame, updateLayer]
  );

  const updateKeyframeEasing = useCallback(
    (
      layerId: string,
      key: TransformPropertyKey,
      keyframeId: string,
      easing: EasingPreset,
      customHandles?: Keyframe<unknown>['bezierHandles'],
      recordHistory = true
    ) => {
      updateLayer(
        layerId,
        (layer) => {
          const prop = layer.transform[key];
          const updated = prop.keyframes.map((kf) => {
            if (kf.id !== keyframeId) return kf;
            const handles =
              customHandles ??
              (easing === 'hold' || easing === 'custom'
                ? kf.bezierHandles
                : { ...EASING_PRESET_HANDLES[easing] });
            return { ...kf, easing, bezierHandles: handles };
          });
          return {
            ...layer,
            transform: {
              ...layer.transform,
              [key]: { ...prop, keyframes: updated },
            },
          };
        },
        recordHistory
      );
    },
    [updateLayer]
  );

  const addShape = useCallback(
    (kind: ShapeKind) => {
      const comp = project.composition;
      const layer = createShapeLayer(
        kind,
        comp.width,
        comp.height,
        comp.durationFrames,
        comp.layers.length
      );
      commitProject((prev) => ({
        ...prev,
        composition: {
          ...prev.composition,
          layers: [layer, ...prev.composition.layers],
        },
      }));
      setSelectedLayerId(layer.id);
      setActiveTool('select');
    },
    [commitProject, project.composition]
  );

  const addText = useCallback(() => {
    const comp = project.composition;
    const layer = createTextLayer(
      comp.width,
      comp.height,
      comp.durationFrames,
      comp.layers.length
    );
    commitProject((prev) => ({
      ...prev,
      composition: {
        ...prev.composition,
        layers: [layer, ...prev.composition.layers],
      },
    }));
    setSelectedLayerId(layer.id);
    setActiveTool('select');
  }, [commitProject, project.composition]);

  const addSolid = useCallback(() => {
    const comp = project.composition;
    const layer = createSolidLayer(
      comp.width,
      comp.height,
      comp.durationFrames,
      comp.layers.length
    );
    commitProject((prev) => ({
      ...prev,
      composition: {
        ...prev.composition,
        layers: [layer, ...prev.composition.layers],
      },
    }));
    setSelectedLayerId(layer.id);
  }, [commitProject, project.composition]);

  const addLayerFromAsset = useCallback(
    (asset: MediaAsset) => {
      const comp = project.composition;
      const layer = createMediaLayer(
        asset,
        comp.width,
        comp.height,
        comp.durationFrames,
        comp.layers.length
      );
      commitProject((prev) => ({
        ...prev,
        composition: {
          ...prev.composition,
          layers: [layer, ...prev.composition.layers],
        },
      }));
      setSelectedLayerId(layer.id);
      setActiveTool('select');
    },
    [commitProject, project.composition]
  );

  const importMediaFiles = useCallback(
    async (files: FileList | File[], addImmediately = true) => {
      const list = Array.from(files);
      for (const file of list) {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) continue;

        const id = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        let url = URL.createObjectURL(file);
        let dataUrl: string | undefined;
        // Persist files <= 6MB cleanly as dataUrl inside IndexedDB / JSON
        if (file.size <= 6 * 1024 * 1024) {
          try {
            dataUrl = await fileToDataUrl(file);
            url = dataUrl;
          } catch {
            // Keep object URL
          }
        }

        if (isImage) {
          const dims = await new Promise<{ w: number; h: number }>((resolve) => {
            const img = new Image();
            img.onload = () =>
              resolve({ w: img.naturalWidth || 800, h: img.naturalHeight || 600 });
            img.onerror = () => resolve({ w: 800, h: 600 });
            img.src = url;
          });
          const asset: MediaAsset = {
            id,
            name: file.name,
            kind: 'image',
            mimeType: file.type,
            url,
            dataUrl,
            width: dims.w,
            height: dims.h,
          };
          commitProject((prev) => ({
            ...prev,
            assets: [asset, ...prev.assets],
          }));
          if (addImmediately) addLayerFromAsset(asset);
        } else {
          const meta = await new Promise<{
            w: number;
            h: number;
            duration: number;
          }>((resolve) => {
            const vid = document.createElement('video');
            vid.preload = 'metadata';
            vid.onloadedmetadata = () =>
              resolve({
                w: vid.videoWidth || 1280,
                h: vid.videoHeight || 720,
                duration: vid.duration || 5,
              });
            vid.onerror = () => resolve({ w: 1280, h: 720, duration: 5 });
            vid.src = url;
          });
          const asset: MediaAsset = {
            id,
            name: file.name,
            kind: 'video',
            mimeType: file.type,
            url,
            dataUrl,
            width: meta.w,
            height: meta.h,
            durationSec: meta.duration,
          };
          commitProject((prev) => ({
            ...prev,
            assets: [asset, ...prev.assets],
          }));
          if (addImmediately) addLayerFromAsset(asset);
        }
      }
    },
    [addLayerFromAsset, commitProject]
  );

  const deleteAsset = useCallback(
    (assetId: string) => {
      commitProject((prev) => ({
        ...prev,
        assets: prev.assets.filter((a) => a.id !== assetId),
      }));
    },
    [commitProject]
  );

  const duplicateLayer = useCallback(
    (layerId: string) => {
      const comp = project.composition;
      const idx = comp.layers.findIndex((l) => l.id === layerId);
      if (idx < 0) return;
      const source = comp.layers[idx];
      const clone: Layer = JSON.parse(JSON.stringify(source));
      clone.id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      clone.name = `${source.name} Copy`;
      commitProject((prev) => {
        const nextLayers = [...prev.composition.layers];
        nextLayers.splice(idx, 0, clone);
        return {
          ...prev,
          composition: { ...prev.composition, layers: nextLayers },
        };
      });
      setSelectedLayerId(clone.id);
    },
    [commitProject, project.composition]
  );

  const deleteLayer = useCallback(
    (layerId: string) => {
      commitProject((prev) => ({
        ...prev,
        composition: {
          ...prev.composition,
          layers: prev.composition.layers
            .filter((l) => l.id !== layerId)
            .map((l) => (l.parentId === layerId ? { ...l, parentId: null } : l)),
        },
      }));
      setSelectedLayerId((cur) => (cur === layerId ? null : cur));
    },
    [commitProject]
  );

  const moveLayerOrder = useCallback(
    (layerId: string, direction: 'up' | 'down') => {
      commitProject((prev) => {
        const list = [...prev.composition.layers];
        const idx = list.findIndex((l) => l.id === layerId);
        if (idx < 0) return prev;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= list.length) return prev;
        const [item] = list.splice(idx, 1);
        list.splice(targetIdx, 0, item);
        return {
          ...prev,
          composition: { ...prev.composition, layers: list },
        };
      });
    },
    [commitProject]
  );

  const loadNewProject = useCallback(
    (mode: 'blank' | 'starter' | StudioProject) => {
      const next =
        mode === 'blank'
          ? createBlankProject()
          : mode === 'starter'
            ? createStarterProject()
            : mode;
      setIsPlaying(false);
      setProject(next);
      setHistoryPast([]);
      setHistoryFuture([]);
      setCurrentFrame(0);
      setSelectedLayerId(next.composition.layers[0]?.id ?? null);
      setSelectedKeyframe(null);
    },
    []
  );

  const seekVideoElementsForExport = useCallback(
    async (frame: number): Promise<void> => {
      const fps = project.composition.fps || 30;
      const seeks: Promise<void>[] = [];
      for (const layer of project.composition.layers) {
        if (layer.type !== 'video' || !layer.mediaProps) continue;
        const video = mediaCacheRef.current.videos.get(layer.mediaProps.assetId);
        if (!video || video.readyState < 1) continue;
        const localFrame =
          frame - layer.inFrame + layer.mediaProps.mediaOffsetFrame;
        const targetSec = Math.max(
          0,
          Math.min(video.duration || 0, localFrame / fps)
        );
        if (Math.abs(video.currentTime - targetSec) > 0.01) {
          seeks.push(
            new Promise((resolve) => {
              const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                resolve();
              };
              video.addEventListener('seeked', onSeeked, { once: true });
              video.currentTime = targetSec;
              window.setTimeout(() => {
                video.removeEventListener('seeked', onSeeked);
                resolve();
              }, 250);
            })
          );
        }
      }
      if (seeks.length > 0) await Promise.all(seeks);
    },
    [project.composition]
  );

  const selectedLayer =
    project.composition.layers.find((l) => l.id === selectedLayerId) ?? null;

  return {
    project,
    selectedLayer,
    selectedLayerId,
    setSelectedLayerId,
    activeGraphProperty,
    setActiveGraphProperty,
    selectedKeyframe,
    setSelectedKeyframe,
    currentFrame,
    setCurrentFrame,
    isPlaying,
    setIsPlaying,
    loopPlayback,
    setLoopPlayback,
    activeTool,
    setActiveTool,
    mediaCacheRef,
    mediaRevision,
    canUndo: historyPast.length > 0,
    canRedo: historyFuture.length > 0,
    undo,
    redo,
    updateComposition,
    updateLayer,
    setLayerTransformValue,
    togglePropertyStopwatch,
    addKeyframeAtCurrentFrame,
    moveKeyframe,
    deleteKeyframe,
    updateKeyframeEasing,
    addShape,
    addText,
    addSolid,
    addLayerFromAsset,
    importMediaFiles,
    deleteAsset,
    duplicateLayer,
    deleteLayer,
    moveLayerOrder,
    loadNewProject,
    seekVideoElementsForExport,
  };
}
