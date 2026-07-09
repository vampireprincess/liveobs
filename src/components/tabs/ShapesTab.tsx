import { newShapeAsset } from "../../factory";
import { useStore } from "../../store";
import type { ShapeKind } from "../../types";
import { Btn, Panel } from "../ui";

const COMMON_SHAPES: { kind: ShapeKind; label: string; icon: string; w?: number; h?: number }[] = [
  { kind: "rect", label: "Rectangle", icon: "▭" },
  { kind: "ellipse", label: "Ellipse", icon: "◯" },
  { kind: "triangle", label: "Triangle", icon: "△" },
  { kind: "line", label: "Line", icon: "─", w: 320, h: 16 },
  { kind: "diamond", label: "Diamond", icon: "◇" },
  { kind: "pentagon", label: "Pentagon", icon: "⬟" },
  { kind: "hexagon", label: "Hexagon", icon: "⬡" },
  { kind: "star", label: "Star", icon: "★" },
];

export default function ShapesTab() {
  const data = useStore((s) => s.data())!;
  const addShape = (kind: ShapeKind, w?: number, h?: number) => {
    const layer = data.layers.find((l) => l.id === "layer-mid") ?? data.layers[0];
    const asset = newShapeAsset(kind, layer.id, Math.round(data.canvasWidth / 2 - 120), Math.round(data.canvasHeight / 2 - 80));
    if (w) asset.width = w;
    if (h) asset.height = h;
    useStore.getState().addAsset(asset);
    useStore.getState().select("asset", asset.id);
    useStore.getState().setTool("select");
  };

  return (
    <div className="space-y-2">
      <Panel title="Common Shapes">
        <div className="grid grid-cols-2 gap-2">
          {COMMON_SHAPES.map((s) => (
            <button
              key={s.kind}
              onClick={() => addShape(s.kind, s.w, s.h)}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/40 p-2 text-left text-xs text-slate-200 hover:border-violet-500 hover:bg-violet-500/10"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-xl text-violet-200">{s.icon}</span>
              <span className="font-medium">{s.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-slate-500">Shapes are normal canvas assets: resize, rotate, blend, animate, add entrance/exit, and style them in the inspector.</p>
      </Panel>
      <Btn className="w-full" onClick={() => addShape("rect")}>+ Add default shape</Btn>
    </div>
  );
}
