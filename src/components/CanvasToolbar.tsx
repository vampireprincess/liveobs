import { useStore } from "../store";
import type { CanvasAsset } from "../types";

interface Props {
  selIds: string[];
  assets: CanvasAsset[];
  W: number;
  H: number;
}

type AlignMode =
  | "canvas-left" | "canvas-hcenter" | "canvas-right"
  | "canvas-top" | "canvas-vcenter" | "canvas-bottom"
  | "group-left" | "group-hcenter" | "group-right"
  | "group-top" | "group-vcenter" | "group-bottom";

function selectedIdsFromState(propIds: string[]) {
  const st = useStore.getState();
  const ids = propIds.length ? propIds : st.selKind === "asset" && st.selId ? [st.selId] : [];
  return Array.from(new Set(ids.filter(Boolean)));
}

function boundsOf(targets: CanvasAsset[]) {
  const minX = Math.min(...targets.map((a) => a.x));
  const minY = Math.min(...targets.map((a) => a.y));
  const maxX = Math.max(...targets.map((a) => a.x + a.width));
  const maxY = Math.max(...targets.map((a) => a.y + a.height));
  return { minX, minY, maxX, maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
}

// Floating toolbar that appears above the canvas when one or more assets are selected.
// The first section always aligns the selected asset(s) to the canvas. Group-relative
// align is shown separately for 2+ selections, so single-asset buttons never no-op.
export default function CanvasToolbar({ selIds, assets, W, H }: Props) {
  const effectiveIds = selectedIdsFromState(selIds);
  const sel = assets.filter((a) => effectiveIds.includes(a.id) && !a.locked);
  if (!sel.length) return null;

  const applyAlign = (mode: AlignMode) => {
    const ids = selectedIdsFromState(selIds);
    if (!ids.length) return;

    useStore.getState().update((d) => {
      const targets = d.assets.filter((a) => ids.includes(a.id) && !a.locked);
      if (!targets.length) return;

      const isGroup = mode.startsWith("group-");
      if (isGroup && targets.length < 2) return;
      const b = boundsOf(targets);

      targets.forEach((a) => {
        switch (mode) {
          case "canvas-left": a.x = 0; break;
          case "canvas-hcenter": a.x = (W - a.width) / 2; break;
          case "canvas-right": a.x = W - a.width; break;
          case "canvas-top": a.y = 0; break;
          case "canvas-vcenter": a.y = (H - a.height) / 2; break;
          case "canvas-bottom": a.y = H - a.height; break;
          case "group-left": a.x = b.minX; break;
          case "group-hcenter": a.x = b.centerX - a.width / 2; break;
          case "group-right": a.x = b.maxX - a.width; break;
          case "group-top": a.y = b.minY; break;
          case "group-vcenter": a.y = b.centerY - a.height / 2; break;
          case "group-bottom": a.y = b.maxY - a.height; break;
        }
      });
    });
  };

  const applyDistribute = (axis: "x" | "y") => {
    const ids = selectedIdsFromState(selIds);
    if (ids.length < 3) return;

    useStore.getState().update((d) => {
      const targets = d.assets.filter((a) => ids.includes(a.id) && !a.locked);
      if (targets.length < 3) return;

      if (axis === "x") {
        const sorted = [...targets].sort((a, b) => a.x - b.x);
        const first = sorted[0], last = sorted[sorted.length - 1];
        const totalGap = (last.x + last.width) - first.x - sorted.reduce((sum, x) => sum + x.width, 0);
        const gap = totalGap / (sorted.length - 1);
        let curX = first.x;
        sorted.forEach((a) => { a.x = curX; curX += a.width + gap; });
      } else {
        const sorted = [...targets].sort((a, b) => a.y - b.y);
        const first = sorted[0], last = sorted[sorted.length - 1];
        const totalGap = (last.y + last.height) - first.y - sorted.reduce((sum, x) => sum + x.height, 0);
        const gap = totalGap / (sorted.length - 1);
        let curY = first.y;
        sorted.forEach((a) => { a.y = curY; curY += a.height + gap; });
      }
    });
  };

  const AlignIcon = ({ type }: { type: string }) => {
    const icons: Record<string, React.ReactNode> = {
      left: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="2" height="12"/><rect x="6" y="4" width="8" height="2"/><rect x="6" y="7" width="6" height="2"/><rect x="6" y="10" width="8" height="2"/></svg>,
      hcenter: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="7" y="2" width="2" height="12"/><rect x="2" y="4" width="5" height="2"/><rect x="9" y="4" width="5" height="2"/><rect x="4" y="7" width="3" height="2"/><rect x="9" y="7" width="5" height="2"/></svg>,
      right: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="12" y="2" width="2" height="12"/><rect x="2" y="4" width="8" height="2"/><rect x="4" y="7" width="6" height="2"/><rect x="2" y="10" width="8" height="2"/></svg>,
      top: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="2"/><rect x="4" y="6" width="2" height="8"/><rect x="7" y="6" width="2" height="6"/><rect x="10" y="6" width="2" height="8"/></svg>,
      vcenter: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="7" width="12" height="2"/><rect x="4" y="2" width="2" height="5"/><rect x="4" y="9" width="2" height="5"/><rect x="7" y="4" width="2" height="3"/><rect x="7" y="9" width="2" height="3"/></svg>,
      bottom: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="12" width="12" height="2"/><rect x="4" y="2" width="2" height="8"/><rect x="7" y="4" width="2" height="6"/><rect x="10" y="2" width="2" height="8"/></svg>,
      distH: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="4" width="2" height="8"/><rect x="7" y="4" width="2" height="8"/><rect x="12" y="4" width="2" height="8"/></svg>,
      distV: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="2" width="8" height="2"/><rect x="4" y="7" width="8" height="2"/><rect x="4" y="12" width="8" height="2"/></svg>,
    };
    return <>{icons[type] || null}</>;
  };

  const Btn = ({ children, onPress, title }: { children: React.ReactNode; onPress: () => void; title?: string }) => (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onPress(); }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      title={title}
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-transparent bg-slate-800/40 text-slate-300 hover:border-slate-600 hover:bg-violet-500/30 hover:text-white"
    >
      {children}
    </button>
  );

  return (
    <div
      className="pointer-events-auto absolute left-1/2 bottom-4 z-[9999] flex -translate-x-1/2 items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur"
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div className="flex items-center gap-0.5 px-1.5">
        <span className="mr-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">Canvas</span>
        <Btn title="Canvas Left" onPress={() => applyAlign("canvas-left")}><AlignIcon type="left" /></Btn>
        <Btn title="Canvas Center H" onPress={() => applyAlign("canvas-hcenter")}><AlignIcon type="hcenter" /></Btn>
        <Btn title="Canvas Right" onPress={() => applyAlign("canvas-right")}><AlignIcon type="right" /></Btn>
        <div className="mx-1 h-6 w-px bg-slate-700" />
        <Btn title="Canvas Top" onPress={() => applyAlign("canvas-top")}><AlignIcon type="top" /></Btn>
        <Btn title="Canvas Center V" onPress={() => applyAlign("canvas-vcenter")}><AlignIcon type="vcenter" /></Btn>
        <Btn title="Canvas Bottom" onPress={() => applyAlign("canvas-bottom")}><AlignIcon type="bottom" /></Btn>
      </div>

      {sel.length >= 2 && (
        <>
          <div className="mx-1 h-6 w-px bg-slate-700" />
          <div className="flex items-center gap-0.5 px-1.5">
            <span className="mr-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">Group</span>
            <Btn title="Group Left" onPress={() => applyAlign("group-left")}><AlignIcon type="left" /></Btn>
            <Btn title="Group Center H" onPress={() => applyAlign("group-hcenter")}><AlignIcon type="hcenter" /></Btn>
            <Btn title="Group Right" onPress={() => applyAlign("group-right")}><AlignIcon type="right" /></Btn>
            <div className="mx-1 h-6 w-px bg-slate-700" />
            <Btn title="Group Top" onPress={() => applyAlign("group-top")}><AlignIcon type="top" /></Btn>
            <Btn title="Group Center V" onPress={() => applyAlign("group-vcenter")}><AlignIcon type="vcenter" /></Btn>
            <Btn title="Group Bottom" onPress={() => applyAlign("group-bottom")}><AlignIcon type="bottom" /></Btn>
          </div>
        </>
      )}

      {sel.length >= 3 && (
        <>
          <div className="mx-1 h-6 w-px bg-slate-700" />
          <div className="flex items-center gap-0.5 px-1.5">
            <span className="mr-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">Distribute</span>
            <Btn title="Distribute Horizontally" onPress={() => applyDistribute("x")}><AlignIcon type="distH" /></Btn>
            <Btn title="Distribute Vertically" onPress={() => applyDistribute("y")}><AlignIcon type="distV" /></Btn>
          </div>
        </>
      )}
    </div>
  );
}
