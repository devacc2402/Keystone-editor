import React, { useRef, useState } from 'react';
import { Film, ImageIcon, Plus, Trash2, Upload } from 'lucide-react';
import type { MediaAsset } from '../types/studio';

interface MediaBinPanelProps {
  assets: MediaAsset[];
  onImportFiles: (files: FileList, addImmediately?: boolean) => void;
  onAddAssetToComp: (asset: MediaAsset) => void;
  onDeleteAsset: (assetId: string) => void;
}

export const MediaBinPanel: React.FC<MediaBinPanelProps> = ({
  assets,
  onImportFiles,
  onAddAssetToComp,
  onDeleteAsset,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draggingOver, setDraggingOver] = useState(false);

  return (
    <div
      className="p-4 space-y-4 overflow-y-auto studio-scroll h-full"
      onDragOver={(e) => {
        e.preventDefault();
        setDraggingOver(true);
      }}
      onDragLeave={() => setDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDraggingOver(false);
        if (e.dataTransfer.files.length > 0) {
          onImportFiles(e.dataTransfer.files, false);
        }
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-100">
            Project Media
          </h3>
          <p className="text-xs text-slate-400">
            Images & video clips for this project
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg bg-[#5B7CFA] hover:bg-[#4C6DF2] text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onImportFiles(e.target.files, true);
          }
          e.target.value = '';
        }}
      />

      {assets.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`w-full border border-dashed rounded-xl p-6 text-center transition-colors ${
            draggingOver
              ? 'border-[#5B7CFA] bg-[#5B7CFA]/10'
              : 'border-white/15 bg-[#0C0E12] hover:border-white/30'
          }`}
        >
          <ImageIcon className="w-7 h-7 text-slate-400 mx-auto mb-2" />
          <div className="text-xs font-medium text-slate-200">
            Tap or drop PNG, JPG, SVG, MP4, WebM
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Uploaded media is immediately added to your stage
          </div>
        </button>
      ) : (
        <div className="space-y-2">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center justify-between gap-2.5 bg-[#0C0E12] border border-white/10 rounded-lg p-2"
            >
              <div className="w-12 h-10 rounded bg-[#1B1F27] overflow-hidden shrink-0 flex items-center justify-center">
                {asset.kind === 'image' ? (
                  <img
                    src={asset.url}
                    alt={asset.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Film className="w-4 h-4 text-[#5B7CFA]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-slate-200 truncate">
                  {asset.name}
                </div>
                <div className="font-mono text-[11px] tabular-nums text-slate-400">
                  {asset.width}×{asset.height}
                  {asset.durationSec
                    ? ` · ${asset.durationSec.toFixed(1)}s`
                    : ''}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onAddAssetToComp(asset)}
                  title="Insert onto timeline"
                  className="w-8 h-8 rounded-md bg-[#1B1F27] hover:bg-[#5B7CFA] text-slate-200 hover:text-white flex items-center justify-center transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteAsset(asset.id)}
                  title="Remove from project"
                  className="w-8 h-8 rounded-md hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
