import { useStore } from "../../store";
import { exportZip, exportSingleHtml } from "../../runtime/exportHtml";
import { Btn, Field, NumberInput, Panel, Select, Slider, Toggle } from "../ui";
import GradientPicker from "../GradientPicker";
import { repairCanvasToFullHd } from "../../projectNormalize";

const SIZES = [
  { value: "1920x1080", label: "1920 × 1080 (Full HD)" },
  { value: "2560x1440", label: "2560 × 1440 (2K)" },
  { value: "3840x2160", label: "3840 × 2160 (4K)" },
  { value: "1280x720", label: "1280 × 720 (HD)" },
  { value: "custom", label: "Custom" },
];

export default function ExportTab() {
  const data = useStore((s) => s.data())!;
  const project = useStore((s) => s.current())!;
  const upd = useStore.getState().update;

  const forceRestoreCanvas = async () => {
    const st = useStore.getState();
    st.setRuntimePreview(false);
    st.update((d) => repairCanvasToFullHd(d));
    await st.saveNow();
  };

  const sizeKey = `${data.canvasWidth}x${data.canvasHeight}`;
  const known = SIZES.some((s) => s.value === sizeKey) ? sizeKey : "custom";
  const usedMediaIds = new Set(data.assets.filter((a) => a.visible && data.layers.find((l) => l.id === a.layerId)?.visible !== false).map((a) => a.mediaId).filter(Boolean));

  return (
    <div>
      <Panel title="Canvas Size">
        <Field label="Base Resolution">
          <Select
            value={known}
            onChange={(v) => {
              if (v === "custom") return;
              const [w, h] = v.split("x").map(Number);
              upd((d) => {
                d.canvasWidth = w;
                d.canvasHeight = h;
              });
            }}
            options={SIZES}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width">
            <NumberInput value={data.canvasWidth} onChange={(v) => upd((d) => (d.canvasWidth = Math.max(320, v)))} />
          </Field>
          <Field label="Height">
            <NumberInput value={data.canvasHeight} onChange={(v) => upd((d) => (d.canvasHeight = Math.max(240, v)))} />
          </Field>
        </div>
        <Btn className="w-full" onClick={forceRestoreCanvas}>↩ Force repair runtime/export canvas to 1920×1080</Btn>
        {!data.bgGradient?.enabled && (
          <Field label="Background Color">
            <input type="color" value={data.bgColor} onChange={(e) => upd((d) => (d.bgColor = e.target.value))} className="h-9 w-full rounded" />
          </Field>
        )}
      </Panel>

      <Panel title="Background Gradient">
        <Toggle
          label="Enable Gradient"
          checked={!!data.bgGradient?.enabled}
          onChange={(v) =>
            upd((d) => {
              if (!d.bgGradient)
                d.bgGradient = {
                  enabled: false,
                  type: "linear",
                  angle: 135,
                  stops: [
                    { id: "s1", color: "#1e1b4b", offset: 0 },
                    { id: "s2", color: "#312e81", offset: 1 },
                  ],
                  animate: false,
                  speed: 1,
                };
              d.bgGradient.enabled = v;
            })
          }
        />
        {data.bgGradient?.enabled && (
          <GradientPicker
            value={data.bgGradient}
            onChange={(g) => upd((d) => { d.bgGradient = g; })}
          />
        )}
      </Panel>

      <Panel title="Day / Night Cycle">
        <Toggle label="Enable cycle" checked={data.dayNight.enabled} onChange={(v) => upd((d) => (d.dayNight.enabled = v))} />
        <Slider label="Cycle length (sec)" min={10} max={600} value={data.dayNight.cycleSec} onChange={(v) => upd((d) => (d.dayNight.cycleSec = v))} />
        <Slider label="Max darkness" min={0} max={1} step={0.05} value={data.dayNight.maxDarkness} onChange={(v) => upd((d) => (d.dayNight.maxDarkness = v))} format={(v) => `${Math.round(v * 100)}%`} />
        <Field label="Night tint">
          <input type="color" value={data.dayNight.nightOverlayColor} onChange={(e) => upd((d) => (d.dayNight.nightOverlayColor = e.target.value))} className="h-9 w-full rounded" />
        </Field>
      </Panel>

      <Panel title="Background Rotation">
        <Toggle label="Rotate backgrounds" checked={data.bgRotation.enabled} onChange={(v) => upd((d) => (d.bgRotation.enabled = v))} />
        <Slider label="Interval (minutes)" min={0.1} max={60} step={0.1} value={data.bgRotation.intervalMin} onChange={(v) => upd((d) => (d.bgRotation.intervalMin = v))} format={(v) => `${v}m`} />
        <Slider label="Crossfade (sec)" min={0} max={10} step={0.5} value={data.bgRotation.crossfadeSec} onChange={(v) => upd((d) => (d.bgRotation.crossfadeSec = v))} />
        <Field label="Background images (from library)">
          <div className="grid grid-cols-4 gap-1.5">
            {data.media.filter((m) => m.type !== "video" && usedMediaIds.has(m.id)).map((m) => {
              const on = data.bgRotation.mediaIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() =>
                    upd((d) => {
                      d.bgRotation.mediaIds = on ? d.bgRotation.mediaIds.filter((x) => x !== m.id) : [...d.bgRotation.mediaIds, m.id];
                    })
                  }
                  className={`overflow-hidden rounded border-2 ${on ? "border-violet-500" : "border-slate-700"}`}
                >
                  <img src={m.dataUrl} className="aspect-square w-full object-cover" />
                </button>
              );
            })}
          </div>
        </Field>
      </Panel>

      <Panel title="Export Standalone Layout">
        <p className="text-[11px] text-slate-400">
          Exports a self-contained scene that runs locally in OBS Browser Source. No editor UI, no server, no internet. Add the HTML as a <b>Local file</b> browser source at {data.canvasWidth}×{data.canvasHeight}.
        </p>
        <Btn variant="primary" className="w-full" onClick={() => exportZip(project)}>
          ⬇ Export as ZIP (index.html + README)
        </Btn>
        <Btn className="w-full" onClick={() => exportSingleHtml(project)}>
          ⬇ Export single HTML file
        </Btn>
      </Panel>
    </div>
  );
}
