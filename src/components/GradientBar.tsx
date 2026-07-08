import { useRef, useState } from "react";
import type { ColorStop } from "../types";
import { uid } from "../factory";

interface Props {
  stops: ColorStop[];
  onChange: (stops: ColorStop[]) => void;
}

// Interactive gradient bar with draggable nodes.
// Click on the bar to add a stop, drag nodes to move, right-click node to delete.
export default function GradientBar({ stops, onChange }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);

  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  const cssStops = sorted.map((s) => `${s.color} ${(s.offset * 100).toFixed(1)}%`).join(", ");

  const posFromEvent = (clientX: number) => {
    const rect = barRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const onBarClick = (e: React.MouseEvent) => {
    if (dragId.current) return;
    // don't add when clicking a node (handled separately)
    const target = e.target as HTMLElement;
    if (target.dataset.node) return;
    const offset = posFromEvent(e.clientX);
    // interpolate a color from neighbors
    const color = colorAt(sorted, offset);
    const ns: ColorStop = { id: uid(), color, offset };
    onChange([...stops, ns]);
    setActiveId(ns.id);
  };

  const startDrag = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    setActiveId(id);
    dragId.current = id;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!dragId.current) return;
    const offset = posFromEvent(e.clientX);
    onChange(stops.map((s) => (s.id === dragId.current ? { ...s, offset } : s)));
  };

  const endDrag = () => {
    dragId.current = null;
  };

  const deleteStop = (id: string) => {
    if (stops.length <= 2) return;
    onChange(stops.filter((s) => s.id !== id));
  };

  const setColor = (id: string, color: string) => {
    onChange(stops.map((s) => (s.id === id ? { ...s, color } : s)));
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[9px] text-slate-500">
        <span className="uppercase tracking-wide">Color Stops</span>
        <span>Click bar to add · Right-click node to delete</span>
      </div>
      <div
        ref={barRef}
        onClick={onBarClick}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        className="relative h-7 w-full cursor-copy rounded-md border border-slate-600"
        style={{
          background: `linear-gradient(90deg, ${cssStops}), repeating-conic-gradient(#334155 0% 25%, #1e293b 0% 50%) 50% / 12px 12px`,
        }}
      >
        {sorted.map((s) => (
          <div
            key={s.id}
            data-node="1"
            onPointerDown={(e) => startDrag(e, s.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              deleteStop(s.id);
            }}
            className={`absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 shadow ${
              activeId === s.id ? "border-white ring-2 ring-violet-400" : "border-white/70"
            }`}
            style={{ left: `${s.offset * 100}%`, background: s.color }}
          >
            <input
              type="color"
              value={s.color}
              title="Click to edit color"
              onPointerDown={(e) => { e.stopPropagation(); setActiveId(s.id); }}
              onChange={(e) => setColor(s.id, e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
        ))}
      </div>

      {/* selected stop color picker */}
      {activeId && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="color"
            value={sorted.find((s) => s.id === activeId)?.color || "#ffffff"}
            onChange={(e) => setColor(activeId, e.target.value)}
            className="h-6 w-10 rounded"
          />
          <span className="text-[10px] text-slate-400">
            {Math.round((sorted.find((s) => s.id === activeId)?.offset || 0) * 100)}%
          </span>
          <button
            onClick={() => deleteStop(activeId)}
            disabled={stops.length <= 2}
            className="ml-auto rounded bg-rose-950/50 px-2 py-0.5 text-[10px] text-rose-300 hover:bg-rose-900/50 disabled:opacity-40"
          >
            Delete stop
          </button>
        </div>
      )}
    </div>
  );
}

function colorAt(sorted: ColorStop[], offset: number): string {
  if (!sorted.length) return "#ffffff";
  if (offset <= sorted[0].offset) return sorted[0].color;
  if (offset >= sorted[sorted.length - 1].offset) return sorted[sorted.length - 1].color;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i],
      b = sorted[i + 1];
    if (offset >= a.offset && offset <= b.offset) {
      const t = (offset - a.offset) / (b.offset - a.offset || 1);
      return lerpHex(a.color, b.color, t);
    }
  }
  return sorted[0].color;
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a),
    pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
