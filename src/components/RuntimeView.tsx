import { useEffect, useRef, useState } from "react";
import { loadAllProjects, getMeta } from "../db";
import { RuntimeEngine } from "../runtime/engine";
import type { ProjectData } from "../types";

// Fullscreen standalone runtime rendered from the last opened project.
// Used when the app is opened with #runtime (e.g. a separate OBS window),
// without any editor UI.
export default function RuntimeView() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ProjectData | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    (async () => {
      const projects = await loadAllProjects();
      const lastId = await getMeta<string>("lastProject");
      const p = projects.find((x) => x.id === lastId) ?? projects[0];
      if (p) setData(p.data);
    })();
  }, []);

  useEffect(() => {
    if (!data || !stageRef.current) return;
    const eng = new RuntimeEngine(stageRef.current, data, { editorMode: false });
    const fit = () => setScale(Math.min(window.innerWidth / data.canvasWidth, window.innerHeight / data.canvasHeight));
    fit();
    window.addEventListener("resize", fit);
    eng.start();
    return () => {
      eng.destroy();
      window.removeEventListener("resize", fit);
    };
  }, [data]);

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black">
      <div ref={stageRef} style={{ transform: `scale(${scale})`, transformOrigin: "center" }} />
    </div>
  );
}
