import type { SavedGradient, SavedPalette } from "./types";

// ===== Color extraction from an image (median-cut style k-means-lite) =====
export async function extractColorsFromImage(dataUrl: string, count: number): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const size = 96;
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d");
      if (!ctx) return resolve([]);
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;

      // collect pixels (skip transparent)
      const pixels: [number, number, number][] = [];
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 125) continue;
        pixels.push([data[i], data[i + 1], data[i + 2]]);
      }
      if (!pixels.length) return resolve([]);

      const clusters = medianCut(pixels, count);
      // sort by luminance for a pleasant gradient order
      clusters.sort((a, b) => luminance(a) - luminance(b));
      resolve(clusters.map(rgbToHex));
    };
    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });
}

function luminance([r, g, b]: [number, number, number]) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function rgbToHex([r, g, b]: [number, number, number]) {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Median cut quantization
function medianCut(pixels: [number, number, number][], count: number): [number, number, number][] {
  let boxes: [number, number, number][][] = [pixels];
  while (boxes.length < count) {
    // find box with largest range
    let bestIdx = 0;
    let bestRange = -1;
    let bestChannel = 0;
    boxes.forEach((box, idx) => {
      if (box.length < 2) return;
      for (let ch = 0; ch < 3; ch++) {
        let min = 255,
          max = 0;
        for (const px of box) {
          if (px[ch] < min) min = px[ch];
          if (px[ch] > max) max = px[ch];
        }
        const range = max - min;
        if (range > bestRange) {
          bestRange = range;
          bestIdx = idx;
          bestChannel = ch;
        }
      }
    });
    if (bestRange <= 0) break;
    const box = boxes[bestIdx];
    box.sort((a, b) => a[bestChannel] - b[bestChannel]);
    const mid = Math.floor(box.length / 2);
    const b1 = box.slice(0, mid);
    const b2 = box.slice(mid);
    boxes.splice(bestIdx, 1, b1, b2);
  }
  return boxes.map((box) => {
    const avg: [number, number, number] = [0, 0, 0];
    for (const px of box) {
      avg[0] += px[0];
      avg[1] += px[1];
      avg[2] += px[2];
    }
    return [avg[0] / box.length, avg[1] / box.length, avg[2] / box.length] as [number, number, number];
  });
}

// ===== localStorage persistence for swatches & palettes =====
const GRAD_KEY = "obs_saved_gradients";
const PAL_KEY = "obs_saved_palettes";

export function loadSavedGradients(): SavedGradient[] {
  try {
    return JSON.parse(localStorage.getItem(GRAD_KEY) || "[]");
  } catch {
    return [];
  }
}
export function saveSavedGradients(list: SavedGradient[]) {
  localStorage.setItem(GRAD_KEY, JSON.stringify(list));
}
export function loadSavedPalettes(): SavedPalette[] {
  try {
    return JSON.parse(localStorage.getItem(PAL_KEY) || "[]");
  } catch {
    return [];
  }
}
export function saveSavedPalettes(list: SavedPalette[]) {
  localStorage.setItem(PAL_KEY, JSON.stringify(list));
}
