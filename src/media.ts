import type { MediaAsset } from "./types";
import { uid, defaultSchedule } from "./factory";

function detectType(file: File): MediaAsset["type"] {
  const t = file.type;
  if (file.name.endsWith(".json")) return "lottie";
  if (t.includes("svg")) return "svg";
  if (t.includes("gif")) return "gif";
  if (t.includes("webp")) return "webp";
  if (t.startsWith("video")) return "video";
  return "image";
}

export function readFileAsMedia(file: File): Promise<MediaAsset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const type = detectType(file);
      const media: MediaAsset = {
        id: uid(),
        name: file.name.replace(/\.[^.]+$/, ""),
        type,
        dataUrl,
        categoryId: "cat-general",
        schedule: defaultSchedule(),
      };
      if (type === "lottie") {
        media.width = 500;
        media.height = 500;
        resolve(media);
      } else if (type === "video") {
        const v = document.createElement("video");
        v.onloadedmetadata = () => {
          media.width = v.videoWidth;
          media.height = v.videoHeight;
          resolve(media);
        };
        v.onerror = () => resolve(media);
        v.src = dataUrl;
      } else {
        const img = new Image();
        img.onload = () => {
          media.width = img.naturalWidth || 300;
          media.height = img.naturalHeight || 200;
          resolve(media);
        };
        img.onerror = () => {
          media.width = 300;
          media.height = 200;
          resolve(media);
        };
        img.src = dataUrl;
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function readFiles(files: FileList | File[]): Promise<MediaAsset[]> {
  const arr = Array.from(files);
  return Promise.all(arr.map(readFileAsMedia));
}
