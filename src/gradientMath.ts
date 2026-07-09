// ===== Shared gradient math utilities =====
// Used by the editor (live preview, particle coloring) AND re-implemented in
// plain JS inside runtime/engineSource.ts for the exported standalone HTML.
// Keep the semantics identical between the two.
import type { ColorStop, GradientConfig } from "./types";

export function parseColorToRgb(input: string): [number, number, number] {
  if (!input) return [0, 0, 0];
  if (input.startsWith("rgb")) {
    const nums = input.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
    return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0];
  }
  const h = input.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full || "000000", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function lerpColor(a: string, b: string, t: number): string {
  const pa = parseColorToRgb(a);
  const pb = parseColorToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Sample a color from an ordered list of stops at position t (wraps into 0..1). */
export function sampleGradientColor(stops: ColorStop[] | { color: string; offset: number }[], t: number): string {
  if (!stops || !stops.length) return "#ffffff";
  const s = [...stops].sort((a, b) => a.offset - b.offset);
  const tt = ((t % 1) + 1) % 1;
  if (tt <= s[0].offset) return s[0].color;
  if (tt >= s[s.length - 1].offset) return s[s.length - 1].color;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i], b = s[i + 1];
    if (tt >= a.offset && tt <= b.offset) {
      const local = (tt - a.offset) / Math.max(0.0001, b.offset - a.offset);
      return lerpColor(a.color, b.color, local);
    }
  }
  return s[0].color;
}

export function shiftHue(color: string, deg: number): string {
  if (!deg) return color;
  const [r0, g0, b0] = parseColorToRgb(color);
  const r = r0 / 255, g = g0 / 255, b = b0 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  h = (h + deg) % 360;
  if (h < 0) h += 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rr = 0, gg = 0, bb = 0;
  if (h < 60) [rr, gg, bb] = [c, x, 0];
  else if (h < 120) [rr, gg, bb] = [x, c, 0];
  else if (h < 180) [rr, gg, bb] = [0, c, x];
  else if (h < 240) [rr, gg, bb] = [0, x, c];
  else if (h < 300) [rr, gg, bb] = [x, 0, c];
  else [rr, gg, bb] = [c, 0, x];
  return rgbToHex([(rr + m) * 255, (gg + m) * 255, (bb + m) * 255]);
}

export interface GradientAnimState {
  angle: number; // effective angle for linear/conic
  hueShift: number; // 0..360
  panPercent: number; // 0..100, used for backgroundPosition
  sampleShift: number; // 0..1, used to shift per-particle sampling position over time
}

/**
 * Compute the current animation state of a gradient given elapsed seconds.
 * `speed` is interpreted as "seconds per full cycle" (bigger = slower).
 */
export function computeGradientAnim(g: GradientConfig, elapsedSec: number): GradientAnimState {
  if (!g.animate) return { angle: g.angle, hueShift: 0, panPercent: 0, sampleShift: 0 };
  const speed = Math.max(0.1, g.speed || 20);
  const cycle = (elapsedSec / speed) % 1;
  const animType = g.animType || (g.type === "linear" ? "rotation" : "hue");
  if (animType === "rotation") {
    return { angle: (g.angle + cycle * 360) % 360, hueShift: 0, panPercent: 0, sampleShift: cycle };
  }
  if (animType === "panning") {
    return { angle: g.angle, hueShift: 0, panPercent: cycle * 100, sampleShift: cycle };
  }
  if (animType === "hue") {
    return { angle: g.angle, hueShift: cycle * 360, panPercent: 0, sampleShift: 0 };
  }
  return { angle: g.angle, hueShift: 0, panPercent: 0, sampleShift: 0 };
}

export function gradientCss(
  type: GradientConfig["type"],
  angle: number,
  stops: ColorStop[] | { color: string; offset: number }[],
  hueShift = 0
): string {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  const stopStr = sorted
    .map((s) => `${hueShift ? shiftHue(s.color, hueShift) : s.color} ${(s.offset * 100).toFixed(1)}%`)
    .join(", ");
  if (type === "radial") return `radial-gradient(circle, ${stopStr})`;
  if (type === "conic") return `conic-gradient(from ${angle}deg, ${stopStr})`;
  return `linear-gradient(${angle}deg, ${stopStr})`;
}

/** Compute behavior animation transform string for a given time. */
export function oneShotTransform(anim: string | undefined, progress: number, entering: boolean): { transform: string; opacity: number } {
  const t = Math.max(0, Math.min(1, progress));
  const e = entering ? t : 1 - t;
  const inv = 1 - e;
  if (!anim || anim === "none") return { transform: "", opacity: 1 };
  if (anim === "fade") return { transform: "", opacity: e };
  if (anim === "scale") return { transform: `scale(${0.2 + e * 0.8})`, opacity: e };
  if (anim === "pop") return { transform: `scale(${e < 0.7 ? 0.4 + e * 1.05 : 1.12 - (e - 0.7) * 0.4})`, opacity: e };
  if (anim === "spin") return { transform: `rotate(${inv * (entering ? -180 : 180)}deg) scale(${0.5 + e * 0.5})`, opacity: e };
  const d = inv * 80;
  if (anim === "slide-up") return { transform: `translateY(${d}px)`, opacity: e };
  if (anim === "slide-down") return { transform: `translateY(${-d}px)`, opacity: e };
  if (anim === "slide-left") return { transform: `translateX(${d}px)`, opacity: e };
  if (anim === "slide-right") return { transform: `translateX(${-d}px)`, opacity: e };
  return { transform: "", opacity: 1 };
}

export function behaviorTransform(
  anim: string | undefined,
  t: number,
  speed: number,
  baseRot: number,
  baseSX: number,
  baseSY: number
): { transform: string; filter?: string } {
  let transform = `rotate(${baseRot}deg) scale(${baseSX}, ${baseSY}) `;
  let filter: string | undefined;

  if (!anim || anim === "none") return { transform };

  const p = t * speed;
  switch (anim) {
    case "pendulum":
      transform += `rotate(${Math.sin(p * 4) * 15}deg)`;
      break;
    case "rotation":
      transform += `rotate(${(p * 360) % 360}deg)`;
      break;
    case "float":
      transform += `translateY(${Math.sin(p * 3) * 20}px)`;
      break;
    case "pulse":
      const s = 1 + Math.sin(p * 4) * 0.15;
      transform += `scale(${s})`;
      break;
    case "bounce":
      transform += `translateY(${Math.abs(Math.sin(p * 5)) * -35}px)`;
      break;
    case "shake":
      transform += `translate(${(Math.random() - 0.5) * 10}px, ${(Math.random() - 0.5) * 10}px)`;
      break;
    case "wiggle":
      transform += `translateX(${Math.sin(p * 10) * 12}px)`;
      break;
    case "skew":
      transform += `skewX(${Math.sin(p * 3) * 12}deg)`;
      break;
    case "blur":
      filter = `blur(${Math.max(0, Math.sin(p * 2) * 8)}px)`;
      break;
    case "heartbeat": {
      const beat = Math.pow(Math.abs(Math.sin(p * 5)), 8);
      transform += `scale(${1 + beat * 0.25})`;
      break;
    }
    case "sway":
      transform += `rotate(${Math.sin(p * 2) * 8}deg) translateX(${Math.sin(p * 2) * 8}px)`;
      break;
    case "jelly":
      transform += `scale(${1 + Math.sin(p * 5) * 0.12}, ${1 - Math.sin(p * 5) * 0.1})`;
      break;
    case "breathe":
      transform += `scale(${1 + (Math.sin(p * 2) * 0.5 + 0.5) * 0.12})`;
      break;
    case "drift":
      transform += `translate(${Math.sin(p * 1.3) * 24}px, ${Math.cos(p * 1.1) * 18}px)`;
      break;
    case "glitch":
      transform += `translate(${Math.sin(p * 41) * 6}px, ${Math.cos(p * 37) * 3}px) skewX(${Math.sin(p * 29) * 8}deg)`;
      filter = `hue-rotate(${Math.sin(p * 13) * 25}deg)`;
      break;
    case "orbit":
      transform += `translate(${Math.cos(p * 2) * 18}px, ${Math.sin(p * 2) * 18}px)`;
      break;
    case "tada":
      transform += `rotate(${Math.sin(p * 10) * 10}deg) scale(${1 + Math.abs(Math.sin(p * 5)) * 0.12})`;
      break;
  }
  return { transform, filter };
}
