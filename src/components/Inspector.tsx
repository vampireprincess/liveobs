import { useStore } from "../store";
import AssetInspector from "./inspectors/AssetInspector";
import GroupInspector from "./inspectors/GroupInspector";
import ParticleInspector from "./inspectors/ParticleInspector";
import PathInspector from "./inspectors/PathInspector";
import ZoneInspector from "./inspectors/ZoneInspector";

export default function Inspector() {
  const selKind = useStore((s) => s.selKind);
  const selId = useStore((s) => s.selId);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">Inspector</h2>
        <p className="text-[11px] text-slate-500">{selKind ? `Editing ${selKind}` : "Select something to edit"}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {!selId && (
          <div className="mt-10 text-center text-xs text-slate-500">
            <div className="mb-2 text-3xl opacity-40">🎛️</div>
            Select an asset, group, particle, path or zone to see its settings.
          </div>
        )}
        {selKind === "asset" && <AssetInspector />}
        {selKind === "group" && <GroupInspector />}
        {selKind === "particle" && <ParticleInspector />}
        {selKind === "path" && <PathInspector />}
        {selKind === "zone" && <ZoneInspector />}
      </div>
    </div>
  );
}
