import { useStore } from "../../store";
import { Panel, Slider, Toggle } from "../ui";
import type { AudioReactiveConfig } from "../../types";

export default function AudioTab() {
  const data = useStore((s) => s.data())!;
  const upd = useStore.getState().update;
  const audio: AudioReactiveConfig = data.audioReactive ?? {
    enabled: false,
    sensitivity: 5,
    affectSize: true,
    affectSpeed: false,
    affectOpacity: false,
    smoothing: 0.7,
  };
  const set = (patch: Partial<AudioReactiveConfig>) =>
    upd((d) => {
      d.audioReactive = { ...(d.audioReactive ?? audio), ...patch };
    });

  return (
    <div>
      <Panel title="🎤 Audio-Reactive Particles">
        <p className="text-[10px] leading-4 text-slate-400">
          Particles react to your <b>microphone</b> input — great for music/talk streams. Runs 100% locally in the browser (no server, no upload). In OBS Browser Source, enable
          <b> "Control audio via OBS"</b> is not needed; the runtime asks for mic permission on first load.
        </p>
        <Toggle label="Enable audio-reactive" checked={audio.enabled} onChange={(v) => set({ enabled: v })} />
        {audio.enabled && (
          <div className="mt-2 space-y-2">
            <Slider label="Sensitivity" min={1} max={10} value={audio.sensitivity} onChange={(v) => set({ sensitivity: v })} />
            <Slider label="Smoothing" min={0} max={0.95} step={0.05} value={audio.smoothing} onChange={(v) => set({ smoothing: v })} format={(v) => `${Math.round(v * 100)}%`} />
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 space-y-1.5">
              <div className="text-[9px] uppercase tracking-wide text-slate-500">Loudness affects…</div>
              <Toggle label="Particle size (pulse)" checked={audio.affectSize} onChange={(v) => set({ affectSize: v })} />
              <Toggle label="Particle speed" checked={audio.affectSpeed} onChange={(v) => set({ affectSpeed: v })} />
              <Toggle label="Particle opacity" checked={audio.affectOpacity} onChange={(v) => set({ affectOpacity: v })} />
            </div>
            <div className="rounded bg-amber-950/30 border border-amber-800/40 px-2 py-1.5 text-[10px] text-amber-200">
              💡 The editor preview and the exported HTML will both request microphone access. If denied, particles simply animate normally.
            </div>
          </div>
        )}
      </Panel>

      <Panel title="How to use in OBS">
        <ol className="list-decimal space-y-1 pl-4 text-[10px] leading-4 text-slate-400">
          <li>Export your scene as HTML/ZIP.</li>
          <li>Add it as a <b>Browser Source</b> (Local file).</li>
          <li>In Browser Source properties, make sure "Page permissions" allow microphone (OBS 30+ allows this by default for local files).</li>
          <li>Set your mic as the default input device in Windows / macOS.</li>
        </ol>
      </Panel>
    </div>
  );
}
