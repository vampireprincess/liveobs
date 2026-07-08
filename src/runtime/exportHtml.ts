import JSZip from "jszip";
import type { Project } from "../types";
import { RUNTIME_ENGINE_SRC } from "./engineSource";
import LOTTIE_WEB_SRC from "lottie-web/build/player/lottie.min.js?raw";

// Build a standalone HTML string that runs the scene in OBS Browser Source.
// Everything (data + engine) is embedded — no server, no API, no editor UI.
export function buildRuntimeHtml(project: Project, opts: { dataOverride?: Project["data"]; externalRuntimeSrc?: string; externalLottieSrc?: string } = {}): string {
  const data = opts.dataOverride ?? project.data;
  const json = JSON.stringify(data);
  const lottieScript = opts.externalLottieSrc ? `<script src="${opts.externalLottieSrc}"></script>` : `<script>\n${LOTTIE_WEB_SRC}\n</script>`;
  const runtimeScript = opts.externalRuntimeSrc ? `<script src="${opts.externalRuntimeSrc}"></script>` : `<script>\n${RUNTIME_ENGINE_SRC}\n</script>`;
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
${lottieScript}
</head>
<body>
<div id="stage-wrap"><div id="stage"></div></div>
${runtimeScript}
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
  const data = structuredClone(project.data);
  const assetFolder = zip.folder("assets");
  for (const media of data.media) {
    const parsed = dataUrlToFile(media.dataUrl);
    if (parsed) {
      const filename = `${media.id}-${sanitize(media.name)}.${parsed.ext}`;
      assetFolder?.file(filename, parsed.bytes);
      media.dataUrl = `assets/${filename}`;
    }
  }

  zip.file("index.html", buildRuntimeHtml(project, { dataOverride: data, externalRuntimeSrc: "runtime/runtime.js", externalLottieSrc: "runtime/lottie.min.js" }));
  zip.file("runtime/runtime.js", RUNTIME_ENGINE_SRC);
  zip.file("runtime/lottie.min.js", LOTTIE_WEB_SRC);
  zip.file("runtime/runtime.css", "html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000;}#stage-wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;}#stage{transform-origin:center center;}img,video{-webkit-user-drag:none;user-select:none;}");
  zip.file("project.json", JSON.stringify(data, null, 2));
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

export function exportSingleHtml(project: Project): void {
  const blob = new Blob([buildRuntimeHtml(project)], { type: "text/html" });
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
