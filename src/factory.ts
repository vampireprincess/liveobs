import { nanoid } from "nanoid";
import type {
  Project,
  Layer,
  RandomGroup,
  ParticleSystem,
  MotionPath,
  Zone,
  CanvasAsset,
  MediaAsset,
  RandomMemberOverride,
  AssetSchedule,
  AssetCategory,
} from "./types";

export const uid = () => nanoid(10);

export function defaultLayers(): Layer[] {
  return [
    { id: "layer-bg", name: "Background", visible: true, locked: false },
    { id: "layer-mid", name: "Middle", visible: true, locked: false },
    { id: "layer-rand", name: "Random Assets", visible: true, locked: false },
    { id: "layer-fg", name: "Foreground", visible: true, locked: false },
  ];
}

export function createProject(name = "Untitled Scene"): Project {
  const now = Date.now();
  return {
    id: uid(),
    name,
    createdAt: now,
    updatedAt: now,
    data: {
      canvasWidth: 1920,
      canvasHeight: 1080,
      bgColor: "#0b1020",
      categories: defaultCategories(),
      media: [],
      layers: defaultLayers(),
      assets: [],
      paths: [],
      zones: [],
      randomGroups: [],
      particles: [],
      dayNight: {
        enabled: false,
        cycleSec: 120,
        nightOverlayColor: "#0a1a3a",
        maxDarkness: 0.55,
      },
      bgRotation: {
        enabled: false,
        intervalMin: 5,
        mediaIds: [],
        crossfadeSec: 2,
      },
      bgGradient: {
        enabled: false,
        type: "linear",
        angle: 135,
        stops: [
          { id: uid(), color: "#1e1b4b", offset: 0 },
          { id: uid(), color: "#312e81", offset: 1 },
        ],
        animate: false,
        speed: 1,
      },
      gradientStudio: {
        mode: "off",
        gradient: {
          enabled: true,
          type: "linear",
          angle: 135,
          stops: [
            { id: uid(), color: "#ff2d95", offset: 0 },
            { id: uid(), color: "#ffb3d1", offset: 0.5 },
            { id: uid(), color: "#8b1e5a", offset: 1 },
          ],
          animate: true,
          speed: 20,
          animType: "rotation",
        },
      },
      audioReactive: {
        enabled: false,
        sensitivity: 5,
        affectSize: true,
        affectSpeed: false,
        affectOpacity: false,
        smoothing: 0.7,
      },
    },
  };
}

export function newLayer(name = "New Layer"): Layer {
  return { id: uid(), name, visible: true, locked: false };
}

export function defaultSchedule(): AssetSchedule {
  return {
    spawnMode: "path",
    hourlyLimit: 0,
    dailyLimit: 0,
    weeklyLimit: 0,
    season: "any",
    dateStart: "",
    dateEnd: "",
    hourStart: 0,
    hourEnd: 24,
    enabled: true,
  };
}

export function defaultCategories(): AssetCategory[] {
  return [
    { id: "cat-general", name: "General", direction: "ltr", alternateDirection: true, flipOnDirection: true, flipAxis: "horizontal", speed: 1 },
    { id: "cat-cars", name: "Cars", direction: "ltr", alternateDirection: true, flipOnDirection: true, flipAxis: "horizontal", speed: 1 },
    { id: "cat-people", name: "People", direction: "ltr", alternateDirection: true, flipOnDirection: true, flipAxis: "horizontal", speed: 0.7 },
    { id: "cat-animals", name: "Animals", direction: "random", alternateDirection: false, flipOnDirection: false, flipAxis: "horizontal", speed: 0.5 },
    { id: "cat-halloween", name: "Halloween", direction: "random", alternateDirection: false, flipOnDirection: false, flipAxis: "horizontal", speed: 0.4 },
    { id: "cat-seasonal", name: "Seasonal", direction: "ltr", alternateDirection: true, flipOnDirection: true, flipAxis: "horizontal", speed: 1 },
  ];
}

export function newCanvasAsset(mediaId: string, layerId: string, media: MediaAsset): CanvasAsset {
  const w = media.width ?? 300;
  const h = media.height ?? 200;
  const maxW = 500;
  const ratio = w > maxW ? maxW / w : 1;
  return {
    id: uid(),
    mediaId,
    name: media.name,
    layerId,
    x: 760,
    y: 440,
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
    rotation: 0,
    opacity: 1,
    scale: 1,
    flipH: false,
    flipV: false,
    visible: true,
    locked: false,
    zoffset: 0,
    blend: "normal",
    fit: "contain",
    shadow: { enabled: false, color: "#000000", blur: 10, offsetX: 0, offsetY: 0 },
  };
}

export function newShapeAsset(kind: "rect" | "ellipse" | "triangle" | "line", layerId: string, x: number, y: number): CanvasAsset {
  return {
    id: uid(),
    name: kind.charAt(0).toUpperCase() + kind.slice(1),
    layerId,
    x,
    y,
    width: 240,
    height: kind === "line" ? 12 : 160,
    rotation: 0,
    opacity: 1,
    scale: 1,
    flipH: false,
    flipV: false,
    visible: true,
    locked: false,
    zoffset: 0,
    blend: "normal",
    fit: "fill",
    shadow: { enabled: false, color: "#000000", blur: 10, offsetX: 0, offsetY: 0 },
    shape: {
      kind,
      fill: kind === "line" ? "transparent" : "#7c3aed",
      stroke: "#ffffff",
      strokeWidth: kind === "line" ? 8 : 2,
      radius: kind === "rect" ? 24 : 0,
    },
  };
}

export function newRandomGroup(layerId: string, categoryId: string): RandomGroup {
  return {
    id: uid(),
    name: "New Random Group",
    categoryId,
    layerId,
    enabled: true,
  };
}

export function newMember(mediaId: string): RandomMemberOverride {
  return { mediaId, weight: 1, enabled: true, rarity: 1 };
}

export function newParticle(layerId: string, type: ParticleSystem["type"] = "snow"): ParticleSystem {
  const defaults: Record<string, Partial<ParticleSystem>> = {
    snow: { density: 140, speed: 1.2, size: 6, opacity: 0.8, windX: 0.3, windY: 1, spread: 1.5 },
    rain: { density: 250, speed: 4.5, size: 12, opacity: 0.5, windX: -0.2, windY: 2, spread: 0.5 },
    leaves: { density: 40, speed: 0.8, size: 18, opacity: 0.9, windX: 0.8, windY: 0.5, spread: 2.5 },
    dust: { density: 180, speed: 0.3, size: 4, opacity: 0.4, windX: 0.1, windY: 0.1, spread: 2 },
    sparkle: { density: 60, speed: 0.5, size: 10, opacity: 0.9, windX: 0, windY: 0.2, spread: 1 },
    fog: { density: 15, speed: 0.2, size: 250, opacity: 0.3, windX: 0.4, windY: 0, spread: 3 },
    fireflies: { density: 35, speed: 0.5, size: 8, opacity: 1, windX: 0, windY: 0, spread: 1, color: "#fef08a" },
    bokeh: { density: 20, speed: 0.4, size: 60, opacity: 0.6, windX: 0.1, windY: 0.2, spread: 2 },
  };

  const specific = defaults[type] || defaults.snow;

  return {
    id: uid(),
    name: type.charAt(0).toUpperCase() + type.slice(1),
    type,
    enabled: true,
    layerId,
    density: specific.density || 120,
    speed: specific.speed || 1,
    size: specific.size || 6,
    sizeVariance: 0.5,
    opacity: specific.opacity || 0.85,
    rotationSpeed: type === "leaves" ? 0.8 : 0.3,
    randomness: 0.6,
    windX: specific.windX || 0.4,
    windY: specific.windY || 1,
    spread: specific.spread || 1,
    color: specific.color || "#ffffff",
    colorMode: "solid",
    customMediaIds: [],
    includeZoneIds: [],
    excludeZoneIds: [],
  };
}

export function newPath(w: number, h: number, count = 0): MotionPath {
  const y = h * 0.6;
  return {
    id: uid(),
    name: `Path ${count + 1}`,
    closed: false,
    color: "#38bdf8",
    points: [
      { id: uid(), x: -100, y, hIn: { x: 0, y: 0 }, hOut: { x: 200, y: 0 } },
      { id: uid(), x: w + 100, y, hIn: { x: -200, y: 0 }, hOut: { x: 0, y: 0 } },
    ],
  };
}

export function newZone(shape: Zone["shape"], kind: Zone["kind"]): Zone {
  return {
    id: uid(),
    name: (kind === "include" ? "Include " : "Exclude ") + shape,
    shape,
    kind,
    color: kind === "include" ? "#34d399" : "#f87171",
    x: 700,
    y: 400,
    w: 500,
    h: 300,
    points: [],
  };
}