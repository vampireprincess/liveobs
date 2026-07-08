import { useEffect, useState } from "react";
import { useStore } from "../store";
import type { GradientConfig, ColorStop } from "../types";
import { uid } from "../factory";
import { Btn, Field, Select, Slider, Toggle } from "./ui";

interface Props {
  value: GradientConfig | undefined;
  onChange: (g: GradientConfig) => void;
  compact?: boolean;
}

const DEFAULT_GRAD: GradientConfig = {
  enabled: true,
  type: "linear",
  angle: 135,
  stops: [
    { id: "s1", color: "#7c3aed", offset: 0 },
    { id: "s2", color: "#ec4899", offset: 1 },
  ],
  animate: false,
  speed: 1,
};

export function gradientToCss(g: GradientConfig): string {
  const stops = [...g.stops].sort((a, b) => a.offset - b.offset);
  const stopStr = stops.map((s) => `${s.color} ${(s.offset * 100).toFixed(1)}%`).join(", ");
  if (g.type === "radial") return `radial-gradient(circle, ${stopStr})`;
  if (g.type === "conic") return `conic-gradient(from ${g.angle}deg, ${stopStr})`;
  return `linear-gradient(${g.angle}deg, ${stopStr})`;
}

/** Extract N dominant colors from an image using a simple bucket average. */
export async function extractPalette(dataUrl: string, n: number): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const size = 64;
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      // simple bucketed color histogram
      const buckets: Record<string, { r: number; g: number; b: number; count: number }> = {};
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 100) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // quantize to reduce buckets
        const q = (v: number) => Math.round(v / 24) * 24;
        const key = `${q(r)}-${q(g)}-${q(b)}`;
        if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, count: 0 };
        buckets[key].r += r;
        buckets[key].g += g;
        buckets[key].b += b;
        buckets[key].count++;
      }
      const sorted = Object.values(buckets)
        .sort((a, b) => b.count - a.count)
        .slice(0, n)
        .map((b) => {
          const r = Math.round(b.r / b.count);
          const g = Math.round(b.g / b.count);
          const bl = Math.round(b.b / b.count);
          return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
        });
      // sort by brightness for nice gradient
      sorted.sort((a, b) => {
        const l = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
        return l(a) - l(b);
      });
      resolve(sorted);
    };
    img.onerror = () => resolve(["#000000", "#ffffff"]);
    img.src = dataUrl;
  });
}

export default function GradientPicker({ value, onChange, compact }: Props) {
  const g = value || DEFAULT_GRAD;
  const [pickingAsset, setPickingAsset] = useState(false);
  const [colorCount, setColorCount] = useState(3);
  const data = useStore((s) => s.data());

  useEffect(() => {
    if (!pickingAsset) return;
    // listen for global asset-pick event fired from Canvas
    const handler = async (e: Event) => {
      const custom = e as CustomEvent<{ mediaId?: string }>;
      const mediaId = custom.detail?.mediaId;
      if (!mediaId) return;
      const media = data?.media.find((m) => m.id === mediaId);
      if (!media) return;
      const palette = await extractPalette(media.dataUrl, colorCount);
      const stops: ColorStop[] = palette.map((c, i) => ({
        id: uid(),
        color: c,
        offset: palette.length === 1 ? 0 : i / (palette.length - 1),
      }));
      onChange({ ...g, enabled: true, stops });
      setPickingAsset(false);
    };
    window.addEventListener("gradient-pick-asset", handler);
    return () => window.removeEventListener("gradient-pick-asset", handler);
  }, [pickingAsset, colorCount, data, g, onChange]);

  const updateStop = (i: number, patch: Partial<ColorStop>) => {
    const stops = [...g.stops];
    stops[i] = { ...stops[i], ...patch };
    onChange({ ...g, stops });
  };

  const addStop = () => {
    const stops = [...g.stops, { id: uid(), color: "#ffffff", offset: 1 }];
    onChange({ ...g, stops });
  };

  const removeStop = (i: number) => {
    if (g.stops.length <= 2) return;
    const stops = g.stops.filter((_, idx) => idx !== i);
    onChange({ ...g, stops });
  };

  const startPicking = () => {
    setPickingAsset(true);
    // set global pick mode via window flag consumed by Canvas
    (window as unknown as { __gradientPicking?: boolean }).__gradientPicking = true;
  };

  const cancelPicking = () => {
    setPickingAsset(false);
    (window as unknown as { __gradientPicking?: boolean }).__gradientPicking = false;
  };

  return (
    <div className="space-y-2">
      <div
        className="h-8 w-full rounded border border-slate-700"
        style={{ background: gradientToCss(g) }}
      />

      {!compact && (
        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Type">
            <Select
              value={g.type}
              onChange={(v) => onChange({ ...g, type: v as GradientConfig["type"] })}
              options={[
                { value: "linear", label: "Linear" },
                { value: "radial", label: "Radial" },
                { value: "conic", label: "Conic" },
              ]}
            />
          </Field>
          {(g.type === "linear" || g.type === "conic") && (
            <Field label="Angle">
              <input
                type="number"
                value={g.angle}
                onChange={(e) => onChange({ ...g, angle: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-1.5 py-1 text-xs text-slate-100"
              />
            </Field>
          )}
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">Color Stops</span>
          <button onClick={addStop} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-slate-700">+ Stop</button>
        </div>
        {g.stops.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <input
              type="color"
              value={s.color}
              onChange={(e) => updateStop(i, { color: e.target.value })}
              className="h-6 w-8 rounded"
            />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={s.offset}
              onChange={(e) => updateStop(i, { offset: parseFloat(e.target.value) })}
              className="flex-1 accent-violet-500"
            />
            <span className="w-8 text-right text-[10px] font-mono text-slate-400">{Math.round(s.offset * 100)}%</span>
            {g.stops.length > 2 && (
              <button onClick={() => removeStop(i)} className="rounded text-rose-400 hover:bg-rose-900/40 px-1 text-xs">×</button>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-md border border-violet-800/40 bg-violet-950/30 p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-300">Gradient Maker</span>
          <div className="flex items-center gap-1">
            <label className="text-[10px] text-slate-400">Colors:</label>
            <input
              type="number"
              min={2}
              max={10}
              value={colorCount}
              onChange={(e) => setColorCount(Math.max(2, Math.min(10, parseInt(e.target.value) || 3)))}
              className="w-10 rounded border border-slate-700 bg-slate-900 px-1 text-xs text-slate-100"
            />
          </div>
        </div>
        {!pickingAsset ? (
          <Btn variant="primary" className="w-full" onClick={startPicking}>
            🎨 Extract from Image
          </Btn>
        ) : (
          <div className="space-y-1">
            <p className="text-[10px] text-violet-200">Click any image asset on the canvas to extract {colorCount} colors.</p>
            <Btn className="w-full" onClick={cancelPicking}>Cancel</Btn>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Toggle label="Animate" checked={g.animate} onChange={(v) => onChange({ ...g, animate: v })} />
        {g.animate && (
          <Slider label="Speed" min={0.1} max={5} step={0.1} value={g.speed} onChange={(v) => onChange({ ...g, speed: v })} />
        )}
      </div>
    </div>
  );
}
