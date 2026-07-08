import { useStore } from "../store";
import type { CanvasTool } from "../types";

interface ToolDef { id: CanvasTool; label: string; icon: string; tip: string; }

const GROUPS: { title: string; tools: ToolDef[] }[] = [
  {
    title: "Select",
    tools: [
      { id: "select", label: "Select", icon: "↖", tip: "Select, marquee, move, resize, rotate" },
    ],
  },
  {
    title: "Shapes",
    tools: [
      { id: "shape-rect", label: "Rect", icon: "▭", tip: "Drag to draw rectangle asset" },
      { id: "shape-ellipse", label: "Ellipse", icon: "◯", tip: "Drag to draw ellipse asset" },
      { id: "shape-triangle", label: "Triangle", icon: "▲", tip: "Drag to draw triangle asset" },
      { id: "shape-line", label: "Line", icon: "／", tip: "Drag to draw line" },
    ],
  },
  {
    title: "Paths",
    tools: [
      { id: "path", label: "Path", icon: "✏️", tip: "Click canvas to add motion-path points" },
    ],
  },
  {
    title: "Zones / Masks",
    tools: [
      { id: "zone-rect", label: "Rect", icon: "⬚", tip: "Drag to create rectangular mask" },
      { id: "zone-ellipse", label: "Ellipse", icon: "⬭", tip: "Drag to create ellipse mask" },
      { id: "zone-triangle", label: "Triangle", icon: "△", tip: "Drag to create triangle mask" },
      { id: "zone-poly", label: "Poly", icon: "⬡", tip: "Click to add polygon mask points" },
    ],
  },
];

export default function CanvasToolsBar() {
  const tool = useStore((s) => s.tool);

  const activate = (next: CanvasTool) => {
    const st = useStore.getState();
    st.setTool(next);
    if (next === "path") st.setTab("paths");
    else if (next.startsWith("zone-")) st.setTab("zones");
    else if (next.startsWith("shape-") || next === "select") st.setTab("assets");
  };

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-50 -translate-x-1/2 rounded-2xl border border-slate-800/80 bg-slate-950/85 p-1.5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-1">
        {GROUPS.map((group, gi) => (
          <div key={group.title} className="flex items-center gap-1">
            {gi > 0 && <div className="mx-1 h-8 w-px bg-slate-700" />}
            {group.tools.map((t) => {
              const active = tool === t.id;
              return (
                <button
                  key={t.id}
                  title={t.tip}
                  onClick={() => activate(t.id)}
                  className={`flex min-w-[50px] flex-col items-center justify-center rounded-xl px-2 py-1.5 text-[10px] font-medium transition ${
                    active
                      ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-900/40"
                      : "text-slate-300 hover:bg-slate-800/80"
                  }`}
                >
                  <span className="text-base leading-none">{t.icon}</span>
                  <span className="mt-0.5 leading-none">{t.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
