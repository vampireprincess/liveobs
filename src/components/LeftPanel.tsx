import { useStore } from "../store";
import type { EditorTab } from "../types";
import AssetsTab from "./tabs/AssetsTab";
import LayersTab from "./tabs/LayersTab";
import RandomTab from "./tabs/RandomTab";
import PathsTab from "./tabs/PathsTab";
import ZonesTab from "./tabs/ZonesTab";
import ParticlesTab from "./tabs/ParticlesTab";
import ShapesTab from "./tabs/ShapesTab";
import LottieTab from "./tabs/LottieTab";
import SvgTab from "./tabs/SvgTab";
import ExportTab from "./tabs/ExportTab";
import GradientTab from "./tabs/GradientTab";
import AudioTab from "./tabs/AudioTab";
import DebugTab from "./tabs/DebugTab";

const TABS: { id: EditorTab; label: string; icon: string }[] = [
  { id: "assets", label: "Library", icon: "📚" },
  { id: "layers", label: "Layers", icon: "🗂️" },
  { id: "random", label: "Groups", icon: "🎲" },
  { id: "paths", label: "Paths", icon: "〰️" },
  { id: "zones", label: "Zones", icon: "🗺️" },
  { id: "particles", label: "Particles", icon: "❄️" },
  { id: "shapes", label: "Shapes", icon: "⬡" },
  { id: "lottie", label: "Lottie", icon: "🎬" },
  { id: "svg", label: "SVG", icon: "✒️" },
  { id: "gradient", label: "Gradient", icon: "🌈" },
  { id: "audio", label: "Audio", icon: "🎤" },
  { id: "debug", label: "Debug", icon: "🔍" },
  { id: "export", label: "Export", icon: "📦" },
];

export default function LeftPanel() {
  const tab = useStore((s) => s.tab);
  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-5 gap-1 border-b border-slate-800 p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => useStore.getState().setTab(t.id)}
            className={`flex flex-col items-center gap-0.5 rounded-md py-2 text-[10px] font-medium transition ${
              tab === t.id ? "bg-violet-500/20 text-violet-300" : "text-slate-400 hover:bg-slate-800/60"
            }`}
          >
            <span className="text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {tab === "assets" && <AssetsTab />}
        {tab === "layers" && <LayersTab />}
        {tab === "random" && <RandomTab />}
        {tab === "paths" && <PathsTab />}
        {tab === "zones" && <ZonesTab />}
        {tab === "particles" && <ParticlesTab />}
        {tab === "shapes" && <ShapesTab />}
        {tab === "lottie" && <LottieTab />}
        {tab === "svg" && <SvgTab />}
        {tab === "gradient" && <GradientTab />}
        {tab === "audio" && <AudioTab />}
        {tab === "debug" && <DebugTab />}
        {tab === "export" && <ExportTab />}
      </div>
    </div>
  );
}
