export type ColorHit = { key: string; value: string };

export function toDataUrl(mime: string, text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return `data:${mime};base64,${btoa(binary)}`;
}

export function normalizeHex(input: string): string | null {
  const s = input.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(s)) return "#" + s.slice(1).split("").map((c) => c + c).join("");
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  const rgb = s.match(/^rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)/);
  if (rgb) {
    const nums = rgb.slice(1, 4).map((n) => Math.max(0, Math.min(255, Math.round(Number(n)))));
    return "#" + nums.map((n) => n.toString(16).padStart(2, "0")).join("");
  }
  return null;
}

function floatColorToHex(arr: unknown[]): string | null {
  if (arr.length < 3 || arr.length > 4) return null;
  if (!arr.slice(0, 3).every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1)) return null;
  const rgb = arr.slice(0, 3).map((n) => Math.round((n as number) * 255));
  return "#" + rgb.map((n) => n.toString(16).padStart(2, "0")).join("");
}

export function hexToLottieArray(hex: string, alpha = 1): number[] {
  const h = normalizeHex(hex) ?? "#ffffff";
  return [
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
    alpha,
  ];
}

export function extractSvgColors(svg: string): ColorHit[] {
  const found = new Set<string>();
  const add = (raw?: string | null) => {
    if (!raw || raw === "none" || raw === "transparent" || raw.startsWith("url(")) return;
    const hex = normalizeHex(raw);
    if (hex) found.add(hex);
  };
  [...svg.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].forEach((m) => add(m[0].slice(0, 7)));
  [...svg.matchAll(/rgba?\([^)]*\)/gi)].forEach((m) => add(m[0]));
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    doc.querySelectorAll("*").forEach((el) => {
      ["fill", "stroke", "stop-color", "color", "flood-color", "lighting-color"].forEach((attr) => add(el.getAttribute(attr)));
      const style = el.getAttribute("style") || "";
      style.split(";").forEach((decl) => add(decl.split(":")[1]));
    });
  } catch {}
  return Array.from(found).sort().map((c) => ({ key: c, value: c }));
}

export function recolorSvg(svg: string, map: Record<string, string>): string {
  let out = svg;
  for (const [from, toRaw] of Object.entries(map)) {
    const to = normalizeHex(toRaw) ?? toRaw;
    const variants = [from, from.toUpperCase()];
    const short = from.replace(/^#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3$/i, "#$1$2$3");
    variants.push(short, short.toUpperCase());
    variants.forEach((v) => { out = out.split(v).join(to); });
  }
  return out;
}

export function extractLottieColors(data: unknown): ColorHit[] {
  const found = new Set<string>();
  const walk = (node: any) => {
    if (Array.isArray(node)) {
      const hex = floatColorToHex(node);
      if (hex) found.add(hex);
      node.forEach(walk);
    } else if (node && typeof node === "object") {
      if (typeof node.k === "string") {
        const hex = normalizeHex(node.k);
        if (hex) found.add(hex);
      }
      Object.values(node).forEach(walk);
    } else if (typeof node === "string") {
      const hex = normalizeHex(node);
      if (hex) found.add(hex);
    }
  };
  walk(data);
  return Array.from(found).sort().map((c) => ({ key: c, value: c }));
}

export function recolorLottie<T>(data: T, map: Record<string, string>): T {
  const clone: any = structuredClone(data);
  const replace = (node: any) => {
    if (Array.isArray(node)) {
      const hex = floatColorToHex(node);
      if (hex && map[hex]) {
        const next = hexToLottieArray(map[hex], typeof node[3] === "number" ? node[3] : 1);
        for (let i = 0; i < Math.min(node.length, next.length); i++) node[i] = next[i];
      }
      node.forEach(replace);
    } else if (node && typeof node === "object") {
      Object.keys(node).forEach((k) => {
        if (typeof node[k] === "string") {
          const hex = normalizeHex(node[k]);
          if (hex && map[hex]) node[k] = normalizeHex(map[hex]) ?? map[hex];
        } else replace(node[k]);
      });
    }
  };
  replace(clone);
  return clone;
}
