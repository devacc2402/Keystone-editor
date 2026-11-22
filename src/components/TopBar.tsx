import React, { useRef, useState } from 'react';
import {
  ChevronDown,
  Circle,
  Download,
  FilePlus2,
  FolderOpen,
  Hand,
  ImagePlus,
  Maximize,
  Minimize,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Square,
  Star,
  Type,
  Undo2,
} from 'lucide-react';
import type { ShapeKind, ToolMode } from '../types/studio';

interface TopBarProps {
  projectName: string;
  onRenameProject: (name: string) => void;
  activeTool: ToolMode;
  onSelectTool: (tool: ToolMode) => void;
  onAddShape: (kind: ShapeKind) => void;
  onAddText: () => void;
  onImportMedia: (files: FileList) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onNewBlank: () => void;
  onResetStarter: () => void;
  onSaveJson: () => void;
  onOpenJson: (file: File) => void;
  onOpenExport: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  projectName,
  onRenameProject,
  activeTool,
  onSelectTool,
  onAddShape,
  onAddText,
  onImportMedia,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onNewBlank,
  onResetStarter,
  onSaveJson,
  onOpenJson,
  onOpenExport,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(projectName);

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const closeAllMenus = () => {
    setShapeMenuOpen(false);
    setProjectMenuOpen(false);
    setAddMenuOpen(false);
  };

  return (
    <header className="relative z-40 h-[52px] shrink-0 bg-[#14171D] border-b border-white/[0.08] px-3 lg:px-4 flex items-center justify-between gap-3">
      {/* Zone 1: Brand + Project Menu */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <span className="font-display font-bold text-base tracking-tight text-slate-100 whitespace-nowrap shrink-0">
          Keystone
        </span>

        <span className="text-white/15 select-none hidden sm:inline">/</span>

        {editingTitle ? (
          <input
            type="text"
            value={titleDraft}
            autoFocus
            onFocus={(e) => e.target.select()}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              if (titleDraft.trim()) onRenameProject(titleDraft.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setEditingTitle(false);
                if (titleDraft.trim()) onRenameProject(titleDraft.trim());
              }
              if (e.key === 'Escape') setEditingTitle(false);
            }}
            className="bg-[#0C0E12] border border-[#5B7CFA] rounded px-2 py-1 text-xs font-medium text-slate-100 w-36 outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitleDraft(projectName);
              setEditingTitle(true);
            }}
            className="hidden sm:inline-flex items-center px-2 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors max-w-[160px] truncate whitespace-nowrap"
            title="Click to rename composition"
          >
            {projectName}
          </button>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              const next = !projectMenuOpen;
              closeAllMenus();
              setProjectMenuOpen(next);
            }}
            className="inline-flex items-center gap-1 px-2.5 min-h-[36px] rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 transition-colors whitespace-nowrap shrink-0"
          >
            <span>File</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {projectMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={closeAllMenus}
              />
              <div className="absolute left-0 top-full mt-1.5 z-50 w-48 bg-[#1B1F27] border border-white/10 rounded-lg shadow-2xl py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onNewBlank();
                    closeAllMenus();
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10 flex items-center gap-2.5 whitespace-nowrap"
                >
                  <FilePlus2 className="w-3.5 h-3.5 text-slate-400" />
                  New Blank Comp
                </button>
                <button
                  type="button"
                  onClick={() => {
                    jsonInputRef.current?.click();
                    closeAllMenus();
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10 flex items-center gap-2.5 whitespace-nowrap"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                  Open Project (.json)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSaveJson();
                    closeAllMenus();
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10 flex items-center gap-2.5 whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5 text-slate-400" />
                  Save Project (.json)
                </button>
                <div className="my-1 border-t border-white/[0.08]" />
                <button
                  type="button"
                  onClick={() => {
                    onResetStarter();
                    closeAllMenus();
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/10 flex items-center gap-2.5 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  Load Starter Demo
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Zone 2: Primary Tools (Desktop spacious row / iPad compact non-overlapping controls) */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Select & Hand segmented switch */}
        <div className="flex items-center bg-[#0C0E12] border border-white/10 rounded-lg p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onSelectTool('select')}
            title="Select & Transform (V)"
            className={`inline-flex items-center justify-center gap-1.5 px-2.5 min-h-[32px] rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTool === 'select'
                ? 'bg-[#5B7CFA] text-white'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Select</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTool('hand')}
            title="Pan Canvas (H)"
            className={`inline-flex items-center justify-center gap-1.5 px-2.5 min-h-[32px] rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTool === 'hand'
                ? 'bg-[#5B7CFA] text-white'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Hand className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Pan</span>
          </button>
        </div>

        {/* Desktop Direct Layer Creation */}
        <div className="hidden lg:flex items-center gap-1.5 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const next = !shapeMenuOpen;
                closeAllMenus();
                setShapeMenuOpen(next);
              }}
              className="inline-flex items-center gap-1.5 px-3 min-h-[34px] rounded-lg bg-[#1B1F27] hover:bg-[#242934] border border-white/10 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              <Square className="w-3.5 h-3.5 text-[#5B7CFA]" />
              <span>Shape</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {shapeMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={closeAllMenus}
                />
                <div className="absolute left-0 top-full mt-1.5 z-50 w-40 bg-[#1B1F27] border border-white/10 rounded-lg shadow-2xl py-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onAddShape('rect');
                      closeAllMenus();
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10 flex items-center gap-2.5 whitespace-nowrap"
                  >
                    <Square className="w-3.5 h-3.5 text-[#5B7CFA]" />
                    Rectangle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onAddShape('ellipse');
                      closeAllMenus();
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10 flex items-center gap-2.5 whitespace-nowrap"
                  >
                    <Circle className="w-3.5 h-3.5 text-[#F59E0B]" />
                    Ellipse
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onAddShape('star');
                      closeAllMenus();
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10 flex items-center gap-2.5 whitespace-nowrap"
                  >
                    <Star className="w-3.5 h-3.5 text-emerald-400" />
                    Star
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onAddText}
            className="inline-flex items-center gap-1.5 px-3 min-h-[34px] rounded-lg bg-[#1B1F27] hover:bg-[#242934] border border-white/10 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            <Type className="w-3.5 h-3.5 text-slate-300" />
            <span>Text</span>
          </button>

          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 min-h-[34px] rounded-lg bg-[#1B1F27] hover:bg-[#242934] border border-white/10 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            <ImagePlus className="w-3.5 h-3.5 text-slate-300" />
            <span>Media</span>
          </button>
        </div>

        {/* Compact Add Layer Menu on iPad/Tablet (< lg) */}
        <div className="relative lg:hidden">
          <button
            type="button"
            onClick={() => {
              const next = !addMenuOpen;
              closeAllMenus();
              setAddMenuOpen(next);
            }}
            className="inline-flex items-center gap-1 px-2.5 min-h-[36px] rounded-lg bg-[#1B1F27] border border-white/10 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 text-[#5B7CFA]" />
            <span>Add</span>
          </button>

          {addMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={closeAllMenus} />
              <div className="absolute right-0 top-full mt-1.5 z-50 w-44 bg-[#1B1F27] border border-white/10 rounded-lg shadow-2xl py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onAddShape('rect');
                    closeAllMenus();
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs text-slate-200 hover:bg-white/10 flex items-center gap-2.5 whitespace-nowrap"
                >
                  <Square className="w-3.5 h-3.5 text-[#5B7CFA]" />
                  Rectangle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddShape('ellipse');
                    closeAllMenus();
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs text-slate-200 hover:bg-white/10 flex items-center gap-2.5 whitespace-nowrap"
                >
                  <Circle className="w-3.5 h-3.5 text-[#F59E0B]" />
                  Ellipse
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddShape('star');
                    closeAllMenus();
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs text-slate-200 hover:bg-white/10 flex items-center gap-2.5 whitespace-nowrap"
                >
                  <Star className="w-3.5 h-3.5 text-emerald-400" />
                  Star
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddText();
                    closeAllMenus();
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs text-slate-200 hover:bg-white/10 flex items-center gap-2.5 whitespace-nowrap"
                >
                  <Type className="w-3.5 h-3.5 text-slate-300" />
                  Text Layer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    mediaInputRef.current?.click();
                    closeAllMenus();
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs text-slate-200 hover:bg-white/10 flex items-center gap-2.5 whitespace-nowrap"
                >
                  <ImagePlus className="w-3.5 h-3.5 text-slate-300" />
                  Import Image / Video
                </button>
              </div>
            </>
          )}
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl/Cmd+Z)"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors shrink-0"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl/Cmd+Shift+Z)"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors shrink-0"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Zone 3: Fullscreen & Primary Export CTA */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 transition-colors shrink-0"
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4" />
          ) : (
            <Maximize className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          className="inline-flex items-center gap-1.5 px-3.5 min-h-[36px] rounded-lg bg-[#5B7CFA] hover:bg-[#4C6DF2] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>

      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onImportMedia(e.target.files);
          }
          e.target.value = '';
        }}
      />
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onOpenJson(f);
          e.target.value = '';
        }}
      />
    </header>
  );
};
