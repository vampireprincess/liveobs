import { useStore } from "../../store";
import { newZone } from "../../factory";
import { Btn, EmptyHint, Panel } from "../ui";

export default function ZonesTab() {
  const data = useStore((s) => s.data())!;
  const selId = useStore((s) => s.selId);
  const selKind = useStore((s) => s.selKind);
  const tool = useStore((s) => s.tool);
  const keepClear = useStore((s) => s.zoneDrawKeepClear);

  const pickTool = (t: typeof tool) => {
    useStore.getState().setTool(t);
  };

  const addOBSPreset = (kind: "screen" | "chat" | "webcam" | "goal") => {
    const presets: Record<string, { x: number; y: number; w: number; h: number; name: string }> = {
      screen: { x: 80, y: 80, w: 1240, h: 700, name: "Screen Slot" },
      chat: { x: 1400, y: 80, w: 440, h: 900, name: "Chat Slot" },
      webcam: { x: 1420, y: 720, w: 400, h: 260, name: "Webcam Slot" },
      goal: { x: 80, y: 900, w: 500, h: 100, name: "Goal Widget Slot" },
    };
    const p = presets[kind];
    const z = newZone("rect", "exclude");
    z.name = "🔒 " + p.name;
    z.color = "#f43f5e";
    z.global = true;
    z.locked = true;
    z.x = p.x;
    z.y = p.y;
    z.w = p.w;
    z.h = p.h;
    useStore.getState().addZone(z);
    useStore.getState().select("zone", z.id);
  };

  return (
    <div>
      <Panel title="OBS Safe Area Slots">
        <p className="mb-2 text-[10px] text-slate-500">
          Pre-configured locked safe areas. Nothing spawns or animates inside — perfect for stream/chat/webcam holes.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <Btn onClick={() => addOBSPreset("screen")}>📺 Screen</Btn>
          <Btn onClick={() => addOBSPreset("chat")}>💬 Chat</Btn>
          <Btn onClick={() => addOBSPreset("webcam")}>🎥 Webcam</Btn>
          <Btn onClick={() => addOBSPreset("goal")}>🎯 Goal Widget</Btn>
        </div>
      </Panel>

      <Panel title="Draw Zones on Canvas">
        <div className={`mb-2 flex items-center justify-between rounded-lg border px-2.5 py-2 ${keepClear ? "border-rose-600/60 bg-rose-950/40" : "border-emerald-600/40 bg-emerald-950/30"}`}>
          <div>
            <div className={`text-[11px] font-semibold ${keepClear ? "text-rose-300" : "text-emerald-300"}`}>
              {keepClear ? "🚫 Keep-Clear (Exclude) mode" : "✅ Include mode"}
            </div>
            <div className="text-[9px] text-slate-400">
              {keepClear ? "Drawn shapes BLOCK everything inside" : "Drawn shapes ALLOW content inside"}
            </div>
          </div>
          <button
            onClick={() => useStore.getState().setZoneDrawKeepClear(!keepClear)}
            className={`relative h-5 w-9 shrink-0 rounded-full transition ${keepClear ? "bg-rose-500" : "bg-slate-600"}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${keepClear ? "left-4.5" : "left-0.5"}`} style={{ left: keepClear ? "18px" : "2px" }} />
          </button>
        </div>
        <p className="mb-2 text-[10px] text-slate-500">
          Pick a shape, then draw on the canvas. Rect / Ellipse / Triangle = drag. Polygon = click to add points (click near the first point or press Enter to finish).
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          <Btn onClick={() => pickTool("zone-rect")} variant={tool === "zone-rect" ? "primary" : "default"}>▭ Rect</Btn>
          <Btn onClick={() => pickTool("zone-ellipse")} variant={tool === "zone-ellipse" ? "primary" : "default"}>◯ Ellipse</Btn>
          <Btn onClick={() => pickTool("zone-triangle")} variant={tool === "zone-triangle" ? "primary" : "default"}>▲ Triangle</Btn>
          <Btn onClick={() => pickTool("zone-poly")} variant={tool === "zone-poly" ? "primary" : "default"}>⬡ Poly</Btn>
        </div>
        {tool === "zone-poly" && (
          <div className="rounded bg-sky-950/40 px-2 py-1.5 text-[10px] text-sky-300">
            Click on canvas to add polygon points. Click near the FIRST point (or press Enter) to close the shape, then switch to Select.
          </div>
        )}
      </Panel>

      <Panel title="Zone List">
        {data.zones.length === 0 ? (
          <EmptyHint>No zones yet. Draw one on the canvas or add a preset above.</EmptyHint>
        ) : (
          <div className="space-y-1">
            {data.zones.map((z) => {
              const sel = selKind === "zone" && selId === z.id;
              return (
                <div key={z.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${sel ? "border-violet-500 bg-violet-500/10" : "border-slate-800 bg-slate-800/30"}`}>
                  <span className="h-3 w-3 rounded" style={{ background: z.color }} />
                  <button onClick={() => useStore.getState().select("zone", z.id)} className="flex-1 text-left text-xs text-slate-200 truncate">
                    {z.name}{" "}
                    <span className="text-[10px] text-slate-500">
                      · {z.kind} · {z.shape}
                      {z.global && <span className="ml-1 rounded bg-rose-900/60 px-1 text-rose-300">GLOBAL</span>}
                      {z.locked && <span className="ml-1 rounded bg-amber-900/60 px-1 text-amber-300">🔒</span>}
                    </span>
                  </button>
                  <button onClick={() => useStore.getState().removeZone(z.id)} className="rounded px-1.5 text-rose-400 hover:bg-rose-900/40">×</button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
