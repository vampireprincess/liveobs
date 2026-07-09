import { useEffect, useRef } from "react";
import { useStore } from "../store";
import { pointInZone } from "../runtime/engine";
import { sampleGradientColor, shiftHue, computeGradientAnim } from "../gradientMath";
import type { ParticleSystem, GradientConfig } from "../types";

interface P {
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

export default function EditorParticles({ W, H, layerId, zIndex = 1 }: { W: number; H: number; layerId: string; zIndex?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const data = useStore((s) => s.data())!;
  
  // Re-run effect if any system on this layer changes
  const systems = data.particles.filter(p => p.layerId === layerId && p.enabled);
  const particlesKey = systems.map(p => `${p.id}-${p.color}-${p.density}-${p.speed}-${p.size}-${p.type}-${p.colorMode}`).join('|');

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || systems.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state: Record<string, P[]> = {};
    const imgCache: Record<string, HTMLImageElement> = {};
    let raf = 0;
    let last = 0;
    const startTime = performance.now();

    const pickColor = (ps: ParticleSystem, pX: number, pGradPos: number, anim: ReturnType<typeof computeGradientAnim>, studio: GradientConfig): string => {
      let c: string;
      if (ps.colorMode === "per-particle") {
        c = sampleGradientColor(studio.stops, pGradPos);
      } else {
        c = sampleGradientColor(studio.stops, pX / W + anim.sampleShift);
      }
      if (anim.hueShift) c = shiftHue(c, anim.hueShift);
      return c;
    };

    const spawn = (ps: ParticleSystem, imgIndex: number, initial: boolean): P => {
      const size = ps.size * (1 + (Math.random() - 0.5) * ps.sizeVariance * 2);
      const gradientPos = Math.random();
      const x = Math.random() * W;
      const y = initial ? Math.random() * H : -size - Math.random() * 100;
      
      let vx: number, vy: number;
      if (ps.type === "fireflies") {
        vx = (Math.random() - 0.5) * 1.5;
        vy = (Math.random() - 0.5) * 1.5;
      } else {
        vx = ps.windX * (0.5 + Math.random()) * ps.spread;
        vy = ps.speed * (0.5 + Math.random() * 1.5) * (ps.windY || 1);
      }

      return {
        x, y, vx, vy, size: Math.max(1, size),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * ps.rotationSpeed,
        opacity: ps.opacity,
        imgIndex,
        gradPos: gradientPos,
        color: ps.color, // placeholder
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.5 + Math.random() * 2,
      };
    };

    const getImg = (mediaId: string, url?: string) => {
      if (imgCache[mediaId]) return imgCache[mediaId];
      if (!url) return undefined;
      const img = new Image();
      img.src = url;
      imgCache[mediaId] = img;
      return img;
    };

    const drawBuiltin = (type: string, size: number, color: string | CanvasGradient, p: P) => {
      const isSolid = typeof color === "string";
      const c = isSolid ? (color as string) : "#ffffff";

      ctx.save();
      ctx.fillStyle = color;
      ctx.strokeStyle = color;

      if (type === "fireflies") {
        const alpha = (Math.sin(p.phase) * 0.5 + 0.5) * 0.8 + 0.2;
        ctx.globalAlpha *= alpha;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
        g.addColorStop(0, c);
        g.addColorStop(0.4, c);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill();
      } 
      else if (type === "bokeh") {
        ctx.globalAlpha *= 0.25;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
        g.addColorStop(0, c);
        g.addColorStop(0.8, c);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill();
      }
      else if (type === "sparkle") {
        // 4-point star
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          ctx.lineTo(Math.cos(a) * size * 0.6, Math.sin(a) * size * 0.6);
          ctx.lineTo(Math.cos(a + Math.PI / 4) * size * 0.15, Math.sin(a + Math.PI / 4) * size * 0.15);
        }
        ctx.closePath(); ctx.fill();
        // Glow
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
        g.addColorStop(0, c); g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill();
      }
      else if (type === "snow") {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
        g.addColorStop(0, "white"); g.addColorStop(0.4, c); g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill();
      }
      else if (type === "rain") {
        ctx.lineWidth = Math.max(1, size / 6);
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(0, size); ctx.stroke();
      }
      else if (type === "leaves") {
        ctx.beginPath(); ctx.ellipse(0, 0, size / 2, size / 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-size/2, 0); ctx.lineTo(size/2, 0); ctx.stroke();
      }
      else if (type === "dust") {
        ctx.globalAlpha *= 0.4;
        ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill();
      }
      else if (type === "fog") {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
        g.addColorStop(0, c); g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.globalAlpha *= 0.4;
        ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
      }
      else {
        ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    };

    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
      last = ts;
      
      const st = useStore.getState();
      const data = st.data();
      if (!data) return;
      
      const studio = data.gradientStudio?.gradient;
      const anim = studio ? computeGradientAnim(studio, (ts - startTime) / 1000) : undefined;
      const globalExcl = data.zones.filter((z) => z.global && z.kind === "exclude").map((z) => z.id);

      ctx.clearRect(0, 0, W, H);

      for (const ps of systems) {
        const arr = state[ps.id] ?? (state[ps.id] = []);
        const target = Math.max(0, Math.round(ps.density));
        const nImgs = ps.customMediaIds.length || 1;
        
        while (arr.length < target) arr.push(spawn(ps, arr.length % nImgs, true));
        if (arr.length > target) arr.length = target;

        const imgs = ps.customMediaIds.map((id) => getImg(id, data.media.find((m) => m.id === id)?.dataUrl));

        for (const p of arr) {
          p.phase += p.phaseSpeed * dt;
          
          if (ps.type === "fireflies") {
            p.vx += (Math.random() - 0.5) * 0.3;
            p.vy += (Math.random() - 0.5) * 0.3;
            p.vx *= 0.98; p.vy *= 0.98;
            p.x += p.vx; p.y += p.vy;
            if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
            if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
          } else {
            p.x += p.vx * dt * 30 * ps.speed;
            p.y += p.vy * dt * 30;
            p.rot += p.vr * dt;
            if (p.y > H + 50 || p.x < -50 || p.x > W + 50) {
              Object.assign(p, spawn(ps, p.imgIndex, false));
            }
          }

          if (globalExcl.some(zid => {
            const z = data.zones.find(zx => zx.id === zid);
            return z ? pointInZone(p.x, p.y, z) : false;
          })) continue;

          // Color resolution
          let fill: string | CanvasGradient = ps.color;
          if (ps.colorMode !== "solid" && studio && anim) {
            if (ps.colorMode === "global") {
              fill = pickColor(ps, p.x, p.gradPos, anim, studio);
            } else if (ps.colorMode === "per-particle") {
              fill = sampleGradientColor(studio.stops, p.gradPos + anim.sampleShift);
              if (anim.hueShift) fill = shiftHue(fill, anim.hueShift);
            } else if (ps.colorMode === "individual") {
              const g = ctx.createLinearGradient(-p.size / 2, 0, p.size / 2, 0);
              const sorted = [...studio.stops].sort((a, b) => a.offset - b.offset);
              sorted.forEach((s) => g.addColorStop(s.offset, anim.hueShift ? shiftHue(s.color, anim.hueShift) : s.color));
              fill = g;
            }
          }

          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);

          const img = ps.customMediaIds.length > 0 ? imgs[p.imgIndex % nImgs] : null;
          if (img && img.complete && img.naturalWidth) {
            if (ps.colorMode !== "solid") {
              ctx.save();
              ctx.drawImage(img, -p.size / 2, -p.size / 2, p.size, p.size);
              ctx.globalCompositeOperation = "source-in";
              ctx.fillStyle = fill;
              ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
              ctx.restore();
            } else {
              ctx.drawImage(img, -p.size / 2, -p.size / 2, p.size, p.size);
            }
          } else {
            drawBuiltin(ps.type, p.size, fill, p);
          }
          ctx.restore();
        }
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [W, H, layerId, particlesKey]);

  return <canvas ref={ref} width={W} height={H} className="pointer-events-none absolute inset-0" style={{ zIndex }} />;
}
