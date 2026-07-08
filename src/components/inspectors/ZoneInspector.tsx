import { useStore } from "../../store";
import { Btn, Field, NumberInput, Panel, Select, TextInput, Toggle } from "../ui";
import type { Zone, ZoneKind } from "../../types";

export default function ZoneInspector() {
  const data = useStore((s) => s.data())!;
  const selId = useStore((s) => s.selId)!;
  const z = data.zones.find((x) => x.id === selId);
  if (!z) return null;
  const set = (patch: Partial<Zone>) => useStore.getState().updateZone(z.id, patch);

  return (
    <div>
      <Panel title="Zone / Mask">
        <Field label="Name"><TextInput value={z.name} onChange={(v) => set({ name: v })} /></Field>
        <Field label="Type">
          <Select value={z.kind} onChange={(v) => set({ kind: v as ZoneKind, color: v === "include" ? "#34d399" : "#f87171" })} options={[
            { value: "include", label: "Include (allow inside)" },
            { value: "exclude", label: "Exclude (block inside)" },
          ]} />
        </Field>
        <Field label="Color">
          <input type="color" value={z.color} onChange={(e) => set({ color: e.target.value })} className="h-9 w-full rounded" />
        </Field>
        {z.kind === "exclude" && (
          <Toggle
            label="Global keep-clear (blocks everything)"
            checked={!!z.global}
            onChange={(v) => set({ global: v })}
          />
        )}
        <Toggle
          label={z.locked ? "🔒 Locked (protected)" : "🔓 Unlocked"}
          checked={!!z.locked}
          onChange={(v) => set({ locked: v })}
        />
        {z.global && (
          <p className="rounded bg-rose-950/40 p-2 text-[10px] text-rose-300">
            Global mask: all particles and random assets are blocked/hidden inside this area, without being assigned. Ideal for OBS screen/chat/webcam holes.
          </p>
        )}
        <div className="rounded bg-slate-800/40 p-2 text-[10px] text-slate-400">
          Shape: <b>{z.shape}</b>. {z.shape === "polygon" ? "Add points via the Polygon tool on canvas." : "Drag handles on canvas to resize; unlock first to move."}
        </div>
        <Btn variant="danger" className="w-full" onClick={() => { useStore.getState().removeZone(z.id); useStore.getState().select(null, null); }}>🗑 Delete Zone</Btn>
      </Panel>

      {z.shape !== "polygon" && (
        <Panel title="Bounds">
          <div className="grid grid-cols-2 gap-2">
            <Field label="X"><NumberInput value={z.x} onChange={(v) => set({ x: v })} /></Field>
            <Field label="Y"><NumberInput value={z.y} onChange={(v) => set({ y: v })} /></Field>
            <Field label="Width"><NumberInput value={z.w} onChange={(v) => set({ w: v })} /></Field>
            <Field label="Height"><NumberInput value={z.h} onChange={(v) => set({ h: v })} /></Field>
          </div>
        </Panel>
      )}

      {z.shape === "polygon" && (
        <Panel title="Polygon Points">
          <p className="mb-2 text-[11px] text-slate-500">{z.points.length} points.</p>
          <Btn className="w-full" onClick={() => set({ points: z.points.slice(0, -1) })}>Remove last point</Btn>
        </Panel>
      )}
    </div>
  );
}
