import { useStore } from "../../store";
import { Btn, Field, NumberInput, Panel, Select, Slider, TextInput, Toggle } from "../ui";
import type { AssetFit, BlendMode, ShapeKind, BehaviorAnimation } from "../../types";

const REF_POINTS = [
  [0, 0], [0.5, 0], [1, 0],
  [0, 0.5], [0.5, 0.5], [1, 0.5],
  [0, 1], [0.5, 1], [1, 1],
];

export default function AssetInspector() {
  const data = useStore((s) => s.data())!;
  const selId = useStore((s) => s.selId)!;
  const a = data.assets.find((x) => x.id === selId);
  if (!a) return null;
  const set = (patch: Partial<typeof a>) => useStore.getState().updateAsset(a.id, patch);

  const media = a.mediaId ? data.media.find((m) => m.id === a.mediaId) : undefined;
  const W = data.canvasWidth;
  const H = data.canvasHeight;

  const align = (hx: 0 | 1 | 2, vy: 0 | 1 | 2) => {
    set({
      x: hx === 0 ? 0 : hx === 1 ? (W - a.width) / 2 : W - a.width,
      y: vy === 0 ? 0 : vy === 1 ? (H - a.height) / 2 : H - a.height,
    });
  };

  const canvasFill = (fit: AssetFit) => {
    set({ x: 0, y: 0, width: W, height: H, fit });
  };

  const mediaRatio = (media?.width ?? a.width) / Math.max(1, media?.height ?? a.height);

  const sizePresets: { label: string; apply: () => void }[] = [
    { label: "Full canvas", apply: () => set({ x: 0, y: 0, width: W, height: H }) },
    { label: "½ canvas", apply: () => set({ width: W / 2, height: H / 2 }) },
    { label: "⅓ canvas", apply: () => set({ width: W / 3, height: H / 3 }) },
    { label: "¼ canvas", apply: () => set({ width: W / 4, height: H / 4 }) },
    {
      label: "Fit width",
      apply: () => set({ x: 0, width: W, height: Math.round(W / mediaRatio) }),
    },
    {
      label: "Fit height",
      apply: () => set({ y: 0, height: H, width: Math.round(H * mediaRatio) }),
    },
    ...(media?.width && media?.height
      ? [{ label: "Original size", apply: () => set({ width: media.width!, height: media.height! }) }]
      : []),
  ];

  const updateShape = (patch: Partial<NonNullable<typeof a.shape>>) => {
    if (!a.shape) return;
    set({ shape: { ...a.shape, ...patch } });
  };

  return (
    <div>
      <Panel title="Asset">
        <Field label="Name">
          <TextInput value={a.name} onChange={(v) => set({ name: v })} />
        </Field>
        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Layer">
            <Select
              value={a.layerId}
              onChange={(v) => set({ layerId: v })}
              options={data.layers.map((l) => ({ value: l.id, label: l.name }))}
            />
          </Field>
          <Field label="Blend">
            <Select
              value={a.blend}
              onChange={(v) => set({ blend: v as BlendMode })}
              options={[
                { value: "normal", label: "Normal" },
                { value: "screen", label: "Screen" },
                { value: "multiply", label: "Multiply" },
                { value: "overlay", label: "Overlay" },
                { value: "lighten", label: "Lighten" },
                { value: "add", label: "Add / Glow" },
              ]}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Toggle label="Visible" checked={a.visible} onChange={(v) => set({ visible: v })} />
          <Toggle label="Locked" checked={a.locked} onChange={(v) => set({ locked: v })} />
        </div>
        <div className="flex gap-1.5">
          <Btn className="flex-1" onClick={() => useStore.getState().duplicateAsset(a.id)}>⧉ Duplicate</Btn>
          <Btn variant="danger" onClick={() => { useStore.getState().removeAsset(a.id); useStore.getState().select(null, null); }}>🗑</Btn>
        </div>
      </Panel>

      <Panel title="Transform">
        <div className="grid grid-cols-4 gap-1.5">
          <Field label="X"><NumberInput value={a.x} onChange={(v) => set({ x: v })} /></Field>
          <Field label="Y"><NumberInput value={a.y} onChange={(v) => set({ y: v })} /></Field>
          <Field label="W"><NumberInput value={a.width} onChange={(v) => set({ width: Math.max(10, v) })} /></Field>
          <Field label="H"><NumberInput value={a.height} onChange={(v) => set({ height: Math.max(10, v) })} /></Field>
        </div>
        <Slider label="Rotation" min={-180} max={180} value={a.rotation} onChange={(v) => set({ rotation: v })} format={(v) => `${v}°`} />
        <Slider label="Opacity" min={0} max={1} step={0.05} value={a.opacity} onChange={(v) => set({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
        <div className="grid grid-cols-2 gap-1.5">
          <Btn onClick={() => set({ flipH: !a.flipH })}>↔ Flip H {a.flipH ? "✓" : ""}</Btn>
          <Btn onClick={() => set({ flipV: !a.flipV })}>↕ Flip V {a.flipV ? "✓" : ""}</Btn>
        </div>
      </Panel>

      <Panel title="Fit to Canvas">
        <Field label="Fill entire canvas with:">
          <div className="grid grid-cols-4 gap-1">
            {(["contain", "cover", "fill", "auto"] as AssetFit[]).map((fit) => (
              <button
                key={fit}
                onClick={() => canvasFill(fit)}
                className={`rounded border px-1 py-1.5 text-[10px] capitalize font-medium ${
                  (a.fit ?? "contain") === fit && a.width === W && a.height === H && a.x === 0 && a.y === 0
                    ? "border-violet-500 bg-violet-500/20 text-violet-200"
                    : "border-slate-700 bg-slate-800/40 text-slate-300 hover:border-violet-500"
                }`}
              >
                {fit}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[9px] leading-3 text-slate-500">
            Resizes asset to <b>Full Canvas ({W}×{H})</b>.
          </p>
        </Field>
      </Panel>

      <Panel title="Manual Size & Align">
        <Field label="Size presets">
          <div className="grid grid-cols-3 gap-1">
            {sizePresets.map((p) => (
              <button
                key={p.label}
                onClick={p.apply}
                className="rounded border border-slate-700 bg-slate-800/40 px-1 py-1 text-[10px] text-slate-300 hover:border-violet-500 hover:text-violet-200"
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Align on canvas (9-point)">
          <div className="mx-auto grid w-28 grid-cols-3 gap-1 rounded-lg border border-slate-800 bg-slate-950/50 p-1.5">
            {([0, 1, 2] as const).flatMap((vy) =>
              ([0, 1, 2] as const).map((hx) => (
                <button
                  key={`${hx}-${vy}`}
                  title={`${["top", "middle", "bottom"][vy]} ${["left", "center", "right"][hx]}`}
                  onClick={() => align(hx, vy)}
                  className="group flex h-7 items-center justify-center rounded border border-slate-700 bg-slate-800/50 hover:border-violet-500 hover:bg-violet-500/20"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 group-hover:bg-violet-200" />
                </button>
              ))
            )}
          </div>
        </Field>
      </Panel>

      {a.shape && (
        <Panel title="Shape Style">
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Type">
              <Select
                value={a.shape.kind}
                onChange={(v) => updateShape({ kind: v as ShapeKind })}
                options={[
                  { value: "rect", label: "Rectangle" },
                  { value: "ellipse", label: "Ellipse" },
                  { value: "triangle", label: "Triangle" },
                  { value: "line", label: "Line" },
                ]}
              />
            </Field>
            <Field label="Z-offset">
              <NumberInput value={a.zoffset} onChange={(v) => set({ zoffset: v })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Fill">
              <input type="color" value={a.shape.fill} onChange={(e) => updateShape({ fill: e.target.value })} className="h-7 w-full rounded" />
            </Field>
            <Field label="Stroke">
              <input type="color" value={a.shape.stroke} onChange={(e) => updateShape({ stroke: e.target.value })} className="h-7 w-full rounded" />
            </Field>
          </div>
          <Slider label="Stroke width" min={0} max={24} value={a.shape.strokeWidth} onChange={(v) => updateShape({ strokeWidth: v })} />
          {a.shape.kind === "rect" && <Slider label="Corner radius" min={0} max={50} value={a.shape.radius} onChange={(v) => updateShape({ radius: v })} />}
        </Panel>
      )}

      <Panel title="Behavior Animation" defaultCollapsed>
        <Field label="Animation">
          <Select
            value={a.animation || "none"}
            onChange={(v) => set({ animation: v as BehaviorAnimation })}
            options={[
              { value: "none", label: "None" },
              { value: "pendulum", label: "Pendulum (Swing)" },
              { value: "rotation", label: "Rotation (Spin)" },
              { value: "float", label: "Floating (Up/Down)" },
              { value: "pulse", label: "Pulsing (Size)" },
              { value: "bounce", label: "Bouncing" },
              { value: "shake", label: "Shaking (Glitch)" },
              { value: "wiggle", label: "Wiggling (Side-to-Side)" },
              { value: "skew", label: "Skewing" },
              { value: "blur", label: "Focus Pulse (Blur)" },
            ]}
          />
        </Field>
        {a.animation && a.animation !== "none" && (
          <div className="space-y-3 pt-2">
            <Slider label="Animation Intensity/Speed" min={0.1} max={5} step={0.1} value={a.animSpeed ?? 1} onChange={(v) => set({ animSpeed: v })} />
            
            <Field label="Reference Point (Pivot)">
              <div className="mx-auto grid w-24 grid-cols-3 gap-1 rounded-lg border border-slate-800 bg-slate-950/50 p-1.5">
                {REF_POINTS.map(([x, y], i) => (
                  <button
                    key={i}
                    onClick={() => set({ refPointX: x, refPointY: y })}
                    className={`h-5 w-full rounded border transition flex items-center justify-center ${
                      (a.refPointX ?? 0.5) === x && (a.refPointY ?? 0.5) === y
                        ? "border-violet-500 bg-violet-600/30"
                        : "border-slate-800 bg-slate-900/60 hover:border-slate-600"
                    }`}
                  >
                    <div className={`h-1 w-1 rounded-full ${(a.refPointX ?? 0.5) === x && (a.refPointY ?? 0.5) === y ? "bg-white" : "bg-slate-600"}`} />
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[9px] text-center text-slate-500 italic">Sets the anchor for rotation and swing.</p>
            </Field>
          </div>
        )}
      </Panel>

      <Panel title="Glow / Drop Shadow" defaultCollapsed>
        <Toggle label="Enable effect" checked={!!a.shadow?.enabled} onChange={(v) => set({ shadow: { ...(a.shadow || { color: "#000000", blur: 10, offsetX: 0, offsetY: 0 }), enabled: v } })} />
        {a.shadow?.enabled && (
          <div className="mt-2 space-y-2">
            <Field label="Color">
              <input type="color" value={a.shadow.color} onChange={(e) => set({ shadow: { ...a.shadow!, color: e.target.value } })} className="h-7 w-full rounded" />
            </Field>
            <Slider label="Blur" min={0} max={100} value={a.shadow.blur} onChange={(v) => set({ shadow: { ...a.shadow!, blur: v } })} />
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Offset X"><NumberInput value={a.shadow.offsetX} onChange={(v) => set({ shadow: { ...a.shadow!, offsetX: v } })} /></Field>
              <Field label="Offset Y"><NumberInput value={a.shadow.offsetY} onChange={(v) => set({ shadow: { ...a.shadow!, offsetY: v } })} /></Field>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
