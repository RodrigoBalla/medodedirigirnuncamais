import { useEffect, useRef, useState } from "react";

/**
 * CarCursor — substitui o cursor do mouse por um carrinho topdown amarelo+navy
 * que rotaciona suave na direção do movimento. A cada ~28px de movimento,
 * deixa um par de marcas de pneu na tela que somem em 1 segundo.
 *
 * Vibe perfeita pra área de membros do "Medo de Dirigir Nunca Mais".
 *
 * Detalhes:
 *  - Esconde o cursor padrão GLOBAL enquanto vive (injeta <style>; remove no unmount).
 *  - SÓ em devices com pointer fino (skip touch/tablet — sem mouse real).
 *  - Posição do carro animada via requestAnimationFrame + transform (60fps, no re-render).
 *  - Trails são divs absolute spawned em setState com cap de 60 (evita inflar DOM).
 *  - Cada trail tem 2 pneus paralelos, posicionados ATRÁS do carro perpendicular
 *    à direção do movimento.
 *  - Respeita prefers-reduced-motion (cursor instantâneo, sem trails).
 *  - z-index altíssimo + pointer-events: none pra não bloquear cliques.
 */

interface Trail {
  id: number;
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
  angleDeg: number; // ângulo do veículo (pneu fica perpendicular)
}

// Constantes ajustáveis — se ficar lento, aumente SPAWN_DISTANCE ou diminua MAX_TRAILS
const SPAWN_DISTANCE = 28;
const MAX_TRAILS = 60;
const TRAIL_LIFE_MS = 1000;
const CAR_OFFSET = 12;        // px atrás do centro do carro
const TIRE_HALF_WIDTH = 7;    // px entre o pneu esquerdo e o direito (metade)

export function CarCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const lastPos = useRef({ x: -100, y: -100 });
  const targetAngle = useRef(0);
  const currentAngle = useRef(0);
  const rafId = useRef<number | null>(null);
  const distSinceTrail = useRef(0);
  const trailIdSeq = useRef(0);
  // Rastros em estado (re-render) — mas só spawnam a cada SPAWN_DISTANCE px
  const [trails, setTrails] = useState<Trail[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Desativa em touch devices
    const isTouch = window.matchMedia("(hover: none)").matches;
    if (isTouch) return;

    const cursor = cursorRef.current;
    if (!cursor) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SMOOTHING = reducedMotion ? 1 : 0.22;
    const MIN_DISTANCE = 2;
    const SPAWN_TRAILS = !reducedMotion;

    // Injeta CSS global pra ocultar o cursor padrão em tudo
    const styleEl = document.createElement("style");
    styleEl.id = "car-cursor-global-style";
    styleEl.textContent = `
      html, body, button, a, input, textarea, select, label, summary,
      [role="button"], [role="link"], [tabindex] {
        cursor: none !important;
      }
    `;
    document.head.appendChild(styleEl);
    document.body.classList.add("car-cursor-active");

    function handleMove(e: MouseEvent) {
      const prevX = lastPos.current.x;
      const prevY = lastPos.current.y;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      const distance = Math.hypot(dx, dy);

      // Atualiza ângulo só com movimento significativo
      if (distance > MIN_DISTANCE) {
        const angleRad = Math.atan2(dy, dx);
        // O SVG do carro aponta pra CIMA (norte) por padrão → +90° pra alinhar
        targetAngle.current = angleRad * (180 / Math.PI) + 90;
      }

      lastPos.current = { x: e.clientX, y: e.clientY };

      // Spawn de trail
      if (!SPAWN_TRAILS || distance < 0.5 || prevX < 0) return; // primeira leitura: ignora
      distSinceTrail.current += distance;
      if (distSinceTrail.current >= SPAWN_DISTANCE) {
        distSinceTrail.current = 0;

        const len = Math.max(distance, 0.0001);
        const dirX = dx / len;
        const dirY = dy / len;
        // Perpendicular (pra separar pneu esquerdo/direito)
        const perpX = -dirY;
        const perpY = dirX;

        // Centro dos pneus: atrás do carro na direção contrária ao movimento
        const cx = e.clientX - dirX * CAR_OFFSET;
        const cy = e.clientY - dirY * CAR_OFFSET;

        const id = ++trailIdSeq.current;
        const angleDeg = targetAngle.current;
        const trail: Trail = {
          id,
          leftX: cx + perpX * TIRE_HALF_WIDTH,
          leftY: cy + perpY * TIRE_HALF_WIDTH,
          rightX: cx - perpX * TIRE_HALF_WIDTH,
          rightY: cy - perpY * TIRE_HALF_WIDTH,
          angleDeg,
        };

        setTrails((prev) => {
          const next = prev.length >= MAX_TRAILS ? prev.slice(prev.length - MAX_TRAILS + 1) : prev;
          return [...next, trail];
        });

        setTimeout(() => {
          setTrails((prev) => prev.filter((t) => t.id !== id));
        }, TRAIL_LIFE_MS + 50);
      }
    }

    function animate() {
      // Interpolação angular pelo caminho curto ([-180°, 180°])
      const raw = targetAngle.current - currentAngle.current;
      const shortest = ((raw + 540) % 360) - 180;
      currentAngle.current += shortest * SMOOTHING;

      cursor!.style.transform =
        `translate3d(${lastPos.current.x}px, ${lastPos.current.y}px, 0)` +
        ` translate(-50%, -50%) rotate(${currentAngle.current}deg)`;

      rafId.current = requestAnimationFrame(animate);
    }

    document.addEventListener("mousemove", handleMove);
    rafId.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener("mousemove", handleMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
      document.body.classList.remove("car-cursor-active");
      document.getElementById("car-cursor-global-style")?.remove();
    };
  }, []);

  // SSR / touch: não renderiza nada
  if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) {
    return null;
  }

  return (
    <>
      <style>{`
        .mddnm-tire-mark {
          position: fixed;
          top: 0;
          left: 0;
          width: 3px;
          height: 11px;
          background: rgba(255, 255, 255, 0.42);
          border-radius: 2px;
          pointer-events: none;
          z-index: 9999;
          animation: mddnm-tire-fade ${TRAIL_LIFE_MS}ms linear forwards;
          will-change: opacity;
        }
        @keyframes mddnm-tire-fade {
          0% { opacity: 0.55; }
          100% { opacity: 0; }
        }
      `}</style>

      <div
        ref={cursorRef}
        aria-hidden="true"
        className="fixed top-0 left-0 pointer-events-none hidden md:block"
        style={{
          zIndex: 10000,
          willChange: "transform",
          transform: "translate3d(-100px, -100px, 0)",
        }}
      >
        {/* Carro top-down: amarelo (#FFD60A), contornos pretos, vidros navy */}
        <svg
          width="34"
          height="34"
          viewBox="0 0 34 34"
          xmlns="http://www.w3.org/2000/svg"
          style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,.45))" }}
        >
          <ellipse cx="17" cy="29" rx="9" ry="2" fill="rgba(0,0,0,.35)" />
          <rect x="8" y="4" width="18" height="24" rx="5" fill="#FFD60A" stroke="#000000" strokeWidth="1.5" />
          <path d="M 10 8 Q 17 6 24 8 L 23 12 L 11 12 Z" fill="#0A1F5C" stroke="#000" strokeWidth="0.8" />
          <path d="M 11 22 L 23 22 L 23.5 25 Q 17 26 10.5 25 Z" fill="#0A1F5C" opacity="0.85" />
          <circle cx="11" cy="5.5" r="1.2" fill="#FFFFFF" stroke="#000" strokeWidth="0.4" />
          <circle cx="23" cy="5.5" r="1.2" fill="#FFFFFF" stroke="#000" strokeWidth="0.4" />
          <rect x="10" y="26.5" width="3" height="1.5" rx="0.5" fill="#dc2626" />
          <rect x="21" y="26.5" width="3" height="1.5" rx="0.5" fill="#dc2626" />
          <rect x="6" y="11" width="2.5" height="2.5" rx="0.6" fill="#000" />
          <rect x="25.5" y="11" width="2.5" height="2.5" rx="0.6" fill="#000" />
          <line x1="10" y1="16" x2="24" y2="16" stroke="#000" strokeWidth="0.5" opacity="0.4" />
        </svg>
      </div>

      {/* Rastros de pneus — 2 marcas por trail (pneu esquerdo + direito) */}
      {trails.map((t) => (
        <span key={t.id}>
          <span
            className="mddnm-tire-mark"
            style={{
              transform: `translate3d(${t.leftX}px, ${t.leftY}px, 0) translate(-50%, -50%) rotate(${t.angleDeg}deg)`,
            }}
          />
          <span
            className="mddnm-tire-mark"
            style={{
              transform: `translate3d(${t.rightX}px, ${t.rightY}px, 0) translate(-50%, -50%) rotate(${t.angleDeg}deg)`,
            }}
          />
        </span>
      ))}
    </>
  );
}
