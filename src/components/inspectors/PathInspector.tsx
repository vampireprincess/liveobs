import { useStore } from "../../store";
import { Btn, Field, Panel, Select, TextInput, Toggle } from "../ui";
import type { MotionPath, PathMode } from "../../types";

export default function PathInspector() {
  const data = useStore((s) => s.data())!;
  const selId = useStore((s) => s.selId)!;
  const p = data.paths.find((x) => x.id === selId);
  if (!p) return null;
  const set = (patch: Partial<MotionPath>) => useStore.getState().updatePath(p.id, patch);

  return (
    <div>
      <Panel title="Path">
        <Field label="Name"><TextInput value={p.name} onChange={(v) => set({ name: v })} /></Field>
        <Field label="Color">
          <input type="color" value={p.color} onChange={(e) => set({ color: e.target.value })} className="h-9 w-full rounded" />
        </Field>
        <Field label="Path type">
          <Select<PathMode>
            value={p.mode ?? "curve"}
            onChange={(v) => set({ mode: v })}
            options={[
              { value: "curve", label: "Curves / Bezier" },
              { value: "angle", label: "Angles / Straight lines" },
            ]}
          />
        </Field>
        <Toggle label={p.closed ? "Closed loop" : "Open path"} checked={p.closed} onChange={(v) => set({ closed: v })} />
        <div className="rounded-md bg-slate-800/40 p-2 text-[11px] text-slate-400">
          {p.points.length} points. Use the <b>Pen tool</b> (Paths tab) and click the canvas to add points. Drag squares to move points{(p.mode ?? "curve") === "curve" ? ", circles to shape bezier curves" : ". Angle mode uses straight line segments"}.
        </div>
        <div className="flex gap-1.5">
          <Btn className="flex-1" onClick={() => set({ points: p.points.slice(0, -1) })}>Remove last point</Btn>
        </div>
        <Btn variant="danger" className="w-full" onClick={() => { useStore.getState().removePath(p.id); useStore.getState().setActivePath(null); useStore.getState().select(null, null); }}>🗑 Delete Path</Btn>
      </Panel>

      <Panel title="Points">
        <div className="space-y-1">
          {p.points.map((pt, i) => (
            <div key={pt.id} className="flex items-center gap-2 rounded bg-slate-800/40 px-2 py-1 text-[11px] text-slate-400">
              <span className="font-mono">#{i + 1}</span>
              <span className="flex-1 font-mono">{Math.round(pt.x)}, {Math.round(pt.y)}</span>
              <button onClick={() => set({ points: p.points.filter((x) => x.id !== pt.id) })} className="rounded px-1.5 text-rose-400 hover:bg-rose-900/40">×</button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
