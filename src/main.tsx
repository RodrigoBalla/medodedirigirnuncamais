import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ─── Silenciar ruído conhecido de TERCEIROS ──────────────────────────────────
// O bridge.js da Eduzz (checkout embedado) dispara "Uncaught (in promise) Error:
// already initialized" toda vez que inicializa — é interno da Eduzz, não quebra
// nada e o checkout funciona normal. Como não controlamos o código deles, só
// engolimos ESSE erro específico pra não poluir o console (e os relatórios de
// erro). Qualquer outro erro continua aparecendo normalmente.
if (typeof window !== "undefined") {
  const isEduzzAlreadyInit = (msg: unknown): boolean => {
    const s = typeof msg === "string" ? msg : (msg as { message?: string })?.message || "";
    return /already initialized/i.test(s);
  };
  window.addEventListener("unhandledrejection", (e) => {
    if (isEduzzAlreadyInit(e.reason)) {
      e.preventDefault();
    }
  });
  window.addEventListener(
    "error",
    (e) => {
      if (isEduzzAlreadyInit(e.message) || isEduzzAlreadyInit(e.error)) {
        e.preventDefault();
      }
    },
    true,
  );
}

createRoot(document.getElementById("root")!).render(<App />);
