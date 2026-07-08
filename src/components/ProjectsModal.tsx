import { useStore } from "../store";
import { Btn } from "./ui";

export default function ProjectsModal({ onClose }: { onClose: () => void }) {
  const projects = useStore((s) => s.projects);
  const currentId = useStore((s) => s.currentId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-100">Projects</h2>
          <div className="flex gap-2">
            <Btn variant="primary" onClick={() => { useStore.getState().newProject("New Scene " + (projects.length + 1)); onClose(); }}>+ Blank Project</Btn>
            <button onClick={onClose} className="rounded-md px-2 text-slate-400 hover:bg-slate-800">✕</button>
          </div>
        </div>
        <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto p-5">
          {projects.map((p) => (
            <div
              key={p.id}
              className={`group rounded-xl border p-3 transition ${p.id === currentId ? "border-violet-500 bg-violet-500/10" : "border-slate-800 bg-slate-800/40 hover:border-slate-700"}`}
            >
              <button
                onClick={() => { useStore.getState().openProject(p.id); onClose(); }}
                className="mb-2 flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-slate-800"
                style={{ background: p.data.bgColor }}
              >
                {p.thumbnail ? (
                  <img src={p.thumbnail} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl opacity-30">🌆</span>
                )}
              </button>
              <div className="mb-2 flex items-center justify-between">
                <div className="truncate text-sm font-medium text-slate-200">{p.name}</div>
                {p.id === currentId && <span className="text-[10px] text-violet-400">current</span>}
              </div>
              <div className="text-[10px] text-slate-500">
                {p.data.assets.length} assets · {p.data.randomGroups.length} groups · {p.data.particles.length} particles
              </div>
              <div className="mt-2 flex gap-1 opacity-70 group-hover:opacity-100">
                <button onClick={() => useStore.getState().duplicateProject(p.id)} className="flex-1 rounded bg-slate-800 py-1 text-[11px] text-slate-300 hover:bg-slate-700">Duplicate</button>
                <button
                  onClick={() => {
                    if (projects.length > 1 && confirm(`Delete "${p.name}"? This cannot be undone.`)) useStore.getState().deleteProject(p.id);
                  }}
                  className="rounded bg-rose-950/50 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-900/50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
