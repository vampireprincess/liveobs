import { useEffect, useRef, useState } from "react";
import lottie, { type AnimationItem } from "lottie-web";
import { uid, newCanvasAsset, defaultSchedule } from "../../factory";
import { useStore } from "../../store";
import { Btn, EmptyHint, Field, NumberInput, Panel, Select, Toggle } from "../ui";
import { extractLottieColors, recolorLottie, toDataUrl, type ColorHit } from "../../vectorColorUtils";
import type { MediaAsset } from "../../types";

type LoopMode = "loop" | "once" | "count" | "segment";
const SPEEDS = [0.5, 1, 1.5, 2, 2.5];

function parseLottieDataUrl(dataUrl: string) {
  const raw = dataUrl.startsWith("data:") ? atob(dataUrl.split(",")[1]) : dataUrl;
  return JSON.parse(raw);
}

export default function LottieTab() {
  const data = useStore((s) => s.data())!;
  const selId = useStore((s) => s.selId);
  const previewRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("Lottie animation");
  const [json, setJson] = useState<any>(null);
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [colors, setColors] = useState<ColorHit[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [playing, setPlaying] = useState(true);
  const [loopMode, setLoopMode] = useState<LoopMode>("loop");
  const [loopCount, setLoopCount] = useState(3);
  const [speed, setSpeed] = useState(1);
  const [frame, setFrame] = useState(0);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [segmentStart, setSegmentStart] = useState(20);
  const [segmentEnd, setSegmentEnd] = useState(80);
  const [introEnd, setIntroEnd] = useState(20);

  const edited = json ? recolorLottie(json, map) : null;
  const totalFrames = Math.max(1, Math.round(edited?.op ?? 1));
  const fps = Math.max(1, edited?.fr ?? 60);
  const seconds = frame / fps;

  const loadJson = (parsed: any, nextName: string, mediaId: string | null = null) => {
    setName(nextName);
    setJson(parsed);
    setEditingMediaId(mediaId);
    const hits = extractLottieColors(parsed);
    setColors(hits);
    setMap(Object.fromEntries(hits.map((c) => [c.key, c.value])));
    setFrame(0);
    setPlaying(true);
    setIntroEnd(Math.min(20, Math.max(0, Math.round(parsed.op ?? 80))));
    setSegmentStart(Math.min(20, Math.max(0, Math.round(parsed.op ?? 80))));
    setSegmentEnd(Math.max(1, Math.round(parsed.op ?? 80)));
  };

  const loadSelected = () => {
    const asset = data.assets.find((a) => a.id === selId);
    const media = asset?.mediaId ? data.media.find((m) => m.id === asset.mediaId) : undefined;
    if (!media || media.type !== "lottie") return;
    loadJson(parseLottieDataUrl(media.dataUrl), media.name, media.id);
  };

  useEffect(() => {
    const asset = data.assets.find((a) => a.id === selId);
    const media = asset?.mediaId ? data.media.find((m) => m.id === asset.mediaId) : undefined;
    if (media?.type === "lottie" && !json) loadSelected();
  }, [selId]);

  const buildAnim = (container: HTMLDivElement) => {
    if (!edited) return null;
    const loop = loopMode === "loop" ? true : loopMode === "once" || loopMode === "segment" ? false : Math.max(1, Math.round(loopCount));
    const anim = lottie.loadAnimation({ container, renderer: "svg", autoplay: false, loop, animationData: edited });
    anim.setSpeed(speed);
    anim.addEventListener("enterFrame", (ev: any) => {
      const cur = ev.currentTime ?? anim.currentFrame;
      setFrame(Math.round(cur));
      if (loopMode === "segment" && cur >= segmentEnd) anim.goToAndPlay(segmentStart, true);
      if (loopMode === "segment" && cur < segmentStart && cur >= introEnd) anim.goToAndPlay(segmentStart, true);
    });
    anim.addEventListener("DOMLoaded", () => {
      if (loopMode === "segment") anim.playSegments([0, introEnd], true);
      else anim.goToAndStop(frame, true);
      if (playing) anim.play();
    });
    return anim;
  };

  useEffect(() => {
    if (!previewRef.current || !edited) return;
    animRef.current?.destroy();
    previewRef.current.innerHTML = "";
    const anim = buildAnim(previewRef.current);
    animRef.current = anim;
    return () => anim?.destroy();
  }, [edited, loopMode, loopCount, segmentStart, segmentEnd, introEnd]);

  useEffect(() => { animRef.current?.setSpeed(speed); }, [speed]);
  useEffect(() => { playing ? animRef.current?.play() : animRef.current?.pause(); }, [playing]);

  useEffect(() => {
    if (!showFullscreen || !fullRef.current || !edited) return;
    fullRef.current.innerHTML = "";
    const anim = buildAnim(fullRef.current);
    return () => anim?.destroy();
  }, [showFullscreen, edited, loopMode, speed, segmentStart, segmentEnd, introEnd]);

  const loadFile = async (file?: File) => {
    if (!file) return;
    loadJson(JSON.parse(await file.text()), file.name.replace(/\.json$/i, ""));
  };

  const seek = (f: number) => {
    const next = Math.max(0, Math.min(totalFrames, f));
    setFrame(next);
    animRef.current?.goToAndStop(next, true);
    setPlaying(false);
  };

  const saveToLibrary = (place = false) => {
    if (!edited) return;
    const w = edited.w || 500, h = edited.h || 500;
    const patch = { name, dataUrl: toDataUrl("application/json", JSON.stringify(edited)), width: w, height: h };
    if (editingMediaId) {
      useStore.getState().update((d) => { const m = d.media.find((x) => x.id === editingMediaId); if (m) Object.assign(m, patch); });
      return;
    }
    const media: MediaAsset = { id: uid(), name, type: "lottie", dataUrl: patch.dataUrl, width: w, height: h, categoryId: "static-assets", schedule: defaultSchedule(), inLibrary: false };
    useStore.getState().addMedia(media);
    if (place) {
      const layer = data.layers.find((l) => l.id === "layer-mid") ?? data.layers[0];
      const asset = newCanvasAsset(media.id, layer.id, media);
      useStore.getState().addAsset(asset); useStore.getState().select("asset", asset.id);
    }
  };

  return (
    <div className="space-y-2">
      <Panel title="Advanced Lottie JSON Player + Editor">
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => loadFile(e.target.files?.[0])} />
        <div className="grid grid-cols-2 gap-1.5">
          <Btn variant="primary" onClick={() => fileRef.current?.click()}>⬆ Import JSON</Btn>
          <Btn onClick={loadSelected}>Load selected</Btn>
        </div>
        {!json && <EmptyHint>Import or load selected Lottie to preview timeline, frames, speed, loops and recolor.</EmptyHint>}
        {json && <div className="space-y-2 pt-2">
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-100 outline-none" /></Field>
          <div ref={previewRef} className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-black/30" />
          <input type="range" min={0} max={totalFrames} value={frame} onChange={(e) => seek(parseFloat(e.target.value))} className="w-full accent-violet-500" />
          <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-400"><span>Frame: <b className="text-slate-200">{frame}/{totalFrames}</b></span><span>Seconds: <b className="text-slate-200">{seconds.toFixed(2)}s</b></span><span>FPS: <b className="text-slate-200">{fps}</b></span></div>
          <div className="grid grid-cols-3 gap-1.5"><Btn onClick={() => setPlaying(true)}>▶ Play</Btn><Btn onClick={() => { setPlaying(false); animRef.current?.pause(); }}>⏸ Pause</Btn><Btn onClick={() => { setPlaying(false); seek(0); }}>⏹ Stop</Btn></div>
          <div className="flex flex-wrap gap-1">{SPEEDS.map((s) => <button key={s} onClick={() => setSpeed(s)} className={`rounded px-2 py-1 text-[10px] ${speed === s ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>{s}x</button>)}</div>
          <Field label="Loop mode"><Select<LoopMode> value={loopMode} onChange={setLoopMode} options={[{ value: "loop", label: "Loop forever" }, { value: "once", label: "No loop / play once" }, { value: "count", label: "Loop count" }, { value: "segment", label: "Intro once, then loop segment" }]} /></Field>
          {loopMode === "count" && <Field label="How many loops"><NumberInput value={loopCount} onChange={setLoopCount} /></Field>}
          {loopMode === "segment" && <div className="grid grid-cols-3 gap-1.5"><Field label="Intro end"><NumberInput value={introEnd} onChange={setIntroEnd} /></Field><Field label="Loop from"><NumberInput value={segmentStart} onChange={setSegmentStart} /></Field><Field label="Loop to"><NumberInput value={segmentEnd} onChange={setSegmentEnd} /></Field><p className="col-span-3 text-[10px] text-amber-300/80">Experimental: one Lottie can only loop the whole animation segment. Truly keeping one layer still while only flowers loop requires that vine/flowers are authored as separate layers/precomps.</p></div>}
          {loopMode === "segment" && <Btn className="w-full" onClick={() => setShowFullscreen(true)}>⛶ Fullscreen segment preview</Btn>}
        </div>}
      </Panel>

      {json && <Panel title={`Lottie Colors (${colors.length})`} defaultCollapsed={false}>{!colors.length && <EmptyHint>No editable colors found.</EmptyHint>}<div className="space-y-1.5">{colors.map((c) => <div key={c.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md bg-slate-800/40 p-1.5 text-xs"><span className="font-mono text-slate-300">{c.key}</span><span className="h-6 w-6 rounded border border-slate-700" style={{ background: c.key }} /><input type="color" value={map[c.key] ?? c.value} onChange={(e) => setMap((m) => ({ ...m, [c.key]: e.target.value }))} className="h-7 w-10 rounded" /></div>)}</div><div className="mt-2 grid grid-cols-2 gap-1.5"><Btn onClick={() => setMap(Object.fromEntries(colors.map((c) => [c.key, c.key])))}>Reset colors</Btn><Btn variant="primary" onClick={() => saveToLibrary(false)}>{editingMediaId ? "Update asset" : "Save asset"}</Btn>{!editingMediaId && <Btn variant="primary" className="col-span-2" onClick={() => saveToLibrary(true)}>Save + place on canvas</Btn>}</div></Panel>}

      {showFullscreen && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-8 backdrop-blur"><div className="relative h-[80vh] w-[80vw] rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-2xl"><button onClick={() => setShowFullscreen(false)} className="absolute right-4 top-4 rounded bg-slate-800 px-3 py-1 text-sm text-white">✕ Close</button><div ref={fullRef} className="h-full w-full" /></div></div>}
    </div>
  );
}
