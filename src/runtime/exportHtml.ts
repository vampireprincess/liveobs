import JSZip from "jszip";
import type { Project, ProjectData } from "../types";
import { RUNTIME_ENGINE_SRC } from "./engineSource";
import LOTTIE_WEB_SRC from "lottie-web/build/player/lottie.min.js?raw";

// Build a standalone HTML string that runs the scene in OBS Browser Source.
// Everything (data + engine) is embedded — no server, no API, no editor UI.
export function buildRuntimeHtml(project: Project): string {
  const data = project.data;
  const json = JSON.stringify(data);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(project.name)}</title>
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000;}
  #stage-wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;}
  #stage{transform-origin:center center;}
  img,video{-webkit-user-drag:none;user-select:none;}
</style>
<script>
${LOTTIE_WEB_SRC}
</script>
</head>
<body>
<div id="stage-wrap"><div id="stage"></div></div>
<script>
${RUNTIME_ENGINE_SRC}
</script>
<script>
(function(){
  var DATA = ${json};
  var stage = document.getElementById('stage');
  var wrap = document.getElementById('stage-wrap');
  function fit(){
    var s = Math.min(window.innerWidth/DATA.canvasWidth, window.innerHeight/DATA.canvasHeight);
    stage.style.transform = 'scale('+s+')';
  }
  window.addEventListener('resize', fit);
  var engine = new RuntimeEngine(stage, DATA, { editorMode:false });
  fit();
  engine.start();
})();
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function exportZip(project: Project): Promise<void> {
  const zip = new JSZip();
  zip.file("index.html", buildRuntimeHtml(project));
  zip.file("runtime/runtime.js", RUNTIME_ENGINE_SRC);
  zip.file("runtime/runtime.css", "html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000;}#stage-wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;}#stage{transform-origin:center center;}img,video{-webkit-user-drag:none;user-select:none;}");
  zip.file("project.json", JSON.stringify(project.data, null, 2));
  const assetFolder = zip.folder("assets");
  for (const media of project.data.media) {
    const parsed = dataUrlToFile(media.dataUrl);
    if (parsed) assetFolder?.file(`${media.id}-${sanitize(media.name)}.${parsed.ext}`, parsed.bytes);
  }
  zip.file(
    "README.txt",
    `${project.name} — OBS Browser Source Layout\n\n` +
      `HOW TO USE IN OBS:\n` +
      `1. Extract this folder anywhere on your PC.\n` +
      `2. In OBS add a "Browser" source.\n` +
      `3. Check "Local file" and select index.html.\n` +
      `4. Set Width ${project.data.canvasWidth} and Height ${project.data.canvasHeight}.\n` +
      `5. Enjoy your living scene! Everything runs locally, no internet needed.\n`
  );
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, sanitize(project.name) + ".zip");
}

async function optimizeImagesForSingleHtml(data: ProjectData): Promise<ProjectData> {
  const clone = structuredClone(data);
  await Promise.all(clone.media.map(async (m) => {
    if (!m.dataUrl.startsWith('data:image/') || m.type === 'svg' || m.type === 'gif' || m.type === 'lottie') return;
    const used = clone.assets.filter((a) => a.mediaId === m.id);
    if (!used.length) return;
    const maxW = Math.max(...used.map((a) => Math.ceil(a.width * (a.scale || 1))));
    const maxH = Math.max(...used.map((a) => Math.ceil(a.height * (a.scale || 1))));
    if (!maxW || !maxH) return;
    try {
      const img = await loadImage(m.dataUrl);
      if (img.naturalWidth <= maxW * 1.15 && img.naturalHeight <= maxH * 1.15) return;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, maxW); canvas.height = Math.max(1, maxH);
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const mime = m.dataUrl.match(/^data:([^;]+);/)?.[1] || 'image/jpeg';
      m.dataUrl = canvas.toDataURL(mime.includes('png') ? 'image/png' : mime.includes('webp') ? 'image/webp' : 'image/jpeg', 0.86);
      m.width = canvas.width; m.height = canvas.height;
    } catch {}
  }));
  return clone;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function dataUrlToFile(dataUrl: string): { bytes: Uint8Array; ext: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const ext = mime.includes("svg") ? "svg" : mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("gif") ? "gif" : mime.includes("mp4") ? "mp4" : "jpg";
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, ext };
}

export async function exportSingleHtml(project: Project): Promise<void> {
  const optimized = await optimizeImagesForSingleHtml(project.data);
  const blob = new Blob([buildRuntimeHtml(project, { dataOverride: optimized })], { type: "text/html" });
  downloadBlob(blob, sanitize(project.name) + ".html");
}

function sanitize(s: string): string {
  return s.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "scene";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
