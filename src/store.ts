import { create } from "zustand";
import type {
  Project,
  ProjectData,
  CanvasAsset,
  Layer,
  MediaAsset,
  RandomGroup,
  ParticleSystem,
  MotionPath,
  Zone,
  EditorTab,
  CanvasTool,
} from "./types";
import { createProject, uid } from "./factory";
import { saveProjectDb, deleteProjectDb, loadAllProjects, getMeta, setMeta } from "./db";

export type SelectionKind = "asset" | "group" | "particle" | "path" | "zone" | "layer" | null;

interface AppState {
  projects: Project[];
  currentId: string | null;
  loaded: boolean;

  past: ProjectData[];
  future: ProjectData[];

  tab: EditorTab;
  tool: CanvasTool;
  selKind: SelectionKind;
  selId: string | null;
  selIds: string[];
  setSelIds: (ids: string[]) => void;
  activePathId: string | null;
  runtimePreview: boolean;
  dirty: boolean;
  zoneDrawKeepClear: boolean;

  init: () => Promise<void>;
  current: () => Project | undefined;
  data: () => ProjectData | undefined;

  setTab: (t: EditorTab) => void;
  setTool: (t: CanvasTool) => void;
  setZoneDrawKeepClear: (v: boolean) => void;
  select: (kind: SelectionKind, id: string | null) => void;
  setActivePath: (id: string | null) => void;
  setRuntimePreview: (v: boolean) => void;

  newProject: (name?: string) => void;
  openProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  duplicateProject: (id: string) => void;
  deleteProject: (id: string) => void;
  saveNow: (thumbnail?: string) => Promise<void>;

  update: (fn: (d: ProjectData) => void, saveHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;

  addMedia: (m: MediaAsset) => void;
  removeMedia: (id: string) => void;
  addAsset: (a: CanvasAsset) => void;
  updateAsset: (id: string, patch: Partial<CanvasAsset>) => void;
  removeAsset: (id: string) => void;
  duplicateAsset: (id: string) => void;

  addLayer: (l: Layer) => void;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
  reorderLayer: (id: string, dir: number) => void;
  duplicateLayer: (id: string) => void;

  addGroup: (g: RandomGroup) => void;
  updateGroup: (id: string, patch: Partial<RandomGroup>) => void;
  removeGroup: (id: string) => void;

  addParticle: (p: ParticleSystem) => void;
  updateParticle: (id: string, patch: Partial<ParticleSystem>) => void;
  removeParticle: (id: string) => void;

  addPath: (p: MotionPath) => void;
  updatePath: (id: string, patch: Partial<MotionPath>) => void;
  removePath: (id: string) => void;

  addZone: (z: Zone) => void;
  updateZone: (id: string, patch: Partial<Zone>) => void;
  removeZone: (id: string) => void;
}

let autosaveTimer: number | undefined;

export const useStore = create<AppState>((set, get) => {
  const commit = (updater: (d: ProjectData) => void, saveHistory = true) => {
    const st = get();
    const proj = st.projects.find((p) => p.id === st.currentId);
    if (!proj) return;
    const oldData = structuredClone(proj.data);
    const clone: Project = { ...proj, data: structuredClone(proj.data), updatedAt: Date.now() };
    updater(clone.data);
    
    let nextPast = st.past;
    let nextFuture = st.future;
    if (saveHistory && JSON.stringify(oldData) !== JSON.stringify(clone.data)) {
      nextPast = [...st.past, oldData].slice(-30);
      nextFuture = [];
    }

    set({
      projects: st.projects.map((p) => (p.id === clone.id ? clone : p)),
      past: nextPast,
      future: nextFuture,
      dirty: true,
    });

    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
      const cur = get().projects.find((p) => p.id === clone.id);
      if (cur) {
        saveProjectDb(cur);
        set({ dirty: false });
      }
    }, 1200);
  };

  return {
    projects: [],
    currentId: null,
    loaded: false,
    past: [],
    future: [],
    tab: "assets",
    tool: "select",
    selKind: null,
    selId: null,
    selIds: [],
    setSelIds: (ids) => set({ selIds: ids }),
    activePathId: null,
    runtimePreview: false,
    dirty: false,
    zoneDrawKeepClear: false,

    init: async () => {
      let projects = await loadAllProjects();
      projects = projects.map((p) => ({
        ...p,
        data: {
          ...p.data,
          categories: (p.data.categories ?? createProject().data.categories).map(c => ({
            ...c,
            flipAxis: c.flipAxis ?? "horizontal",
          })),
          assets: p.data.assets.map((a) => ({ ...a, fit: a.fit ?? "contain" })),
          media: (p.data.media || []).map((m: any) => ({
            ...m,
            categoryId: m.categoryId ?? m.category ?? "cat-general",
            schedule: m.schedule ?? { spawnMode: "path", frequencyPerHour: 10, dailyLimit: 0, weeklyLimit: 0, hourlyLimit: 0, dateStart: "", dateEnd: "", hourStart: 0, hourEnd: 24, durationSec: 12, weight: 1, enabled: true },
            inLibrary: m.inLibrary ?? ((m.categoryId ?? m.category) !== "static-assets"),
          })),
        },
      }));
      if (!projects.length) {
        const p = createProject("My First Scene");
        await saveProjectDb(p);
        projects = [p];
      }
      const lastId = await getMeta<string>("lastProject");
      const currentId = projects.find((p) => p.id === lastId)?.id ?? projects[0].id;
      set({ projects, currentId, loaded: true });
    },

    current: () => get().projects.find((p) => p.id === get().currentId),
    data: () => get().projects.find((p) => p.id === get().currentId)?.data,

    setTab: (t) => set({ tab: t }),
    setTool: (t) => set({ tool: t }),
    setZoneDrawKeepClear: (v) => set({ zoneDrawKeepClear: v }),
    select: (kind, id) => set({ selKind: kind, selId: id }),
    setActivePath: (id) => set({ activePathId: id }),
    setRuntimePreview: (v) => set({ runtimePreview: v }),

    newProject: (name) => {
      const p = createProject(name);
      saveProjectDb(p);
      setMeta("lastProject", p.id);
      set((st) => ({ projects: [p, ...st.projects], currentId: p.id, selId: null, selKind: null }));
    },

    openProject: (id) => {
      setMeta("lastProject", id);
      set({ currentId: id, selId: null, selIds: [], selKind: null, runtimePreview: false, past: [], future: [] });
    },

    renameProject: (id, name) => {
      set((st) => ({
        projects: st.projects.map((p) => (p.id === id ? { ...p, name, updatedAt: Date.now() } : p)),
      }));
      const p = get().projects.find((x) => x.id === id);
      if (p) saveProjectDb(p);
    },

    duplicateProject: (id) => {
      const src = get().projects.find((p) => p.id === id);
      if (!src) return;
      const copy: Project = {
        ...structuredClone(src),
        id: uid(),
        name: src.name + " (copy)",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      saveProjectDb(copy);
      set((st) => ({ projects: [copy, ...st.projects] }));
    },

    deleteProject: (id) => {
      deleteProjectDb(id);
      set((st) => {
        const remaining = st.projects.filter((p) => p.id !== id);
        const currentId = st.currentId === id ? remaining[0]?.id ?? null : st.currentId;
        return { projects: remaining, currentId };
      });
    },

    saveNow: async (thumbnail) => {
      const st = get();
      const proj = st.projects.find((p) => p.id === st.currentId);
      if (!proj) return;
      const updated = { ...proj, thumbnail: thumbnail ?? proj.thumbnail, updatedAt: Date.now() };
      await saveProjectDb(updated);
      set({
        projects: st.projects.map((p) => (p.id === updated.id ? updated : p)),
        dirty: false,
      });
    },

    undo: () => {
      const st = get();
      if (!st.past.length) return;
      const prev = st.past[st.past.length - 1];
      const curData = st.projects.find((p) => p.id === st.currentId)?.data;
      if (!curData) return;
      
      commit((d) => Object.assign(d, prev), false);
      set({ past: st.past.slice(0, -1), future: [curData, ...st.future] });
    },

    redo: () => {
      const st = get();
      if (!st.future.length) return;
      const next = st.future[0];
      const curData = st.projects.find((p) => p.id === st.currentId)?.data;
      if (!curData) return;
      
      commit((d) => Object.assign(d, next), false);
      set({ past: [...st.past, curData], future: st.future.slice(1) });
    },

    update: (fn, saveHistory = true) => commit(fn, saveHistory),
    addMedia: (m) => commit((d) => d.media.push(m)),
    removeMedia: (id) =>
      commit((d) => {
        d.media = d.media.filter((m) => m.id !== id);
        d.assets = d.assets.filter((a) => a.mediaId !== id);
      }),

    addAsset: (a) => commit((d) => d.assets.push(a)),
    updateAsset: (id, patch) =>
      commit((d) => {
        const a = d.assets.find((x) => x.id === id);
        if (a) Object.assign(a, patch);
      }, false),
    removeAsset: (id) => commit((d) => (d.assets = d.assets.filter((a) => a.id !== id))),
    duplicateAsset: (id) =>
      commit((d) => {
        const a = d.assets.find((x) => x.id === id);
        if (a) d.assets.push({ ...structuredClone(a), id: uid(), x: a.x + 30, y: a.y + 30, name: a.name + " copy" });
      }),

    addLayer: (l) => commit((d) => d.layers.push(l)),
    updateLayer: (id, patch) =>
      commit((d) => {
        const l = d.layers.find((x) => x.id === id);
        if (l) Object.assign(l, patch);
      }),
    removeLayer: (id) =>
      commit((d) => {
        if (d.layers.length <= 1) return;
        d.layers = d.layers.filter((l) => l.id !== id);
        const fallback = d.layers[0].id;
        d.assets.forEach((a) => a.layerId === id && (a.layerId = fallback));
      }),
    reorderLayer: (id, dir) =>
      commit((d) => {
        const i = d.layers.findIndex((l) => l.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= d.layers.length) return;
        [d.layers[i], d.layers[j]] = [d.layers[j], d.layers[i]];
      }),
    duplicateLayer: (id) =>
      commit((d) => {
        const i = d.layers.findIndex((l) => l.id === id);
        if (i < 0) return;
        const src = d.layers[i];
        const copy = { ...src, id: uid(), name: src.name + " copy" };
        d.layers.splice(i + 1, 0, copy);
        const dupAssets = d.assets.filter((a) => a.layerId === id).map((a) => ({ ...structuredClone(a), id: uid(), layerId: copy.id }));
        d.assets.push(...dupAssets);
      }),

    addGroup: (g) => commit((d) => d.randomGroups.push(g)),
    updateGroup: (id, patch) =>
      commit((d) => {
        const g = d.randomGroups.find((x) => x.id === id);
        if (g) Object.assign(g, patch);
      }),
    removeGroup: (id) => commit((d) => (d.randomGroups = d.randomGroups.filter((g) => g.id !== id))),

    addParticle: (p) => commit((d) => d.particles.push(p)),
    updateParticle: (id, patch) =>
      commit((d) => {
        const p = d.particles.find((x) => x.id === id);
        if (p) Object.assign(p, patch);
      }),
    removeParticle: (id) => commit((d) => (d.particles = d.particles.filter((p) => p.id !== id))),

    addPath: (p) => commit((d) => d.paths.push(p)),
    updatePath: (id, patch) =>
      commit((d) => {
        const p = d.paths.find((x) => x.id === id);
        if (p) Object.assign(p, patch);
      }),
    removePath: (id) => commit((d) => (d.paths = d.paths.filter((p) => p.id !== id))),

    addZone: (z) => commit((d) => d.zones.push(z)),
    updateZone: (id, patch) =>
      commit((d) => {
        const z = d.zones.find((x) => x.id === id);
        if (z) Object.assign(z, patch);
      }),
    removeZone: (id) => commit((d) => (d.zones = d.zones.filter((z) => z.id !== id))),
  };
});