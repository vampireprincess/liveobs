import { useStore } from "../../store";

// Random Assets Debug / Schedule Inspector.
// Shows why a random/scheduled asset is or isn't appearing right now.
export default function DebugTab() {
  const data = useStore((s) => s.data())!;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentHour = now.getHours() + now.getMinutes() / 60;

  // Debug: iterate all media that could be triggered. Each gets a diagnostic string.
  // Only show assets from Random Asset Library that are actually placed on canvas.
  // Static quick-upload assets are intentionally excluded.
  const placedMediaIds = new Set(data.assets.map((a) => a.mediaId).filter(Boolean));
  const diagnostics = data.media.filter((m) => m.inLibrary && placedMediaIds.has(m.id)).map((m) => {
    const issues: { level: "ok" | "warn" | "err"; msg: string }[] = [];



    if (m.schedule.dateStart && today < m.schedule.dateStart) {
      issues.push({ level: "warn", msg: `Date window not started yet (begins ${m.schedule.dateStart}).` });
    }
    if (m.schedule.dateEnd && today > m.schedule.dateEnd) {
      issues.push({ level: "err", msg: `Date window ended (was until ${m.schedule.dateEnd}).` });
    }
    if (m.schedule.hourStart <= m.schedule.hourEnd) {
      if (currentHour < m.schedule.hourStart || currentHour > m.schedule.hourEnd) {
        issues.push({ level: "warn", msg: `Time window closed: ${m.schedule.hourStart}:00 – ${m.schedule.hourEnd}:00.` });
      }
    } else if (currentHour < m.schedule.hourStart && currentHour > m.schedule.hourEnd) {
      issues.push({ level: "warn", msg: `Time window closed: ${m.schedule.hourStart}:00 – ${m.schedule.hourEnd}:00.` });
    }

    if (m.schedule.hourlyLimit > 0 || m.schedule.dailyLimit > 0 || m.schedule.weeklyLimit > 0) {
      // We can't know exact runtime counts from editor data, but we can indicate the limit is set.
      issues.push({ level: "ok", msg: `Limits set: hourly=${m.schedule.hourlyLimit || "∞"}, daily=${m.schedule.dailyLimit || "∞"}, weekly=${m.schedule.weeklyLimit || "∞"}.` });
    }

    if (m.schedule.spawnMode === "path") {
      const cat = data.categories.find((c) => c.id === m.categoryId);
      const hasPath = !!data.paths.find((p) => p.id === cat?.pathId);
      if (!hasPath) {
        issues.push({ level: "err", msg: `Spawn mode is "Path Movement" but NO PATH is assigned. Open Category Settings and set a Motion Path.` });
      } else {
        const p = data.paths.find((pp) => pp.id === cat?.pathId);
        issues.push({ level: "ok", msg: `Will move on path "${p?.name}" (from category "${cat?.name}").` });
      }
    } else if (m.schedule.spawnMode === "static") {
      issues.push({ level: "ok", msg: `Will appear at a random static position and disappear.` });
    }

    if (issues.length === 0) {
      issues.push({ level: "ok", msg: "Asset is active and should appear soon." });
    }

    const cat = data.categories.find((c) => c.id === m.categoryId);
    return { media: m, category: cat, issues };
  });

  const colorFor = (lvl: "ok" | "warn" | "err") =>
    lvl === "ok" ? "text-emerald-300 bg-emerald-950/30" :
    lvl === "warn" ? "text-amber-200 bg-amber-950/30" :
    "text-rose-300 bg-rose-950/30";

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-violet-700 bg-violet-950/30 p-3 text-[10px] text-violet-200">
        💡 This panel ONLY inspects assets that have a schedule (Library uploads). Static assets on the canvas are not shown here.
        {diagnostics.length === 0 && <div className="mt-1">No random/scheduled assets defined yet. Use the Asset Library to add some.</div>}
      </div>
      {diagnostics.map(({ media, category, issues }) => {
        const top = issues[0];
        return (
          <div key={media.id} className={`rounded-lg border border-slate-800 p-3 ${colorFor(top.level)}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-100">{media.name}</div>
                <div className="text-[10px] text-slate-400 uppercase">Category: {category?.name || "None"} · {media.schedule.spawnMode} · {media.schedule.hourlyLimit}/h</div>
              </div>
              <div className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                top.level === "ok" ? "bg-emerald-600" : top.level === "warn" ? "bg-amber-600" : "bg-rose-600"
              }`}>
                {top.level}
              </div>
            </div>
            <ul className="mt-2 space-y-1">
              {issues.map((i, idx) => (
                <li key={idx} className="flex items-start gap-2 text-[11px]">
                  <span className={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${i.level === "ok" ? "bg-emerald-400" : i.level === "warn" ? "bg-amber-400" : "bg-rose-400"}`} />
                  <span className="text-slate-200">{i.msg}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
