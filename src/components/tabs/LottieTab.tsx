import { useEffect, useRef, useState } from "react";
import lottie, { type AnimationItem } from "lottie-web";
import { uid, newCanvasAsset, defaultSchedule } from "../../factory";
import { useStore } from "../../store";
import { Btn, EmptyHint, Field, NumberInput, Panel, Select } from "../ui";
import { extractLottieColors, recolorLottie, toDataUrl, type ColorHit } from "../../vectorColorUtils";
import type { MediaAsset } from "../../types";

type LoopMode = "loop" | "once" | "count";
type SegmentFlow = "intro-loop" | "loop-outro";
const SPEEDS = [0.5, 1, 1.5, 2, 2.5];

function parseLottieDataUrl(dataUrl: string) {
  const raw = dataUrl.startsWith("data:") ? atob(dataUrl.split(",")[1]) : dataUrl;
  return JSON.parse(raw);
}

function clampFrame(value: number, total: number) {
  return Math.max(0, Math.min(total, Math.round(Number.isFinite(value) ? value : 0)));
}

export default function LottieTab() {
  const data = useStore((s) => s.data())!;
  const selId = useStore((s) => s.selId);
  const previewRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const fullAnimRef = useRef<AnimationItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("Lottie animation");
  const [json, setJson] = useState<any>(null);
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [colors, setColors] = useState<ColorHit[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [playing, setPlaying] = useState(false);
  const [loopMode, setLoopMode] = useState<LoopMode>("loop");
  const [loopCount, setLoopCount] = useState(3);
  const [speed, setSpeed] = useState(1);
  const [frame, setFrame] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [showSegmentPopup, setShowSegmentPopup] = useState(false);
  const [segmentFlow, setSegmentFlow] = useState<SegmentFlow>("intro-loop");
  const [loopFrom, setLoopFrom] = useState(20);
  const [loopTo, setLoopTo] = useState(80);

  const edited = json ? recolorLottie(json, map) : null;
  const totalFrames = Math.max(1, Math.round(edited?.op ?? 1));
  const fps = Math.max(1, edited?.fr ?? 60);
  const seconds = frame / fps;
  const safeLoopFrom = clampFrame(Math.min(loopFrom, loopTo - 1), totalFrames);
  const safeLoopTo = clampFrame(Math.max(loopTo, safeLoopFrom + 1), totalFrames);

  const syncFrame = (f: number) => setFrame(clampFrame(f, totalFrames));

  const loadJson = (parsed: any, nextName: string, mediaId: string | null = null) => {
    const total = Math.max(1, Math.round(parsed.op ?? 80));
    setName(nextName);
    setJson(parsed);
    setEditingMediaId(mediaId);
    const hits = extractLottieColors(parsed);
    setColors(hits);
    setMap(Object.fromEntries(hits.map((c) => [c.key, c.value])));
    setFrame(0);
    setPlaying(false);
    setLoopFrom(Math.min(20, total - 1));
    setLoopTo(total);
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

  const configureBasicLoop = (anim: AnimationItem) => {
    anim.loop = loopMode === "loop" ? true : loopMode === "once" ? false : Math.max(1, Math.round(loopCount)) as any;
  };

  const buildAnim = (container: HTMLDivElement, full = false) => {
    if (!edited) return null;
    container.innerHTML = "";
    const anim = lottie.loadAnimation({ container, renderer: "svg", autoplay: false, loop: false, animationData: edited });
    anim.setSpeed(speed);
    configureBasicLoop(anim);
    anim.addEventListener("enterFrame", (ev: any) => {
      if (scrubbing) return;
      const cur = ev.currentTime ?? anim.currentFrame;
      syncFrame(cur);
    });
    anim.addEventListener("complete", () => {
      if (loopMode === "loop") anim.goToAndPlay(0, true);
      else setPlaying(false);
    });
    anim.addEventListener("DOMLoaded", () => {
      anim.goToAndStop(clampFrame(frame, totalFrames), true);
      if (playing && !full) anim.play();
    });
    return anim;
  };

  useEffect(() => {
    if (!previewRef.current || !edited) return;
    animRef.current?.destroy();
    const anim = buildAnim(previewRef.current);
    animRef.current = anim;
    return () => anim?.destroy();
  }, [edited, loopMode, loopCount]);

  useEffect(() => {
    animRef.current?.setSpeed(speed);
    fullAnimRef.current?.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    if (playing) animRef.current?.play();
    else animRef.current?.pause();
  }, [playing]);

  useEffect(() => {
    if (!showSegmentPopup || !fullRef.current || !edited) return;
    fullAnimRef.current?.destroy();
    const anim = lottie.loadAnimation({ container: fullRef.current, renderer: "svg", autoplay: false, loop: false, animationData: edited });
    fullAnimRef.current = anim;
    anim.setSpeed(speed);
    anim.addEventListener("enterFrame", (ev: any) => {
      if (!scrubbing) syncFrame(ev.currentTime ?? anim.currentFrame);
      const cur = ev.currentFrame;
      if (segmentFlow === "intro-loop" && cur >= safeLoopTo) anim.playSegments([safeLoopFrom, safeLoopTo], true);
      if (segmentFlow === "loop-outro" && cur >= safeLoopTo && playing) anim.playSegments([safeLoopFrom, safeLoopTo], true);
    });
    anim.addEventListener("DOMLoaded", () => anim.goToAndStop(frame, true));
    return () => { anim.destroy(); fullAnimRef.current = null; };
  }, [showSegmentPopup, edited, speed, safeLoopFrom, safeLoopTo, segmentFlow]);

  const loadFile = async (file?: File) => {
    if (!file) return;
    loadJson(JSON.parse(await file.text()), file.name.replace(/\.json$/i, ""));
  };

  const seek = (f: number, target: "main" | "full" | "both" = "both") => {
    const next = clampFrame(f, totalFrames);
    setFrame(next);
    if (target === "main" || target === "both") animRef.current?.goToAndStop(next, true);
    if (target === "full" || target === "both") fullAnimRef.current?.goToAndStop(next, true);
    setPlaying(false);
  };

  const togglePlay = () => {
    const next = !playing;
    setPlaying(next);
    if (next) animRef.current?.play();
    else animRef.current?.pause();
  };

  const stop = () => {
    setPlaying(false);
    seek(0);
  };

  const playSegmentPreview = () => {
    const anim = fullAnimRef.current;
    if (!anim) return;
    setPlaying(true);
    if (segmentFlow === "intro-loop") anim.playSegments([[0, safeLoopFrom], [safeLoopFrom, safeLoopTo]], true);
    else anim.playSegments([safeLoopFrom, safeLoopTo], true);
  };

  const playOutroOnce = () => {
    const anim = fullAnimRef.current;
    if (!anim) return;
    setPlaying(true);
    anim.playSegments([safeLoopTo, totalFrames], true);
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

  const Timeline = ({ target = "both" as "main" | "full" | "both" }) => (
    <input
      type="range"
      min={0}
      max={totalFrames}
      step={1}
      value={frame}
      onPointerDown={() => setScrubbing(true)}
      onPointerUp={() => setScrubbing(false)}
      onChange={(e) => seek(parseFloat(e.target.value), target)}
      onInput={(e) => seek(parseFloat((e.target as HTMLInputElement).value), target)}
      className="w-full accent-violet-500"
    />
  );

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
          <Timeline />
          <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-400"><span>Frame: <b className="text-slate-200">{frame}/{totalFrames}</b></span><span>Seconds: <b className="text-slate-200">{seconds.toFixed(2)}s</b></span><span>FPS: <b className="text-slate-200">{fps}</b></span></div>
          <div className="grid grid-cols-2 gap-1.5"><Btn variant="primary" onClick={togglePlay}>{playing ? "⏸ Pause" : "▶ Play"}</Btn><Btn onClick={stop}>⏹ Stop</Btn></div>
          <div className="flex flex-wrap gap-1">{SPEEDS.map((s) => <button key={s} onClick={() => setSpeed(s)} className={`rounded px-2 py-1 text-[10px] ${speed === s ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>{s}x</button>)}</div>
          <Field label="Loop mode"><Select<LoopMode> value={loopMode} onChange={setLoopMode} options={[{ value: "loop", label: "Loop forever" }, { value: "once", label: "No loop / play once" }, { value: "count", label: "Loop count" }]} /></Field>
          {loopMode === "count" && <Field label="How many loops"><NumberInput value={loopCount} onChange={setLoopCount} /></Field>}
          <Btn className="w-full" onClick={() => setShowSegmentPopup(true)}>⛶ Fullscreen segment preview / loop setup</Btn>
        </div>}
      </Panel>

      {json && <Panel title={`Lottie Colors (${colors.length})`} defaultCollapsed={false}>{!colors.length && <EmptyHint>No editable colors found.</EmptyHint>}<div className="space-y-1.5">{colors.map((c) => <div key={c.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md bg-slate-800/40 p-1.5 text-xs"><span className="font-mono text-slate-300">{c.key}</span><span className="h-6 w-6 rounded border border-slate-700" style={{ background: c.key }} /><input type="color" value={map[c.key] ?? c.value} onChange={(e) => setMap((m) => ({ ...m, [c.key]: e.target.value }))} className="h-7 w-10 rounded" /></div>)}</div><div className="mt-2 grid grid-cols-2 gap-1.5"><Btn onClick={() => setMap(Object.fromEntries(colors.map((c) => [c.key, c.key])))}>Reset colors</Btn><Btn variant="primary" onClick={() => saveToLibrary(false)}>{editingMediaId ? "Update asset" : "Save asset"}</Btn>{!editingMediaId && <Btn variant="primary" className="col-span-2" onClick={() => saveToLibrary(true)}>Save + place on canvas</Btn>}</div></Panel>}

      {showSegmentPopup && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-5 backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
        <div className="relative flex h-[90vh] w-[88vw] flex-col rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-2xl">
          <button type="button" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowSegmentPopup(false); }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowSegmentPopup(false); }} className="absolute right-4 top-4 z-[10002] rounded bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700">✕ Close</button>
          <div ref={fullRef} className="min-h-0 flex-1 overflow-hidden rounded-xl bg-black/40" />
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
            <Timeline target="full" />
            <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-slate-300"><span>Frame: <b>{frame}/{totalFrames}</b></span><span>Seconds: <b>{seconds.toFixed(2)}s</b></span><span>FPS: <b>{fps}</b></span></div>
            <div className="mt-2 grid grid-cols-4 gap-2"><Btn variant="primary" onClick={playSegmentPreview}>▶ Play segment</Btn><Btn onClick={() => { fullAnimRef.current?.pause(); setPlaying(false); }}>⏸ Pause</Btn><Btn onClick={() => { fullAnimRef.current?.stop(); seek(0, "full"); }}>⏹ Stop</Btn>{segmentFlow === "loop-outro" && <Btn onClick={playOutroOnce}>Play outro 1x</Btn>}</div>
            <div className="mt-2 flex flex-wrap gap-1">{SPEEDS.map((s) => <button key={s} onClick={() => setSpeed(s)} className={`rounded px-2 py-1 text-[10px] ${speed === s ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>{s}x</button>)}</div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <Field label="Segment style"><Select<SegmentFlow> value={segmentFlow} onChange={setSegmentFlow} options={[{ value: "intro-loop", label: "Intro then loop" }, { value: "loop-outro", label: "Loop then outro" }]} /></Field>
              <Field label="Loop from"><NumberInput value={loopFrom} onChange={(v) => setLoopFrom(clampFrame(v, totalFrames))} /></Field>
              <Field label="Loop to"><NumberInput value={loopTo} onChange={(v) => setLoopTo(clampFrame(v, totalFrames))} /></Field>
              <Field label="Current frame"><NumberInput value={frame} onChange={(v) => seek(v, "full")} /></Field>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2"><Btn onClick={() => setLoopFrom(frame)}>Set current → Loop from</Btn><Btn onClick={() => setLoopTo(frame)}>Set current → Loop to</Btn><Btn onClick={() => { setLoopFrom(frame); setLoopTo(totalFrames); }}>Current → loop start to end</Btn></div>
            <p className="mt-2 text-[10px] text-amber-300/80">Experimental: this loops a full Lottie frame segment. Independent still+loop per object requires the Lottie to be authored as separate layers/precomps.</p>
          </div>
        </div>
      </div>}
    </div>
  );
}
