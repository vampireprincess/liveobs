import { useEffect, useState } from "react";
import { useStore } from "./store";
import Toolbar from "./components/Toolbar";
import LeftPanel from "./components/LeftPanel";
import Canvas from "./components/Canvas";
import Inspector from "./components/Inspector";
import RuntimeView from "./components/RuntimeView";

export default function App() {
  const loaded = useStore((s) => s.loaded);
  const current = useStore((s) => s.current());
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  useEffect(() => {
    useStore.getState().init();
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const st = useStore.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        const input = target as HTMLInputElement;
        const allowAppUndo = target.tagName !== "INPUT" || input.type === "color" || input.type === "range";
        if (allowAppUndo) {
          e.preventDefault();
          if (e.shiftKey) st.redo();
          else st.undo();
          return;
        }
      }
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      const { selKind, selId, selIds } = st;
      if ((e.key === "Delete" || e.key === "Backspace") && (selId || selIds.length)) {
        if (selKind === "asset") {
          st.update((d) => {
            const toDel = new Set([selId, ...selIds].filter(Boolean));
            d.assets = d.assets.filter((a) => !toDel.has(a.id));
            d.randomGroups = d.randomGroups.filter((g) => !toDel.has(g.id));
            d.particles = d.particles.filter((p) => !toDel.has(p.id));
            d.paths = d.paths.filter((p) => !toDel.has(p.id));
            d.zones = d.zones.filter((z) => !toDel.has(z.id));
          });
        } else if (selKind === "group") st.removeGroup(selId!);
        else if (selKind === "particle") st.removeParticle(selId!);
        else if (selKind === "path") st.removePath(selId!);
        else if (selKind === "zone") st.removeZone(selId!);
        st.select(null, null);
      }
      if (e.key === "Escape") {
        st.select(null, null);
        st.setTool("select");
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      }
      if (selKind === "asset" && (selId || selIds.length) && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const toMove = new Set([selId!, ...selIds].filter(Boolean));
        st.update((d) => {
          for (const a of d.assets) if (toMove.has(a.id)) { a.x += dx; a.y += dy; }
        });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && selKind === "asset" && selId) {
        e.preventDefault();
        st.duplicateAsset(selId);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); st.saveNow(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "a" && selKind === "asset") {
        e.preventDefault();
        const ids = st.data()?.assets.map((a) => a.id) ?? [];
        st.setSelIds(ids);
      }
      // Delete last point of selected path
      if (e.key === "Delete" && selKind === "path" && selId) {
        e.preventDefault();
        const path = st.data()?.paths.find((p) => p.id === selId);
        if (path && path.points.length > 0) {
          st.updatePath(selId, { points: path.points.slice(0, -1) });
        }
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key.toLowerCase() === "v") st.setTool("select");
        if (e.key.toLowerCase() === "p") { st.setTool("path"); st.setTab("paths"); }
        if (e.key.toLowerCase() === "r") { st.setTool("shape-rect"); st.setTab("assets"); }
        if (e.key.toLowerCase() === "e") { st.setTool("zone-rect"); st.setTab("zones"); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (typeof window !== "undefined" && window.location.hash.startsWith("#runtime")) {
    return <RuntimeView />;
  }

  if (!loaded || !current) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="text-center">
          <div className="mb-3 text-4xl">🌆</div>
          <div className="text-sm">Loading studio…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        {/* Left panel with collapse */}
        {leftOpen && (
          <aside className="flex w-80 shrink-0 flex-col border-r border-slate-800 bg-slate-900/40 transition-all">
            <LeftPanel />
          </aside>
        )}
        {!leftOpen && (
          <div className="flex w-8 shrink-0 flex-col items-center border-r border-slate-800 bg-slate-900/40">
            <button
              onClick={() => setLeftOpen(true)}
              className="mt-3 flex h-8 w-6 items-center justify-center rounded-r-md bg-slate-800 text-slate-400 hover:bg-violet-600 hover:text-white"
              title="Open left panel"
            >
              ▶
            </button>
          </div>
        )}

        {/* Canvas */}
        <main className="relative min-w-0 flex-1">
          {leftOpen && (
            <button
              onClick={() => setLeftOpen(false)}
              className="absolute left-0 top-1/2 z-30 -translate-y-1/2 flex h-12 w-5 items-center justify-center rounded-r-md bg-slate-800/80 text-slate-400 hover:bg-violet-600 hover:text-white"
              title="Collapse left panel"
            >
              ◀
            </button>
          )}
          <Canvas />
          {rightOpen && (
            <button
              onClick={() => setRightOpen(false)}
              className="absolute right-0 top-1/2 z-30 -translate-y-1/2 flex h-12 w-5 items-center justify-center rounded-l-md bg-slate-800/80 text-slate-400 hover:bg-violet-600 hover:text-white"
              title="Collapse right panel"
            >
              ▶
            </button>
          )}
        </main>

        {/* Right inspector with collapse */}
        {rightOpen ? (
          <aside className="flex w-80 shrink-0 flex-col border-l border-slate-800 bg-slate-900/40 transition-all">
            <Inspector />
          </aside>
        ) : (
          <div className="flex w-8 shrink-0 flex-col items-center border-l border-slate-800 bg-slate-900/40">
            <button
              onClick={() => setRightOpen(true)}
              className="mt-3 flex h-8 w-6 items-center justify-center rounded-l-md bg-slate-800 text-slate-400 hover:bg-violet-600 hover:text-white"
              title="Open right panel"
            >
              ◀
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
