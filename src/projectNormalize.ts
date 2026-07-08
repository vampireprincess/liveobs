import type { ProjectData } from "./types";

export const DEFAULT_CANVAS_WIDTH = 1920;
export const DEFAULT_CANVAS_HEIGHT = 1080;

function shouldRepairCanvas(w: number, h: number): boolean {
  if (!Number.isFinite(w) || !Number.isFinite(h)) return true;
  return w < 320 || h < 240;
}

export function normalizeCanvasSize(data: ProjectData): ProjectData {
  const d = structuredClone(data);
  const w = Number(d.canvasWidth);
  const h = Number(d.canvasHeight);
  if (shouldRepairCanvas(w, h)) {
    d.canvasWidth = DEFAULT_CANVAS_WIDTH;
    d.canvasHeight = DEFAULT_CANVAS_HEIGHT;
  }
  return d;
}

export function repairCanvasToFullHd(data: ProjectData): void {
  const oldW = Number(data.canvasWidth) || DEFAULT_CANVAS_WIDTH;
  const oldH = Number(data.canvasHeight) || DEFAULT_CANVAS_HEIGHT;
  data.canvasWidth = DEFAULT_CANVAS_WIDTH;
  data.canvasHeight = DEFAULT_CANVAS_HEIGHT;
  data.assets.forEach((a) => {
    const lookedLikeOldFullCanvas = Math.abs(a.x) < 1 && Math.abs(a.y) < 1 && Math.abs(a.width - oldW) < 4 && Math.abs(a.height - oldH) < 4;
    if (lookedLikeOldFullCanvas || (a.name === "Gradient Layer" && Math.abs(a.x) < 1 && Math.abs(a.y) < 1)) {
      a.x = 0;
      a.y = 0;
      a.width = DEFAULT_CANVAS_WIDTH;
      a.height = DEFAULT_CANVAS_HEIGHT;
    }
  });
}
