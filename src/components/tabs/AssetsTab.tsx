import { useRef, useState } from "react";
import { useStore } from "../../store";
import { readFiles } from "../../media";
import { newCanvasAsset } from "../../factory";
import { Btn, EmptyHint, Panel, Select } from "../ui";
import AssetLibraryModal from "../AssetLibraryModal";

export default function AssetsTab() {
  const data = useStore((s) => s.data())!;
  const selId = useStore((s) => s.selId);
  const selKind = useStore((s) => s.selKind);
  const addMedia = useStore((s) => s.addMedia);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [quickLayerId, setQuickLayerId] = useState(data.layers.find((l) => l.id === "layer-mid")?.id ?? data.layers[0]?.id ?? "");

  const onUpload = async (files: FileList | null) => {
    if (!files) return;
    const media = await readFiles(files);
    media.forEach((m) => {
      // Quick Upload is for fixed/static canvas assets, not random library assets.
      m.categoryId = "static-assets";
      m.inLibrary = false;
      addMedia(m);
      const asset = newCanvasAsset(m.id, quickLayerId || data.layers[0].id, m);
      useStore.getState().addAsset(asset);
      useStore.getState().select("asset", asset.id);
    });
  };

  const place = (mediaId: string) => {
    const media = data.media.find((m) => m.id === mediaId)!;
    const layer = data.layers.find((l) => l.id === "layer-mid") ?? data.layers[0];
    const asset = newCanvasAsset(mediaId, layer.id, media);
    useStore.getState().addAsset(asset);
    useStore.getState().select("asset", asset.id);
  };

  return (
    <div className="space-y-2">
      <Panel title="Quick Upload">
        <input ref={inputRef} type="file" accept="image/*,video/*,.svg,.gif,.webp,.json" multiple hidden onChange={(e) => onUpload(e.target.files)} />
        <Select
          value={quickLayerId}
          onChange={setQuickLayerId}
          options={data.layers.map((l) => ({ value: l.id, label: l.name }))}
        />
        <Btn className="mt-2 w-full" onClick={() => inputRef.current?.click()}>⬆ Upload Fixed Canvas Asset</Btn>
        <p className="mt-1 text-[10px] text-slate-500">Use this for always-visible Background/Middle/Foreground assets. Random interval assets go into Random Asset Library.</p>
      </Panel>

      <Btn variant="primary" className="w-full" onClick={() => setShowLibrary(true)}>
        📚 Open Random Asset Library
      </Btn>

      <Panel title="On Canvas">
        {data.assets.length === 0 ? (
          <EmptyHint>No assets placed yet.</EmptyHint>
        ) : (
          <div className="space-y-1">
            {data.assets.map((a) => {
              const media = data.media.find((m) => m.id === a.mediaId);
              const sel = selId === a.id && selKind === "asset";
              return (
                <button
                  key={a.id}
                  onClick={() => useStore.getState().select("asset", a.id)}
                  className={`flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-xs ${
                    sel ? "border-violet-500 bg-violet-500/10 text-white" : "border-slate-800 bg-slate-800/30 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  {a.shape ? (
                    <span className="h-6 w-6 rounded border border-slate-700" style={{ background: a.shape.fill }} />
                  ) : (
                    <img src={media?.dataUrl} referrerPolicy="no-referrer" className="h-6 w-6 rounded object-contain" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </Panel>

      {showLibrary && <AssetLibraryModal onClose={() => setShowLibrary(false)} onPlace={place} />}
    </div>
  );
}
