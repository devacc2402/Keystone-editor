import React, { useRef, useState } from 'react';
import { Check, Download, X } from 'lucide-react';
import type { ExportFormat, StudioProject } from '../types/studio';
import type { MediaCache } from '../utils/canvasRenderer';
import { renderCompositionToContext } from '../utils/canvasRenderer';
import { GifEncoder } from '../utils/gifEncoder';

interface ExportModalProps {
  project: StudioProject;
  mediaCacheRef: React.MutableRefObject<MediaCache>;
  seekVideoElementsForExport: (frame: number) => Promise<void>;
  onSaveJson: () => void;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  project,
  mediaCacheRef,
  seekVideoElementsForExport,
  onSaveJson,
  onClose,
}) => {
  const supportsMp4 =
    typeof MediaRecorder !== 'undefined' &&
    MediaRecorder.isTypeSupported('video/mp4');

  const [format, setFormat] = useState<ExportFormat>('webm');
  const [scale, setScale] = useState<number>(1);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState<{ cur: number; total: number }>({
    cur: 0,
    total: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedMsg, setCompletedMsg] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const comp = project.composition;
  const outWidth = Math.max(64, Math.round((comp.width * scale) / 2) * 2);
  const outHeight = Math.max(64, Math.round((comp.height * scale) / 2) * 2);
  const startFrame = comp.workAreaStart;
  const endFrame = Math.max(startFrame + 1, comp.workAreaEnd);
  const totalFrames = endFrame - startFrame + 1;

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const handleStartExport = async () => {
    setErrorMsg(null);
    setCompletedMsg(null);

    if (format === 'json') {
      onSaveJson();
      setCompletedMsg('Project JSON downloaded.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setErrorMsg('Unable to initialize offscreen 2D canvas.');
      return;
    }

    cancelledRef.current = false;
    setRendering(true);
    setProgress({ cur: 0, total: totalFrames });

    try {
      const safeName =
        project.name.toLowerCase().replace(/[^a-z0-9-_]+/g, '_') || 'keystone';

      if (format === 'gif') {
        // Cap GIF at 720px max side for responsive browser encoding
        const gifCap = Math.min(1, 720 / Math.max(outWidth, outHeight));
        const gw = Math.max(64, Math.round(outWidth * gifCap));
        const gh = Math.max(64, Math.round(outHeight * gifCap));
        canvas.width = gw;
        canvas.height = gh;

        const encoder = new GifEncoder(gw, gh, comp.fps);
        const step = comp.fps > 24 ? 2 : 1; // smooth ~15fps GIF output
        const gifTotal = Math.ceil(totalFrames / step);
        let count = 0;

        for (let f = startFrame; f <= endFrame; f += step) {
          if (cancelledRef.current) {
            setRendering(false);
            return;
          }
          await seekVideoElementsForExport(f);
          ctx.save();
          ctx.scale(gw / comp.width, gh / comp.height);
          renderCompositionToContext(ctx, comp, f, mediaCacheRef.current);
          ctx.restore();

          const imgData = ctx.getImageData(0, 0, gw, gh);
          encoder.addFrame(imgData.data);
          count++;
          setProgress({ cur: count, total: gifTotal });
          await new Promise((r) => setTimeout(r, 0));
        }

        const blob = encoder.finish();
        triggerDownload(blob, `${safeName}.gif`);
        setCompletedMsg(`Rendered ${safeName}.gif (${gw}×${gh}).`);
        setRendering(false);
        return;
      }

      // Video Export via MediaRecorder
      if (typeof MediaRecorder === 'undefined') {
        setErrorMsg('Video recording is not supported in this browser.');
        setRendering(false);
        return;
      }

      const mimeCandidate =
        format === 'mp4' && supportsMp4
          ? 'video/mp4'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm';

      const stream = canvas.captureStream(comp.fps);
      const recorder = new MediaRecorder(stream, {
        mimeType: mimeCandidate,
        videoBitsPerSecond: 6_000_000,
      });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const stopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () =>
          resolve(new Blob(chunks, { type: mimeCandidate }));
      });

      recorder.start();
      const frameMs = 1000 / Math.max(1, comp.fps);

      for (let f = startFrame; f <= endFrame; f++) {
        if (cancelledRef.current) {
          recorder.stop();
          setRendering(false);
          return;
        }
        await seekVideoElementsForExport(f);
        ctx.save();
        ctx.scale(outWidth / comp.width, outHeight / comp.height);
        renderCompositionToContext(ctx, comp, f, mediaCacheRef.current);
        ctx.restore();

        setProgress({ cur: f - startFrame + 1, total: totalFrames });
        await new Promise((r) => setTimeout(r, frameMs));
      }

      recorder.stop();
      const videoBlob = await stopped;
      const ext = mimeCandidate.includes('mp4') ? 'mp4' : 'webm';
      triggerDownload(videoBlob, `${safeName}.${ext}`);
      setCompletedMsg(`Rendered ${safeName}.${ext} (${outWidth}×${outHeight}).`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Export failed during render.'
      );
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#14171D] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-100">
              Export Composition
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {comp.name} · {comp.width}×{comp.height} · {comp.fps}fps
            </p>
          </div>
          {!rendering && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Format</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'webm', label: 'WebM Video' },
                  {
                    id: 'mp4',
                    label: supportsMp4 ? 'MP4 Video' : 'MP4 (WebM fallback)',
                  },
                  { id: 'gif', label: 'Animated GIF' },
                  { id: 'json', label: 'Project JSON' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={rendering}
                  onClick={() => setFormat(opt.id)}
                  className={`min-h-[40px] px-3 rounded-lg border text-xs font-medium text-left transition-colors ${
                    format === opt.id
                      ? 'bg-[#5B7CFA]/15 border-[#5B7CFA] text-[#5B7CFA]'
                      : 'bg-[#0C0E12] border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {format !== 'json' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Resolution Scale
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 1, label: '100% Full' },
                  { val: 0.75, label: '75%' },
                  { val: 0.5, label: '50% Draft' },
                ].map((s) => (
                  <button
                    key={s.val}
                    type="button"
                    disabled={rendering}
                    onClick={() => setScale(s.val)}
                    className={`min-h-[36px] rounded-lg border text-xs font-medium transition-colors ${
                      scale === s.val
                        ? 'bg-[#5B7CFA]/15 border-[#5B7CFA] text-[#5B7CFA]'
                        : 'bg-[#0C0E12] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="font-mono text-[11px] tabular-nums text-slate-400">
                Output: {outWidth}×{outHeight} · {totalFrames} frames
              </div>
            </div>
          )}

          {rendering && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Rendering frames...</span>
                <span className="font-mono tabular-nums text-[#5B7CFA]">
                  {progress.cur} / {progress.total}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#0C0E12] overflow-hidden">
                <div
                  style={{
                    width: `${
                      progress.total > 0
                        ? Math.round((progress.cur / progress.total) * 100)
                        : 0
                    }%`,
                  }}
                  className="h-full bg-[#5B7CFA] transition-all duration-100"
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          {completedMsg && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{completedMsg}</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 bg-[#101318] border-t border-white/[0.08] flex items-center justify-end gap-2">
          {rendering ? (
            <button
              type="button"
              onClick={() => {
                cancelledRef.current = true;
              }}
              className="px-4 min-h-[38px] rounded-lg border border-white/15 text-xs font-medium text-slate-200 hover:bg-white/5"
            >
              Cancel Render
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 min-h-[38px] rounded-lg border border-white/10 text-xs font-medium text-slate-300 hover:bg-white/5"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleStartExport}
                className="inline-flex items-center gap-1.5 px-4 min-h-[38px] rounded-lg bg-[#5B7CFA] hover:bg-[#4C6DF2] text-white text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Start Export</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
