// ===== Shared runtime engine =====
// Renders the "living world": static assets, particle systems, random events,
// day/night cycle and background rotation. Used by both the live preview and
// the exported standalone HTML. Zero dependencies, no network.
import type { ProjectData, MotionPath, Zone, ParticleSystem, GradientConfig, FlipAxis } from "../types";
import { sampleGradientColor, shiftHue, computeGradientAnim, gradientCss, behaviorTransform, oneShotTransform } from "../gradientMath";
import lottie from "lottie-web";

export { sampleGradientColor as sampleStops, shiftHue, behaviorTransform, oneShotTransform };

export interface EngineOptions {
  editorMode?: boolean;
  simulateFast?: boolean;
  /** Preview-only runtime multiplier. Export uses the default 1x. */
  timeScale?: number;
}

interface ActiveEvent {
  el: HTMLDivElement;
  start: number;
  duration: number;
  path: { x: number; y: number }[];
  flipAxis: FlipAxis | null;
  exclIds: string[];
  rotateAlongPath?: boolean;
  easing?: string;
  template?: Partial<import("../types").CanvasAsset>;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  opacity: number;
  imgIndex: number;
  gradPos: number;
  color: string;
  phase: number;
  phaseSpeed: number;
}

export function samplePath(path: MotionPath, segments = 48): { x: number; y: number }[] {
  const pts = path.points;
  if (pts.length < 2) return pts.map((p) => ({ x: p.x, y: p.y }));
  const out: { x: number; y: number }[] = [];
  const list = path.closed ? [...pts, pts[0]] : pts;

  if ((path.mode ?? "curve") === "angle") {
    for (let i = 0; i < list.length - 1; i++) {
      const p0 = list[i], p1 = list[i + 1];
      for (let s = 0; s < segments; s++) {
        const t = s / segments;
        out.push({ x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t });
      }
    }
    const last = list[list.length - 1];
    out.push({ x: last.x, y: last.y });
    return out;
  }

  for (let i = 0; i < list.length - 1; i++) {
    const p0 = list[i], p1 = list[i + 1];
    const c0 = { x: p0.x + p0.hOut.x, y: p0.y + p0.hOut.y };
    const c1 = { x: p1.x + p1.hIn.x, y: p1.y + p1.hIn.y };
    for (let s = 0; s < segments; s++) {
      const t = s / segments, mt = 1 - t;
      const x = mt * mt * mt * p0.x + 3 * mt * mt * t * c0.x + 3 * mt * t * t * c1.x + t * t * t * p1.x;
      const y = mt * mt * mt * p0.y + 3 * mt * mt * t * c0.y + 3 * mt * t * t * c1.y + t * t * t * p1.y;
      out.push({ x, y });
    }
  }
  const last = list[list.length - 1];
  out.push({ x: last.x, y: last.y });
  return out;
}

export function ease01(t: number, easing?: string): number {
  const x = Math.max(0, Math.min(1, t));
  if (easing === "ease-in") return x * x;
  if (easing === "ease-out") return 1 - (1 - x) * (1 - x);
  if (easing === "ease-in-out") return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  if (easing === "smoothstep") return x * x * (3 - 2 * x);
  if (easing === "sine") return -(Math.cos(Math.PI * x) - 1) / 2;
  if (easing === "bounce") {
    const n1 = 7.5625, d1 = 2.75;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) { const y = x - 1.5 / d1; return n1 * y * y + 0.75; }
    if (x < 2.5 / d1) { const y = x - 2.25 / d1; return n1 * y * y + 0.9375; }
    const y = x - 2.625 / d1; return n1 * y * y + 0.984375;
  }
  return x;
}

export function pathSvgD(path: MotionPath): string {
  const pts = path.points;
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  const list = path.closed ? [...pts, pts[0]] : pts;
  for (let i = 0; i < list.length - 1; i++) {
    const p0 = list[i], p1 = list[i + 1];
    if ((path.mode ?? "curve") === "angle") d += ` L ${p1.x} ${p1.y}`;
    else {
      const c0x = p0.x + p0.hOut.x, c0y = p0.y + p0.hOut.y, c1x = p1.x + p1.hIn.x, c1y = p1.y + p1.hIn.y;
      d += ` C ${c0x} ${c0y}, ${c1x} ${c1y}, ${p1.x} ${p1.y}`;
    }
  }
  if (path.closed) d += " Z";
  return d;
}

export function pointInZone(x: number, y: number, z: Zone): boolean {
  if (z.shape === "rect") return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
  if (z.shape === "ellipse") {
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2, rx = z.w / 2, ry = z.h / 2;
    if (rx === 0 || ry === 0) return false;
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }
  if (z.shape === "triangle") {
    const p1 = { x: z.x + z.w / 2, y: z.y }, p2 = { x: z.x, y: z.y + z.h }, p3 = { x: z.x + z.w, y: z.y + z.h };
    const sign = (a: any, b: any, c: any) => (a.x - c.x) * (b.y - c.y) - (b.x - c.x) * (a.y - c.y);
    const pt = { x, y };
    const d1 = sign(pt, p1, p2), d2 = sign(pt, p2, p3), d3 = sign(pt, p3, p1);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0, hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }
  const p = z.points;
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if (p[i].y > y !== p[j].y > y && x < ((p[j].x - p[i].x) * (y - p[i].y)) / (p[j].y - p[i].y) + p[i].x) inside = !inside;
  }
  return inside;
}

export function allowedByZones(x: number, y: number, zones: Zone[], includeIds: string[], excludeIds: string[]): boolean {
  if (includeIds.length) {
    const inc = zones.filter((z) => includeIds.includes(z.id));
    if (inc.length && !inc.some((z) => pointInZone(x, y, z))) return false;
  }
  if (excludeIds.length) {
    const exc = zones.filter((z) => excludeIds.includes(z.id));
    if (exc.some((z) => pointInZone(x, y, z))) return false;
  }
  return true;
}

export function shapeSvg(a: import("../types").CanvasAsset): string {
  const shape = a.shape; if (!shape) return "";
  const sw = shape.strokeWidth, fill = shape.fill, stroke = shape.stroke, common = `vector-effect:non-scaling-stroke;`;
  if (shape.kind === "ellipse") return `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"><ellipse cx="50" cy="50" rx="${50 - sw}" ry="${50 - sw}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" style="${common}"/></svg>`;
  if (shape.kind === "triangle") return `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"><polygon points="50,4 96,96 4,96" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" style="${common}"/></svg>`;
  if (shape.kind === "diamond") return `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"><polygon points="50,3 97,50 50,97 3,50" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" style="${common}"/></svg>`;
  if (shape.kind === "pentagon") return `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"><polygon points="50,3 97,38 79,96 21,96 3,38" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" style="${common}"/></svg>`;
  if (shape.kind === "hexagon") return `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"><polygon points="25,5 75,5 98,50 75,95 25,95 2,50" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" style="${common}"/></svg>`;
  if (shape.kind === "star") return `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"><polygon points="50,3 61,36 96,36 68,56 79,91 50,70 21,91 32,56 4,36 39,36" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" style="${common}"/></svg>`;
  if (shape.kind === "line") return `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"><line x1="2" y1="50" x2="98" y2="50" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" style="${common}"/></svg>`;
  return `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"><rect x="${sw}" y="${sw}" width="${100 - sw * 2}" height="${100 - sw * 2}" rx="${shape.radius}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" style="${common}"/></svg>`;
}

export class RuntimeEngine {
  root: HTMLElement; data: ProjectData; opts: EngineOptions; mediaMap: Record<string, string> = {}; layerEls: Record<string, HTMLDivElement> = {};
  raf = 0; lastTs = 0; running = false; activeEvents: ActiveEvent[] = []; groupTimers: Record<string, number> = {}; mediaTimers: Record<string, number> = {};
  mediaNextSpawnAt: Record<string, number> = {}; mediaLastSpawnAt: Record<string, number> = {}; particleState: Record<string, Particle[]> = {};
  particleCanvas?: HTMLCanvasElement; pctx?: CanvasRenderingContext2D; nightEl?: HTMLDivElement; bgRotEls: HTMLDivElement[] = [];
  bgRotIndex = 0; bgRotTimer = 0; startTime = 0; audioCtx?: AudioContext; analyser?: AnalyserNode; audioData?: Uint8Array; audioLevel = 0;
  spawnCounts: Record<string, { total: number; hour: number; day: number; week: number; lastHour: number; lastDay: number; lastWeek: number }> = {};
  dirState: Record<string, boolean> = {}; imgCache: Record<string, HTMLImageElement> = {};
  mediaInterval: Record<string, number> = {};
  private timeScaleValue = 1;
  private realBaseTime = 0;
  private simBaseTime = 0;

  constructor(root: HTMLElement, data: ProjectData, opts: EngineOptions = {}) {
    this.root = root; this.data = data; this.opts = opts;
    this.timeScaleValue = Math.max(0.1, opts.timeScale ?? (opts.simulateFast ? 10 : 1));
    this.mediaMap = Object.fromEntries(data.media.map((m) => [m.id, m.dataUrl]));
    this.build();
  }

  private timeScale(): number { return this.timeScaleValue; }
  private scaledNow(now = performance.now()): number { return this.startTime ? this.simBaseTime + (now - this.realBaseTime) * this.timeScale() : now; }
  private scaledDate(now = performance.now()): Date { return new Date(Date.now() + (this.scaledNow(now) - now)); }

  setTimeScale(scale: number) {
    const next = Math.max(0.1, scale || 1);
    const now = performance.now();
    this.simBaseTime = this.scaledNow(now);
    this.realBaseTime = now;
    this.timeScaleValue = next;
    this.opts.timeScale = next;
    if (this.running) { clearInterval(this.bgRotTimer); this.startBgRotation(); }
  }

  elapsedSec(): number { return this.startTime ? (this.scaledNow() - this.startTime) / 1000 : 0; }

  build() {
    this.root.innerHTML = "";
    this.root.style.position = "relative"; this.root.style.overflow = "hidden";
    this.root.style.width = this.data.canvasWidth + "px"; this.root.style.height = this.data.canvasHeight + "px";

    const studio = this.data.gradientStudio;
    const useStudioBg = studio && (studio.mode === "background" || studio.mode === "hybrid") && studio.gradient.stops.length;
    const bgGrad = useStudioBg ? studio!.gradient : this.data.bgGradient?.enabled ? this.data.bgGradient : undefined;
    if (bgGrad) this.applyGradientBackground(bgGrad); else this.root.style.background = this.data.bgColor;

    this.data.layers.forEach((layer, idx) => {
      const el = document.createElement("div");
      el.style.position = "absolute"; el.style.inset = "0"; el.style.zIndex = String(idx * 10 + 1); el.style.pointerEvents = "none";
      if (!layer.visible) el.style.display = "none";
      this.layerEls[layer.id] = el; this.root.appendChild(el);
    });

    for (const a of this.data.assets) {
      if (!a.visible) continue;
      if (a.layerId === "layer-rand") continue;
      const layerIndex = this.data.layers.findIndex((l) => l.id === a.layerId);
      const layerEl = this.root;
      const el = document.createElement("div");
      el.style.position = "absolute"; el.style.left = a.x + "px"; el.style.top = a.y + "px"; el.style.width = a.width + "px"; el.style.height = a.height + "px";
      el.style.opacity = String(a.opacity); el.style.zIndex = String((Math.max(0, layerIndex) * 1000) + (a.zoffset ?? 0) + 10);
      el.style.mixBlendMode = a.blend === "normal" ? "normal" : a.blend === "add" ? "plus-lighter" : a.blend;
      const sx = a.flipH ? -a.scale : a.scale, sy = a.flipV ? -a.scale : a.scale;
      el.style.transformOrigin = `${(a.refPointX ?? 0.5) * 100}% ${(a.refPointY ?? 0.5) * 100}%`;
      
      const updateAnim = () => {
        if (!a.animation || a.animation === "none") return `rotate(${a.rotation}deg) scale(${sx}, ${sy})`;
        const phase = (performance.now() / 1000) * (a.animSpeed ?? 1);
        let { transform } = behaviorTransform(a.animation, phase, 1, a.rotation, sx, sy);
        return transform;
      };

      if (a.animation && a.animation !== "none") {
        const tick = () => {
          if (!el.isConnected) return;
          el.style.transform = updateAnim();
          if (a.animation === "blur") el.style.filter = `blur(${Math.max(0, Math.sin(performance.now()/1000 * (a.animSpeed || 1) * 2) * 8)}px)`;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } else {
        el.style.transform = `rotate(${a.rotation}deg) scale(${sx}, ${sy})`;
      }

      if (a.shadow?.enabled) {
        const s = a.shadow; const sh = `drop-shadow(${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.color})`;
        el.style.filter = a.animation === "blur" ? el.style.filter + " " + sh : sh;
      }
      if (a.gradient) {
        const child = document.createElement("div");
        child.style.width = "100%"; child.style.height = "100%";
        el.appendChild(child);
        const renderGradient = (elapsed: number) => {
          const gg = a.gradient!;
          if (!gg.animate) { child.style.background = gradientCss(gg.type, gg.angle, gg.stops); return; }
          const anim = computeGradientAnim(gg, elapsed);
          const animType = gg.animType || (gg.type === "linear" ? "rotation" : "hue");
          if (animType === "panning") { child.style.backgroundSize = gg.type === "linear" ? "220% 220%" : "100% 100%"; child.style.backgroundPosition = `${anim.panPercent}% 50%`; child.style.background = gradientCss(gg.type, gg.angle, gg.stops); }
          else if (animType === "hue") child.style.background = gradientCss(gg.type, gg.angle, gg.stops, anim.hueShift);
          else child.style.background = gradientCss(gg.type, anim.angle, gg.stops);
        };
        if (a.gradient.animate) {
          const start = performance.now();
          const tick = () => { if (!child.isConnected) return; renderGradient((performance.now() - start) / 1000); requestAnimationFrame(tick); };
          tick();
        } else renderGradient(0);
      } else {
      const staticMedia = a.mediaId ? this.data.media.find((m) => m.id === a.mediaId) : undefined;
      if (staticMedia?.type === "lottie") {
        try {
          const isData = staticMedia.dataUrl.startsWith("data:");
          const anim = lottie.loadAnimation(isData
            ? { container: el, renderer: "svg", loop: true, autoplay: true, animationData: JSON.parse(atob(staticMedia.dataUrl.split(",")[1])) }
            : { container: el, renderer: "svg", loop: true, autoplay: true, path: staticMedia.dataUrl });
          anim.addEventListener("complete", () => anim.goToAndPlay(0, true));
          window.setInterval(() => { if (el.isConnected && anim.isPaused) anim.play(); }, 1000);
        } catch (e) { console.warn("Lottie runtime error", e); }
      } else {
        el.innerHTML = this.assetMarkup(a);
      }
      }
      layerEl.appendChild(el);
    }

    this.particleCanvas = document.createElement("canvas");
    this.particleCanvas.width = this.data.canvasWidth; this.particleCanvas.height = this.data.canvasHeight;
    this.particleCanvas.style.position = "absolute"; this.particleCanvas.style.inset = "0"; this.particleCanvas.style.pointerEvents = "none"; this.particleCanvas.style.zIndex = "5000";
    this.root.appendChild(this.particleCanvas); this.pctx = this.particleCanvas.getContext("2d")!;
    this.initParticles();

    if (this.data.bgRotation.enabled && this.data.bgRotation.mediaIds.length) {
      this.data.bgRotation.mediaIds.forEach((mid, i) => {
        const el = document.createElement("div");
        el.style.position = "absolute"; el.style.inset = "0"; el.style.zIndex = "0";
        el.style.backgroundImage = `url(${this.mediaMap[mid]})`; el.style.backgroundSize = "cover"; el.style.backgroundPosition = "center";
        el.style.opacity = i === 0 ? "1" : "0"; el.style.transition = `opacity ${this.data.bgRotation.crossfadeSec}s ease`;
        this.root.insertBefore(el, this.root.firstChild); this.bgRotEls.push(el);
      });
    }

    this.nightEl = document.createElement("div");
    this.nightEl.style.position = "absolute"; this.nightEl.style.inset = "0"; this.nightEl.style.pointerEvents = "none"; this.nightEl.style.zIndex = "9000";
    this.nightEl.style.mixBlendMode = "multiply"; this.nightEl.style.background = this.data.dayNight.nightOverlayColor; this.nightEl.style.opacity = "0";
    if (this.data.dayNight.enabled) this.root.appendChild(this.nightEl);

    if (this.opts.editorMode) this.drawGuides();
  }

  private curBgGrad?: GradientConfig;
  applyGradientBackground(g: GradientConfig) {
    this.curBgGrad = g; this.renderBgGradient(g.angle);
    this.root.style.backgroundSize = g.type === "linear" ? "220% 220%" : "100% 100%";
    this.root.style.backgroundPosition = "0% 50%";
  }

  private renderBgGradient(angle: number, hueShift = 0) {
    const g = this.curBgGrad; if (!g) return;
    this.root.style.background = gradientCss(g.type, angle, g.stops, hueShift);
  }

  assetMarkup(asset: any): string {
    if (asset.shape) return shapeSvg(asset);
    if (!asset.mediaId) return "";
    return this.mediaTag(asset.mediaId, asset.fit || "contain");
  }

  mediaTag(mediaId: string, fit = "contain"): string {
    const url = this.mediaMap[mediaId]; if (!url) return "";
    const media = this.data.media.find((m) => m.id === mediaId);
    const objectFit = fit === "auto" ? "scale-down" : fit;
    const style = `width:100%;height:100%;object-fit:${objectFit};display:block;`;
    const safeUrl = String(url).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    if (media?.type === "video") return `<video src="${safeUrl}" autoplay loop muted playsinline referrerpolicy="no-referrer" style="${style}"></video>`;
    return `<img src="${safeUrl}" style="${style}" draggable="false" referrerpolicy="no-referrer"/>`;
  }

  drawGuides() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg") as SVGSVGElement;
    svg.setAttribute("width", String(this.data.canvasWidth)); svg.setAttribute("height", String(this.data.canvasHeight));
    svg.style.position = "absolute"; svg.style.inset = "0"; svg.style.zIndex = "10000"; svg.style.pointerEvents = "none";
    for (const p of this.data.paths) {
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", pathSvgD(p)); path.setAttribute("fill", "none"); path.setAttribute("stroke", p.color); path.setAttribute("stroke-width", "3"); path.setAttribute("stroke-dasharray", "10 8");
      svg.appendChild(path);
    }
    this.root.appendChild(svg);
  }

  initParticles() {
    this.particleState = {};
    for (const ps of this.data.particles) {
      if (!ps.enabled) continue;
      const arr: Particle[] = []; const nImgs = ps.customMediaIds.length || 1;
      for (let i = 0; i < ps.density; i++) arr.push(this.spawnParticle(ps, i % nImgs, true));
      this.particleState[ps.id] = arr;
    }
  }

  spawnParticle(ps: ParticleSystem, imgIndex: number, initial: boolean): Particle {
    const W = this.data.canvasWidth, H = this.data.canvasHeight;
    const size = ps.size * (1 + (Math.random() - 0.5) * ps.sizeVariance * 2);
    const gradPos = Math.random(); const studioGrad = this.studioGradient();
    let color = ps.color;
    if (ps.colorMode !== "solid" && studioGrad) {
      const anim = computeGradientAnim(studioGrad, this.elapsedSec());
      color = sampleGradientColor(studioGrad.stops, gradPos + anim.sampleShift);
      if (anim.hueShift) color = shiftHue(color, anim.hueShift);
    }
    const vx = ps.type === "fireflies" ? (Math.random() - 0.5) * 0.5 : ps.windX * (0.5 + Math.random()) * ps.spread;
    const vy = ps.type === "fireflies" ? (Math.random() - 0.5) * 0.5 : ps.speed * (0.5 + Math.random() * 1.5) * (ps.windY || 1);
    return { x: Math.random() * W, y: initial ? Math.random() * H : -size - Math.random() * 100, vx, vy, size: Math.max(1, size), rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * ps.rotationSpeed, opacity: ps.opacity * (0.6 + Math.random() * 0.4), imgIndex, gradPos, color, phase: Math.random() * Math.PI * 2, phaseSpeed: 0.5 + Math.random() * 2 };
  }

  private studioGradient() {
    const studio = this.data.gradientStudio;
    return (studio && studio.gradient.stops.length) ? studio.gradient : undefined;
  }

  globalExcludeIds(): string[] { return this.data.zones.filter((z) => z.global && z.kind === "exclude").map((z) => z.id); }

  updateParticles(dt: number) {
    const ctx = this.pctx!; ctx.clearRect(0, 0, this.data.canvasWidth, this.data.canvasHeight);
    const W = this.data.canvasWidth, H = this.data.canvasHeight, globalExcl = this.globalExcludeIds();
    const ar = this.data.audioReactive, level = ar?.enabled ? this.audioLevel : 0, sens = ar ? ar.sensitivity / 5 : 1;
    const sizeMul = ar?.enabled && ar.affectSize ? 1 + level * sens * 1.5 : 1, speedMul = ar?.enabled && ar.affectSpeed ? 1 + level * sens * 2 : 1;
    const opacityMul = ar?.enabled && ar.affectOpacity ? Math.min(1.5, 0.5 + level * sens * 1.5) : 1;
    const studioGrad = this.studioGradient(), gradAnim = studioGrad ? computeGradientAnim(studioGrad, this.elapsedSec()) : undefined;

    for (const ps of this.data.particles) {
      if (!ps.enabled) continue;
      const arr = this.particleState[ps.id]; if (!arr) continue;
      const exclAll = [...ps.excludeZoneIds, ...globalExcl], imgs = ps.customMediaIds.map((id) => this.getImg(id));
      
      for (const p of arr) {
        p.phase += p.phaseSpeed * dt;
        if (ps.type === "fireflies") {
          p.vx += (Math.random() - 0.5) * 0.2; p.vy += (Math.random() - 0.5) * 0.2; p.vx *= 0.98; p.vy *= 0.98; p.x += p.vx; p.y += p.vy;
          if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20; if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
        } else {
          p.x += p.vx * dt * 30 * ps.speed * speedMul + (Math.random() - 0.5) * ps.randomness; p.y += p.vy * dt * 30 * speedMul; p.rot += p.vr * dt;
          if (p.y > H + 30 || p.x < -50 || p.x > W + 50) Object.assign(p, this.spawnParticle(ps, p.imgIndex, false));
        }

        if (!allowedByZones(p.x, p.y, this.data.zones, ps.includeZoneIds, exclAll)) continue;

        let fill: string | CanvasGradient = ps.color;
        if (ps.colorMode !== "solid" && studioGrad && gradAnim) {
          if (ps.colorMode === "global") fill = sampleGradientColor(studioGrad.stops, p.x / W + gradAnim.sampleShift);
          else if (ps.colorMode === "per-particle") fill = p.color;
          else if (ps.colorMode === "individual") {
            const g = ctx.createLinearGradient(-p.size / 2, 0, p.size / 2, 0);
            const sorted = [...studioGrad.stops].sort((a, b) => a.offset - b.offset);
            sorted.forEach((s) => g.addColorStop(s.offset, gradAnim.hueShift ? shiftHue(s.color, gradAnim.hueShift) : s.color));
            fill = g;
          }
        }

        const drawSize = p.size * sizeMul; ctx.save(); ctx.globalAlpha = Math.min(1, p.opacity * opacityMul);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        const img = imgs[p.imgIndex];
        if (img && img.complete && img.naturalWidth) {
          if (ps.colorMode !== "solid") {
             ctx.save(); ctx.drawImage(img, -drawSize/2, -drawSize/2, drawSize, drawSize);
             ctx.globalCompositeOperation = "source-in"; ctx.fillStyle = fill; ctx.fillRect(-drawSize/2, -drawSize/2, drawSize, drawSize); ctx.restore();
          } else ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        } else this.drawBuiltinParticle(ctx, ps.type, drawSize, fill, p);
        ctx.restore();
      }
    }
  }

  drawBuiltinParticle(ctx: CanvasRenderingContext2D, type: string, size: number, color: string | CanvasGradient, p: Particle) {
    const isSolid = typeof color === "string"; ctx.fillStyle = color; ctx.strokeStyle = isSolid ? color : "#fff";
    if (type === "fireflies") {
      const alpha = (Math.sin(p.phase) * 0.5 + 0.5) * 0.8 + 0.2; ctx.globalAlpha *= alpha;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2); g.addColorStop(0, isSolid ? color : "#fff"); g.addColorStop(0.4, isSolid ? color : "#fff"); g.addColorStop(1, "transparent");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill(); return;
    }
    if (type === "bokeh") {
      ctx.globalAlpha *= 0.25; const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2); g.addColorStop(0, isSolid ? color : "#fff"); g.addColorStop(0.8, isSolid ? color : "#fff"); g.addColorStop(1, "transparent");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill(); return;
    }
    if (type === "rain") { ctx.lineWidth = Math.max(1, size / 5); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(0, size); ctx.stroke(); }
    else if (type === "snow" || type === "dust") {
      if (isSolid) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2); g.addColorStop(0, color); g.addColorStop(0.6, color); g.addColorStop(1, "transparent"); ctx.fillStyle = g; }
      ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill();
    } else if (type === "sparkle") {
      if (isSolid) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2); g.addColorStop(0, color); g.addColorStop(1, "transparent"); ctx.fillStyle = g; }
      ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = color; ctx.beginPath();
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; ctx.lineTo(Math.cos(a) * size * 0.6, Math.sin(a) * size * 0.6); ctx.lineTo(Math.cos(a + Math.PI / 4) * size * 0.12, Math.sin(a + Math.PI / 4) * size * 0.12); }
      ctx.closePath(); ctx.fill();
    } else if (type === "leaves") { ctx.beginPath(); ctx.ellipse(0, 0, size / 2, size / 4, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (type === "fog") {
      if (isSolid) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size); g.addColorStop(0, color); g.addColorStop(0.5, color); g.addColorStop(1, "transparent"); ctx.fillStyle = g; }
      ctx.globalAlpha *= 0.5; ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
    } else { ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill(); }
  }

  getImg(mediaId: string): HTMLImageElement | undefined {
    if (this.imgCache[mediaId]) return this.imgCache[mediaId];
    const url = this.mediaMap[mediaId]; if (!url) return undefined;
    const img = new Image(); img.referrerPolicy = "no-referrer"; img.src = url; this.imgCache[mediaId] = img; return img;
  }

  scheduleGroups() {
    const now = this.scaledNow();
    for (const m of this.data.media) {
      if (m.inLibrary && this.data.assets.some(a => a.mediaId === m.id)) {
        if (m.schedule.enabled !== false && m.schedule.hourlyLimit > 0) {
          const perHour = Math.max(0.01, m.schedule.hourlyLimit);
          const interval = (3600 / perHour) * 1000;
          this.mediaInterval[m.id] = interval;
          this.mediaNextSpawnAt[m.id] = now + 500 + Math.random() * 1000;
        }
      }
    }
  }

  checkMediaSpawns(now: number) {
    const scaledNow = this.scaledNow(now);
    for (const mediaId in this.mediaNextSpawnAt) {
      if (scaledNow >= this.mediaNextSpawnAt[mediaId]) {
        const m = this.data.media.find(x => x.id === mediaId);
        if (m && this.mediaAllowedNow(m)) {
          this.triggerMedia(mediaId);
        }
        const interval = this.mediaInterval[mediaId] || 4000;
        this.mediaNextSpawnAt[mediaId] = scaledNow + interval;
      }
    }
  }

  mediaAllowedNow(m: any): boolean {
    const s = m.schedule;
    if (s?.enabled === false) return false;
    const now = this.scaledDate(), today = now.toISOString().slice(0, 10);
    if (s.dateStart && today < s.dateStart) return false;
    if (s.dateEnd && today > s.dateEnd) return false;
    const h = now.getHours() + now.getMinutes() / 60;
    if (s.hourStart <= s.hourEnd) { if (h < s.hourStart || h > s.hourEnd) return false; }
    else { if (h < s.hourStart && h > s.hourEnd) return false; }
    return this.mediaWithinLimits(m);
  }

  mediaWithinLimits(m: any): boolean {
    const s = m.schedule, now = this.scaledDate(), h = now.getHours(), d = now.getDate();
    const week = Math.floor(now.getTime() / (7 * 24 * 3600 * 1000));
    const state = this.spawnCounts[m.id];
    if (!state) return true;
    if (state.lastHour !== h) { state.hour = 0; state.lastHour = h; }
    if (state.lastDay !== d) { state.day = 0; state.lastDay = d; }
    if (state.lastWeek !== week) { state.week = 0; state.lastWeek = week; }
    if (s.hourlyLimit && state.hour >= s.hourlyLimit) return false;
    if (s.dailyLimit && state.day >= s.dailyLimit) return false;
    if (s.weeklyLimit && state.week >= s.weeklyLimit) return false;
    return true;
  }

  triggerMedia(mediaId: string) {
    const media = this.data.media.find((x) => x.id === mediaId); if (!media) return;
    const state = this.spawnCounts[media.id] || (this.spawnCounts[media.id] = { total: 0, hour: 0, day: 0, week: 0, lastHour: -1, lastDay: -1, lastWeek: -1 });
    state.total++; state.hour++; state.day++; state.week++;
    const cat = this.data.categories?.find((c) => c.id === media.categoryId);
    const path = cat?.pathId ? this.data.paths.find((p) => p.id === cat.pathId) : undefined;
    
    if (media.schedule.spawnMode === "path" && (!path || path.points.length < 2)) {
      return; 
    }

    let poly: { x: number; y: number }[] = [];
    let ltr = true;
    if (cat?.direction === "rtl") ltr = false;
    else if (cat?.direction === "random") ltr = Math.random() > 0.5;
    
    if (cat?.alternateDirection) {
      if (this.dirState[mediaId] === undefined) this.dirState[mediaId] = ltr;
      else this.dirState[mediaId] = !this.dirState[mediaId];
      ltr = this.dirState[mediaId];
    }

    if (media.schedule.spawnMode === "static") {
      const x = Math.random() * (this.data.canvasWidth - 200) + 100, y = Math.random() * (this.data.canvasHeight - 200) + 100;
      poly = [{ x, y }, { x, y }];
    } else if (path) {
      poly = samplePath(path, 48);
      if (!ltr) poly = [...poly].reverse();
    } else {
      const fallbackY = this.data.canvasHeight * (0.4 + Math.random() * 0.4);
      poly = ltr ? [{ x: -200, y: fallbackY }, { x: this.data.canvasWidth + 200, y: fallbackY }] : [{ x: this.data.canvasWidth + 200, y: fallbackY }, { x: -200, y: fallbackY }];
    }
    
    if (poly.length === 0) return;

    const templateAsset = this.data.assets.find(a => a.mediaId === mediaId);
    const w = templateAsset ? templateAsset.width : (media.width || 200);
    const h = templateAsset ? templateAsset.height : (media.height || 120);
    
    const targetLayerId = cat?.layerId || "layer-rand";
    const targetLayerIndex = this.data.layers.findIndex((l) => l.id === targetLayerId);
    const layerEl = this.root;
    const el = document.createElement("div");
    el.style.position = "absolute"; el.style.width = w + "px"; el.style.height = h + "px"; el.style.willChange = "transform, opacity, filter";
    el.style.zIndex = String((Math.max(0, targetLayerIndex) * 1000) + (templateAsset?.zoffset ?? 100) + 10);
    el.style.opacity = String(templateAsset?.opacity ?? 1);
    el.style.mixBlendMode = templateAsset?.blend === "add" ? "plus-lighter" : (templateAsset?.blend || "normal");
    
    const shouldFlip = cat?.flipOnDirection && !ltr;
    const flipAxis: FlipAxis | null = shouldFlip ? (cat?.flipAxis || "horizontal") : null;
    
    if (poly.length > 0) el.style.transform = `translate(${poly[0].x - w / 2}px, ${poly[0].y - h / 2}px)`;
    
    if (media.type === "lottie") {
      try { 
        const animData = JSON.parse(atob(media.dataUrl.split(",")[1])); 
        const anim = lottie.loadAnimation({ container: el, renderer: "svg", loop: true, autoplay: true, animationData: animData });
        anim.addEventListener("complete", () => anim.goToAndPlay(0, true));
        window.setInterval(() => { if (el.isConnected && anim.isPaused) anim.play(); }, 1000); 
      } catch (e) {}
    } else if (media.type === "video") {
      const safeUrl = String(media.dataUrl).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      el.innerHTML = `<video src="${safeUrl}" autoplay loop muted playsinline referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:contain"></video>`;
    } else {
      const safeUrl = String(media.dataUrl).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      el.innerHTML = `<img src="${safeUrl}" style="width:100%;height:100%;object-fit:contain" draggable="false" referrerpolicy="no-referrer"/>`;
    }
    
    layerEl.appendChild(el);
    
    let travelTime = 10;
    if (media.schedule.spawnMode === "path" && poly.length > 1) {
      let pathLength = 0;
      for (let i = 0; i < poly.length - 1; i++) {
        const dx = poly[i+1].x - poly[i].x;
        const dy = poly[i+1].y - poly[i].y;
        pathLength += Math.sqrt(dx*dx + dy*dy);
      }
      const speedPxPerSec = (cat?.speed || 1) * 300;
      travelTime = pathLength / Math.max(1, speedPxPerSec);
    } else {
      travelTime = (media.schedule as any).durationSec || 10;
    }
    
    this.activeEvents.push({ 
      el, 
      start: this.scaledNow(), 
      duration: travelTime * 1000, 
      path: poly, 
      flipAxis,
      exclIds: [],
      rotateAlongPath: cat?.rotateAlongPath,
      easing: path?.easing,
      template: templateAsset ? structuredClone(templateAsset) : undefined,
    });
  }

  updateEvents(now: number) {
    const scaledNow = this.scaledNow(now);
    for (let i = this.activeEvents.length - 1; i >= 0; i--) {
      const ev = this.activeEvents[i]; const rawT = (scaledNow - ev.start) / ev.duration;
      if (rawT >= 1) { ev.el.remove(); this.activeEvents.splice(i, 1); continue; }
      const t = ease01(rawT, ev.easing);
      const seg = t * (ev.path.length - 1), idx = Math.floor(seg), frac = seg - idx, a = ev.path[idx], b = ev.path[Math.min(idx + 1, ev.path.length - 1)];
      const x = a.x + (b.x - a.x) * frac, y = a.y + (b.y - a.y) * frac, w = parseFloat(ev.el.style.width), h = parseFloat(ev.el.style.height);
      
      const tmpl = ev.template;
      const baseSX = tmpl?.flipH ? -(tmpl.scale ?? 1) : (tmpl?.scale ?? 1);
      const baseSY = tmpl?.flipV ? -(tmpl.scale ?? 1) : (tmpl?.scale ?? 1);
      const behavior = behaviorTransform(tmpl?.animation, (scaledNow - ev.start) / 1000, tmpl?.animSpeed ?? 1, tmpl?.rotation ?? 0, baseSX, baseSY);
      let oneShot = { transform: "", opacity: 1 };
      const enterDur = (tmpl?.entranceDuration ?? 0.6) * 1000;
      const exitDur = (tmpl?.exitDuration ?? 0.6) * 1000;
      if (tmpl?.entranceAnim && tmpl.entranceAnim !== "none" && scaledNow - ev.start < enterDur) oneShot = oneShotTransform(tmpl.entranceAnim, (scaledNow - ev.start) / enterDur, true);
      if (tmpl?.exitAnim && tmpl.exitAnim !== "none" && ev.start + ev.duration - scaledNow < exitDur) oneShot = oneShotTransform(tmpl.exitAnim, 1 - ((ev.start + ev.duration - scaledNow) / exitDur), false);

      let transform = `translate(${x - w / 2}px, ${y - h / 2}px)`;
      if (ev.rotateAlongPath) {
        const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        transform += ` rotate(${angle}deg)`;
      }
      if (!tmpl) {
        if (ev.flipAxis === "horizontal") transform += ` scaleX(-1)`;
        else if (ev.flipAxis === "vertical") transform += ` scaleY(-1)`;
        else if (ev.flipAxis === "both") transform += ` scale(-1, -1)`;
      }
      transform += ` ${behavior.transform} ${oneShot.transform}`;
      ev.el.style.transform = transform;
      ev.el.style.opacity = String((tmpl?.opacity ?? 1) * oneShot.opacity);
      const shadow = tmpl?.shadow?.enabled ? `drop-shadow(${tmpl.shadow.offsetX}px ${tmpl.shadow.offsetY}px ${tmpl.shadow.blur}px ${tmpl.shadow.color})` : "";
      ev.el.style.filter = [shadow, behavior.filter].filter(Boolean).join(" ");
      if (ev.exclIds.length) ev.el.style.visibility = allowedByZones(x, y, this.data.zones, [], ev.exclIds) ? "visible" : "hidden";
    }
  }

  updateDayNight(now: number) {
    if (!this.data.dayNight.enabled || !this.nightEl) return;
    const cycle = this.data.dayNight.cycleSec * 1000, phase = ((now - this.startTime) % cycle) / cycle, dark = (Math.sin((phase - 0.25) * Math.PI * 2) * 0.5 + 0.5) * this.data.dayNight.maxDarkness;
    this.nightEl.style.opacity = String(dark);
  }

  startBgRotation() {
    if (!this.data.bgRotation.enabled || this.bgRotEls.length < 2) return;
    const rotate = () => { this.bgRotEls[this.bgRotIndex].style.opacity = "0"; this.bgRotIndex = (this.bgRotIndex + 1) % this.bgRotEls.length; this.bgRotEls[this.bgRotIndex].style.opacity = "1"; };
    const interval = (this.data.bgRotation.intervalMin * 60000) / this.timeScale();
    this.bgRotTimer = window.setInterval(rotate, interval);
  }

  loop = (ts: number) => {
    if (!this.running) return;
    try {
      const dt = this.lastTs ? Math.min(0.05, (ts - this.lastTs) / 1000) : 0.016; this.lastTs = ts;
      const studio = this.data.gradientStudio, useStudioBg = studio && (studio.mode === "background" || studio.mode === "hybrid") && studio.gradient.stops.length;
      const bgG = useStudioBg ? studio!.gradient : this.data.bgGradient?.enabled ? this.data.bgGradient : undefined;
      if (bgG && bgG.animate) {
        const anim = computeGradientAnim(bgG, this.elapsedSec()), animType = bgG.animType || (bgG.type === "linear" ? "rotation" : "hue");
        if (animType === "panning") this.root.style.backgroundPosition = `${anim.panPercent}% 50%`;
        else if (animType === "hue") this.renderBgGradient(bgG.angle, anim.hueShift);
        else this.renderBgGradient(anim.angle);
      }
      if (this.data.audioReactive?.enabled) this.updateAudio();
      this.updateParticles(dt * this.timeScale()); this.updateEvents(ts); this.updateDayNight(this.scaledNow(ts));
      this.checkMediaSpawns(ts);
    } catch (err) {
      console.error("Runtime loop error", err);
    } finally {
      this.raf = requestAnimationFrame(this.loop);
    }
  };

  start() {
    if (this.running) return; this.running = true; this.startTime = performance.now(); this.realBaseTime = this.startTime; this.simBaseTime = this.startTime; this.lastTs = 0;
    this.raf = requestAnimationFrame(this.loop); this.scheduleGroups(); this.startBgRotation();
    if (this.data.audioReactive?.enabled) this.initAudio();
  }

  async initAudio() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioCtx = new AudioContext(); const source = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser(); this.analyser.fftSize = 256;
      source.connect(this.analyser); this.audioData = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (e) { console.warn("Audio access denied", e); }
  }

  updateAudio() {
    if (!this.analyser || !this.audioData) return; this.analyser.getByteFrequencyData(this.audioData as any);
    let sum = 0; for (let i = 0; i < this.audioData.length; i++) sum += this.audioData[i];
    const instant = sum / this.audioData.length / 255, smoothing = this.data.audioReactive?.smoothing ?? 0.7;
    this.audioLevel = this.audioLevel * smoothing + instant * (1 - smoothing);
  }

  stop() { this.running = false; cancelAnimationFrame(this.raf); Object.values(this.mediaTimers).forEach((t) => clearTimeout(t)); clearInterval(this.bgRotTimer); this.activeEvents.forEach((e) => e.el.remove()); this.activeEvents = []; this.mediaNextSpawnAt = {}; this.mediaInterval = {}; }
  destroy() { this.stop(); this.root.innerHTML = ""; }
}