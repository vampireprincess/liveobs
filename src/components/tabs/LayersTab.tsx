import { useState } from "react";
import { useStore } from "../../store";
import { newLayer } from "../../factory";
import { Btn, Panel, TextInput } from "../ui";

export default function LayersTab() {
  const data = useStore((s) => s.data())!;
  const [dragId, setDragId] = useState<string | null>(null);
  const [assetDragId, setAssetDragId] = useState<string | null>(null);

  const reorderAssetTo = (draggedId: string, targetLayerId: string, beforeAssetId?: string) => {
    useStore.getState().update((d) => {
      const dragged = d.assets.find((x) => x.id === draggedId);
      if (!dragged) return;
      dragged.layerId = targetLayerId;
      const list = d.assets
        .filter((x) => x.layerId === targetLayerId && x.id !== draggedId)
        .sort((a, b) => a.zoffset - b.zoffset);
      const insertAt = beforeAssetId ? Math.max(0, list.findIndex((x) => x.id === beforeAssetId)) : list.length;
      list.splice(insertAt < 0 ? list.length : insertAt, 0, dragged);
      list.forEach((asset, index) => { asset.zoffset = index; });
    });
  };

  const ordered = [...data.layers].reverse(); // show top layer first

  return (
    <Panel title="Layers (top → bottom)" action={<Btn variant="primary" onClick={() => useStore.getState().addLayer(newLayer())}>+ Layer</Btn>}>
      <p className="mb-2 text-[11px] text-slate-500">Drag layers to reorder. Drag asset rows between layers to move them visually.</p>
      <div className="space-y-1">
        {ordered.map((l) => {
          const layerAssets = data.assets.filter((a) => a.layerId === l.id);
          return (
            <div
              key={l.id}
              draggable
              onDragStart={() => setDragId(l.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (assetDragId) {
                  reorderAssetTo(assetDragId, l.id);
                  setAssetDragId(null);
                  return;
                }
                if (!dragId || dragId === l.id) return;
                const d = useStore.getState().data()!;
                const from = d.layers.findIndex((x) => x.id === dragId);
                const to = d.layers.findIndex((x) => x.id === l.id);
                useStore.getState().update((dd) => {
                  const [moved] = dd.layers.splice(from, 1);
                  dd.layers.splice(to, 0, moved);
                });
                setDragId(null);
              }}
              className="rounded-md border border-slate-800 bg-slate-800/40 p-2"
            >
              <div className="flex items-center gap-1.5">
                <span className="cursor-grab text-slate-600">⠿</span>
                <TextInput value={l.name} onChange={(v) => useStore.getState().updateLayer(l.id, { name: v })} />
                <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-400">{layerAssets.length}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <IconBtn active={l.visible} onClick={() => useStore.getState().updateLayer(l.id, { visible: !l.visible })}>
                  {l.visible ? "👁 Show" : "🚫 Hidden"}
                </IconBtn>
                <IconBtn active={!l.locked} onClick={() => useStore.getState().updateLayer(l.id, { locked: !l.locked })}>
                  {l.locked ? "🔒 Locked" : "🔓 Unlocked"}
                </IconBtn>
                <IconBtn onClick={() => useStore.getState().duplicateLayer(l.id)}>⧉ Dup</IconBtn>
                <IconBtn onClick={() => useStore.getState().removeLayer(l.id)} danger>
                  🗑
                </IconBtn>
              </div>
              {layerAssets.length > 0 && (
                <div className="mt-2 space-y-1 rounded-md border border-slate-900 bg-slate-950/30 p-1">
                  {layerAssets
                    .slice()
                    .sort((a, b) => a.zoffset - b.zoffset)
                    .map((a) => {
                      const media = data.media.find((m) => m.id === a.mediaId);
                       return (
                         <div
                           key={a.id}
                           onDragOver={(e) => e.preventDefault()}
                           onDrop={(e) => {
                             e.preventDefault();
                             e.stopPropagation();
                             if (assetDragId && assetDragId !== a.id) reorderAssetTo(assetDragId, l.id, a.id);
                             setAssetDragId(null);
                           }}
                           className="flex w-full items-center gap-1 rounded bg-slate-800/60 px-2 py-1 text-[11px] text-slate-300"
                         >
                           <button
                             draggable
                             onDragStart={(e) => {
                               e.stopPropagation();
                               setAssetDragId(a.id);
                             }}
                             onClick={() => useStore.getState().select("asset", a.id)}
                             className={`flex min-w-0 flex-1 cursor-grab items-center gap-2 ${a.locked ? "opacity-50" : ""}`}
                           >
                             {a.shape ? <span className="h-5 w-5 rounded border border-slate-600" style={{ background: a.shape.fill }} /> : <img src={media?.dataUrl} referrerPolicy="no-referrer" className="h-5 w-5 rounded object-contain" />}
                             <span className="min-w-0 truncate">{a.name}</span>
                           </button>
                           <button
                             onClick={(e) => { e.stopPropagation(); useStore.getState().updateAsset(a.id, { visible: !a.visible }); }}
                             className={`rounded px-1.5 py-0.5 text-[10px] ${a.visible ? "text-slate-300 hover:bg-slate-700" : "text-slate-600"}`}
                             title={a.visible ? "Hide" : "Show"}
                           >
                             {a.visible ? "👁" : "🚫"}
                           </button>
                           <button
                             onClick={(e) => { e.stopPropagation(); useStore.getState().updateAsset(a.id, { locked: !a.locked }); }}
                             className={`rounded px-1.5 py-0.5 text-[10px] ${a.locked ? "text-amber-400" : "text-slate-500 hover:bg-slate-700"}`}
                             title={a.locked ? "Unlock" : "Lock"}
                           >
                             {a.locked ? "🔒" : "🔓"}
                           </button>
                         </div>
                       );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function IconBtn({ children, onClick, active, danger }: { children: React.ReactNode; onClick: () => void; active?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2 py-1 text-[11px] ${
        danger
          ? "bg-rose-950/50 text-rose-300 hover:bg-rose-900/50"
          : active
          ? "bg-slate-700 text-slate-100"
          : "bg-slate-900 text-slate-400 hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}
