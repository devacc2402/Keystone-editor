import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FolderOpen,
  Layers,
  Sliders,
  Spline,
} from 'lucide-react';
import { BezierGraphEditor } from './components/BezierGraphEditor';
import { ExportModal } from './components/ExportModal';
import { InspectorPanel } from './components/InspectorPanel';
import { MediaBinPanel } from './components/MediaBinPanel';
import { StageViewport } from './components/StageViewport';
import { TimelineDock } from './components/TimelineDock';
import { TopBar } from './components/TopBar';
import { useStudioStore } from './store/useStudioStore';
import type { DesktopSideTab, MobileTab, TimelineViewMode } from './types/studio';
import { validateImportedProject } from './utils/storage';

export default function App() {
  const store = useStudioStore();
  const [desktopSideTab, setDesktopSideTab] =
    useState<DesktopSideTab>('inspector');
  const [timelineViewMode, setTimelineViewMode] =
    useState<TimelineViewMode>('timeline');
  const [mobileTab, setMobileTab] = useState<MobileTab>('timeline');
  const [exportOpen, setExportOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Resizable Desktop Splitters
  const [timelineHeight, setTimelineHeight] = useState<number>(280);
  const [sideWidth, setSideWidth] = useState<number>(308);
  const resizeRef = useRef<
    | { kind: 'timeline'; startY: number; startH: number }
    | { kind: 'side'; startX: number; startW: number }
    | null
  >(null);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3200);
  }, []);

  useEffect(() => {
    const syncFullscreen = () => {
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
      };
      setIsFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };

    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      } else if (root.requestFullscreen) {
        await root.requestFullscreen();
      } else if (root.webkitRequestFullscreen) {
        await root.webkitRequestFullscreen();
      } else {
        showNotice('Fullscreen is not supported in this browser.');
      }
    } catch {
      showNotice('Fullscreen is blocked in this embedded view.');
    }
  }, [showNotice]);

  const handleSaveJson = useCallback(() => {
    const json = JSON.stringify(store.project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName =
      store.project.name.toLowerCase().replace(/[^a-z0-9-_]+/g, '_') ||
      'keystone_project';
    a.href = url;
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    showNotice(`Saved ${safeName}.json`);
  }, [showNotice, store.project]);

  const handleOpenJson = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = validateImportedProject(JSON.parse(text));
        if (!parsed) {
          showNotice('Invalid Keystone project JSON file.');
          return;
        }
        store.loadNewProject(parsed);
        showNotice(`Loaded ${parsed.name}`);
      } catch {
        showNotice('Could not read JSON file.');
      }
    },
    [showNotice, store]
  );

  // Global keyboard shortcuts (Desktop & iPad hardware keyboards)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingText =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;
      if (isEditingText) return;

      if (e.code === 'Space') {
        e.preventDefault();
        store.setIsPlaying((p) => !p);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if (e.key.toLowerCase() === 'v') {
        store.setActiveTool('select');
      } else if (e.key.toLowerCase() === 'h') {
        store.setActiveTool('hand');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        store.setCurrentFrame((f) => Math.max(0, f - (e.shiftKey ? 10 : 1)));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        store.setCurrentFrame((f) =>
          Math.min(store.project.composition.durationFrames, f + (e.shiftKey ? 10 : 1))
        );
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedKeyframe) {
          e.preventDefault();
          store.deleteKeyframe(
            store.selectedKeyframe.layerId,
            store.selectedKeyframe.property,
            store.selectedKeyframe.keyframeId
          );
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  // Splitter pointer tracking
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = resizeRef.current;
      if (!drag) return;
      if (drag.kind === 'timeline') {
        const next = Math.max(180, Math.min(480, drag.startH - (e.clientY - drag.startY)));
        setTimelineHeight(next);
      } else {
        const next = Math.max(260, Math.min(440, drag.startW - (e.clientX - drag.startX)));
        setSideWidth(next);
      }
    };
    const onUp = () => {
      resizeRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const comp = store.project.composition;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0C0E12] text-slate-100 overflow-hidden">
      <TopBar
        projectName={store.project.name}
        onRenameProject={(name) => store.updateComposition({ name })}
        activeTool={store.activeTool}
        onSelectTool={store.setActiveTool}
        onAddShape={store.addShape}
        onAddText={store.addText}
        onImportMedia={(files) => {
          void store.importMediaFiles(files, true);
        }}
        canUndo={store.canUndo}
        canRedo={store.canRedo}
        onUndo={store.undo}
        onRedo={store.redo}
        onNewBlank={() => store.loadNewProject('blank')}
        onResetStarter={() => store.loadNewProject('starter')}
        onSaveJson={handleSaveJson}
        onOpenJson={(f) => void handleOpenJson(f)}
        onOpenExport={() => {
          store.setIsPlaying(false);
          setExportOpen(true);
        }}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => void handleToggleFullscreen()}
      />

      {/* DESKTOP STUDIO LAYOUT (>= 1024px) */}
      <div className="hidden lg:flex flex-1 min-h-0 flex-col">
        {/* Upper Workspace: Stage + Single Focused Side Panel */}
        <div className="flex-1 min-h-0 flex">
          <StageViewport
            composition={comp}
            currentFrame={store.currentFrame}
            selectedLayerId={store.selectedLayerId}
            onSelectLayer={store.setSelectedLayerId}
            activeTool={store.activeTool}
            mediaCacheRef={store.mediaCacheRef}
            mediaRevision={store.mediaRevision}
            onTransformChange={store.setLayerTransformValue}
          />

          {/* Side Splitter */}
          <div
            onPointerDown={(e) => {
              resizeRef.current = {
                kind: 'side',
                startX: e.clientX,
                startW: sideWidth,
              };
            }}
            className="w-1.5 bg-[#0C0E12] hover:bg-[#5B7CFA]/60 border-l border-white/[0.08] cursor-col-resize transition-colors shrink-0"
          />

          {/* Focused Single Right Sidebar (Inspector | Media) */}
          <aside
            style={{ width: sideWidth }}
            className="shrink-0 bg-[#14171D] flex flex-col min-h-0"
          >
            <div className="shrink-0 h-10 px-3 border-b border-white/[0.08] flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDesktopSideTab('inspector')}
                className={`flex-1 min-h-[28px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  desktopSideTab === 'inspector'
                    ? 'bg-[#1F2430] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Inspector
              </button>
              <button
                type="button"
                onClick={() => setDesktopSideTab('media')}
                className={`flex-1 min-h-[28px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  desktopSideTab === 'media'
                    ? 'bg-[#1F2430] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Media ({store.project.assets.length})
              </button>
            </div>

            <div className="flex-1 min-h-0">
              {desktopSideTab === 'inspector' ? (
                <InspectorPanel
                  composition={comp}
                  selectedLayer={store.selectedLayer}
                  currentFrame={store.currentFrame}
                  onUpdateComposition={store.updateComposition}
                  onUpdateLayer={store.updateLayer}
                  onTransformChange={store.setLayerTransformValue}
                  onToggleStopwatch={store.togglePropertyStopwatch}
                  onAddKeyframe={store.addKeyframeAtCurrentFrame}
                  onDuplicateLayer={store.duplicateLayer}
                  onDeleteLayer={store.deleteLayer}
                />
              ) : (
                <MediaBinPanel
                  assets={store.project.assets}
                  onImportFiles={(files, addNow) =>
                    void store.importMediaFiles(files, addNow)
                  }
                  onAddAssetToComp={store.addLayerFromAsset}
                  onDeleteAsset={store.deleteAsset}
                />
              )}
            </div>
          </aside>
        </div>

        {/* Bottom Timeline Splitter */}
        <div
          onPointerDown={(e) => {
            resizeRef.current = {
              kind: 'timeline',
              startY: e.clientY,
              startH: timelineHeight,
            };
          }}
          className="h-1.5 bg-[#0C0E12] hover:bg-[#5B7CFA]/60 border-t border-white/[0.08] cursor-row-resize transition-colors shrink-0"
        />

        {/* Bottom Dock: Timeline / Graph */}
        <section style={{ height: timelineHeight }} className="shrink-0 min-h-0">
          <TimelineDock
            composition={comp}
            currentFrame={store.currentFrame}
            onSeekFrame={store.setCurrentFrame}
            isPlaying={store.isPlaying}
            onTogglePlay={() => store.setIsPlaying((p) => !p)}
            loopPlayback={store.loopPlayback}
            onToggleLoop={() => store.setLoopPlayback((l) => !l)}
            selectedLayerId={store.selectedLayerId}
            onSelectLayer={store.setSelectedLayerId}
            selectedKeyframe={store.selectedKeyframe}
            onSelectKeyframe={store.setSelectedKeyframe}
            activeGraphProperty={store.activeGraphProperty}
            onSelectGraphProperty={store.setActiveGraphProperty}
            viewMode={timelineViewMode}
            onChangeViewMode={setTimelineViewMode}
            onUpdateLayer={store.updateLayer}
            onMoveLayerOrder={store.moveLayerOrder}
            onToggleStopwatch={store.togglePropertyStopwatch}
            onAddKeyframe={store.addKeyframeAtCurrentFrame}
            onMoveKeyframe={store.moveKeyframe}
            onDeleteKeyframe={store.deleteKeyframe}
            onUpdateKeyframeEasing={store.updateKeyframeEasing}
          />
        </section>
      </div>

      {/* IPAD / TABLET ADAPTIVE LAYOUT (< 1024px) */}
      <div className="flex lg:hidden flex-1 min-h-0 flex-col">
        {/* Persistent Composition Stage (~44% height) */}
        <div className="h-[44%] min-h-[210px] flex flex-col border-b border-white/[0.08]">
          <StageViewport
            composition={comp}
            currentFrame={store.currentFrame}
            selectedLayerId={store.selectedLayerId}
            onSelectLayer={store.setSelectedLayerId}
            activeTool={store.activeTool}
            mediaCacheRef={store.mediaCacheRef}
            mediaRevision={store.mediaRevision}
            onTransformChange={store.setLayerTransformValue}
          />
        </div>

        {/* Clean Segmented Tab Switcher (44px+ touch targets) */}
        <nav className="shrink-0 bg-[#14171D] border-b border-white/[0.08] px-2 py-1.5 grid grid-cols-4 gap-1">
          {(
            [
              { id: 'timeline', label: 'Timeline', icon: Layers },
              { id: 'graph', label: 'Graph', icon: Spline },
              { id: 'inspector', label: 'Inspector', icon: Sliders },
              { id: 'media', label: 'Media', icon: FolderOpen },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = mobileTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMobileTab(tab.id)}
                className={`min-h-[42px] rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#5B7CFA] text-white'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Active Tabbed Panel */}
        <div className="flex-1 min-h-0 bg-[#14171D]">
          {mobileTab === 'timeline' && (
            <TimelineDock
              composition={comp}
              currentFrame={store.currentFrame}
              onSeekFrame={store.setCurrentFrame}
              isPlaying={store.isPlaying}
              onTogglePlay={() => store.setIsPlaying((p) => !p)}
              loopPlayback={store.loopPlayback}
              onToggleLoop={() => store.setLoopPlayback((l) => !l)}
              selectedLayerId={store.selectedLayerId}
              onSelectLayer={store.setSelectedLayerId}
              selectedKeyframe={store.selectedKeyframe}
              onSelectKeyframe={store.setSelectedKeyframe}
              activeGraphProperty={store.activeGraphProperty}
              onSelectGraphProperty={store.setActiveGraphProperty}
              viewMode="timeline"
              hideModeSwitch
              onUpdateLayer={store.updateLayer}
              onMoveLayerOrder={store.moveLayerOrder}
              onToggleStopwatch={store.togglePropertyStopwatch}
              onAddKeyframe={store.addKeyframeAtCurrentFrame}
              onMoveKeyframe={store.moveKeyframe}
              onDeleteKeyframe={store.deleteKeyframe}
              onUpdateKeyframeEasing={store.updateKeyframeEasing}
            />
          )}

          {mobileTab === 'graph' && (
            <BezierGraphEditor
              layer={store.selectedLayer}
              activeProperty={store.activeGraphProperty}
              onSelectProperty={store.setActiveGraphProperty}
              durationFrames={comp.durationFrames}
              currentFrame={store.currentFrame}
              onSeekFrame={store.setCurrentFrame}
              onUpdateKeyframeEasing={store.updateKeyframeEasing}
            />
          )}

          {mobileTab === 'inspector' && (
            <InspectorPanel
              composition={comp}
              selectedLayer={store.selectedLayer}
              currentFrame={store.currentFrame}
              onUpdateComposition={store.updateComposition}
              onUpdateLayer={store.updateLayer}
              onTransformChange={store.setLayerTransformValue}
              onToggleStopwatch={store.togglePropertyStopwatch}
              onAddKeyframe={store.addKeyframeAtCurrentFrame}
              onDuplicateLayer={store.duplicateLayer}
              onDeleteLayer={store.deleteLayer}
            />
          )}

          {mobileTab === 'media' && (
            <MediaBinPanel
              assets={store.project.assets}
              onImportFiles={(files, addNow) =>
                void store.importMediaFiles(files, addNow)
              }
              onAddAssetToComp={store.addLayerFromAsset}
              onDeleteAsset={store.deleteAsset}
            />
          )}
        </div>
      </div>

      {/* Export Dialog */}
      {exportOpen && (
        <ExportModal
          project={store.project}
          mediaCacheRef={store.mediaCacheRef}
          seekVideoElementsForExport={store.seekVideoElementsForExport}
          onSaveJson={handleSaveJson}
          onClose={() => setExportOpen(false)}
        />
      )}

      {/* Brief Action Toast */}
      {notice && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#1B1F27] border border-white/15 rounded-lg px-3.5 py-2 text-xs text-slate-100 shadow-xl">
          {notice}
        </div>
      )}
    </div>
  );
}
