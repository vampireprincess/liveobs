import { useStore } from "../store";
import type { CanvasAsset } from "../types";

interface Props {
  selIds: string[];
  assets: CanvasAsset[];
  W: number;
  H: number;
}

// Floating toolbar that appears above the canvas when 2+ assets are selected.
// Supports alignment, distribution, multi-resize, and multi-rotation.
export default function CanvasToolbar({ selIds, assets, W, H }: Props) {
  if (selIds.length < 2) return null;

  const sel = assets.filter((a) => selIds.includes(a.id));
  if (!sel.length) return null;

  const applyAlign = (mode: string) => {
    const st = useStore.getState();
    // Use props selIds — guaranteed current, unlike store.selIds which may be stale on click
    const ids = selIds;
    if (ids.length < 2) return;

    st.update((d) => {
      const targets = d.assets.filter((a) => ids.includes(a.id) && !a.locked);
      if (targets.length === 0) return;

      const tMinX = Math.min(...targets.map((a) => a.x));
      const tMinY = Math.min(...targets.map((a) => a.y));
      const tMaxX = Math.max(...targets.map((a) => a.x + a.width));
      const tMaxY = Math.max(...targets.map((a) => a.y + a.height));
      const tCenterX = (tMinX + tMaxX) / 2;
      const tCenterY = (tMinY + tMaxY) / 2;

      targets.forEach((a) => {
        if (mode === "left") a.x = tMinX;
        else if (mode === "hcenter") a.x = tCenterX - a.width / 2;
        else if (mode === "right") a.x = tMaxX - a.width;
        else if (mode === "top") a.y = tMinY;
        else if (mode === "vcenter") a.y = tCenterY - a.height / 2;
        else if (mode === "bottom") a.y = tMaxY - a.height;
        else if (mode === "canvas-left") a.x = 0;
        else if (mode === "canvas-hcenter") a.x = (W - a.width) / 2;
        else if (mode === "canvas-right") a.x = W - a.width;
        else if (mode === "canvas-top") a.y = 0;
        else if (mode === "canvas-vcenter") a.y = (H - a.height) / 2;
        else if (mode === "canvas-bottom") a.y = H - a.height;
      });
    }, false);
  };

  const applyDistribute = (axis: "x" | "y") => {
    const st = useStore.getState();
    const ids = selIds;
    if (ids.length < 3) return;

    st.update((d) => {
      const targets = d.assets.filter((a) => ids.includes(a.id) && !a.locked);
      if (targets.length < 3) return;

      if (axis === "x") {
        const sorted = [...targets].sort((a, b) => a.x - b.x);
        const first = sorted[0], last = sorted[sorted.length - 1];
        const totalGap = (last.x + last.width) - first.x - sorted.reduce((sum, x) => sum + x.width, 0);
        const gap = totalGap / (sorted.length - 1);
        let curX = first.x;
        sorted.forEach(a => { a.x = curX; curX += a.width + gap; });
      } else {
        const sorted = [...targets].sort((a, b) => a.y - b.y);
        const first = sorted[0], last = sorted[sorted.length - 1];
        const totalGap = (last.y + last.height) - first.y - sorted.reduce((sum, x) => sum + x.height, 0);
        const gap = totalGap / (sorted.length - 1);
        let curY = first.y;
        sorted.forEach(a => { a.y = curY; curY += a.height + gap; });
      }
    }, false);
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

  const Btn = ({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) => (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      title={title}
      className="h-8 w-8 flex items-center justify-center rounded-md text-slate-300 hover:bg-violet-500/30 hover:text-white border border-transparent hover:border-slate-600 bg-slate-800/40 cursor-pointer"
    >
      {children}
    </button>
  );

  return (
    <div className="pointer-events-auto absolute left-1/2 bottom-4 z-[70] -translate-x-1/2 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-0.5 px-1.5">
        <Btn title="Align Left" onClick={() => applyAlign("left")}><AlignIcon type="left" /></Btn>
        <Btn title="Align Center H" onClick={() => applyAlign("hcenter")}><AlignIcon type="hcenter" /></Btn>
        <Btn title="Align Right" onClick={() => applyAlign("right")}><AlignIcon type="right" /></Btn>
        <div className="mx-1 h-6 w-px bg-slate-700" />
        <Btn title="Align Top" onClick={() => applyAlign("top")}><AlignIcon type="top" /></Btn>
        <Btn title="Align Center V" onClick={() => applyAlign("vcenter")}><AlignIcon type="vcenter" /></Btn>
        <Btn title="Align Bottom" onClick={() => applyAlign("bottom")}><AlignIcon type="bottom" /></Btn>
      </div>
      <div className="mx-1 h-6 w-px bg-slate-700" />
      <div className="flex items-center gap-0.5 px-1.5">
        <Btn title="To Canvas Left" onClick={() => applyAlign("canvas-left")}><AlignIcon type="left" /></Btn>
        <Btn title="To Canvas Center H" onClick={() => applyAlign("canvas-hcenter")}><AlignIcon type="hcenter" /></Btn>
        <Btn title="To Canvas Right" onClick={() => applyAlign("canvas-right")}><AlignIcon type="right" /></Btn>
        <div className="mx-1 h-6 w-px bg-slate-700" />
        <Btn title="To Canvas Top" onClick={() => applyAlign("canvas-top")}><AlignIcon type="top" /></Btn>
        <Btn title="To Canvas Center V" onClick={() => applyAlign("canvas-vcenter")}><AlignIcon type="vcenter" /></Btn>
        <Btn title="To Canvas Bottom" onClick={() => applyAlign("canvas-bottom")}><AlignIcon type="bottom" /></Btn>
      </div>
      {sel.length >= 3 && (
        <>
          <div className="mx-1 h-6 w-px bg-slate-700" />
          <div className="flex items-center gap-0.5 px-1.5">
            <Btn title="Distribute Horizontally" onClick={() => applyDistribute("x")}><AlignIcon type="distH" /></Btn>
            <Btn title="Distribute Vertically" onClick={() => applyDistribute("y")}><AlignIcon type="distV" /></Btn>
          </div>
        </>
      )}
    </div>
  );
}