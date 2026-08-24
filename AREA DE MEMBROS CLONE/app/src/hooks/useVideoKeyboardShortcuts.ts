import { useEffect } from "react";

// ─── useVideoKeyboardShortcuts ───────────────────────────────────────────────
// Atalhos de teclado clássicos pra player de vídeo. Usado no
// CoursePlayerScreen — o componente passa as ações que sabe executar
// (delegadas ao SDK do Panda / YouTube IFrame API), e o hook escuta o
// document e chama a ação certa.
//
// Atalhos:
//   Espaço / K  → play/pause
//   ←  / J      → -10s
//   →  / L      → +10s
//   ↑           → +10% volume
//   ↓           → -10% volume
//   M           → mute toggle
//   F           → fullscreen toggle
//   C           → toggle modo foco (esconde sidebar)
//   ?           → mostra modal de ajuda (não implementado aqui)
//
// Não dispara se foco estiver em <input>/<textarea>/contentEditable.
// =============================================================================

interface Actions {
  togglePlay?: () => void;
  seek?: (deltaSeconds: number) => void;
  setVolumeDelta?: (delta: number) => void;
  toggleMute?: () => void;
  toggleFullscreen?: () => void;
  toggleFocusMode?: () => void;
}

export function useVideoKeyboardShortcuts(actions: Actions, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    function isTyping(): boolean {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if (el.isContentEditable) return true;
      return false;
    }

    function onKey(e: KeyboardEvent) {
      if (isTyping()) return;
      // Só age em teclas sem modificadores (exceto Shift pra ?)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();
      switch (key) {
        case " ":
        case "k":
          if (actions.togglePlay) {
            e.preventDefault();
            actions.togglePlay();
          }
          break;
        case "arrowleft":
        case "j":
          if (actions.seek) {
            e.preventDefault();
            actions.seek(-10);
          }
          break;
        case "arrowright":
        case "l":
          if (actions.seek) {
            e.preventDefault();
            actions.seek(10);
          }
          break;
        case "arrowup":
          if (actions.setVolumeDelta) {
            e.preventDefault();
            actions.setVolumeDelta(0.1);
          }
          break;
        case "arrowdown":
          if (actions.setVolumeDelta) {
            e.preventDefault();
            actions.setVolumeDelta(-0.1);
          }
          break;
        case "m":
          if (actions.toggleMute) {
            e.preventDefault();
            actions.toggleMute();
          }
          break;
        case "f":
          if (actions.toggleFullscreen) {
            e.preventDefault();
            actions.toggleFullscreen();
          }
          break;
        case "c":
          if (actions.toggleFocusMode) {
            e.preventDefault();
            actions.toggleFocusMode();
          }
          break;
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled, actions]);
}
