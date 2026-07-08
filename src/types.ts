// ===== Core data model for the OBS Layout Maker =====

export type Vec2 = { x: number; y: number };

export type BlendMode = "normal" | "screen" | "multiply" | "overlay" | "lighten" | "add";
export type AssetFit = "contain" | "cover" | "fill" | "auto";
export type ShapeKind = "rect" | "ellipse" | "triangle" | "line" | "diamond" | "pentagon" | "hexagon" | "star";

export interface ShapeStyle {
  kind: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
}

// ===== Asset Library =====
export type FlipAxis = "horizontal" | "vertical" | "both";

export interface AssetCategory {
  id: string;
  name: string;
  thumbnail?: string;
  pathId?: string;
  direction: Direction;
  alternateDirection: boolean;
  flipOnDirection: boolean;
  flipAxis?: FlipAxis;
  speed: number;
  layerId?: string;
  rotateAlongPath?: boolean;
  includeZoneIds?: string[];
  excludeZoneIds?: string[];
}

export type BehaviorAnimation = "none" | "pendulum" | "rotation" | "shake" | "wiggle" | "float" | "pulse" | "bounce" | "skew" | "blur" | "heartbeat" | "sway" | "jelly" | "breathe" | "drift" | "glitch" | "orbit" | "tada";
export type OneShotAnimation = "none" | "fade" | "scale" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "pop" | "spin";
export type PathEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "smoothstep" | "sine" | "bounce";

export interface AssetSchedule {
  spawnMode: "static" | "path";
  dailyLimit: number;
  weeklyLimit: number;
  hourlyLimit: number;
  season: "any" | "spring" | "summer" | "autumn" | "winter";
  dateStart: string;
  dateEnd: string;
  hourStart: number;
  hourEnd: number;
  durationSec?: number;
  enabled?: boolean;
}

export interface MediaAsset {
  id: string;
  name: string;
  type: "image" | "svg" | "gif" | "video" | "webp" | "lottie";
  dataUrl: string;
  width?: number;
  height?: number;
  categoryId: string;
  schedule: AssetSchedule;
  inLibrary?: boolean;
}

export interface DropShadow {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface ColorStop {
  id: string;
  color: string;
  offset: number;
}

export type GradientAnimType = "rotation" | "panning" | "hue" | "none";

export interface GradientConfig {
  enabled: boolean;
  type: "linear" | "radial" | "conic";
  angle: number;
  stops: ColorStop[];
  animate: boolean;
  speed: number;
  animType?: GradientAnimType;
}

export interface SavedGradient {
  id: string;
  name: string;
  gradient: GradientConfig;
}

export interface SavedPalette {
  id: string;
  name: string;
  colors: string[];
}

export type GradientMode = "off" | "background" | "particles" | "hybrid";

export interface GradientStudio {
  mode: GradientMode;
  gradient: GradientConfig;
}

export interface CanvasAsset {
  id: string;
  mediaId?: string;
  shape?: ShapeStyle;
  name: string;
  layerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  scale: number;
  flipH: boolean;
  flipV: boolean;
  visible: boolean;
  locked: boolean;
  zoffset: number;
  blend: BlendMode;
  fit: AssetFit;
  gradient?: GradientConfig;
  shadow?: DropShadow;
  animation?: BehaviorAnimation;
  animSpeed?: number;
  entranceAnim?: OneShotAnimation;
  entranceDuration?: number;
  exitAnim?: OneShotAnimation;
  exitDuration?: number;
  refPointX?: number;
  refPointY?: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  maskZoneId?: string;
}

export interface PathPoint {
  id: string;
  x: number;
  y: number;
  hIn: Vec2;
  hOut: Vec2;
}

export type PathMode = "curve" | "angle";

export interface MotionPath {
  id: string;
  name: string;
  points: PathPoint[];
  closed: boolean;
  color: string;
  mode?: PathMode;
  easing?: PathEasing;
}

export type ZoneShape = "rect" | "ellipse" | "polygon" | "triangle";
export type ZoneKind = "include" | "exclude";

export interface Zone {
  id: string;
  name: string;
  shape: ZoneShape;
  kind: ZoneKind;
  color: string;
  global?: boolean;
  locked?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  points: Vec2[];
}

export interface RandomMemberOverride {
  mediaId: string;
  weight: number;
  enabled: boolean;
  scale?: number;
  opacity?: number;
  speed?: number;
  duration?: number;
  pathId?: string;
  rarity?: number;
}

export type Direction = "ltr" | "rtl" | "random";
export type Season = "any" | "spring" | "summer" | "autumn" | "winter";

export interface RandomGroup {
  id: string;
  name: string;
  categoryId: string;
  layerId: string;
  enabled: boolean;
  frequencyPerHour?: number;
  minDelaySec?: number;
  maxDelaySec?: number;
}

export type ParticleType = "rain" | "snow" | "leaves" | "dust" | "sparkle" | "fog" | "fireflies" | "bokeh" | "custom";

export type ParticleColorMode = "solid" | "global" | "individual" | "per-particle";

export interface ParticleSystem {
  id: string;
  name: string;
  type: ParticleType;
  enabled: boolean;
  layerId: string;
  density: number;
  speed: number;
  size: number;
  sizeVariance: number;
  opacity: number;
  rotationSpeed: number;
  randomness: number;
  windX: number;
  windY: number;
  spread: number;
  color: string;
  colorMode: ParticleColorMode;
  customMediaIds: string[];
  includeZoneIds: string[];
  excludeZoneIds: string[];
}

export interface DayNightConfig {
  enabled: boolean;
  cycleSec: number;
  nightOverlayColor: string;
  maxDarkness: number;
}

export interface BackgroundRotation {
  enabled: boolean;
  intervalMin: number;
  mediaIds: string[];
  crossfadeSec: number;
}

export interface ProjectData {
  canvasWidth: number;
  canvasHeight: number;
  bgColor: string;
  categories: AssetCategory[];
  media: MediaAsset[];
  layers: Layer[];
  assets: CanvasAsset[];
  paths: MotionPath[];
  zones: Zone[];
  randomGroups: RandomGroup[];
  particles: ParticleSystem[];
  dayNight: DayNightConfig;
  bgRotation: BackgroundRotation;
  bgGradient: GradientConfig;
  gradientStudio?: GradientStudio;
  audioReactive?: AudioReactiveConfig;
}

export interface AudioReactiveConfig {
  enabled: boolean;
  sensitivity: number;
  affectSize: boolean;
  affectSpeed: boolean;
  affectOpacity: boolean;
  smoothing: number;
}

export type RuntimePreviewSpeed = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  data: ProjectData;
}

export type EditorTab = "assets" | "layers" | "random" | "paths" | "zones" | "particles" | "shapes" | "lottie" | "svg" | "gradient" | "audio" | "debug" | "export";

export type CanvasTool = "select" | "path" | "zone-rect" | "zone-ellipse" | "zone-poly" | "zone-triangle" | "shape-rect" | "shape-ellipse" | "shape-triangle" | "shape-line";