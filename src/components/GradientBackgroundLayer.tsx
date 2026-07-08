import { useEffect, useRef } from "react";
import { useStore } from "../store";
import { computeGradientAnim, gradientCss } from "../gradientMath";

// Persistent animated background layer for the editor's live canvas.
// Reads `data.gradientStudio` every frame so that:
//  - Turning "Background" or "Hybrid" mode on immediately shows an animated
//    gradient layer.
//  - Editing stops/angle/animation type live-updates the SAME layer (no need
//    to "recreate" anything).
//  - Turning it off reveals the plain background color underneath.
export default function GradientBackgroundLayer() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const startTime = performance.now();

    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const el = ref.current;
      if (!el) return;
      const data = useStore.getState().data();
      const studio = data?.gradientStudio;
      const active = !!studio && (studio.mode === "background" || studio.mode === "hybrid") && studio.gradient.stops.length > 0;
      if (!active || !studio) {
        if (el.style.opacity !== "0") el.style.opacity = "0";
        return;
      }
      if (el.style.opacity !== "1") el.style.opacity = "1";
      const g = studio.gradient;
      const anim = computeGradientAnim(g, (ts - startTime) / 1000);
      if (g.animate && (g.animType === "panning")) {
        el.style.backgroundSize = g.type === "linear" ? "220% 220%" : "100% 100%";
        el.style.backgroundPosition = `${anim.panPercent}% 50%`;
        el.style.background = gradientCss(g.type, g.angle, g.stops);
      } else if (g.animate && g.animType === "hue") {
        el.style.background = gradientCss(g.type, g.angle, g.stops, anim.hueShift);
      } else {
        // rotation (default for linear) or static
        el.style.background = gradientCss(g.type, anim.angle, g.stops);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <div ref={ref} className="absolute inset-0" style={{ opacity: 0, transition: "opacity 120ms linear" }} />;
}
