import { useState } from "react";
import { useStore } from "../../store";
import { newRandomGroup } from "../../factory";
import { Btn, EmptyHint, Panel } from "../ui";

export default function RandomTab() {
  const data = useStore((s) => s.data())!;
  const selId = useStore((s) => s.selId);
  const selKind = useStore((s) => s.selKind);
  const [showDropdown, setShowDropdown] = useState(false);

  const categories = data.categories || [];

  const createGroupForCategory = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const layer = cat.layerId || "layer-rand";
    const g = newRandomGroup(layer, catId);
    useStore.getState().addGroup(g);
    useStore.getState().select("group", g.id);
    setShowDropdown(false);
  };

  return (
    <Panel title="Random Event Groups" action={
      <div className="relative">
        <Btn variant="primary" onClick={() => setShowDropdown(!showDropdown)}>+ Group</Btn>
        {showDropdown && (
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-md border border-slate-700 bg-slate-800 p-1 shadow-xl">
            <div className="mb-1 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">Select Category</div>
            {categories.length === 0 ? (
              <div className="px-2 py-2 text-xs text-slate-400">No categories found.</div>
            ) : (
              categories.map(cat => (
                <button 
                  key={cat.id} 
                  onClick={() => createGroupForCategory(cat.id)}
                  className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-violet-600"
                >
                  {cat.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    }>
      <p className="mb-2 text-[11px] text-slate-500">Groups are extensions of Random Library categories. Select a category to manage its path, speed, zones, and members.</p>
      {data.randomGroups.length === 0 ? (
        <EmptyHint>No groups created. Click "+ Group" to link a category.</EmptyHint>
      ) : (
        <div className="space-y-1">
          {data.randomGroups.map((g) => {
            const sel = selKind === "group" && selId === g.id;
            const cat = categories.find(c => c.id === g.categoryId);
            return (
              <div key={g.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${sel ? "border-violet-500 bg-violet-500/10" : "border-slate-800 bg-slate-800/30"}`}>
                <button onClick={() => useStore.getState().select("group", g.id)} className="flex-1 text-left text-sm text-slate-200">
                  {cat ? cat.name : g.name} <span className="text-[10px] text-slate-500">· Category Group</span>
                </button>
                <span className={`h-2 w-2 rounded-full ${g.enabled ? "bg-emerald-400" : "bg-slate-600"}`} />
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
