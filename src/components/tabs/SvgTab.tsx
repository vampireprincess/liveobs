import { useEffect, useMemo, useRef, useState } from "react";
import { uid, newCanvasAsset, defaultSchedule } from "../../factory";
import { useStore } from "../../store";
import { Btn, EmptyHint, Field, Panel } from "../ui";
import { extractSvgColors, recolorSvg, toDataUrl, type ColorHit } from "../../vectorColorUtils";
import type { MediaAsset } from "../../types";

function svgSize(svg: string) {
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const root = doc.documentElement;
    const vb = root.getAttribute("viewBox")?.split(/[\s,]+/).map(Number);
    const w = parseFloat(root.getAttribute("width") || "") || (vb && vb[2]) || 500;
    const h = parseFloat(root.getAttribute("height") || "") || (vb && vb[3]) || 500;
    return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
  } catch {
    return { width: 500, height: 500 };
  }
}

export default function SvgTab() {
  const data = useStore((s) => s.data())!;
  const fileRef = useRef<HTMLInputElement>(null);
  const selId = useStore((s) => s.selId);
  const [name, setName] = useState("SVG asset");
  const [svg, setSvg] = useState("");
  const [colors, setColors] = useState<ColorHit[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const edited = useMemo(() => (svg ? recolorSvg(svg, map) : ""), [svg, map]);

  const loadSvg = (text: string, nextName: string, mediaId: string | null = null) => {
    setName(nextName); setSvg(text); setEditingMediaId(mediaId);
    const hits = extractSvgColors(text); setColors(hits); setMap(Object.fromEntries(hits.map((c) => [c.key, c.value])));
  };

  const loadFile = async (file?: File) => {
    if (!file) return;
    loadSvg(await file.text(), file.name.replace(/\.svg$/i, ""));
  };

  const loadSelected = () => {
    const asset = data.assets.find((a) => a.id === selId);
    const media = asset?.mediaId ? data.media.find((m) => m.id === asset.mediaId) : undefined;
    if (!media || media.type !== "svg") return;
    const text = media.dataUrl.startsWith("data:") ? new TextDecoder().decode(Uint8Array.from(atob(media.dataUrl.split(",")[1]), c => c.charCodeAt(0))) : media.dataUrl;
    loadSvg(text, media.name, media.id);
  };

  useEffect(() => {
    const asset = data.assets.find((a) => a.id === selId);
    const media = asset?.mediaId ? data.media.find((m) => m.id === asset.mediaId) : undefined;
    if (media?.type === "svg" && !svg) loadSelected();
  }, [selId]);

  const saveToLibrary = (place = false) => {
    if (!edited) return;
    const size = svgSize(edited);
    const patch = { name, dataUrl: toDataUrl("image/svg+xml", edited), width: size.width, height: size.height };
    if (editingMediaId) { useStore.getState().update((d) => { const m = d.media.find((x) => x.id === editingMediaId); if (m) Object.assign(m, patch); }); return; }
    const media: MediaAsset = { id: uid(), name, type: "svg", dataUrl: patch.dataUrl, width: size.width, height: size.height, categoryId: "static-assets", schedule: defaultSchedule(), inLibrary: false };
    useStore.getState().addMedia(media);
    if (place) {
      const layer = data.layers.find((l) => l.id === "layer-mid") ?? data.layers[0];
      const asset = newCanvasAsset(media.id, layer.id, media);
      useStore.getState().addAsset(asset);
      useStore.getState().select("asset", asset.id);
    }
  };

  return (
    <div className="space-y-2">
      <Panel title="SVG Import + Editor">
        <input ref={fileRef} type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => loadFile(e.target.files?.[0])} />
        <div className="grid grid-cols-2 gap-1.5"><Btn variant="primary" onClick={() => fileRef.current?.click()}>⬆ Import SVG</Btn><Btn onClick={loadSelected}>Load selected</Btn></div>
        {!svg && <EmptyHint>Import an SVG to preview, extract colors, and recolor it.</EmptyHint>}
        {svg && (
          <div className="space-y-2 pt-2">
            <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-100 outline-none" /></Field>
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-black/30 p-3">
              <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: edited }} />
            </div>
          </div>
        )}
      </Panel>

      {svg && (
        <Panel title={`SVG Colors (${colors.length})`}>
          {!colors.length && <EmptyHint>No editable colors found.</EmptyHint>}
          <div className="space-y-1.5">
            {colors.map((c) => (
              <div key={c.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md bg-slate-800/40 p-1.5 text-xs">
                <span className="font-mono text-slate-300">{c.key}</span>
                <span className="h-6 w-6 rounded border border-slate-700" style={{ background: c.key }} />
                <input type="color" value={map[c.key] ?? c.value} onChange={(e) => setMap((m) => ({ ...m, [c.key]: e.target.value }))} className="h-7 w-10 rounded" />
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Btn onClick={() => setMap(Object.fromEntries(colors.map((c) => [c.key, c.key])))}>Reset colors</Btn>
            <Btn variant="primary" onClick={() => saveToLibrary(false)}>{editingMediaId ? "Update asset" : "Save asset"}</Btn>
            {!editingMediaId && <Btn variant="primary" className="col-span-2" onClick={() => saveToLibrary(true)}>Save + place on canvas</Btn>}
          </div>
        </Panel>
      )}
    </div>
  );
}
