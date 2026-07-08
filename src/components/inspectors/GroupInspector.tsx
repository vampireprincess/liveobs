import { useState } from "react";
import { useStore } from "../../store";
import { Btn, EmptyHint, Field, NumberInput, Select, Toggle } from "../ui";
import type { AssetSchedule } from "../../types";

export default function GroupInspector() {
  const data = useStore((s) => s.data())!;
  const selId = useStore((s) => s.selId)!;
  const g = data.randomGroups.find((x) => x.id === selId);
  if (!g) return null;

  const cat = data.categories.find((c) => c.id === g.categoryId);
  if (!cat) return <EmptyHint>Linked category not found.</EmptyHint>;

  const setCat = (patch: any) => useStore.getState().update((d) => {
    const c = d.categories.find(x => x.id === g.categoryId);
    if (c) Object.assign(c, patch);
  });

  // Get assets that are "ON CANVAS" for this category
  const onCanvasAssets = data.assets.filter(a => a.mediaId && data.media.some(m => m.id === a.mediaId && m.categoryId === cat.id));

  // Accordion state for per-asset settings
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);

  const setAssetSchedule = (mediaId: string, patch: Partial<AssetSchedule>) => {
    useStore.getState().update((d) => {
      const m = d.media.find((x) => x.id === mediaId);
      if (m) m.schedule = { ...m.schedule, ...patch };
    });
  };

  const toggleAssetOnCanvas = (mediaId: string, isOnCanvas: boolean) => {
    const st = useStore.getState();
    if (isOnCanvas) {
      // Remove from canvas
      st.update((d) => {
        d.assets = d.assets.filter(a => a.mediaId !== mediaId);
      });
    } else {
      // Add to canvas (use default positioning)
      const media = data.media.find(m => m.id === mediaId);
      if (!media) return;
      const layer = data.layers.find(l => l.id === "layer-rand") ?? data.layers[0];
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
      st.addAsset(asset);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Group Inspector</h3>
        <Btn variant="danger" onClick={() => useStore.getState().removeGroup(g.id)}>Delete Group</Btn>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Linked Category</div>
        <div className="text-sm text-slate-200">{cat.name}</div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Category Rules (Path & Motion)</div>
        <Field label="Motion Path">
          <Select value={cat.pathId || ""} onChange={v => setCat({ pathId: v || undefined })} options={[{value:"", label:"None"}, ...data.paths.map(p=>({value:p.id, label:p.name}))]} />
        </Field>
        <Field label="Base Speed">
          <input type="range" min="0.1" max="5" step="0.1" value={cat.speed} onChange={e => setCat({ speed: parseFloat(e.target.value) })} className="w-full" />
          <span className="text-xs text-slate-400">{cat.speed}x (1x = 300px/s)</span>
        </Field>
        <Field label="Layer">
          <Select value={cat.layerId || "layer-rand"} onChange={v => setCat({ layerId: v || undefined })} options={[{value:"layer-rand", label:"Random Assets"}, ...data.layers.filter(l => l.id !== "layer-rand").map(l=>({value:l.id, label:l.name}))]} />
        </Field>
        <Field label="Start Direction">
          <Select value={cat.direction} onChange={v => setCat({ direction: v })} options={[{value:"ltr", label:"Left→Right"}, {value:"rtl", label:"Right→Left"}, {value:"random", label:"Random"}]} />
        </Field>
        <Toggle label="Alternate Direction" checked={cat.alternateDirection} onChange={v => setCat({ alternateDirection: v })} />
        <Toggle label="Flip H on Direction" checked={cat.flipOnDirection} onChange={v => setCat({ flipOnDirection: v })} />
        {cat.flipOnDirection && (
          <Field label="Flip Axis">
            <Select 
              value={cat.flipAxis || "horizontal"} 
              onChange={v => setCat({ flipAxis: v })} 
              options={[
                {value:"horizontal", label:"Horizontal (scaleX)"}, 
                {value:"vertical", label:"Vertical (scaleY)"}, 
                {value:"both", label:"Both (scale)"}
              ]} 
            />
          </Field>
        )}
        <Toggle label="Rotate along Path" checked={!!cat.rotateAlongPath} onChange={v => setCat({ rotateAlongPath: v })} />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Zones</div>
        <Field label="Include Zones">
          <Select 
            value={cat.includeZoneIds?.[0] || ""} 
            onChange={v => setCat({ includeZoneIds: v ? [v] : [] })} 
            options={[{value:"", label:"None (All)"}, ...data.zones.map(z=>({value:z.id, label:z.name}))]} 
          />
        </Field>
        <Field label="Exclude Zones">
          <Select 
            value={cat.excludeZoneIds?.[0] || ""} 
            onChange={v => setCat({ excludeZoneIds: v ? [v] : [] })} 
            options={[{value:"", label:"None"}, ...data.zones.map(z=>({value:z.id, label:z.name}))]} 
          />
        </Field>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Assets on Canvas</div>
        <p className="text-[10px] text-slate-400">Toggle ON to place on canvas as template. OFF removes it from canvas (stays in library). Click ⚙ for per-asset Hard Limit & spawn rules.</p>
        {onCanvasAssets.length === 0 && data.media.filter(m => m.categoryId === cat.id).length === 0 ? (
          <EmptyHint>No assets in this category. Upload in Random Library first.</EmptyHint>
        ) : (
          <div className="space-y-1.5">
            {data.media.filter(m => m.categoryId === cat.id).map((media) => {
              const canvasAsset = data.assets.find(a => a.mediaId === media.id);
              const isOnCanvas = !!canvasAsset;
              const isExpanded = expandedAssetId === media.id;
              return (
                <div key={media.id} className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
                  {/* Asset row */}
                  <div className="flex items-center gap-2 p-2">
                    {media.dataUrl ? (
                      <img src={media.dataUrl} className="h-9 w-9 rounded object-cover bg-black shrink-0" />
                    ) : (
                      <div className="h-9 w-9 rounded bg-slate-700 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-200 truncate">{media.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {isOnCanvas ? `${canvasAsset!.width}×${canvasAsset!.height} · ${canvasAsset!.rotation}°` : "Not on canvas"}
                      </div>
                    </div>
                    {/* ON/OFF Toggle */}
                    <button
                      onClick={() => toggleAssetOnCanvas(media.id, isOnCanvas)}
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase transition ${
                        isOnCanvas ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                      }`}
                    >
                      {isOnCanvas ? "ON" : "OFF"}
                    </button>
                    {/* Settings accordion toggle */}
                    <button
                      onClick={() => setExpandedAssetId(isExpanded ? null : media.id)}
                      className={`shrink-0 h-7 w-7 rounded-md flex items-center justify-center text-sm transition ${
                        isExpanded ? "bg-violet-600 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                      }`}
                      title="Asset rules"
                    >
                      ⚙
                    </button>
                  </div>
                  {/* Accordion: per-asset schedule settings */}
                  {isExpanded && (
                    <div className="border-t border-slate-700 bg-slate-900/60 p-3 space-y-3">
                      <div className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Asset Rules</div>
                      <Field label="Spawn Style">
                        <Select
                          value={media.schedule.spawnMode}
                          onChange={v => setAssetSchedule(media.id, { spawnMode: v as any })}
                          options={[
                            { value: "path", label: "Follow Motion Path" },
                            { value: "static", label: "Stay in Place" },
                          ]}
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Hard Limit / Hour">
                          <NumberInput value={media.schedule.hourlyLimit} onChange={v => setAssetSchedule(media.id, { hourlyLimit: v })} />
                        </Field>
                        <Field label="Hard Limit / Day">
                          <NumberInput value={media.schedule.dailyLimit} onChange={v => setAssetSchedule(media.id, { dailyLimit: v })} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Hour From">
                          <NumberInput value={media.schedule.hourStart} onChange={v => setAssetSchedule(media.id, { hourStart: v })} />
                        </Field>
                        <Field label="Hour To">
                          <NumberInput value={media.schedule.hourEnd} onChange={v => setAssetSchedule(media.id, { hourEnd: v })} />
                        </Field>
                      </div>
                      <Field label="Season">
                        <Select
                          value={media.schedule.season || "any"}
                          onChange={v => setAssetSchedule(media.id, { season: v as any })}
                          options={[
                            { value: "any", label: "Any" },
                            { value: "spring", label: "Spring" },
                            { value: "summer", label: "Summer" },
                            { value: "autumn", label: "Autumn" },
                            { value: "winter", label: "Winter" },
                          ]}
                        />
                      </Field>
                      {canvasAsset && (
                        <div className="rounded-md border border-emerald-800/40 bg-emerald-950/20 p-2 text-[10px] text-emerald-300">
                          ✅ Template on canvas — size/position will be used during runtime.
                        </div>
                      )}
                      {!canvasAsset && (
                        <div className="rounded-md border border-amber-800/40 bg-amber-950/20 p-2 text-[10px] text-amber-300">
                          ⚠️ Not on canvas. Switch ON to place it as a template.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}