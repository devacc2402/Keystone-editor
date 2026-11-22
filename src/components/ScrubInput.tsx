import React, { useRef, useState } from 'react';

interface ScrubInputProps {
  label?: string;
  value: number;
  onChange: (next: number, recordHistory?: boolean) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  precision?: number;
  className?: string;
}

export const ScrubInput: React.FC<ScrubInputProps> = ({
  label,
  value,
  onChange,
  min = -99999,
  max = 99999,
  step = 1,
  suffix = '',
  precision = 1,
  className = '',
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const dragRef = useRef<{
    startX: number;
    startVal: number;
    moved: boolean;
  } | null>(null);

  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const roundVal = (n: number) => {
    const factor = 10 ** precision;
    return Math.round(n * factor) / factor;
  };

  const formatted = `${roundVal(value)}${suffix}`;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (editing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startVal: value,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 3) dragRef.current.moved = true;
    if (!dragRef.current.moved) return;
    const delta = dx * step * 0.5;
    const next = roundVal(clamp(dragRef.current.startVal + delta));
    onChange(next, false);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const { moved, startVal } = dragRef.current;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (!moved) {
      setDraft(String(roundVal(value)));
      setEditing(true);
    } else {
      const dx = e.clientX - e.clientX; // already committed final value via last move; commit snapshot
      void dx;
      const finalVal = roundVal(clamp(value));
      if (finalVal !== startVal) {
        onChange(finalVal, true);
      }
    }
  };

  const commitDraft = () => {
    setEditing(false);
    const parsed = Number.parseFloat(draft);
    if (!Number.isNaN(parsed)) {
      onChange(roundVal(clamp(parsed)), true);
    }
  };

  return (
    <div
      className={`flex items-center justify-between gap-1.5 bg-[#0C0E12] border border-white/10 rounded-md px-2.5 min-h-[36px] lg:min-h-[30px] cursor-ew-resize touch-none hover:border-white/20 focus-within:border-[#5B7CFA] transition-colors ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      title="Drag horizontally to scrub or click to type"
    >
      {label && (
        <span className="text-[11px] font-medium text-slate-400 shrink-0 select-none">
          {label}
        </span>
      )}
      {editing ? (
        <input
          type="number"
          step={step}
          value={draft}
          autoFocus
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitDraft();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-full bg-transparent text-right font-mono text-xs tabular-nums text-slate-100 outline-none"
        />
      ) : (
        <span className="font-mono text-xs tabular-nums text-[#5B7CFA] font-medium truncate select-none ml-auto">
          {formatted}
        </span>
      )}
    </div>
  );
};
