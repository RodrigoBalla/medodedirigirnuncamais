import { useEffect, useState } from "react";

// ─── WatermarkOverlay ────────────────────────────────────────────────────────
// Overlay HTML por cima do iframe do Panda — complementa o DRM Watermark
// dele cobrindo print/screencast (a watermark do Panda só aparece DURANTE
// reprodução; um print do thumb não pega).
//
// O texto fica em duas posições alternadas que mudam a cada 8s, com
// `pointer-events: none` (clicks passam pro player) e `mix-blend-mode`
// pra ficar legível em qualquer tom de imagem.
//
// Mostra: email + ID curto do user + horário atual.
// Renderizado por cima do <iframe> via `position: absolute; inset: 0`.
// =============================================================================

type Position = "tl" | "tr" | "bl" | "br" | "c";

const POSITIONS: Record<Position, string> = {
  tl: "top-3 left-3",
  tr: "top-3 right-3",
  bl: "bottom-16 left-3",
  br: "bottom-16 right-3",
  c:  "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
};

const ORDER: Position[] = ["tr", "bl", "tl", "br", "c"];

interface Props {
  /** Email ou identificador do aluno (ex: carla@example.com) */
  viewerId?: string;
  /** Intervalo entre trocas de posição em ms — default 8s */
  intervalMs?: number;
}

export function WatermarkOverlay({ viewerId, intervalMs = 8000 }: Props) {
  const [posIdx, setPosIdx] = useState(0);
  const [now, setNow] = useState(() => new Date().toLocaleString("pt-BR"));

  useEffect(() => {
    if (!viewerId) return;
    const t = window.setInterval(() => {
      setPosIdx((i) => (i + 1) % ORDER.length);
      setNow(new Date().toLocaleString("pt-BR"));
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [viewerId, intervalMs]);

  if (!viewerId) return null;

  const pos = POSITIONS[ORDER[posIdx]];

  return (
    <div
      className={`absolute ${pos} z-30 pointer-events-none transition-all duration-1000 select-none`}
      style={{ mixBlendMode: "difference" }}
      aria-hidden
    >
      <div className="text-[10px] md:text-xs font-mono text-white/70 bg-black/20 backdrop-blur-sm px-2 py-1 rounded leading-tight">
        <div className="font-bold tracking-tight">{viewerId}</div>
        <div className="text-[9px] opacity-70">{now}</div>
      </div>
    </div>
  );
}
