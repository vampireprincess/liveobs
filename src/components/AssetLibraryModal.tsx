import { useRef, useState } from "react";
import { useStore } from "../store";
import { readFiles } from "../media";
import { uid, defaultSchedule } from "../factory";
import { Btn, Field, NumberInput, Select, Slider, TextInput, Toggle } from "./ui";
import type { AssetCategory, AssetSchedule } from "../types";

export default function AssetLibraryModal({ onClose, onPlace }: { onClose: () => void; onPlace: (mediaId: string) => void }) {
  const data = useStore((s) => s.data())!;
  const upd = useStore.getState().update;
  const removeMedia = useStore((s) => s.removeMedia);
  const inputRef = useRef<HTMLInputElement>(null);

  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCatSettings, setShowCatSettings] = useState(false);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  const categories = data.categories || [];
  const libraryMedia = data.media.filter((m) => m.categoryId !== "static-assets");
  const catAssets = activeCatId ? libraryMedia.filter((m) => m.categoryId === activeCatId) : libraryMedia;
  const activeCat = categories.find((c) => c.id === activeCatId);

  const onUpload = async (files: FileList | null) => {
    if (!files) return;
    const media = await readFiles(files);
    media.forEach((m) => {
      m.inLibrary = true;
      if (activeCatId) m.categoryId = activeCatId;
      useStore.getState().addMedia(m);
    });
  };

  const toggleSelect = (id: string, index: number, e: React.MouseEvent) => {
    setEditingId(id);
    setSelected((prev) => {
      const next = new Set<string>();
      if (e.shiftKey && lastClickedIndex !== null) {
        const a = Math.min(lastClickedIndex, index);
        const b = Math.max(lastClickedIndex, index);
        for (let i = a; i <= b; i++) next.add(catAssets[i].id);
      } else if (e.ctrlKey || e.metaKey) {
        prev.forEach((x) => next.add(x));
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setLastClickedIndex(index);
  };

  const addSelectedToCanvas = () => {
    selected.forEach(id => onPlace(id));
    setSelected(new Set());
    onClose();
  };

  const deleteSelected = () => {
    if(!confirm(`Delete ${selected.size} assets?`)) return;
    selected.forEach(id => removeMedia(id));
    setSelected(new Set());
  };

  const addCategoryToCanvas = (catId: string) => {
    data.media.filter(m => m.categoryId === catId).forEach(m => onPlace(m.id));
    onClose();
  };

  const addCategory = () => {
    const name = prompt("Category name:");
    if (!name) return;
    const cat: AssetCategory = { id: uid(), name, direction: "ltr", alternateDirection: true, flipOnDirection: true, flipAxis: "horizontal", speed: 1 };
    upd(d => { d.categories.push(cat); });
    setActiveCatId(cat.id);
  };

  const setAssetSchedule = (mediaId: string, patch: Partial<AssetSchedule>) => {
    upd((d) => {
      const m = d.media.find((x) => x.id === mediaId);
      if (m) m.schedule = { ...m.schedule, ...patch };
    });
  };

  const ea = editingId ? data.media.find((m) => m.id === editingId) : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-2" onClick={onClose}>
      <div className="flex h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        
        {/* Sidebar: Categories */}
        <div className="flex w-64 flex-col border-r border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Random Asset Library</h2>
            <button onClick={addCategory} className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white hover:bg-violet-500">+</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <button onClick={() => { setActiveCatId(null); setShowCatSettings(false); }} className={`group w-full rounded-xl px-3 py-3 text-left transition ${!activeCatId ? "bg-violet-600 text-white shadow-lg shadow-violet-900/20" : "text-slate-400 hover:bg-slate-800/50"}`}>
              <div className="text-xs font-bold uppercase tracking-wider">All Random Assets</div>
              <div className="text-[10px] opacity-60">{libraryMedia.length} items</div>
            </button>
            {categories.map((cat) => {
              const count = data.media.filter(m => m.categoryId === cat.id).length;
              const isSelected = activeCatId === cat.id;
              return (
                <div key={cat.id} className="relative group">
                  <button
                    onClick={() => { setActiveCatId(cat.id); setShowCatSettings(false); }}
                    className={`w-full rounded-xl px-3 py-3 text-left transition ${isSelected ? "bg-slate-800 text-white ring-1 ring-slate-700" : "text-slate-400 hover:bg-slate-800/40"}`}
                  >
                    <div className="text-xs font-bold uppercase tracking-wider">{cat.name}</div>
                    <div className="text-[10px] opacity-60">{count} items</div>
                  </button>
                  <button 
                    onClick={() => addCategoryToCanvas(cat.id)}
                    title="Add all to Canvas"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-emerald-600/20 text-emerald-400 opacity-0 group-hover:opacity-100 hover:bg-emerald-600 hover:text-white transition flex items-center justify-center text-lg"
                  >
                    +
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main: Asset Grid */}
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/30">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-slate-100">{activeCat?.name || "Library"}</h1>
              {selected.size > 0 && (
                <div className="flex items-center gap-2 rounded-full bg-violet-600/20 px-3 py-1 ring-1 ring-violet-500/50">
                  <span className="text-xs font-bold text-violet-300">{selected.size} Selected</span>
                  <div className="h-4 w-px bg-violet-500/30 mx-1" />
                  <button onClick={addSelectedToCanvas} className="text-[10px] font-bold uppercase text-white hover:underline">Add to Canvas</button>
                  <button onClick={deleteSelected} className="text-[10px] font-bold uppercase text-rose-400 hover:underline">Delete</button>
                </div>
              )}
              {catAssets.length > 0 && (
                <button
                  onClick={() => setSelected(new Set(catAssets.map((m) => m.id)))}
                  className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-bold uppercase text-slate-300 hover:bg-slate-700"
                >
                  Select all
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {activeCatId && <Btn onClick={() => setShowCatSettings(!showCatSettings)} variant={showCatSettings ? "primary" : "default"}>⚙ Category Rules</Btn>}
              <input ref={inputRef} type="file" multiple hidden onChange={(e) => onUpload(e.target.files)} />
              <Btn variant="primary" onClick={() => inputRef.current?.click()}>⬆ Upload</Btn>
              <div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 p-1">
                <input
                  placeholder="Paste image/Lottie URL…"
                  className="w-44 bg-transparent px-2 py-1 text-[11px] text-slate-200 outline-none placeholder:text-slate-500"
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      const rawUrl = (e.target as HTMLInputElement).value.trim();
                      const url = (rawUrl.match(/\((https?:\/\/[^)]+)\)/)?.[1] || rawUrl.match(/https?:\/\/\S+/)?.[0] || rawUrl).replace(/[\])>.,;]+$/, "");
                      if (!url) return;
                      const name = url.split("/").pop()?.split("?")[0] || "Remote asset";
                      const lower = url.toLowerCase();
                      const type = lower.endsWith(".mp4") || lower.endsWith(".webm") ? "video" : lower.endsWith(".json") ? "lottie" : lower.endsWith(".webp") ? "webp" : lower.endsWith(".gif") ? "gif" : "image";
                      const catId = activeCatId || "cat-general";

                      const addRemoteMedia = (w: number, h: number) => {
                        useStore.getState().addMedia({
                          id: uid(),
                          name,
                          type: type as any,
                          dataUrl: url,
                          width: w,
                          height: h,
                          categoryId: catId,
                          schedule: defaultSchedule(),
                          inLibrary: true,
                        });
                        (e.target as HTMLInputElement).value = "";
                      };

                      if (type === "image") {
                        const img = new Image();
                        img.referrerPolicy = "no-referrer";
                        img.onload = () => addRemoteMedia(img.naturalWidth || 500, img.naturalHeight || 300);
                        img.onerror = () => addRemoteMedia(500, 300);
                        img.src = url;
                      } else {
                        addRemoteMedia(type === "video" ? 640 : 500, type === "video" ? 360 : 300);
                      }
                    }
                  }}
                />
                <span className="px-1 text-[10px] text-slate-500">↵</span>
              </div>
              <button onClick={onClose} className="ml-2 h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-xl text-slate-400 hover:bg-slate-700 hover:text-white transition">✕</button>
            </div>
          </div>

           {showCatSettings && activeCat && (
             <div className="grid grid-cols-4 gap-6 bg-slate-900/60 p-6 border-b border-slate-800 animate-in slide-in-from-top duration-200">
                <div className="space-y-4">
                   <Field label="Category Name"><TextInput value={activeCat.name} onChange={v => upd(d => {const c=d.categories.find(x=>x.id===activeCat.id); if(c)c.name=v;})} /></Field>
                   <Field label="Motion Path"><Select value={activeCat.pathId || ""} onChange={v => upd(d => {const c=d.categories.find(x=>x.id===activeCat.id); if(c)c.pathId=v||undefined;})} options={[{value:"", label:"None"}, ...data.paths.map(p=>({value:p.id, label:p.name}))]} /></Field>
                </div>
                <div className="space-y-4">
                   <Field label="Layer"><Select value={activeCat.layerId || "layer-rand"} onChange={v => upd(d => {const c=d.categories.find(x=>x.id===activeCat.id); if(c)c.layerId=v||undefined;})} options={[{value:"layer-rand", label:"Random Assets"}, ...data.layers.filter(l => l.id !== "layer-rand").map(l=>({value:l.id, label:l.name}))]} /></Field>
                   <Field label="Base Speed"><Slider label="" min={0.1} max={5} step={0.1} value={activeCat.speed} onChange={v => upd(d => {const c=d.categories.find(x=>x.id===activeCat.id); if(c)c.speed=v;})} /></Field>
                </div>
                <div className="space-y-3">
                   <Field label="Start Direction"><Select value={activeCat.direction} onChange={v => upd(d => {const c=d.categories.find(x=>x.id===activeCat.id); if(c)c.direction=v as any;})} options={[{value:"ltr", label:"Left→Right"}, {value:"rtl", label:"Right→Left"}, {value:"random", label:"Random"}]} /></Field>
                   <Toggle label="Alternate Direction" checked={activeCat.alternateDirection} onChange={v => upd(d => {const c=d.categories.find(x=>x.id===activeCat.id); if(c)c.alternateDirection=v;})} />
                   <Toggle label="Flip H on Direction" checked={activeCat.flipOnDirection} onChange={v => upd(d => {const c=d.categories.find(x=>x.id===activeCat.id); if(c)c.flipOnDirection=v;})} />
                   {activeCat.flipOnDirection && <Field label="Flip Axis"><Select value={activeCat.flipAxis || "horizontal"} onChange={v => upd(d => {const c=d.categories.find(x=>x.id===activeCat.id); if(c)c.flipAxis=v as any;})} options={[{value:"horizontal", label:"Horizontal (scaleX)"}, {value:"vertical", label:"Vertical (scaleY)"}, {value:"both", label:"Both (scale)"}]} /></Field>}
                   <Toggle label="Rotate along Path" checked={!!activeCat.rotateAlongPath} onChange={v => upd(d => {const c=d.categories.find(x=>x.id===activeCat.id); if(c)c.rotateAlongPath=v;})} />
                </div>
                <div className="flex items-end">
                   <Btn variant="danger" className="w-full py-3" onClick={() => { if(confirm("Delete category? Assets will move to General.")) { upd(d => { d.categories = d.categories.filter(c => c.id !== activeCat.id); d.media.forEach(m => { if(m.categoryId === activeCat.id) m.categoryId = "cat-general"; }); }); setActiveCatId(null); } }}>Delete Category</Btn>
                </div>
             </div>
           )}

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {catAssets.map((m, idx) => {
                const isSel = selected.has(m.id);
                const isOnCanvas = data.assets.some(a => a.mediaId === m.id);
                
                return (
                  <div
                    key={m.id}
                    onClick={(e) => toggleSelect(m.id, idx, e)}
                    className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all ${isSel ? "border-violet-500 bg-violet-600/10 ring-2 ring-violet-500/50" : "border-slate-800 bg-slate-900/30 hover:border-slate-600"}`}
                  >
                    {isOnCanvas && (
                      <div className="absolute top-2 right-2 z-10 bg-emerald-500/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm backdrop-blur-sm">
                        ON CANVAS
                      </div>
                    )}
                    <div className="aspect-square flex items-center justify-center p-3 bg-black/20">
                       {m.type === "lottie" ? <span className="text-3xl">🎬</span> : m.type === "video" ? <video src={m.dataUrl} referrerPolicy="no-referrer" className="h-full w-full object-contain" muted /> : <img src={m.dataUrl} referrerPolicy="no-referrer" className="h-full w-full object-contain" />}
                    </div>
                    <div className="p-2 border-t border-slate-800/50 bg-slate-950/50">
                       <div className="truncate text-[10px] font-bold text-slate-300">{m.name}</div>
                       <div className="flex items-center justify-between mt-1">
                          <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">{m.type}</span>
                          <div className="flex gap-1">
                             <button onClick={(e) => { e.stopPropagation(); onPlace(m.id); }} className="rounded-md bg-slate-800 p-1 text-slate-400 hover:bg-emerald-600 hover:text-white">＋</button>
                             <button onClick={(e) => { e.stopPropagation(); removeMedia(m.id); }} className="rounded-md bg-slate-800 p-1 text-slate-400 hover:bg-rose-600 hover:text-white">×</button>
                          </div>
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Pane: Per-Asset Schedule */}
        {ea && (
          <div className="w-80 shrink-0 border-l border-slate-800 bg-slate-900/80 p-5 overflow-y-auto animate-in slide-in-from-right duration-200">
             <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-slate-100">Asset Rules</h2>
                <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-white">✕</button>
             </div>
             <div className="space-y-6">
                <div className="space-y-4">
                  <Field label="Name"><TextInput value={ea.name} onChange={v => upd(d => {const x=d.media.find(xx=>xx.id===ea.id); if(x)x.name=v;})} /></Field>
                  <Field label="Category"><Select value={ea.categoryId} onChange={v => upd(d => {const x=d.media.find(xx=>xx.id===ea.id); if(x)x.categoryId=v;})} options={categories.map(c=>({value:c.id, label:c.name}))} /></Field>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 space-y-4">
                   <div className="flex items-center justify-between"><span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Behavior</span></div>
                   <Field label="Spawn Style"><Select value={ea.schedule.spawnMode} onChange={v => setAssetSchedule(ea.id, {spawnMode: v as any})} options={[{value:"path", label:"Follow Motion Path"}, {value:"static", label:"Stay in Place"}]} /></Field>
                   <p className="text-[9px] text-slate-400">If 'Follow Motion Path', asset moves along the category path and ignores duration. If 'Stay in Place', asset appears randomly and vanishes.</p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-4">
                   <span className="text-[10px] font-bold text-slate-500 uppercase">Hard Limits (Frequency)</span>
                   <div className="grid grid-cols-3 gap-2">
                      <Field label="Per Hour"><NumberInput value={ea.schedule.hourlyLimit} onChange={v => setAssetSchedule(ea.id, {hourlyLimit: v})} /></Field>
                      <Field label="Per Day"><NumberInput value={ea.schedule.dailyLimit} onChange={v => setAssetSchedule(ea.id, {dailyLimit: v})} /></Field>
                      <Field label="Per Week"><NumberInput value={ea.schedule.weeklyLimit} onChange={v => setAssetSchedule(ea.id, {weeklyLimit: v})} /></Field>
                   </div>
                   <p className="text-[9px] text-slate-400">e.g. 90 Per Hour means asset spawns every ~40 seconds.</p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-4">
                   <span className="text-[10px] font-bold text-slate-500 uppercase">Appearance Window</span>
                   <Field label="Season">
                     <Select value={ea.schedule.season || "any"} onChange={v => setAssetSchedule(ea.id, {season: v as any})} options={[
                       {value: "any", label: "Any Season"}, {value: "spring", label: "Spring"}, {value: "summer", label: "Summer"}, {value: "autumn", label: "Autumn"}, {value: "winter", label: "Winter"}
                     ]} />
                   </Field>
                   <div className="grid grid-cols-2 gap-2">
                      <Field label="Date From"><input type="date" value={ea.schedule.dateStart} onChange={e => setAssetSchedule(ea.id, {dateStart: e.target.value})} className="w-full bg-slate-800 border-none rounded p-1 text-[10px]" /></Field>
                      <Field label="Date To"><input type="date" value={ea.schedule.dateEnd} onChange={e => setAssetSchedule(ea.id, {dateEnd: e.target.value})} className="w-full bg-slate-800 border-none rounded p-1 text-[10px]" /></Field>
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                      <Field label="Hour From"><NumberInput value={ea.schedule.hourStart} onChange={v => setAssetSchedule(ea.id, {hourStart: v})} /></Field>
                      <Field label="Hour To"><NumberInput value={ea.schedule.hourEnd} onChange={v => setAssetSchedule(ea.id, {hourEnd: v})} /></Field>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}