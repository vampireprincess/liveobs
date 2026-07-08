import { useState, useEffect } from "react";
import { useStore } from "../../store";
import { newParticle, uid } from "../../factory";
import { Btn, EmptyHint, Panel, Select } from "../ui";
import type { ParticleType, ParticleSystem } from "../../types";

const PRESETS: { type: ParticleType; label: string; emoji: string }[] = [
  { type: "snow", label: "Snow", emoji: "❄️" },
  { type: "rain", label: "Rain", emoji: "🌧️" },
  { type: "leaves", label: "Leaves", emoji: "🍂" },
  { type: "dust", label: "Dust", emoji: "✨" },
  { type: "sparkle", label: "Sparkle", emoji: "⭐" },
  { type: "fog", label: "Fog", emoji: "🌫️" },
  { type: "fireflies", label: "Fireflies", emoji: "🪰" },
  { type: "bokeh", label: "Bokeh", emoji: "⭕" },
];

const STORAGE_KEY = "obs_particle_presets";

export default function ParticlesTab() {
  const data = useStore((s) => s.data())!;
  const selId = useStore((s) => s.selId);
  const selKind = useStore((s) => s.selKind);
  const [userPresets, setUserPresets] = useState<ParticleSystem[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setUserPresets(JSON.parse(raw));
  }, []);

  const create = (type: ParticleType) => {
    const layer = data.layers.find((l) => l.id === "layer-fg") ?? data.layers[data.layers.length - 1];
    const p = newParticle(layer.id, type);
    useStore.getState().addParticle(p);
    useStore.getState().select("particle", p.id);
  };

  const saveCurrentAsPreset = () => {
    const sel = data.particles.find((p) => p.id === selId && selKind === "particle");
    if (!sel) return;
    const next = [{ ...structuredClone(sel), id: uid() }, ...userPresets];
    setUserPresets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const loadUserPreset = (p: ParticleSystem) => {
    const layer = data.layers.find((l) => l.id === "layer-fg") ?? data.layers[data.layers.length - 1];
    const np = { ...structuredClone(p), id: uid(), layerId: layer.id };
    useStore.getState().addParticle(np);
    useStore.getState().select("particle", np.id);
  };

  const deleteUserPreset = (id: string) => {
    const next = userPresets.filter((p) => p.id !== id);
    setUserPresets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <div className="space-y-3">
      <Panel title="Add Particle System">
        <div className="grid grid-cols-3 gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.type} onClick={() => create(p.type)} className="flex flex-col items-center gap-1 rounded-md border border-slate-700 bg-slate-800/40 py-2 text-xs text-slate-300 hover:border-violet-500">
              <span className="text-xl">{p.emoji}</span>
              {p.label}
            </button>
          ))}
        </div>
        <Btn className="mt-2 w-full" onClick={() => create("custom")}>+ Custom Image Particle</Btn>
      </Panel>

      <Panel title="User Presets" defaultCollapsed={userPresets.length === 0}>
        <div className="space-y-1.5">
           <Btn onClick={saveCurrentAsPreset} variant="primary" className="w-full" disabled={selKind !== "particle"}>
             💾 Save Selected as Preset
           </Btn>
           {userPresets.length > 0 ? (
             <div className="grid grid-cols-2 gap-1.5 mt-2">
               {userPresets.map(up => (
                 <div key={up.id} className="relative group">
                   <button onClick={() => loadUserPreset(up)} className="w-full rounded border border-slate-800 bg-slate-800/40 py-1.5 px-2 text-[10px] text-left text-slate-300 hover:border-violet-500">
                     {up.name}
                   </button>
                   <button onClick={() => deleteUserPreset(up.id)} className="absolute -top-1 -right-1 hidden group-hover:block bg-rose-600 text-white rounded-full w-4 h-4 text-[9px] leading-none text-center">×</button>
                 </div>
               ))}
             </div>
           ) : (
             <p className="text-[10px] text-slate-600 text-center">No saved presets yet.</p>
           )}
        </div>
      </Panel>

      <Panel title="Systems">
        {data.particles.length === 0 ? (
          <EmptyHint>No particle systems yet.</EmptyHint>
        ) : (
          <div className="space-y-1">
            {data.particles.map((p) => {
              const sel = selKind === "particle" && selId === p.id;
              const layer = data.layers.find((l) => l.id === p.layerId);
              return (
                <div key={p.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${sel ? "border-violet-500 bg-violet-500/10" : "border-slate-800 bg-slate-800/30"}`}>
                  <button onClick={() => useStore.getState().select("particle", p.id)} className="flex-1 text-left text-sm text-slate-200">
                    {p.name} <span className="text-[10px] text-slate-500">· {p.density}× · {layer?.name}</span>
                  </button>
                  <Select
                    value={p.enabled ? "on" : "off"}
                    onChange={(v) => useStore.getState().updateParticle(p.id, { enabled: v === "on" })}
                    options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]}
                  />
                  <button onClick={() => useStore.getState().removeParticle(p.id)} className="rounded px-1.5 text-rose-400 hover:bg-rose-900/40">×</button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
