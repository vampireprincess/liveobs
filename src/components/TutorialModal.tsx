import { Btn } from "./ui";

export default function TutorialModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[84vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Quick Tutorial</h2>
            <p className="text-xs text-slate-500">Canvas-first workflow for building OBS scenes fast.</p>
          </div>
          <Btn onClick={onClose}>Close</Btn>
        </div>
        <div className="grid gap-4 overflow-y-auto p-5 text-sm text-slate-300 md:grid-cols-2">
          <Guide title="1. Place and transform assets">
            Upload media in Assets, click a thumbnail to place it, then edit directly on the preview: drag the asset body to move, drag white corner/side handles to resize, drag the round top handle to rotate. Hold Shift while rotating to snap to 15 degrees.
          </Guide>
          <Guide title="2. Draw shapes">
            In Assets, choose Rect, Ellipse, Triangle or Line. Click-drag on the canvas. The shape becomes a normal layer asset with color, stroke, opacity, rotation and resize controls in the Inspector.
          </Guide>
          <Guide title="3. Use 9-point align and fit">
            Select an asset, then use Inspector / Quick Layout. Pick contain, cover, fill or auto. The 3x3 dot grid aligns to upper-left, center, lower-right and every other canvas anchor.
          </Guide>
          <Guide title="4. Edit paths visually">
            Open Paths, create a path or turn on Pen Tool and click the canvas. White squares are path points. Blue/pink circles are bezier handles. Random groups can follow the selected path.
          </Guide>
          <Guide title="5. Draw zones and masks">
            Open Zones, choose Rect, Ellipse or Polygon, then draw on the canvas. Use zones as include/exclude areas for particles and random events. They never appear in exported runtime.
          </Guide>
          <Guide title="6. Build random events">
            Open Random, create a group, add member assets, set per-member weight and rarity, assign a path and zones, then press Test. Runtime Preview starts automatically if needed.
          </Guide>
          <Guide title="7. Layer organization">
            Open Layers. Drag layer blocks to reorder front/back. Drag asset rows between layer blocks to move assets between layers. Hide/lock layers while working.
          </Guide>
          <Guide title="8. Export for OBS">
            Open Export and choose ZIP or single HTML. In OBS Browser Source, enable Local file and select index.html. Use the same base resolution shown in the Export panel.
          </Guide>
        </div>
      </div>
    </div>
  );
}

function Guide({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-100">{title}</h3>
      <p className="text-xs leading-5 text-slate-400">{children}</p>
    </div>
  );
}