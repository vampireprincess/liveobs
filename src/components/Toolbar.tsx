import { useState } from "react";
import { useStore } from "../store";
import { exportZip, buildRuntimeHtml } from "../runtime/exportHtml";
import { Btn } from "./ui";
import ProjectsModal from "./ProjectsModal";
import TutorialModal from "./TutorialModal";
import PresetsModal from "./PresetsModal";
import AssetLibraryModal from "./AssetLibraryModal";

export default function Toolbar() {
  const project = useStore((s) => s.current());
  const runtimePreview = useStore((s) => s.runtimePreview);
  const dirty = useStore((s) => s.dirty);
  const [showProjects, setShowProjects] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const placeAsset = (mediaId: string) => {
    const data = useStore.getState().data()!;
    const media = data.media.find((m) => m.id === mediaId)!;
    const layer = data.layers.find((l) => l.id === "layer-rand") ?? data.layers[data.layers.length - 1];
    const asset = {
      id: crypto.randomUUID(),
      mediaId,
      name: media.name,
      layerId: layer.id,
      x: 760,
      y: 440,
      width: Math.round((media.width ?? 300) * 0.5),
      height: Math.round((media.height ?? 200) * 0.5),
      rotation: 0,
      opacity: 1,
      scale: 1,
      flipH: false,
      flipV: false,
      visible: true,
      locked: false,
      zoffset: 0,
      blend: "normal" as const,
      fit: "contain" as const,
    };
    useStore.getState().addAsset(asset);
    useStore.getState().select("asset", asset.id);
  };

  if (!project) return null;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-950/80 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-sm shadow-lg shadow-indigo-900/40">🌆</div>
          <div className="leading-tight">
            <div className="text-xs font-semibold text-slate-200">Living Scene Studio</div>
            <div className="text-[10px] text-slate-500">OBS Layout & Live Wallpaper Builder</div>
          </div>
        </div>

        <div className="mx-2 h-6 w-px bg-slate-800" />

        {renaming ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => { useStore.getState().renameProject(project.id, nameDraft || project.name); setRenaming(false); }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="rounded-md border border-violet-500 bg-slate-800 px-2 py-1 text-sm text-white outline-none"
          />
        ) : (
          <button
            onClick={() => { setNameDraft(project.name); setRenaming(true); }}
            className="rounded-md px-2 py-1 text-sm font-medium text-slate-200 hover:bg-slate-800"
            title="Click to rename"
          >
            {project.name} <span className="text-slate-600">✎</span>
          </button>
        )}
        <span className={`text-[10px] ${dirty ? "text-amber-400" : "text-emerald-500"}`}>{dirty ? "● unsaved" : "✓ saved"}</span>

        <Btn onClick={() => setShowProjects(true)}>📁 Projects</Btn>
        <Btn onClick={() => setShowPresets(true)}>✨ Presets</Btn>
        <Btn onClick={() => setShowLibrary(true)}>📚 Random Library</Btn>
        <Btn onClick={() => setShowTutorial(true)}>Help / Tutorial</Btn>

        <div className="flex-1" />

        <Btn onClick={() => useStore.getState().saveNow()}>💾 Save</Btn>
        <Btn
          variant={runtimePreview ? "primary" : "default"}
          onClick={() => useStore.getState().setRuntimePreview(!runtimePreview)}
        >
          {runtimePreview ? "⏹ Stop Preview" : "▶ Test Runtime"}
        </Btn>
        <div className="flex bg-slate-800 rounded-md overflow-hidden border border-slate-700">
          <button onClick={() => exportZip(project)} className="px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 border-r border-slate-700" title="Export ZIP (with assets)">📦 ZIP</button>
          <button onClick={() => {
            const blob = new Blob([buildRuntimeHtml(project)], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + ".html";
            a.click();
          }} className="px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700" title="Export single standalone HTML">📄 HTML</button>
        </div>
      </div>
      {showProjects && <ProjectsModal onClose={() => setShowProjects(false)} />}
      {showPresets && <PresetsModal onClose={() => setShowPresets(false)} />}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
      {showLibrary && <AssetLibraryModal onClose={() => setShowLibrary(false)} onPlace={placeAsset} />}
    </>
  );
}
