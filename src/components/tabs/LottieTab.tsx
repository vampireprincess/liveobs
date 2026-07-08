import { useEffect, useRef, useState } from "react";
import lottie, { type AnimationItem } from "lottie-web";
import { uid, newCanvasAsset, defaultSchedule } from "../../factory";
import { useStore } from "../../store";
import { Btn, EmptyHint, Field, NumberInput, Panel, Select, Toggle } from "../ui";
import { extractLottieColors, recolorLottie, toDataUrl, type ColorHit } from "../../vectorColorUtils";
import type { MediaAsset } from "../../types";

type LoopMode = "loop" | "once" | "count";

export default function LottieTab() {
  const data = useStore((s) => s.data())!;
  const previewRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("Lottie animation");
  const [json, setJson] = useState<any>(null);
  const [colors, setColors] = useState<ColorHit[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [playing, setPlaying] = useState(true);
  const [loopMode, setLoopMode] = useState<LoopMode>("loop");
  const [loopCount, setLoopCount] = useState(3);

  const edited = json ? recolorLottie(json, map) : null;

  useEffect(() => {
    if (!previewRef.current || !edited) return;
    animRef.current?.destroy();
    previewRef.current.innerHTML = "";
    const loop = loopMode === "loop" ? true : loopMode === "once" ? false : Math.max(1, Math.round(loopCount));
    const anim = lottie.loadAnimation({ container: previewRef.current, renderer: "svg", autoplay: playing, loop, animationData: edited });
    animRef.current = anim;
    return () => anim.destroy();
  }, [edited, playing, loopMode, loopCount]);

  const loadFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text);
    setName(file.name.replace(/\.json$/i, ""));
    setJson(parsed);
    const hits = extractLottieColors(parsed);
    setColors(hits);
    setMap(Object.fromEntries(hits.map((c) => [c.key, c.value])));
    setPlaying(true);
  };

  const saveToLibrary = (place = false) => {
    if (!edited) return;
    const w = edited.w || 500, h = edited.h || 500;
    const media: MediaAsset = {
      id: uid(),
      name,
      type: "lottie",
      dataUrl: toDataUrl("application/json", JSON.stringify(edited)),
      width: w,
      height: h,
      categoryId: "static-assets",
      schedule: defaultSchedule(),
      inLibrary: false,
    };
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
      <Panel title="Lottie JSON Import + Editor">
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => loadFile(e.target.files?.[0])} />
        <Btn variant="primary" className="w-full" onClick={() => fileRef.current?.click()}>⬆ Import Lottie JSON</Btn>
        {!json && <EmptyHint>Import a .json Lottie file to preview, control loops, extract colors, and recolor.</EmptyHint>}
        {json && (
          <div className="space-y-2 pt-2">
            <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-100 outline-none" /></Field>
            <div ref={previewRef} className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-black/30" />
            <div className="grid grid-cols-2 gap-1.5">
              <Btn onClick={() => { setPlaying(true); animRef.current?.play(); }}>▶ Play</Btn>
              <Btn onClick={() => { setPlaying(false); animRef.current?.stop(); }}>⏹ Stop</Btn>
            </div>
            <Field label="Loop mode">
              <Select<LoopMode> value={loopMode} onChange={setLoopMode} options={[{ value: "loop", label: "Loop forever" }, { value: "once", label: "No loop / play once" }, { value: "count", label: "Loop count" }]} />
            </Field>
            {loopMode === "count" && <Field label="How many loops"><NumberInput value={loopCount} onChange={setLoopCount} /></Field>}
          </div>
        )}
      </Panel>

      {json && (
        <Panel title={`Lottie Colors (${colors.length})`} defaultCollapsed={false}>
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
            <Btn variant="primary" onClick={() => saveToLibrary(false)}>Save asset</Btn>
            <Btn variant="primary" className="col-span-2" onClick={() => saveToLibrary(true)}>Save + place on canvas</Btn>
          </div>
        </Panel>
      )}
    </div>
  );
}
