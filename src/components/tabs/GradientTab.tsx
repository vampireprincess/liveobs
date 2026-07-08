import { useRef, useState, useEffect } from "react";
import { useStore } from "../../store";
import { Panel, Slider, Select, Toggle, Btn } from "../ui";
import GradientBar from "../GradientBar";
import { uid, newCanvasAsset, defaultSchedule } from "../../factory";
import type { GradientConfig, GradientMode, SavedGradient, SavedPalette, ColorStop } from "../../types";
import { computeGradientAnim } from "../../gradientMath";
import {
  extractColorsFromImage,
  loadSavedGradients,
  saveSavedGradients,
  loadSavedPalettes,
  saveSavedPalettes,
} from "../../paletteUtils";

// Direction presets that map to gradient type+angle
const MODERN_PRESETS: { name: string; colors: string[]; type?: GradientConfig["type"]; angle?: number }[] = [
  { name: "Aurora", colors: ["#22d3ee", "#a855f7", "#f472b6"], angle: 135 },
  { name: "Sunset", colors: ["#f97316", "#ec4899", "#7c3aed"], angle: 45 },
  { name: "Cyber", colors: ["#00f5ff", "#0614ff", "#ff00e5"], angle: 120 },
  { name: "Mint", colors: ["#d9f99d", "#34d399", "#0f766e"], angle: 90 },
  { name: "Fire", colors: ["#7f1d1d", "#ef4444", "#facc15"], angle: 35 },
  { name: "Ocean", colors: ["#020617", "#0369a1", "#67e8f9"], angle: 160 },
  { name: "Peach", colors: ["#fff7ed", "#fdba74", "#fb7185"], angle: 70 },
  { name: "Galaxy", colors: ["#0f172a", "#4c1d95", "#db2777", "#fde68a"], type: "radial" },
  { name: "Lime", colors: ["#1a2e05", "#65a30d", "#ecfccb"], angle: 110 },
  { name: "Ice", colors: ["#e0f2fe", "#38bdf8", "#312e81"], angle: 180 },
];

const DIRECTIONS: { type: GradientConfig["type"]; angle: number }[] = [
  { type: "linear", angle: 0 },
  { type: "linear", angle: 45 },
  { type: "linear", angle: 90 },
  { type: "linear", angle: 135 },
  { type: "linear", angle: 180 },
  { type: "linear", angle: 225 },
  { type: "linear", angle: 270 },
  { type: "linear", angle: 315 },
  { type: "conic", angle: 0 },
  { type: "radial", angle: 0 },
];

function getGradientCss(g: GradientConfig, angleOverride?: number, typeOverride?: GradientConfig["type"]): string {
  const type = typeOverride || g.type;
  const angle = angleOverride !== undefined ? angleOverride : g.angle;
  const stops = [...g.stops].sort((a, b) => a.offset - b.offset).map((s) => `${s.color} ${(s.offset * 100).toFixed(0)}%`).join(", ");
  if (type === "radial") return `radial-gradient(circle, ${stops})`;
  if (type === "conic") return `conic-gradient(from ${angle}deg, ${stops})`;
  return `linear-gradient(${angle}deg, ${stops})`;
}

/** Live-animated swatch that shows the gradient exactly as it will look/animate at runtime. */
function LiveGradientPreview({ g }: { g: GradientConfig }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!g.animate) {
      if (ref.current) ref.current.style.background = getGradientCss(g);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const el = ref.current;
      if (!el) return;
      const anim = computeGradientAnim(g, (ts - start) / 1000);
      const animType = g.animType || (g.type === "linear" ? "rotation" : "hue");
      if (animType === "panning") {
        el.style.backgroundSize = g.type === "linear" ? "220% 220%" : "100% 100%";
        el.style.backgroundPosition = `${anim.panPercent}% 50%`;
        el.style.background = getGradientCss(g);
      } else if (animType === "hue") {
        el.style.background = getGradientCss({ ...g, stops: g.stops.map((s) => ({ ...s })) });
        // apply hue shift via filter for a cheap live preview
        el.style.filter = anim.hueShift ? `hue-rotate(${anim.hueShift}deg)` : "none";
      } else {
        el.style.filter = "none";
        el.style.background = getGradientCss(g, anim.angle);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [g]);
  return <div ref={ref} className="h-16 w-full rounded-lg border border-slate-700" style={{ background: getGradientCss(g) }} />;
}

export default function GradientTab() {
  const data = useStore((s) => s.data())!;
  const upd = useStore.getState().update;
  const studio = data.gradientStudio ?? {
    mode: "off" as GradientMode,
    gradient: { enabled: true, type: "linear", angle: 135, stops: [], animate: true, speed: 20, animType: "rotation" },
  };
  const g = studio.gradient;

  const setStudio = (patch: Partial<typeof studio>) =>
    upd((d) => {
      d.gradientStudio = { ...(d.gradientStudio ?? studio), ...patch };
    });
  const setGrad = (patch: Partial<GradientConfig>) =>
    upd((d) => {
      const cur = d.gradientStudio ?? studio;
      const nextGradient = { ...cur.gradient, ...patch };
      d.gradientStudio = { ...cur, gradient: nextGradient };
      d.assets.forEach((a) => { if (a.gradient) a.gradient = structuredClone(nextGradient); });
    });

  const applyModernPreset = (preset: typeof MODERN_PRESETS[number]) => {
    const stops = preset.colors.map((color, i) => ({ id: uid(), color, offset: preset.colors.length === 1 ? 0 : i / (preset.colors.length - 1) }));
    setGrad({ stops, type: preset.type ?? "linear", angle: preset.angle ?? g.angle });
  };

  const addGradientAsLayerAsset = () => {
    const css = getGradientCss(g);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${data.canvasWidth}" height="${data.canvasHeight}" viewBox="0 0 ${data.canvasWidth} ${data.canvasHeight}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;background:${css};"></div></foreignObject></svg>`;
    const encoded = btoa(unescape(encodeURIComponent(svg)));
    const dataUrl = `data:image/svg+xml;base64,${encoded}`;
    const existingAsset = data.assets.find((a) => a.name === "Gradient Layer" && data.media.find((m) => m.id === a.mediaId)?.name === "Gradient Layer");
    const existingMediaId = existingAsset?.mediaId;
    if (existingAsset && existingMediaId) {
      useStore.getState().update((d) => {
        const media = d.media.find((m) => m.id === existingMediaId);
        if (media) Object.assign(media, { dataUrl, width: d.canvasWidth, height: d.canvasHeight });
        const asset = d.assets.find((a) => a.id === existingAsset.id);
        if (asset) Object.assign(asset, { gradient: structuredClone(g), fit: "fill" });
      });
      useStore.getState().select("asset", existingAsset.id);
      return;
    }
    const media = {
      id: uid(),
      name: "Gradient Layer",
      type: "svg" as const,
      dataUrl,
      width: data.canvasWidth,
      height: data.canvasHeight,
      categoryId: "static-assets",
      schedule: defaultSchedule(),
      inLibrary: false,
    };
    useStore.getState().addMedia(media);
    const layer = data.layers.find((l) => l.id === "layer-bg") ?? data.layers[0];
    const asset = newCanvasAsset(media.id, layer.id, media);
    Object.assign(asset, { x: 0, y: 0, width: data.canvasWidth, height: data.canvasHeight, name: "Gradient Layer", fit: "fill" as const, opacity: 0.65, blend: "overlay" as const, gradient: structuredClone(g) });
    useStore.getState().addAsset(asset);
    useStore.getState().select("asset", asset.id);
  };

  // ---- color palette ----
  const fileRef = useRef<HTMLInputElement>(null);
  const [paletteColors, setPaletteColors] = useState<string[]>([]);
  const [activeColors, setActiveColors] = useState<boolean[]>([]);
  const [numColors, setNumColors] = useState(6);
  const [lastImage, setLastImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [savedPalettes, setSavedPalettes] = useState<SavedPalette[]>([]);
  const [savedGradients, setSavedGradients] = useState<SavedGradient[]>([]);

  useEffect(() => {
    setSavedPalettes(loadSavedPalettes());
    setSavedGradients(loadSavedGradients());
  }, []);

  const runExtract = async (dataUrl: string, n: number) => {
    setBusy(true);
    const colors = await extractColorsFromImage(dataUrl, n);
    setPaletteColors(colors);
    setActiveColors(colors.map(() => true));
    setBusy(false);
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setLastImage(url);
      runExtract(url, numColors);
    };
    reader.readAsDataURL(file);
  };

  const enabledColors = paletteColors.filter((_, i) => activeColors[i]);

  const makeGradientFromPalette = () => {
    if (enabledColors.length < 2) return;
    const stops: ColorStop[] = enabledColors.map((c, i) => ({
      id: uid(),
      color: c,
      offset: enabledColors.length === 1 ? 0 : i / (enabledColors.length - 1),
    }));
    setGrad({ stops });
    if (studio.mode === "off") setStudio({ mode: "background" });
  };

  const savePalette = () => {
    if (!enabledColors.length) return;
    const p: SavedPalette = { id: uid(), name: "Palette " + (savedPalettes.length + 1), colors: enabledColors };
    const next = [p, ...savedPalettes];
    setSavedPalettes(next);
    saveSavedPalettes(next);
  };

  const applySavedPalette = (p: SavedPalette) => {
    setPaletteColors(p.colors);
    setActiveColors(p.colors.map(() => true));
  };

  const deleteSavedPalette = (id: string) => {
    const next = savedPalettes.filter((p) => p.id !== id);
    setSavedPalettes(next);
    saveSavedPalettes(next);
  };

  const saveGradient = () => {
    const sg: SavedGradient = { id: uid(), name: "Gradient " + (savedGradients.length + 1), gradient: g };
    const next = [sg, ...savedGradients];
    setSavedGradients(next);
    saveSavedGradients(next);
  };

  const applySavedGradient = (sg: SavedGradient) => {
    setGrad({ ...sg.gradient });
  };

  const deleteSavedGradient = (id: string) => {
    const next = savedGradients.filter((s) => s.id !== id);
    setSavedGradients(next);
    saveSavedGradients(next);
  };

  return (
    <div>
      {/* ============ COLOR PALETTE ============ */}
      <Panel title="🎨 Color Palette (from image)">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onUpload(e.target.files?.[0])} />
        <Btn className="w-full" onClick={() => fileRef.current?.click()}>⬆ Upload Image</Btn>
        {lastImage && (
          <img src={lastImage} className="mt-2 h-16 w-full rounded object-cover" alt="source" />
        )}
        <div className="mt-1">
          <Slider
            label={`Extract colors: ${numColors}`}
            min={2}
            max={20}
            value={numColors}
            onChange={(v) => {
              setNumColors(v);
              if (lastImage) runExtract(lastImage, v);
            }}
          />
        </div>
        {busy && <p className="text-[10px] text-violet-300">Extracting…</p>}
        {paletteColors.length > 0 && (
          <>
            <p className="text-[9px] text-slate-500">Click a swatch to toggle it on/off before saving or building a gradient.</p>
            <div className="grid grid-cols-8 gap-1">
              {paletteColors.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setActiveColors((a) => a.map((v, idx) => (idx === i ? !v : v)))}
                  title={c}
                  className={`aspect-square rounded border-2 ${activeColors[i] ? "border-white" : "border-transparent opacity-25"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Btn onClick={savePalette}>💾 Save Swatch</Btn>
              <Btn variant="primary" onClick={makeGradientFromPalette}>→ Make Gradient</Btn>
            </div>
          </>
        )}

        {savedPalettes.length > 0 && (
          <div>
            <div className="mb-1 mt-2 text-[9px] uppercase tracking-wide text-slate-500">Saved Palettes</div>
            <div className="space-y-1">
              {savedPalettes.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-800/40 p-1">
                  <div className="flex h-5 flex-1 overflow-hidden rounded">
                    {p.colors.map((c, i) => (
                      <div key={i} className="flex-1" style={{ background: c }} />
                    ))}
                  </div>
                  <button onClick={() => applySavedPalette(p)} className="rounded bg-slate-700 px-1.5 py-0.5 text-[9px] text-slate-100 hover:bg-slate-600">Use</button>
                  <button onClick={() => deleteSavedPalette(p.id)} className="rounded px-1 text-[10px] text-rose-400 hover:bg-rose-900/40">×</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {/* ============ GRADIENT STUDIO ============ */}
      <Panel title="🌈 Gradient Studio">
        {/* live, real-time animated preview */}
        <LiveGradientPreview g={g} />
        <div>
          <div className="mb-1 text-[9px] uppercase tracking-wide text-slate-500">Modern presets</div>
          <div className="grid grid-cols-5 gap-1.5">
            {MODERN_PRESETS.map((preset) => (
              <button
                key={preset.name}
                title={preset.name}
                onClick={() => applyModernPreset(preset)}
                className="aspect-square rounded-md border border-slate-700 hover:border-violet-400"
                style={{ background: preset.type === "radial" ? `radial-gradient(circle, ${preset.colors.join(", ")})` : `linear-gradient(${preset.angle ?? 135}deg, ${preset.colors.join(", ")})` }}
              />
            ))}
          </div>
        </div>
        <Btn className="w-full" onClick={addGradientAsLayerAsset}>➕ Add current gradient as canvas layer asset</Btn>
        <p className="text-[10px] text-slate-500">Creates a full-canvas gradient layer asset, so you can reorder it with images and use opacity/blend mode in the Asset Inspector.</p>

        <div>
          <div className="mb-1 text-[9px] uppercase tracking-wide text-slate-500">Apply Gradient To</div>
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                { v: "off", label: "Off" },
                { v: "background", label: "Background" },
                { v: "particles", label: "Particles" },
                { v: "hybrid", label: "Hybrid (both)" },
              ] as { v: GradientMode; label: string }[]
            ).map((m) => (
              <button
                key={m.v}
                onClick={() => { setStudio({ mode: m.v }); if (m.v === "background" || m.v === "hybrid") window.setTimeout(addGradientAsLayerAsset, 0); }}
                className={`rounded border px-1 py-1.5 text-[10px] font-medium ${
                  studio.mode === m.v ? "border-violet-500 bg-violet-500/20 text-violet-200" : "border-slate-700 bg-slate-800/40 text-slate-300"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {studio.mode === "particles" && (
            <p className="mt-1 text-[9px] text-slate-500">Particles pull colors from the gradient as they move (background stays solid).</p>
          )}
          {studio.mode === "hybrid" && (
            <p className="mt-1 text-[9px] text-slate-500">Animated gradient background AND particles tinted from the same gradient.</p>
          )}
        </div>

        <GradientBar stops={g.stops} onChange={(stops) => setGrad({ stops })} />

        {/* Animation */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
          <Toggle label="Animated" checked={g.animate} onChange={(v) => setGrad({ animate: v })} />
          {g.animate && (
            <div className="mt-2 space-y-2">
              <div>
                <div className="mb-1 text-[9px] uppercase tracking-wide text-slate-500">Animation Type</div>
                <div className="grid grid-cols-3 gap-1">
                  {(["rotation", "panning", "hue"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setGrad({ animType: t })}
                      className={`rounded px-1 py-1 text-[10px] capitalize ${
                        (g.animType ?? "rotation") === t ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {t === "hue" ? "Hue shift" : t}
                    </button>
                  ))}
                </div>
              </div>
              <Slider label="Animation speed (sec/cycle)" min={2} max={60} value={g.speed} onChange={(v) => setGrad({ speed: v })} format={(v) => `${v}s`} />
            </div>
          )}
        </div>

        {/* Type + angle */}
        <div className="grid grid-cols-2 gap-1.5">
          <Select
            value={g.type}
            onChange={(v) => setGrad({ type: v as GradientConfig["type"] })}
            options={[
              { value: "linear", label: "Linear" },
              { value: "radial", label: "Radial" },
              { value: "conic", label: "Conic" },
            ]}
          />
          {g.type !== "radial" && (
            <Slider label="Angle" min={0} max={360} value={g.angle} onChange={(v) => setGrad({ angle: v })} format={(v) => `${v}°`} />
          )}
        </div>

        {/* Direction presets */}
        <div>
          <div className="mb-1 text-[9px] uppercase tracking-wide text-slate-500">Direction</div>
          <div className="grid grid-cols-5 gap-1.5">
            {DIRECTIONS.map((d, i) => (
              <button
                key={i}
                onClick={() => setGrad({ type: d.type, angle: d.angle })}
                className={`flex aspect-square items-center justify-center rounded-lg border overflow-hidden ${
                  g.type === d.type && (d.type === "radial" || d.type === "conic" || g.angle === d.angle)
                    ? "border-violet-400 ring-1 ring-violet-400"
                    : "border-slate-700 hover:border-slate-500"
                }`}
                style={{ background: getGradientCss(g, d.angle, d.type) }}
              />
            ))}
          </div>
        </div>

        {/* Save/Load gradient swatches */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-2">
          <span className="text-[9px] uppercase tracking-wide text-slate-500">Presets</span>
          <Btn onClick={saveGradient}>💾 Save Current</Btn>
        </div>
        {savedGradients.length > 0 && (
          <div className="space-y-1">
            {savedGradients.map((sg) => {
              const stops = [...sg.gradient.stops].sort((a, b) => a.offset - b.offset).map((s) => `${s.color} ${s.offset * 100}%`).join(", ");
              return (
                <div key={sg.id} className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-800/40 p-1">
                  <div className="h-5 flex-1 rounded" style={{ background: `linear-gradient(90deg, ${stops})` }} />
                  <button onClick={() => applySavedGradient(sg)} className="rounded bg-slate-700 px-1.5 py-0.5 text-[9px] text-slate-100 hover:bg-slate-600">Use</button>
                  <button onClick={() => deleteSavedGradient(sg.id)} className="rounded px-1 text-[10px] text-rose-400 hover:bg-rose-900/40">×</button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
