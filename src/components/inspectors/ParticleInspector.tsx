import { useRef } from "react";
import { useStore } from "../../store";
import { readFiles } from "../../media";
import { Btn, Field, Panel, Select, Slider, TextInput, Toggle } from "../ui";
import type { ParticleSystem, ParticleType, ParticleColorMode } from "../../types";

export default function ParticleInspector() {
  const data = useStore((s) => s.data())!;
  const selId = useStore((s) => s.selId)!;
  const p = data.particles.find((x) => x.id === selId);
  const inputRef = useRef<HTMLInputElement>(null);
  if (!p) return null;
  const set = (patch: Partial<ParticleSystem>) => useStore.getState().updateParticle(p.id, patch);

  const uploadCustom = async (files: FileList | null) => {
    if (!files) return;
    const media = await readFiles(files);
    media.forEach((m) => useStore.getState().addMedia(m));
    set({ customMediaIds: [...p.customMediaIds, ...media.map((m) => m.id)] });
  };

  return (
    <div>
      <Panel title="Particle System">
        <Field label="Name"><TextInput value={p.name} onChange={(v) => set({ name: v })} /></Field>
        <Field label="Type">
          <Select value={p.type} onChange={(v) => set({ type: v as ParticleType })} options={[
            { value: "snow", label: "Snow" },
            { value: "rain", label: "Rain" },
            { value: "leaves", label: "Leaves" },
            { value: "dust", label: "Dust" },
            { value: "sparkle", label: "Sparkle" },
            { value: "fog", label: "Fog" },
            { value: "custom", label: "Custom" },
          ]} />
        </Field>
        <Field label="Layer">
          <Select value={p.layerId} onChange={(v) => set({ layerId: v })} options={data.layers.map((l) => ({ value: l.id, label: l.name }))} />
        </Field>
        <Toggle label={p.enabled ? "Enabled" : "Disabled"} checked={p.enabled} onChange={(v) => set({ enabled: v })} />
        <Btn variant="danger" className="w-full" onClick={() => { useStore.getState().removeParticle(p.id); useStore.getState().select(null, null); }}>🗑 Delete</Btn>
      </Panel>

      <Panel title="Color & Gradient Mode">
         <Field label="Base Solid Color">
          <input type="color" value={p.color} onChange={(e) => set({ color: e.target.value })} className="h-7 w-full rounded" />
        </Field>
        <Field label="Color Source">
          <Select value={p.colorMode} onChange={(v) => set({ colorMode: v as ParticleColorMode })} options={[
            { value: "solid", label: "Solid (use base color)" },
            { value: "global", label: "Global Studio Gradient (by screen position)" },
            { value: "per-particle", label: "Per-Particle Color (sampled from studio)" },
            { value: "individual", label: "Individual Particle Gradient (internal)" },
          ]} />
        </Field>
        <p className="text-[9px] leading-3 text-slate-500 mt-1">
          Modes other than Solid use the active gradient from the <b>Gradient Tab</b>.
        </p>
      </Panel>

      <Panel title="Emission">
        <Slider label="Density (total particles)" min={1} max={500} value={p.density} onChange={(v) => set({ density: Math.round(v) })} />
        <Slider label="Speed" min={0.1} max={8} step={0.1} value={p.speed} onChange={(v) => set({ speed: v })} />
        <Slider label="Size" min={1} max={60} value={p.size} onChange={(v) => set({ size: v })} />
        <Slider label="Size variance" min={0} max={1} step={0.05} value={p.sizeVariance} onChange={(v) => set({ sizeVariance: v })} />
        <Slider label="Opacity" min={0} max={1} step={0.05} value={p.opacity} onChange={(v) => set({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Rotation speed" min={0} max={3} step={0.1} value={p.rotationSpeed} onChange={(v) => set({ rotationSpeed: v })} />
        <Slider label="Randomness" min={0} max={3} step={0.1} value={p.randomness} onChange={(v) => set({ randomness: v })} />
      </Panel>

      <Panel title="Wind & Spread">
        <Slider label="Wind X" min={-5} max={5} step={0.1} value={p.windX} onChange={(v) => set({ windX: v })} />
        <Slider label="Fall (wind Y)" min={0} max={5} step={0.1} value={p.windY} onChange={(v) => set({ windY: v })} />
        <Slider label="Spread" min={0.1} max={3} step={0.1} value={p.spread} onChange={(v) => set({ spread: v })} />
      </Panel>

      <Panel title="Custom Particle Images" action={<Btn onClick={() => inputRef.current?.click()}>+ Upload</Btn>}>
        <input ref={inputRef} type="file" accept="image/*,.svg" multiple hidden onChange={(e) => uploadCustom(e.target.files)} />
        <p className="mb-2 text-[11px] text-slate-500">Upload multiple images (e.g. 4 card faces). The density is split evenly between them — total particle count stays the same.</p>
        {p.customMediaIds.length === 0 ? (
          <p className="text-[11px] text-slate-600">Using built-in {p.type} shape.</p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {p.customMediaIds.map((id) => {
              const m = data.media.find((x) => x.id === id);
              return (
                <div key={id} className="relative overflow-hidden rounded border border-slate-700 bg-slate-950">
                  <img src={m?.dataUrl} className="aspect-square w-full object-contain p-1" />
                  <button onClick={() => set({ customMediaIds: p.customMediaIds.filter((x) => x !== id) })} className="absolute right-0.5 top-0.5 rounded bg-rose-600 px-1 text-[10px] text-white">×</button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Zones / Masks">
        <ZoneChips label="Include zones" selected={p.includeZoneIds} onChange={(ids) => set({ includeZoneIds: ids })} include />
        <ZoneChips label="Exclude zones" selected={p.excludeZoneIds} onChange={(ids) => set({ excludeZoneIds: ids })} include={false} />
      </Panel>
    </div>
  );
}

function ZoneChips({ label, selected, onChange, include }: { label: string; selected: string[]; onChange: (ids: string[]) => void; include: boolean }) {
  const data = useStore((s) => s.data())!;
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      {data.zones.length === 0 ? (
        <p className="text-[11px] text-slate-600">No zones defined.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {data.zones.map((z) => {
            const on = selected.includes(z.id);
            return (
              <button key={z.id} onClick={() => onChange(on ? selected.filter((x) => x !== z.id) : [...selected, z.id])} className={`rounded px-2 py-0.5 text-[11px] ${on ? (include ? "bg-emerald-700 text-white" : "bg-rose-700 text-white") : "bg-slate-800 text-slate-400"}`}>{z.name}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}
