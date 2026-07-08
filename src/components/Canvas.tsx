import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "../store";
import type { CanvasAsset, MotionPath, Zone } from "../types";
import { RuntimeEngine, pathSvgD, behaviorTransform } from "../runtime/engine";
import { uid, newShapeAsset } from "../factory";
import EditorParticles from "./EditorParticles";
import CanvasToolsBar from "./CanvasToolsBar";
import GradientBackgroundLayer from "./GradientBackgroundLayer";
import CanvasToolbar from "./CanvasToolbar";
import lottie from "lottie-web";

type DragState =
  | { mode: "marquee"; sx: number; sy: number; cx: number; cy: number }
  | { mode: "move"; id: string; startX: number; startY: number; ox: number; oy: number }
  | { mode: "resize"; id: string; handle: string; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number }
  | { mode: "rotate"; id: string; cx: number; cy: number; startAngle: number; oRot: number }
  | { mode: "drawShape"; id: string; sx: number; sy: number }
  | { mode: "drawZone"; id: string; sx: number; sy: number }
  | { mode: "point"; pathId: string; pointId: string; field: "p" | "in" | "out"; sx: number; sy: number; ox: number; oy: number; hix: number; hiy: number; hox: number; hoy: number }
  | { mode: "movePath"; id: string; sx: number; sy: number; origPoints: any[] }
  | { mode: "zone"; id: string; handle: string; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number }
  | { mode: "multi-resize"; handles: string; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; centerX: number; centerY: number; origs: { id: string; x: number; y: number; width: number; height: number }[] }
  | { mode: "multi-rotate"; cx: number; cy: number; startAngle: number; origs: { id: string; x: number; y: number; width: number; height: number; rot: number }[] }
  | null;

export default function Canvas() {
  const data = useStore((s) => s.data());
  const runtimePreview = useStore((s) => s.runtimePreview);
  const tool = useStore((s) => s.tool);
  const selKind = useStore((s) => s.selKind);
  const selId = useStore((s) => s.selId);
  const selIds = useStore((s) => s.selIds);
  const activePathId = useStore((s) => s.activePathId);
  const tab = useStore((s) => s.tab);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RuntimeEngine | null>(null);
  const [scale, setScale] = useState(0.5);
  const [drag, setDrag] = useState<DragState>(null);
  const [snapLines, setSnapLines] = useState<{x?: number, y?: number}>({});
  const dragRef = useRef<DragState>(null);
  dragRef.current = drag;

  const W = data?.canvasWidth ?? 1920;
  const H = data?.canvasHeight ?? 1080;

  useEffect(() => {
    // Calculate scale once on mount, don't update on resize
    const c = containerRef.current; if (!c) return;
    const s = Math.min((c.clientWidth - 80) / W, (c.clientHeight - 80) / H);
    setScale(Math.max(0.1, Math.min(1, s)));
  }, [W, H]);

  useEffect(() => {
    if (!data || !runtimeRef.current) return;
    if (runtimePreview) {
      const eng = new RuntimeEngine(runtimeRef.current, data, { editorMode: false, simulateFast: true });
      engineRef.current = eng; eng.start(); (window as any).__engine = eng;
      return () => { eng.destroy(); engineRef.current = null; };
    }
  }, [runtimePreview, data]);

  const toCanvas = useCallback((clientX: number, clientY: number) => {
    if (!stageRef.current) return { x: 0, y: 0 };
    const rect = stageRef.current.getBoundingClientRect();
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  }, [scale]);

  const onAssetPointerDown = (e: React.PointerEvent, a: CanvasAsset) => {
    if (a.locked || runtimePreview) { e.stopPropagation(); return; }
    e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const st = useStore.getState();
    if (e.altKey) {
      const toDup = st.selIds.includes(a.id) ? st.selIds : [a.id];
      const newIds: string[] = []; let primaryNewId = a.id;
      st.update((d) => {
        toDup.forEach(id => {
          const src = d.assets.find(x => x.id === id); if (!src) return;
          const nid = uid(); d.assets.push({ ...structuredClone(src), id: nid, name: src.name + " copy" });
          newIds.push(nid); if (id === a.id) primaryNewId = nid;
        });
      });
      st.select("asset", primaryNewId); useStore.setState({ selIds: newIds }); return;
    }
    if (!st.selIds.includes(a.id)) { st.select("asset", a.id); useStore.setState({ selIds: [a.id] }); }
    const p = toCanvas(e.clientX, e.clientY);
    setDrag({ mode: "move", id: a.id, startX: p.x, startY: p.y, ox: a.x, oy: a.y });
  };

  const onResizeDown = (e: React.PointerEvent, a: CanvasAsset, handle: string) => {
    if (a.locked) return; e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = toCanvas(e.clientX, e.clientY);
    setDrag({ mode: "resize", id: a.id, handle, sx: p.x, sy: p.y, ox: a.x, oy: a.y, ow: a.width, oh: a.height });
  };

  const onRotateDown = (e: React.PointerEvent, a: CanvasAsset) => {
    if (a.locked) return; e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const cx = a.x + a.width / 2, cy = a.y + a.height / 2, p = toCanvas(e.clientX, e.clientY);
    const startAngle = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI;
    setDrag({ mode: "rotate", id: a.id, cx, cy, startAngle, oRot: a.rotation });
  };

  const onPointDown = (e: React.PointerEvent, path: MotionPath, pointId: string, field: "p" | "in" | "out") => {
    e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pt = path.points.find((x) => x.id === pointId)!, p = toCanvas(e.clientX, e.clientY);
    setDrag({ mode: "point", pathId: path.id, pointId, field, sx: p.x, sy: p.y, ox: pt.x, oy: pt.y, hix: pt.hIn.x, hiy: pt.hIn.y, hox: pt.hOut.x, hoy: pt.hOut.y });
  };

  const onZoneDown = (e: React.PointerEvent, z: Zone, handle: string) => {
    if (runtimePreview) return; e.stopPropagation(); useStore.getState().select("zone", z.id);
    if (z.locked) return; (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = toCanvas(e.clientX, e.clientY);
    setDrag({ mode: "zone", id: z.id, handle, sx: p.x, sy: p.y, ox: z.x, oy: z.y, ow: z.w, oh: z.h });
  };

  const onStageDown = (e: React.PointerEvent) => {
    if (runtimePreview) return;
    const st = useStore.getState(), p = toCanvas(e.clientX, e.clientY);
    if (tool === "select") {
      setDrag({ mode: "marquee", sx: p.x, sy: p.y, cx: p.x, cy: p.y });
      st.select(null, null); useStore.setState({ selIds: [] }); return;
    }
    if (tool.startsWith("shape-")) {
      const layer = st.data()!.layers.find((l) => l.id === "layer-mid") ?? st.data()!.layers[0];
      const kind = tool.replace("shape-", "") as any;
      const asset = newShapeAsset(kind, layer.id, p.x, p.y);
      asset.width = 8; asset.height = 8;
      st.addAsset(asset); st.select("asset", asset.id);
      setDrag({ mode: "drawShape", id: asset.id, sx: p.x, sy: p.y }); return;
    }
    if (tool === "path") {
      if (!activePathId) {
        const count = st.data()?.paths.length || 0;
        const np: MotionPath = { id: uid(), name: `Path ${count + 1}`, closed: false, color: "#38bdf8", points: [{ id: uid(), x: p.x, y: p.y, hIn: { x: -60, y: 0 }, hOut: { x: 60, y: 0 } }] };
        st.addPath(np); st.setActivePath(np.id); st.select("path", np.id); return;
      }
      const path = st.data()!.paths.find((x) => x.id === activePathId);
      if (path) { st.updatePath(activePathId, { points: [...path.points, { id: uid(), x: p.x, y: p.y, hIn: { x: -60, y: 0 }, hOut: { x: 60, y: 0 } }] }); }
      return;
    }
    const keepClear = st.zoneDrawKeepClear, zKind = keepClear ? "exclude" : "include", zColor = keepClear ? "#f43f5e" : "#34d399";
    if (tool === "zone-rect" || tool === "zone-ellipse" || tool === "zone-triangle") {
      const shape = tool === "zone-rect" ? "rect" : tool === "zone-ellipse" ? "ellipse" : "triangle";
      const z: Zone = { id: uid(), name: (keepClear ? "Keep-Clear " : "") + shape.charAt(0).toUpperCase() + shape.slice(1), shape, kind: zKind, color: zColor, global: keepClear, x: p.x, y: p.y, w: 12, h: 12, points: [] };
      st.addZone(z); st.select("zone", z.id); setDrag({ mode: "drawZone", id: z.id, sx: p.x, sy: p.y }); return;
    }
    if (tool === "zone-poly") {
      let z = st.data()!.zones.find((x) => x.id === selId && x.shape === "polygon");
      if (!z) {
        const nz: Zone = { id: uid(), name: (keepClear ? "Keep-Clear Polygon" : "Polygon Zone"), shape: "polygon", kind: zKind, color: zColor, global: keepClear, x: 0, y: 0, w: 0, h: 0, points: [{ x: p.x, y: p.y }] };
        st.addZone(nz); st.select("zone", nz.id); return;
      }
      if (z.points.length >= 3) {
        const first = z.points[0], dist = Math.hypot(first.x - p.x, first.y - p.y);
        if (dist < 18 / scale) { st.setTool("select"); return; }
      }
      st.updateZone(z.id, { points: [...z.points, { x: p.x, y: p.y }] }); return;
    }
    st.select(null, null);
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current; if (!d) return;
      const p = toCanvas(e.clientX, e.clientY); const st = useStore.getState();
      if (d.mode === "marquee") { setDrag({ ...d, cx: p.x, cy: p.y }); }
      else if (d.mode === "move") {
        let dx = p.x - d.startX, dy = p.y - d.startY;
        const a = st.data()!.assets.find(x => x.id === d.id)!;
        const snapDist = 15 / scale;
        const nX = d.ox + dx, nY = d.oy + dy, nCX = nX + a.width / 2, nCY = nY + a.height / 2;
        let sx: number | undefined, sy: number | undefined;
        if (Math.abs(nX) < snapDist) { dx = 0 - d.ox; sx = 0; } else if (Math.abs(nX + a.width - W) < snapDist) { dx = W - a.width - d.ox; sx = W; } else if (Math.abs(nCX - W/2) < snapDist) { dx = W/2 - a.width/2 - d.ox; sx = W/2; }
        if (Math.abs(nY) < snapDist) { dy = 0 - d.oy; sy = 0; } else if (Math.abs(nY + a.height - H) < snapDist) { dy = H - a.height - d.oy; sy = H; } else if (Math.abs(nCY - H/2) < snapDist) { dy = H/2 - a.height/2 - d.oy; sy = H/2; }
        setSnapLines({x: sx, y: sy});
        if (st.selIds.length > 1 && st.selIds.includes(d.id)) {
          const deltaX = (d.ox + dx) - a.x, deltaY = (d.oy + dy) - a.y;
          st.update((data) => { data.assets.forEach(asset => { if (st.selIds.includes(asset.id) && !asset.locked) { asset.x += deltaX; asset.y += deltaY; } }); }, false);
        } else { st.updateAsset(d.id, { x: d.ox + dx, y: d.oy + dy }); }
      } else if (d.mode === "resize") {
        let { ox, oy, ow, oh } = d; const dx = p.x - d.sx, dy = p.y - d.sy;
        
        // Lock aspect ratio by default for images to prevent empty space in bounding box
        const asset = st.data()!.assets.find(a => a.id === d.id);
        const isImage = asset && !asset.shape && asset.fit !== 'fill';
        const lockRatio = e.shiftKey || isImage; // Always lock for images unless we add a specific unlock key
        
        if (d.handle.includes("e")) ow = Math.max(20, d.ow + dx); 
        if (d.handle.includes("s")) oh = Math.max(20, d.oh + dy); 
        if (d.handle.includes("w")) { ow = Math.max(20, d.ow - dx); ox = d.ox + dx; } 
        if (d.handle.includes("n")) { oh = Math.max(20, d.oh - dy); oy = d.oy + dy; }
        
        if (lockRatio && d.ow > 0 && d.oh > 0) {
          const ratio = d.ow / d.oh;
          if (d.handle.length === 2) { // Corner resize
             if (Math.abs(dx) > Math.abs(dy)) oh = ow / ratio; else ow = oh * ratio;
             // Adjust position if resizing from top/left to keep opposite corner fixed
             if (d.handle.includes("w")) ox = d.ox + (d.ow - ow);
             if (d.handle.includes("n")) oy = d.oy + (d.oh - oh);
          } else { // Edge resize - simpler to just adjust one dimension or expand both? Usually edge resize doesn't lock ratio well without jumping. Let's stick to corner locking or shift-lock.
             // Actually, for edge resize with lock ratio, it's tricky. Let's just use shift for explicit lock.
             if (e.shiftKey) {
                if (d.handle.includes("e") || d.handle.includes("w")) oh = ow / ratio;
                else ow = oh * ratio;
             }
          }
        }
        
        st.updateAsset(d.id, { x: ox, y: oy, width: ow, height: oh });
      } else if (d.mode === "rotate") {
        const ang = (Math.atan2(p.y - d.cy, p.x - d.cx) * 180) / Math.PI; let rot = d.oRot + (ang - d.startAngle);
        if (e.shiftKey) rot = Math.round(rot / 15) * 15; st.updateAsset(d.id, { rotation: Math.round(rot) });
      } else if (d.mode === "multi-resize") {
        let nx = d.ox, ny = d.oy, nw = d.ow, nh = d.oh; const dx = p.x - d.sx, dy = p.y - d.sy;
        if (d.handles.includes("e")) nw = Math.max(20, d.ow + dx); if (d.handles.includes("s")) nh = Math.max(20, d.oh + dy); if (d.handles.includes("w")) { nw = Math.max(20, d.ow - dx); nx = d.ox + dx; } if (d.handles.includes("n")) { nh = Math.max(20, d.oh - dy); ny = d.oy + dy; }
        const sx = nw / d.ow, sy = nh / d.oh;
        st.update((data) => { for (const orig of d.origs) { const a = data.assets.find((x) => x.id === orig.id); if (!a || a.locked) continue; const rx = (orig.x - d.ox) / d.ow, ry = (orig.y - d.oy) / d.oh; a.x = nx + rx * nw; a.y = ny + ry * nh; a.width = Math.max(10, orig.width * sx); a.height = Math.max(10, orig.height * sy); } }, false);
      } else if (d.mode === "multi-rotate") {
        const ang = (Math.atan2(p.y - d.cy, p.x - d.cx) * 180) / Math.PI; const rot = ang - d.startAngle;
        const ca = Math.cos((rot * Math.PI) / 180), sa = Math.sin((rot * Math.PI) / 180);
        st.update((data) => { for (const orig of d.origs) { const a = data.assets.find((x) => x.id === orig.id); if (!a || a.locked) continue; const cxA = orig.x + orig.width / 2, cyA = orig.y + orig.height / 2, dx0 = cxA - d.cx, dy0 = cyA - d.cy, nxC = d.cx + dx0 * ca - dy0 * sa, nyC = d.cy + dx0 * sa + dy0 * ca; a.x = nxC - orig.width / 2; a.y = nyC - orig.height / 2; let nrot = orig.rot + rot; if (e.shiftKey) nrot = Math.round(nrot / 15) * 15; a.rotation = nrot; } }, false);
      } else if (d.mode === "drawShape") {
        st.updateAsset(d.id, { x: Math.min(d.sx, p.x), y: Math.min(d.sy, p.y), width: Math.max(8, Math.abs(p.x - d.sx)), height: Math.max(8, Math.abs(p.y - d.sy)) });
      } else if (d.mode === "drawZone") {
        st.updateZone(d.id, { x: Math.min(d.sx, p.x), y: Math.min(d.sy, p.y), w: Math.max(12, Math.abs(p.x - d.sx)), h: Math.max(12, Math.abs(p.y - d.sy)) });
      } else if (d.mode === "point") {
        const path = st.data()!.paths.find((x) => x.id === d.pathId)!;
        const pts = path.points.map(pt => { if (pt.id !== d.pointId) return pt; if (d.field === "p") return { ...pt, x: d.ox + (p.x - d.sx), y: d.oy + (p.y - d.sy) }; if (d.field === "in") return { ...pt, hIn: { x: d.hix + (p.x - d.sx), y: d.hiy + (p.y - d.sy) } }; return { ...pt, hOut: { x: d.hox + (p.x - d.sx), y: d.hoy + (p.y - d.sy) } }; });
        st.updatePath(d.pathId, { points: pts });
      } else if (d.mode === "movePath") {
        const dx = p.x - d.sx, dy = p.y - d.sy, nextPts = d.origPoints.map((pt: any) => ({ ...pt, x: pt.x + dx, y: pt.y + dy })); st.updatePath(d.id, { points: nextPts });
      } else if (d.mode === "zone") {
        const z = st.data()!.zones.find((x) => x.id === d.id)!; if (z.shape === "polygon") return;
        let { ox, oy, ow, oh } = d; const dx = p.x - d.sx, dy = p.y - d.sy;
        if (d.handle === "body") { ox = d.ox + dx; oy = d.oy + dy; } else { if (d.handle.includes("e")) ow = Math.max(20, d.ow + dx); if (d.handle.includes("s")) oh = Math.max(20, d.oh + dy); if (d.handle.includes("w")) { ow = Math.max(20, d.ow - dx); ox = d.ox + dx; } if (d.handle.includes("n")) { oh = Math.max(20, d.oh - dy); oy = d.oy + dy; } }
        st.updateZone(d.id, { x: ox, y: oy, w: ow, h: oh });
      }
    };
    const onUp = () => {
      const d = dragRef.current; setSnapLines({}); if (!d) return;
      if (d.mode === "drawShape" || d.mode === "drawZone") useStore.getState().setTool("select");
      else if (d.mode === "marquee") {
        const rx = Math.min(d.sx, d.cx), ry = Math.min(d.sy, d.cy), rw = Math.abs(d.cx - d.sx), rh = Math.abs(d.cy - d.sy);
        const toSelect = useStore.getState().data()!.assets.filter(a => !(a.x > rx + rw || a.x + a.width < rx || a.y > ry + rh || a.y + a.height < ry) && !a.locked);
        if (toSelect.length > 0) { useStore.getState().select("asset", toSelect[0].id); useStore.setState({ selIds: toSelect.map(a => a.id) }); } else { useStore.getState().select(null, null); useStore.setState({ selIds: [] }); }
      }
      if (["move", "resize", "rotate", "multi-resize", "multi-rotate", "drawShape", "drawZone", "point", "movePath", "zone"].includes(d.mode)) useStore.getState().update(() => {}, true);
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [toCanvas, scale, W, H]);

  if (!data) return null;
  const selAsset = selKind === "asset" ? data.assets.find((a) => a.id === selId) : undefined;
  const layerOrder = Object.fromEntries(data.layers.map((l, i) => [l.id, i]));

  return (
    <div ref={containerRef} className="relative flex h-full w-full items-center justify-center overflow-auto bg-[#0a0e1a] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:24px_24px]">
      <CanvasToolsBar />
      <CanvasToolbar selIds={selIds} assets={data.assets} W={W} H={H} />
      <div className="pointer-events-none absolute left-3 top-3 z-40 rounded-md bg-slate-900/80 px-2 py-1 text-[11px] font-mono text-slate-400 backdrop-blur">{Math.round(scale * 100)}% · {W}×{H}</div>
      {runtimePreview && (
        <div className="pointer-events-none absolute right-3 top-3 z-40 flex items-center gap-1.5 rounded-md bg-emerald-900/70 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> RUNTIME PREVIEW
        </div>
      )}
      <div ref={stageRef} onPointerDown={onStageDown} className="relative origin-center shadow-2xl shadow-black/60" style={{ width: W, height: H, transform: `scale(${scale})`, background: data.bgColor, cursor: tool !== "select" ? "crosshair" : "default" }}>
        {!runtimePreview && <GradientBackgroundLayer />}
        {!runtimePreview && (
          <>
            {data.layers.map((layer) => {
              if (!layer.visible) return null;
              const layerAssets = data.assets.filter(a => a.layerId === layer.id && a.visible).sort((a, b) => a.zoffset - b.zoffset);
              const layerParticles = data.particles.filter(p => p.layerId === layer.id && p.enabled);
              return (
                <div key={layer.id} className="absolute inset-0 pointer-events-none" style={{ zIndex: (layerOrder[layer.id] ?? 0) * 10 }}>
                  {layerAssets.map((a) => {
                    const media = data.media.find((m) => m.id === a.mediaId);
                    const interactive = tool === "select" && !a.locked && layer.locked !== true;
                    return <AssetView key={a.id} a={a} media={media} interactive={interactive} ringed={selIds.includes(a.id) && a.id !== selId} onPointerDown={(e) => interactive && onAssetPointerDown(e, a)} />;
                  })}
                  {layerParticles.length > 0 && <EditorParticles W={W} H={H} layerId={layer.id} />}
                </div>
              );
            })}
            {selIds.filter((id) => { const a = data.assets.find(x => x.id === id); return a && !a.locked; }).length > 1 && tool === "select" && (
              <MultiSelectionBox
                assets={data.assets.filter(a => selIds.includes(a.id) && !a.locked)}
                onResizeDown={(handle, e) => {
                  e.stopPropagation(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  const st = useStore.getState(), sel = st.data()!.assets.filter(a => selIds.includes(a.id) && !a.locked); if (!sel.length) return;
                  const minX = Math.min(...sel.map(a => a.x)), minY = Math.min(...sel.map(a => a.y)), maxX = Math.max(...sel.map(a => a.x + a.width)), maxY = Math.max(...sel.map(a => a.y + a.height));
                  const p = toCanvas(e.clientX, e.clientY);
                  setDrag({ mode: "multi-resize", handles: handle, sx: p.x, sy: p.y, ox: minX, oy: minY, ow: maxX - minX, oh: maxY - minY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, origs: sel.map(a => ({ id: a.id, x: a.x, y: a.y, width: a.width, height: a.height })) });
                }}
                onRotateDown={(e) => {
                  e.stopPropagation(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  const st = useStore.getState(), sel = st.data()!.assets.filter(a => selIds.includes(a.id) && !a.locked); if (!sel.length) return;
                  const minX = Math.min(...sel.map(a => a.x)), minY = Math.min(...sel.map(a => a.y)), maxX = Math.max(...sel.map(a => a.x + a.width)), maxY = Math.max(...sel.map(a => a.y + a.height));
                  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, p = toCanvas(e.clientX, e.clientY), startAngle = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI;
                  setDrag({ mode: "multi-rotate", cx, cy, startAngle, origs: sel.map(a => ({ id: a.id, x: a.x, y: a.y, width: a.width, height: a.height, rot: a.rotation })) });
                }}
              />
            )}
            {selIds.length === 1 && selAsset && tool === "select" && <SelectionBox a={selAsset} isMulti={false} onResizeDown={onResizeDown} onRotateDown={onRotateDown} />}
            {drag?.mode === "marquee" && <div className="absolute border border-violet-400 bg-violet-500/20" style={{ left: Math.min(drag.sx, drag.cx), top: Math.min(drag.sy, drag.cy), width: Math.abs(drag.cx - drag.sx), height: Math.abs(drag.cy - drag.sy), pointerEvents: "none", zIndex: 9999 }} />}
            {snapLines.x !== undefined && <div className="absolute top-0 bottom-0 border-l border-violet-500 z-[9999] pointer-events-none" style={{left: snapLines.x}} />}
            {snapLines.y !== undefined && <div className="absolute left-0 right-0 border-t border-violet-500 z-[9999] pointer-events-none" style={{top: snapLines.y}} />}
            <svg className="pointer-events-none absolute inset-0" width={W} height={H}>{data.zones.map((z) => <ZoneShapeSvg key={z.id} z={z} selected={selKind === "zone" && selId === z.id} />)}</svg>
            {tab === "zones" && tool === "select" && data.zones.map((z) => <ZoneHandles key={z.id} z={z} selected={selKind === "zone" && selId === z.id} onDown={onZoneDown} />)}
            <svg className="absolute inset-0" width={W} height={H} style={{ pointerEvents: tab === "paths" ? "auto" : "none" }}>
              {data.paths.map((path) => {
                const pathId = `path-anim-${path.id}`;
                return (
                  <g key={path.id}>
                    <path id={pathId} d={pathSvgD(path)} fill="none" stroke="transparent" strokeWidth={0} />
                    <path d={pathSvgD(path)} fill="none" stroke={path.color} strokeWidth={12} strokeOpacity={0} className={tab === "paths" ? "cursor-move pointer-events-auto" : ""} onPointerDown={(e) => { if (tab !== "paths") return; e.stopPropagation(); const p = toCanvas(e.clientX, e.clientY); useStore.getState().setActivePath(path.id); useStore.getState().select("path", path.id); setDrag({ mode: "movePath", id: path.id, sx: p.x, sy: p.y, origPoints: [...path.points] }); }} />
                    <path d={pathSvgD(path)} fill="none" stroke={path.color} strokeWidth={3} strokeDasharray="10 8" opacity={activePathId && path.id === activePathId ? 1 : (tab === "paths" || tool === "path" ? 0.7 : 0.25)} pointerEvents="none" />
                    {activePathId === path.id && (
                      <circle r="6" fill="#facc15" stroke="#fff" strokeWidth={2}>
                        <animateMotion dur="4s" repeatCount="indefinite" path={pathSvgD(path)} />
                      </circle>
                    )}
                  </g>
                );
              })}
            </svg>
            {activePathId && (tab === "paths" || tool === "path") && (() => {
                const path = data.paths.find((p) => p.id === activePathId); if (!path) return null;
                return (
                  <svg className="absolute inset-0" width={W} height={H} style={{ overflow: "visible", pointerEvents: "none" }}>
                    {path.points.map((pt, i) => (
                      <g key={pt.id} style={{ pointerEvents: "auto" }}>
                        <line x1={pt.x} y1={pt.y} x2={pt.x + pt.hIn.x} y2={pt.y + pt.hIn.y} stroke="#60a5fa" strokeWidth={1.5} />
                        <line x1={pt.x} y1={pt.y} x2={pt.x + pt.hOut.x} y2={pt.y + pt.hOut.y} stroke="#f472b6" strokeWidth={1.5} />
                        <circle cx={pt.x + pt.hIn.x} cy={pt.y + pt.hIn.y} r={8} fill="#60a5fa" style={{ cursor: "grab" }} onPointerDown={(e) => onPointDown(e, path, pt.id, "in")} />
                        <circle cx={pt.x + pt.hOut.x} cy={pt.y + pt.hOut.y} r={8} fill="#f472b6" style={{ cursor: "grab" }} onPointerDown={(e) => onPointDown(e, path, pt.id, "out")} />
                        {i === 0 && path.points.length > 2 && <circle cx={pt.x} cy={pt.y} r={16} fill="none" stroke="#facc15" strokeWidth={2} strokeDasharray="4 3" style={{ pointerEvents: "auto", cursor: "pointer" }} onPointerDown={() => useStore.getState().updatePath(path.id, { closed: true })} />}
                        <rect x={pt.x - 8} y={pt.y - 8} width={16} height={16} rx={3} fill="#fff" stroke={path.color} strokeWidth={2.5} style={{ cursor: "grab" }} onPointerDown={(e) => onPointDown(e, path, pt.id, "p")} onContextMenu={(e) => { e.preventDefault(); if (path.points.length > 2) useStore.getState().updatePath(path.id, { points: path.points.filter((pp) => pp.id !== pt.id) }); }} />
                      </g>
                    ))}
                  </svg>
                );
              })()}
          </>
        )}
        {!runtimePreview && data.assets.length === 0 && data.particles.length === 0 && data.zones.length === 0 && data.paths.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="max-w-md rounded-2xl border border-white/10 bg-black/40 px-8 py-6 text-center backdrop-blur-sm">
              <div className="mb-2 text-4xl">🌆</div>
              <div className="mb-1 text-lg font-semibold text-white/90">Start building your living scene</div>
              <div className="text-sm text-white/70">Upload assets, draw shapes, or click any tool above the canvas.</div>
            </div>
          </div>
        )}
        <div ref={runtimeRef} className="absolute inset-0" style={{ display: runtimePreview ? "block" : "none" }} />
      </div>
    </div>
  );
}

function fitToCss(fit?: string) { if (fit === "auto") return "scale-down"; if (fit === "cover" || fit === "fill") return fit; return "contain"; }
function ShapeView({ shape }: { shape: any }) {
  const sw = shape.strokeWidth; const common = { vectorEffect: "non-scaling-stroke" as const };
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
      {shape.kind === "ellipse" && <ellipse cx="50" cy="50" rx={50 - sw} ry={50 - sw} fill={shape.fill} stroke={shape.stroke} strokeWidth={sw} style={common} />}
      {shape.kind === "triangle" && <polygon points="50,4 96,96 4,96" fill={shape.fill} stroke={shape.stroke} strokeWidth={sw} style={common} />}
      {shape.kind === "line" && <line x1="2" y1="50" x2="98" y2="50" stroke={shape.stroke} strokeWidth={sw} strokeLinecap="round" style={common} />}
      {shape.kind === "rect" && <rect x={sw} y={sw} width={100 - sw * 2} height={100 - sw * 2} rx={shape.radius} fill={shape.fill} stroke={shape.stroke} strokeWidth={sw} style={common} />}
    </svg>
  );
}
function LottieView({ dataUrl }: { dataUrl: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      const isData = dataUrl.startsWith("data:");
      const anim = lottie.loadAnimation(isData ? { container: ref.current, renderer: "svg", loop: true, autoplay: true, animationData: JSON.parse(atob(dataUrl.split(",")[1])) } : { container: ref.current, renderer: "svg", loop: true, autoplay: true, path: dataUrl });
      return () => anim.destroy();
    } catch (e) { console.warn("Lottie error", e); }
  }, [dataUrl]);
  return <div ref={ref} className="h-full w-full" />;
}

function AssetView({ a, media, interactive, ringed, onPointerDown }: { a: CanvasAsset; media: any; interactive: boolean; ringed: boolean; onPointerDown: (e: React.PointerEvent) => void; }) {
  const ref = useRef<HTMLDivElement>(null);
  const sx = a.flipH ? -a.scale : a.scale, sy = a.flipV ? -a.scale : a.scale;
  const baseFilter = a.shadow?.enabled ? `drop-shadow(${a.shadow.offsetX}px ${a.shadow.offsetY}px ${a.shadow.blur}px ${a.shadow.color})` : "";
  useEffect(() => {
    if (!a.animation || a.animation === "none") { if (ref.current) { const { transform } = behaviorTransform(undefined, 0, 1, a.rotation, sx, sy); ref.current.style.transform = transform; ref.current.style.filter = baseFilter; } return; }
    let raf = 0; const start = performance.now();
    const tick = () => { raf = requestAnimationFrame(tick); const el = ref.current; if (!el) return; const t = (performance.now() - start) / 1000; const { transform, filter } = behaviorTransform(a.animation, t, a.animSpeed ?? 1, a.rotation, sx, sy); el.style.transform = transform; el.style.filter = (baseFilter + " " + (filter || "")).trim(); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [a.animation, a.animSpeed, a.rotation, sx, sy, baseFilter]);
  return (
    <div ref={ref} onPointerDown={onPointerDown} className={`absolute select-none ${ringed ? "ring-2 ring-violet-500/50" : ""}`} style={{ left: a.x, top: a.y, width: a.width, height: a.height, opacity: a.opacity, transformOrigin: `${(a.refPointX ?? 0.5) * 100}% ${(a.refPointY ?? 0.5) * 100}%`, cursor: interactive ? "move" : "default", pointerEvents: interactive ? "auto" : "none", filter: baseFilter || undefined }}>
      {a.shape ? <ShapeView shape={a.shape} /> : media?.type === "lottie" ? <LottieView dataUrl={media.dataUrl} /> : media?.type === "video" ? <video src={media.dataUrl} autoPlay loop muted playsInline className="h-full w-full" style={{ objectFit: fitToCss(a.fit) }} /> : <img src={media?.dataUrl} draggable={false} className="h-full w-full" style={{ objectFit: fitToCss(a.fit) }} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.style.background = '#ef4444'; e.currentTarget.parentElement!.style.display = 'flex'; e.currentTarget.parentElement!.style.alignItems = 'center'; e.currentTarget.parentElement!.style.justifyContent = 'center'; e.currentTarget.parentElement!.innerText = 'Broken Image'; }} />}
    </div>
  );
}

function SelectionBox({ a, isMulti, onResizeDown, onRotateDown }: { a: CanvasAsset; isMulti: boolean; onResizeDown: (e: React.PointerEvent, a: CanvasAsset, handle: string) => void; onRotateDown: (e: React.PointerEvent, a: CanvasAsset) => void; }) {
  const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const pos: Record<string, { left: string; top: string; cursor: string }> = { nw: { left: "0%", top: "0%", cursor: "nwse-resize" }, n: { left: "50%", top: "0%", cursor: "ns-resize" }, ne: { left: "100%", top: "0%", cursor: "nesw-resize" }, e: { left: "100%", top: "50%", cursor: "ew-resize" }, se: { left: "100%", top: "100%", cursor: "nwse-resize" }, s: { left: "50%", top: "100%", cursor: "ns-resize" }, sw: { left: "0%", top: "100%", cursor: "nesw-resize" }, w: { left: "0%", top: "50%", cursor: "ew-resize" } };
  return (
    <div className="pointer-events-none absolute border-2 border-violet-400" style={{ left: a.x, top: a.y, width: a.width, height: a.height, transform: `rotate(${a.rotation}deg) scale(${a.scale})`, transformOrigin: `${(a.refPointX ?? 0.5) * 100}% ${(a.refPointY ?? 0.5) * 100}%` }}>
      {!isMulti && handles.map((h) => <div key={h} onPointerDown={(e) => onResizeDown(e, a, h)} className="pointer-events-auto absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-violet-400 bg-white shadow" style={{ left: pos[h].left, top: pos[h].top, cursor: pos[h].cursor }} />)}
      {!isMulti && (<><div onPointerDown={(e) => onRotateDown(e, a)} className="pointer-events-auto absolute left-1/2 h-5 w-5 -translate-x-1/2 cursor-grab rounded-full border-2 border-violet-400 bg-white shadow" style={{ top: -40 }} /><div className="absolute left-1/2 h-8 w-0.5 -translate-x-1/2 bg-violet-400" style={{ top: -32 }} /></>)}
    </div>
  );
}

function MultiSelectionBox({ assets, onResizeDown, onRotateDown }: { assets: CanvasAsset[]; onResizeDown: (handle: string, e: React.PointerEvent) => void; onRotateDown: (e: React.PointerEvent) => void; }) {
  if (!assets.length) return null;
  const minX = Math.min(...assets.map((a) => a.x)), minY = Math.min(...assets.map((a) => a.y)), maxX = Math.max(...assets.map((a) => a.x + a.width)), maxY = Math.max(...assets.map((a) => a.y + a.height));
  const w = maxX - minX, h = maxY - minY;
  const handles: { name: string; left: string; top: string; cursor: string }[] = [ { name: "nw", left: "0%", top: "0%", cursor: "nwse-resize" }, { name: "n", left: "50%", top: "0%", cursor: "ns-resize" }, { name: "ne", left: "100%", top: "0%", cursor: "nesw-resize" }, { name: "e", left: "100%", top: "50%", cursor: "ew-resize" }, { name: "se", left: "100%", top: "100%", cursor: "nwse-resize" }, { name: "s", left: "50%", top: "100%", cursor: "ns-resize" }, { name: "sw", left: "0%", top: "100%", cursor: "nesw-resize" }, { name: "w", left: "0%", top: "50%", cursor: "ew-resize" } ];
  return (<div className="pointer-events-none absolute border-2 border-violet-400 border-dashed" style={{ left: minX, top: minY, width: w, height: h }}><div className="absolute -top-6 whitespace-nowrap rounded bg-violet-500 px-1.5 py-0.5 text-[9px] text-white">Multi-selected ({assets.length})</div>{handles.map((h) => (<div key={h.name} onPointerDown={(e) => onResizeDown(h.name, e)} className="pointer-events-auto absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-violet-400 bg-white shadow" style={{ left: h.left, top: h.top, cursor: h.cursor }} />))}<div onPointerDown={onRotateDown} className="pointer-events-auto absolute left-1/2 h-5 w-5 -translate-x-1/2 cursor-grab rounded-full border-2 border-violet-400 bg-white shadow" style={{ top: -40 }} /><div className="absolute left-1/2 h-8 w-0.5 -translate-x-1/2 bg-violet-400" style={{ top: -32 }} /></div>);
}

function ZoneShapeSvg({ z, selected }: { z: Zone; selected: boolean }) {
  const stroke = z.color, fill = z.color + "22", sw = selected ? 3 : 2, dash = z.kind === "exclude" ? "8 6" : undefined;
  if (z.shape === "rect") return <rect x={z.x} y={z.y} width={z.w} height={z.h} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />;
  if (z.shape === "ellipse") return <ellipse cx={z.x + z.w / 2} cy={z.y + z.h / 2} rx={z.w / 2} ry={z.h / 2} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />;
  if (z.shape === "triangle") { const pts = `${z.x + z.w / 2},${z.y} ${z.x},${z.y + z.h} ${z.x + z.w},${z.y + z.h}`; return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />; }
  return <polygon points={z.points.map((p) => `${p.x},${p.y}`).join(" ")} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />;
}

function ZoneHandles({ z, selected, onDown }: { z: Zone; selected: boolean; onDown: (e: React.PointerEvent, z: Zone, handle: string) => void; }) {
  if (z.shape === "polygon") return null;
  const handles = ["nw", "ne", "se", "sw"];
  const pos: Record<string, { l: number; t: number }> = { nw: { l: z.x, t: z.y }, ne: { l: z.x + z.w, t: z.y }, se: { l: z.x + z.w, t: z.y + z.h }, sw: { l: z.x, t: z.y + z.h } };
  return (<><div onPointerDown={(e) => onDown(e, z, "body")} className="absolute" style={{ left: z.x, top: z.y, width: z.w, height: z.h, cursor: "move" }} />{selected && handles.map((h) => <div key={h} onPointerDown={(e) => onDown(e, z, h)} className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 bg-white" style={{ left: pos[h].l, top: pos[h].t, borderColor: z.color, cursor: "nwse-resize" }} />)}</>);
}
