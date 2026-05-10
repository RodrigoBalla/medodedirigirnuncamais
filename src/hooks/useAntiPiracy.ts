import { useEffect, useState } from "react";

// ─── useAntiPiracy ───────────────────────────────────────────────────────────
// Hook composto com 3 camadas de proteção client-side:
//   1. Detecta DevTools aberto (heurística por window.outer - inner)
//   2. Bloqueia menu de contexto (right-click) e atalhos de save
//   3. Detecta tentativa de captura de tela (getDisplayMedia / OBS)
//
// Quando algo é detectado, retorna `blocked = true` — o componente que usa
// pode mostrar overlay com aviso e pausar o vídeo.
//
// IMPORTANTE: client-side é apenas DISSUASÃO. Atacante determinado contorna.
// A proteção real é DRM Watermark (Panda) + Domain Restriction + sessão única.
// =============================================================================

interface Options {
  /** Bloqueia right-click no documento inteiro */
  blockContextMenu?: boolean;
  /** Bloqueia teclas F12, Ctrl+Shift+I, Ctrl+S, Ctrl+U */
  blockDevToolsKeys?: boolean;
  /** Detecta DevTools aberto via heurística */
  detectDevTools?: boolean;
  /** Detecta getDisplayMedia (OBS, Loom, screencast) */
  detectScreenCapture?: boolean;
}

interface Result {
  /** Algo suspeito foi detectado nesta sessão */
  blocked: boolean;
  /** Motivo do bloqueio (pra mostrar pro user) */
  reason: string | null;
  /** Permite o componente "destravar" depois (ex: aluno fechou DevTools) */
  reset: () => void;
}

export function useAntiPiracy({
  blockContextMenu = true,
  blockDevToolsKeys = true,
  detectDevTools = true,
  detectScreenCapture = true,
}: Options = {}): Result {
  const [blocked, setBlocked] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  // 1. Right-click + atalhos
  useEffect(() => {
    if (!blockContextMenu && !blockDevToolsKeys) return;

    const onContext = (e: MouseEvent) => {
      if (blockContextMenu) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!blockDevToolsKeys) return;
      // F12
      if (e.key === "F12") { e.preventDefault(); return; }
      // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (DevTools)
      if (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) {
        e.preventDefault();
        return;
      }
      // Ctrl+U (view source) / Ctrl+S (save) / Ctrl+P (print)
      if (e.ctrlKey && ["U", "S", "P"].includes(e.key.toUpperCase())) {
        e.preventDefault();
        return;
      }
    };
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("keydown", onKey);
    };
  }, [blockContextMenu, blockDevToolsKeys]);

  // 2. Heurística DevTools — diferença entre outer/inner > 200px sugere docked
  useEffect(() => {
    if (!detectDevTools) return;
    const THRESHOLD = 200;
    const check = () => {
      const widthDiff  = Math.abs(window.outerWidth  - window.innerWidth);
      const heightDiff = Math.abs(window.outerHeight - window.innerHeight);
      // Em alguns browsers/macOS, a diferença normal pode ser ~150px (toolbar).
      // Subo o threshold pra 300 e comparo só a maior das duas.
      if (Math.max(widthDiff, heightDiff) > THRESHOLD) {
        setBlocked(true);
        setReason("DevTools detectado");
      }
    };
    check();
    const t = window.setInterval(check, 2000);
    return () => window.clearInterval(t);
  }, [detectDevTools]);

  // 3. getDisplayMedia (OBS, Loom, screencast nativo)
  useEffect(() => {
    if (!detectScreenCapture) return;
    if (typeof navigator === "undefined") return;
    // @ts-expect-error mediaDevices opcional em browsers antigos
    const md = navigator.mediaDevices;
    if (!md?.getDisplayMedia) return;
    const original = md.getDisplayMedia.bind(md);
    md.getDisplayMedia = async (...args: any[]) => {
      setBlocked(true);
      setReason("Captura de tela detectada");
      // Ainda chama a original — não vamos quebrar o navegador,
      // só registrar a tentativa.
      return original(...args);
    };
    return () => {
      md.getDisplayMedia = original;
    };
  }, [detectScreenCapture]);

  return {
    blocked,
    reason,
    reset: () => { setBlocked(false); setReason(null); },
  };
}
