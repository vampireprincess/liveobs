import { useStore } from "../../store";
import { newPath } from "../../factory";
import { Btn, EmptyHint, Panel } from "../ui";

export default function PathsTab() {
  const data = useStore((s) => s.data())!;
  const activePathId = useStore((s) => s.activePathId);
  const tool = useStore((s) => s.tool);

  const create = () => {
    const p = newPath(data.canvasWidth, data.canvasHeight, data.paths.length);
    useStore.getState().addPath(p);
    useStore.getState().setActivePath(p.id);
    useStore.getState().select("path", p.id);
  };

  return (
    <Panel title="Motion Paths" action={<Btn variant="primary" onClick={create}>+ Path</Btn>}>
      <p className="mb-2 text-[11px] text-slate-500">
        Paths are editor guides for random movement. They are visible here, but hidden in exported runtime. Use Pen Tool and click on the canvas to add points; drag white squares and colored handles to edit curves.
      </p>
      <div className="mb-2 flex gap-1.5">
        <Btn variant={tool === "path" ? "primary" : "default"} onClick={() => useStore.getState().setTool(tool === "path" ? "select" : "path")}>
          Pen Tool {tool === "path" ? "ON" : ""}
        </Btn>
        <Btn onClick={() => { useStore.getState().setActivePath(null); useStore.getState().setTool("path"); }}>
          Draw New From Click
        </Btn>
      </div>
      {data.paths.length === 0 ? (
        <EmptyHint>No paths yet. Create one and assign it to a random group.</EmptyHint>
      ) : (
        <div className="space-y-1">
          {data.paths.map((p) => {
            const active = activePathId === p.id;
            return (
              <div key={p.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${active ? "border-sky-500 bg-sky-500/10" : "border-slate-800 bg-slate-800/30"}`}>
                <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                <button onClick={() => { useStore.getState().setActivePath(p.id); useStore.getState().select("path", p.id); }} className="flex-1 text-left text-sm text-slate-200">
                  {p.name} <span className="text-[10px] text-slate-500">· {p.points.length} pts</span>
                </button>
                <button
                  onClick={() => useStore.getState().updatePath(p.id, { points: [...p.points].reverse().map((pt) => ({ ...pt, hIn: pt.hOut, hOut: pt.hIn })) })}
                  className="rounded px-1.5 text-sky-300 hover:bg-sky-900/40"
                  title="Reverse path direction"
                >
                  ⇄
                </button>
                <button onClick={() => useStore.getState().removePath(p.id)} className="rounded px-1.5 text-rose-400 hover:bg-rose-900/40">×</button>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
