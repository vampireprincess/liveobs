import { useStore } from "../store";
import { Btn, TextInput } from "./ui";
import { uid, createProject } from "../factory";
import type { Project } from "../types";
import { useState, useEffect } from "react";

const STORAGE_KEY = "obs_layout_user_presets";

export default function PresetsModal({ onClose }: { onClose: () => void }) {
  const [userPresets, setUserPresets] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [presetName, setName] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setUserPresets(JSON.parse(raw));
  }, []);

  const saveCurrentAsPreset = () => {
    const cur = useStore.getState().current();
    if (!cur) return;
    const newPreset = { ...structuredClone(cur), name: presetName || "User Preset " + (userPresets.length + 1) };
    const next = [newPreset, ...userPresets];
    setUserPresets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSaving(false);
    setName("");
  };

  const deleteUserPreset = (id: string) => {
    if (!confirm("Delete this preset?")) return;
    const next = userPresets.filter(p => p.id !== id);
    setUserPresets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const renameUserPreset = (id: string, newName: string) => {
    const next = userPresets.map(p => p.id === id ? { ...p, name: newName } : p);
    setUserPresets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const overwriteUserPreset = (id: string) => {
    const cur = useStore.getState().current();
    if (!cur) return;
    if (!confirm("Overwrite this preset with the current scene?")) return;
    const next = userPresets.map(p => p.id === id ? { ...structuredClone(cur), id: p.id, name: p.name } : p);
    setUserPresets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const loadAnyPreset = (pData: any, name: string) => {
    const cloned = structuredClone(pData);
    useStore.getState().newProject(name);
    useStore.getState().update((d) => {
      // deep replace all fields
      Object.keys(cloned).forEach((k) => {
        (d as any)[k] = cloned[k];
      });
    });
    onClose();
  };
  const loadPreset = (type: string) => {
    const p = createProject("Preset: " + type);
    p.data.bgGradient = { 
      enabled: true, 
      type: "linear",
      angle: 135, 
      stops: [
        { id: uid(), color: "#0f172a", offset: 0 },
        { id: uid(), color: "#1e1b4b", offset: 1 }
      ],
      animate: true, 
      speed: 0.5 
    };
    p.data.canvasWidth = 1920;
    p.data.canvasHeight = 1080;

    // Note: presets intentionally do NOT ship with a pre-baked "Screen Safe Area"
    // zone anymore. A large hidden global exclude zone here previously caused
    // ambient particles to always avoid most of the left/center of the canvas,
    // which looked like a bug ("particles avoid the left side"). If you want an
    // OBS-safe hole for your capture/chat, add it explicitly from the
    // Zones tab → "OBS Safe Area Slots".

    if (type === "cozy") {
      p.data.bgGradient.stops = [
        { id: uid(), color: "#451a03", offset: 0 },
        { id: uid(), color: "#78350f", offset: 1 }
      ];
      p.data.particles.push({
        id: uid(), name: "Cozy Dust", type: "dust", enabled: true, layerId: p.data.layers[3].id,
        density: 150, speed: 0.5, size: 4, sizeVariance: 0.8, opacity: 0.6, rotationSpeed: 1, randomness: 1,
        windX: 0, windY: 0.2, spread: 1, color: "#fcd34d", colorMode: "solid", customMediaIds: [], includeZoneIds: [], excludeZoneIds: []
      });
    } else if (type === "neon") {
      p.data.bgGradient.stops = [
        { id: uid(), color: "#020617", offset: 0 },
        { id: uid(), color: "#172554", offset: 1 }
      ];
      p.data.particles.push({
        id: uid(), name: "Cyber Fog", type: "fog", enabled: true, layerId: p.data.layers[1].id,
        density: 20, speed: 0.3, size: 200, sizeVariance: 0.5, opacity: 0.3, rotationSpeed: 0.2, randomness: 0.5,
        windX: 0.5, windY: 0, spread: 2, color: "#8b5cf6", colorMode: "global", customMediaIds: [], includeZoneIds: [], excludeZoneIds: []
      });
      // A glowing neon line to separate chat
      p.data.assets.push({
        id: uid(), name: "Neon Divider", layerId: p.data.layers[2].id, x: 1350, y: 50, width: 10, height: 900,
        rotation: 0, opacity: 1, scale: 1, flipH: false, flipV: false, visible: true, locked: true, zoffset: 0, blend: "add", fit: "contain",
        shadow: { enabled: true, color: "#a855f7", blur: 15, offsetX: 0, offsetY: 0 },
        shape: { kind: "line", fill: "transparent", stroke: "#e9d5ff", strokeWidth: 4, radius: 0 }
      });
    } else if (type === "horror") {
      p.data.bgGradient.stops = [
        { id: uid(), color: "#000000", offset: 0 },
        { id: uid(), color: "#260707", offset: 1 }
      ];
      p.data.particles.push({
        id: uid(), name: "Blood Rain", type: "rain", enabled: true, layerId: p.data.layers[3].id,
        density: 300, speed: 4, size: 10, sizeVariance: 0.3, opacity: 0.7, rotationSpeed: 0, randomness: 0.2,
        windX: -0.5, windY: 2, spread: 1, color: "#991b1b", colorMode: "solid", customMediaIds: [], includeZoneIds: [], excludeZoneIds: []
      });
      p.data.dayNight.enabled = true;
      p.data.dayNight.maxDarkness = 0.8;
      p.data.dayNight.cycleSec = 60;
    }

    useStore.getState().newProject(p.name);
    useStore.getState().update((d) => {
      Object.keys(p.data).forEach((k) => {
        (d as any)[k] = (p.data as any)[k];
      });
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-100">Project Presets Library</h2>
          <div className="flex gap-2">
            {!saving ? (
              <Btn variant="primary" onClick={() => setSaving(true)}>+ Save Current as Preset</Btn>
            ) : (
              <div className="flex gap-2 items-center bg-slate-800 p-1 rounded-md">
                <TextInput value={presetName} onChange={setName} placeholder="Preset name..." className="w-40" />
                <Btn onClick={saveCurrentAsPreset}>Save</Btn>
                <Btn onClick={() => setSaving(false)}>×</Btn>
              </div>
            )}
            <Btn onClick={onClose}>Close</Btn>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Factory Presets</h3>
            <div className="grid grid-cols-3 gap-4">
              <button onClick={() => loadPreset("cozy")} className="group rounded-xl border border-slate-800 bg-slate-800/40 p-4 hover:border-amber-500 hover:bg-amber-950/30 text-left">
                <div className="text-2xl mb-2">☕</div>
                <div className="font-semibold text-slate-200 text-sm">Cozy Chat</div>
                <div className="text-[11px] text-slate-500 mt-1">Warm animated gradient, floating dust motes, clear screen area.</div>
              </button>
              <button onClick={() => loadPreset("neon")} className="group rounded-xl border border-slate-800 bg-slate-800/40 p-4 hover:border-violet-500 hover:bg-violet-950/30 text-left">
                <div className="text-2xl mb-2">⚡</div>
                <div className="font-semibold text-slate-200 text-sm">Neon Synth</div>
                <div className="text-[11px] text-slate-500 mt-1">Dark background, cyber fog particles, glowing neon dividers.</div>
              </button>
              <button onClick={() => loadPreset("horror")} className="group rounded-xl border border-slate-800 bg-slate-800/40 p-4 hover:border-rose-500 hover:bg-rose-950/30 text-left">
                <div className="text-2xl mb-2">🩸</div>
                <div className="font-semibold text-slate-200 text-sm">Horror Storm</div>
                <div className="text-[11px] text-slate-500 mt-1">Pitch black with red hue, heavy fast blood rain, deep day/night dimming.</div>
              </button>
            </div>
          </div>

          {userPresets.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">My Saved Presets</h3>
              <div className="grid grid-cols-3 gap-4">
                {userPresets.map(up => (
                  <div key={up.id} className="relative group rounded-xl border border-slate-800 bg-slate-800/40 hover:border-violet-500 hover:bg-violet-950/30">
                    <button onClick={() => loadAnyPreset(up.data, up.name)} className="w-full p-4 pb-2 text-left">
                      <div className="text-2xl mb-2">📁</div>
                      <input
                        value={up.name}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => renameUserPreset(up.id, e.target.value)}
                        className="w-full font-semibold text-slate-200 text-sm bg-transparent border-none outline-none focus:bg-slate-950/60 focus:px-1 rounded"
                      />
                      <div className="text-[10px] text-slate-500 mt-1">{up.data.assets.length} assets · {up.data.particles.length} particles · {up.data.zones.length} zones</div>
                    </button>
                    <div className="flex gap-1 border-t border-slate-800 p-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); overwriteUserPreset(up.id); }}
                        className="flex-1 rounded bg-slate-800 py-1 text-[10px] text-slate-200 hover:bg-violet-700"
                        title="Overwrite this preset with the currently open scene"
                      >
                        ↻ Overwrite
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteUserPreset(up.id); }}
                        className="rounded bg-rose-950/50 px-2 py-1 text-[10px] text-rose-300 hover:bg-rose-900/50"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
