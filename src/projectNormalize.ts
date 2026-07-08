import type { ProjectData } from "./types";

export const DEFAULT_CANVAS_WIDTH = 1920;
export const DEFAULT_CANVAS_HEIGHT = 1080;

export function normalizeCanvasSize(data: ProjectData): ProjectData {
  const d = structuredClone(data);
  const w = Number(d.canvasWidth);
  const h = Number(d.canvasHeight);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1000 || h < 600) {
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
    const lookedLikeOldFullCanvas = Math.abs(a.x) < 1 && Math.abs(a.y) < 1 && Math.abs(a.width - oldW) < 3 && Math.abs(a.height - oldH) < 3;
    if (lookedLikeOldFullCanvas || (a.name === "Gradient Layer" && Math.abs(a.x) < 1 && Math.abs(a.y) < 1)) {
      a.x = 0;
      a.y = 0;
      a.width = DEFAULT_CANVAS_WIDTH;
      a.height = DEFAULT_CANVAS_HEIGHT;
    }
  });
}
