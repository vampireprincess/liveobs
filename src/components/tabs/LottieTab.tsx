import { useEffect, useMemo, useRef, useState } from "react";
import lottie, { type AnimationItem } from "lottie-web";
import { uid, newCanvasAsset, defaultSchedule } from "../../factory";
import { useStore } from "../../store";
import { Btn, EmptyHint, Field, NumberInput, Panel, Select } from "../ui";
import { extractLottieColors, recolorLottie, toDataUrl, type ColorHit } from "../../vectorColorUtils";
import type { MediaAsset } from "../../types";

type LoopMode = "loop" | "once" | "count";
type SegmentFlow = "intro-loop" | "loop-outro";
type PlayerTarget = "main" | "full" | "both";
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
  const scrubbingRef = useRef(false);
  const segmentLoopActiveRef = useRef(false);
  const fullNormalLoopRef = useRef(false);
  const fullRafRef = useRef<number | null>(null);
  const fullFrameRef = useRef(0);
  const fullPlaybackModeRef = useRef<"none" | "normal" | "segment">("none");
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("Lottie animation");
  const [json, setJson] = useState<any>(null);
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [colors, setColors] = useState<ColorHit[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [playing, setPlaying] = useState(false);
  const [fullPlaying, setFullPlaying] = useState(false);
  const [segmentPlaying, setSegmentPlaying] = useState(false);
  const [loopMode, setLoopMode] = useState<LoopMode>("loop");
  const [loopCount, setLoopCount] = useState(3);
  const [speed, setSpeed] = useState(1);
  const [frame, setFrame] = useState(0);
  const [showSegmentPopup, setShowSegmentPopup] = useState(false);
  const [segmentFlow, setSegmentFlow] = useState<SegmentFlow>("intro-loop");
  const [loopFrom, setLoopFrom] = useState(20);
  const [loopTo, setLoopTo] = useState(80);
  const [segmentSaved, setSegmentSaved] = useState(false);

  const edited = useMemo(() => (json ? recolorLottie(json, map) : null), [json, map]);
  const totalFrames = Math.max(1, Math.round(edited?.op ?? 1));
  const fps = Math.max(1, edited?.fr ?? 60);
  const seconds = frame / fps;
  const safeLoopFrom = clampFrame(Math.min(loopFrom, loopTo - 1), totalFrames);
  const safeLoopTo = clampFrame(Math.max(loopTo, safeLoopFrom + 1), totalFrames);

  const syncFrame = (f: number) => { const next = clampFrame(f, totalFrames); fullFrameRef.current = next; setFrame(next); };

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
    setFullPlaying(false);
    setSegmentPlaying(false);
    setLoopFrom(Math.min(20, total - 1));
    setLoopTo(total);
    setSegmentSaved(false);
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

  const buildMainAnim = (container: HTMLDivElement) => {
    if (!edited) return null;
    container.innerHTML = "";
    const anim = lottie.loadAnimation({ container, renderer: "svg", autoplay: false, loop: false, animationData: edited });
    anim.setSpeed(speed);
    anim.setSubframe(true);
    configureBasicLoop(anim);
    anim.addEventListener("enterFrame", (ev: any) => { if (!scrubbingRef.current) syncFrame(ev.currentTime ?? anim.currentFrame); });
    anim.addEventListener("complete", () => { if (loopMode === "loop") anim.goToAndPlay(0, true); else setPlaying(false); });
    anim.addEventListener("DOMLoaded", () => anim.goToAndStop(clampFrame(frame, totalFrames), true));
    return anim;
  };

  useEffect(() => {
    if (!previewRef.current || !edited) return;
    animRef.current?.destroy();
    animRef.current = buildMainAnim(previewRef.current);
    return () => animRef.current?.destroy();
  }, [edited, loopMode, loopCount]);

  useEffect(() => { animRef.current?.setSpeed(speed); fullAnimRef.current?.setSpeed(speed); }, [speed]);
  useEffect(() => { playing ? animRef.current?.play() : animRef.current?.pause(); }, [playing]);
  useEffect(() => { if (fullPlaybackModeRef.current === "none") fullFrameRef.current = frame; }, [frame]);

  const stopFullPlayback = () => {
    if (fullRafRef.current !== null) cancelAnimationFrame(fullRafRef.current);
    fullRafRef.current = null;
    fullPlaybackModeRef.current = "none";
    segmentLoopActiveRef.current = false;
    fullNormalLoopRef.current = false;
    setFullPlaying(false);
    setSegmentPlaying(false);
  };

  const startFullPlayback = (mode: "normal" | "segment") => {
    const anim = fullAnimRef.current;
    if (!anim) return;
    stopFullPlayback();
    const start = mode === "segment" ? safeLoopFrom : (frame >= totalFrames - 1 ? 0 : frame);
    fullFrameRef.current = start;
    setFrame(start);
    anim.goToAndStop(start, true);
    fullPlaybackModeRef.current = mode;
    segmentLoopActiveRef.current = mode === "segment";
    fullNormalLoopRef.current = mode === "normal";
    setFullPlaying(true);
    setSegmentPlaying(mode === "segment");
    let last = performance.now();
    const tick = (ts: number) => {
      const dt = Math.max(0, Math.min(0.1, (ts - last) / 1000));
      last = ts;
      let next = fullFrameRef.current + dt * fps * speed;
      if (mode === "segment") {
        const length = Math.max(1, safeLoopTo - safeLoopFrom);
        if (next >= safeLoopTo - 1) next = safeLoopFrom + ((next - safeLoopFrom) % length);
      } else if (next >= totalFrames - 1) {
        next = next % Math.max(1, totalFrames - 1);
      }
      fullFrameRef.current = next;
      setFrame(Math.floor(next));
      anim.goToAndStop(next, true);
      fullRafRef.current = requestAnimationFrame(tick);
    };
    fullRafRef.current = requestAnimationFrame(tick);
  };


  useEffect(() => {
    if (!showSegmentPopup || !fullRef.current || !edited) return;
    fullAnimRef.current?.destroy();
    fullRef.current.innerHTML = "";
    const anim = lottie.loadAnimation({ container: fullRef.current, renderer: "svg", autoplay: false, loop: false, animationData: edited });
    fullAnimRef.current = anim;
    anim.setSpeed(speed);
    anim.setSubframe(true);
    anim.addEventListener("enterFrame", (ev: any) => { if (!scrubbingRef.current && fullPlaybackModeRef.current === "none") syncFrame(ev.currentTime ?? anim.currentFrame); });
    anim.addEventListener("DOMLoaded", () => anim.goToAndStop(frame, true));
    return () => { anim.destroy(); fullAnimRef.current = null; };
  }, [showSegmentPopup, edited]);

  const loadFile = async (file?: File) => {
    if (!file) return;
    loadJson(JSON.parse(await file.text()), file.name.replace(/\.json$/i, ""));
  };

  const seek = (f: number, target: PlayerTarget = "both") => {
    const next = clampFrame(f, totalFrames);
    setFrame(next);
    if (target === "main" || target === "both") animRef.current?.goToAndStop(next, true);
    if (target === "full" || target === "both") fullAnimRef.current?.goToAndStop(next, true);
    setPlaying(false);
    stopFullPlayback();
  };

  const togglePlayStop = (target: PlayerTarget = "main") => {
    if (target === "full") {
      if (fullPlaybackModeRef.current === "normal") stopFullPlayback();
      else startFullPlayback("normal");
      return;
    }
    const anim = animRef.current;
    if (!anim) return;
    const shouldPlay = anim.isPaused;
    setPlaying(shouldPlay);
    if (shouldPlay) {
      const start = clampFrame(frame, totalFrames);
      if (start >= totalFrames - 1) anim.goToAndStop(0, true);
      else anim.goToAndStop(start, true);
      anim.play();
    } else {
      anim.pause();
      syncFrame(anim.currentFrame);
    }
  };

  const stepFrame = (delta: number) => seek(frame + delta, showSegmentPopup ? "full" : "main");

  const playSegmentPreview = () => {
    if (fullPlaybackModeRef.current === "segment") stopFullPlayback();
    else startFullPlayback("segment");
  };

  const playOutroOnce = () => {
    const anim = fullAnimRef.current;
    if (!anim) return;
    stopFullPlayback();
    setFullPlaying(true);
    anim.playSegments([safeLoopTo, totalFrames], true);
  };

  const saveSegment = () => {
    setLoopFrom(safeLoopFrom);
    setLoopTo(safeLoopTo);
    setSegmentSaved(true);
    window.setTimeout(() => setSegmentSaved(false), 1500);
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

  const Timeline = ({ target = "both" as PlayerTarget }) => (
    <input
      type="range"
      min={0}
      max={totalFrames}
      step={1}
      value={frame}
      onPointerDown={(e) => { e.stopPropagation(); scrubbingRef.current = true; setPlaying(false); if (target !== "full") animRef.current?.pause(); else { stopFullPlayback(); fullAnimRef.current?.pause(); } }}
      onPointerUp={(e) => { e.stopPropagation(); scrubbingRef.current = false; }}
      onPointerCancel={() => { scrubbingRef.current = false; }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => seek(parseFloat(e.target.value), target)}
      onInput={(e) => seek(parseFloat((e.target as HTMLInputElement).value), target)}
      className="h-8 w-full cursor-pointer accent-violet-500"
      style={{ pointerEvents: "auto" }}
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
          <Btn variant="primary" className="w-full" onClick={() => togglePlayStop("main")}>{playing ? "⏸ Stop" : "▶ Play"}</Btn>
          <div className="flex flex-wrap gap-1">{SPEEDS.map((s) => <button key={s} onClick={() => setSpeed(s)} className={`rounded px-2 py-1 text-[10px] ${speed === s ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>{s}x</button>)}</div>
          <Field label="Loop mode"><Select<LoopMode> value={loopMode} onChange={setLoopMode} options={[{ value: "loop", label: "Loop forever" }, { value: "once", label: "No loop / play once" }, { value: "count", label: "Loop count" }]} /></Field>
          {loopMode === "count" && <Field label="How many loops"><NumberInput value={loopCount} onChange={setLoopCount} /></Field>}
          <Btn className="w-full" onClick={() => setShowSegmentPopup(true)}>⛶ Fullscreen lottie timeline</Btn>
        </div>}
      </Panel>

      {json && <Panel title={`Lottie Colors (${colors.length})`} defaultCollapsed={false}>{!colors.length && <EmptyHint>No editable colors found.</EmptyHint>}<div className="space-y-1.5">{colors.map((c) => <div key={c.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md bg-slate-800/40 p-1.5 text-xs"><span className="font-mono text-slate-300">{c.key}</span><span className="h-6 w-6 rounded border border-slate-700" style={{ background: c.key }} /><input type="color" value={map[c.key] ?? c.value} onChange={(e) => setMap((m) => ({ ...m, [c.key]: e.target.value }))} className="h-7 w-10 rounded" /></div>)}</div><div className="mt-2 grid grid-cols-2 gap-1.5"><Btn onClick={() => setMap(Object.fromEntries(colors.map((c) => [c.key, c.key])))}>Reset colors</Btn><Btn variant="primary" onClick={() => saveToLibrary(false)}>{editingMediaId ? "Update asset" : "Save asset"}</Btn>{!editingMediaId && <Btn variant="primary" className="col-span-2" onClick={() => saveToLibrary(true)}>Save + place on canvas</Btn>}</div></Panel>}

      {showSegmentPopup && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-5 backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
        <div className="relative flex resize flex-col overflow-auto rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-2xl" style={{ width: "88vw", height: "90vh", minWidth: 520, minHeight: 520, maxWidth: "96vw", maxHeight: "96vh" }}>
          <button type="button" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); stopFullPlayback(); setShowSegmentPopup(false); }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); stopFullPlayback(); setShowSegmentPopup(false); }} className="absolute right-4 top-4 z-[10002] rounded bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700">✕ Close</button>
          <div ref={fullRef} className="min-h-[240px] flex-1 overflow-hidden rounded-xl bg-black/40" />
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
            <Timeline target="full" />
            <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-slate-300"><span>Frame: <b>{frame}/{totalFrames}</b></span><span>Seconds: <b>{seconds.toFixed(2)}s</b></span><span>FPS: <b>{fps}</b></span></div>
            <div className="mt-2 grid grid-cols-5 gap-2"><Btn onClick={() => stepFrame(-1)}>◀ Frame</Btn><Btn variant="primary" onClick={() => togglePlayStop("full")}>{fullPlaying ? "⏸ Stop" : "▶ Play"}</Btn><Btn onClick={() => stepFrame(1)}>Frame ▶</Btn><Btn onClick={playSegmentPreview}>{segmentPlaying ? "Stop segment" : "Play segment"}</Btn>{segmentFlow === "loop-outro" && <Btn onClick={playOutroOnce}>Play outro 1x</Btn>}</div>
            <div className="mt-2 flex flex-wrap gap-1">{SPEEDS.map((s) => <button key={s} onClick={() => setSpeed(s)} className={`rounded px-2 py-1 text-[10px] ${speed === s ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>{s}x</button>)}</div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <Field label="Segment style"><Select<SegmentFlow> value={segmentFlow} onChange={setSegmentFlow} options={[{ value: "intro-loop", label: "Intro then loop" }, { value: "loop-outro", label: "Loop then outro" }]} /></Field>
              <Field label="Loop from"><NumberInput value={loopFrom} onChange={(v) => { setLoopFrom(clampFrame(v, totalFrames)); setSegmentSaved(false); }} /></Field>
              <Field label="Loop to"><NumberInput value={loopTo} onChange={(v) => { setLoopTo(clampFrame(v, totalFrames)); setSegmentSaved(false); }} /></Field>
              <Field label="Current frame"><NumberInput value={frame} onChange={(v) => seek(v, "full")} /></Field>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2"><Btn onClick={() => { setLoopFrom(frame); setSegmentSaved(false); }}>Set current → Loop from</Btn><Btn onClick={() => { setLoopTo(frame); setSegmentSaved(false); }}>Set current → Loop to</Btn><Btn onClick={() => { setLoopFrom(frame); setLoopTo(totalFrames); setSegmentSaved(false); }}>Current → loop start to end</Btn><Btn variant="primary" onClick={saveSegment}>{segmentSaved ? "✓ Saved" : "Save segment"}</Btn></div>
            <p className="mt-2 text-[10px] text-amber-300/80">Experimental: this loops a full Lottie frame segment. Independent still+loop per object requires the Lottie to be authored as separate layers/precomps.</p>
          </div>
        </div>
      </div>}
    </div>
  );
}
