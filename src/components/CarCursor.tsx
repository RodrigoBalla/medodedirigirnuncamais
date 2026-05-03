import { useEffect, useRef } from "react";

/**
 * CarCursor — substitui o cursor do mouse por um carrinho topdown amarelo+navy
 * que rotaciona suave na direção do movimento. Identidade visual de trânsito.
 *
 * Detalhes:
 *  - Esconde o cursor padrão em todo o app (exceto inputs/textarea pra usabilidade).
 *  - Não aparece em touch devices (sem ponteiro real).
 *  - Respeita prefers-reduced-motion (sem rotação suave, só posição).
 *  - z-index altíssimo + pointer-events: none pra não bloquear cliques.
 */
export function CarCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const lastPos = useRef({ x: -100, y: -100 });
  const targetAngle = useRef(0);
  const currentAngle = useRef(0);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Desativa em touch devices (sem hover/pointer real)
    const isTouch = window.matchMedia("(hover: none)").matches;
    if (isTouch) return;

    const cursor = cursorRef.current;
    if (!cursor) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SMOOTHING = reducedMotion ? 1 : 0.22; // 1 = sem easing
    const MIN_DISTANCE = 2; // pixels — abaixo disso ignora pra evitar jitter

    function handleMove(e: MouseEvent) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      const distance = Math.hypot(dx, dy);

      // Só atualiza ângulo alvo se houve movimento significativo
      if (distance > MIN_DISTANCE) {
        // atan2 retorna o ângulo (rad) do vetor (dx, dy) em relação ao eixo X positivo.
        // Como o SVG do carro aponta pra CIMA (north) por padrão, somamos 90° pra alinhar.
        const angleRad = Math.atan2(dy, dx);
        targetAngle.current = angleRad * (180 / Math.PI) + 90;
      }

      lastPos.current = { x: e.clientX, y: e.clientY };
    }

    function animate() {
      // Interpola currentAngle em direção a targetAngle pelo caminho mais curto
      // (evita "girar 350° pra chegar a 10°"). Diff normalizado em [-180, 180].
      const raw = targetAngle.current - currentAngle.current;
      const shortest = ((raw + 540) % 360) - 180;
      currentAngle.current += shortest * SMOOTHING;

      cursor!.style.transform =
        `translate3d(${lastPos.current.x}px, ${lastPos.current.y}px, 0)` +
        ` translate(-50%, -50%) rotate(${currentAngle.current}deg)`;

      rafId.current = requestAnimationFrame(animate);
    }

    document.body.classList.add("car-cursor-active");
    document.addEventListener("mousemove", handleMove);
    rafId.current = requestAnimationFrame(animate);

    return () => {
      document.body.classList.remove("car-cursor-active");
      document.removeEventListener("mousemove", handleMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      aria-hidden="true"
      className="fixed top-0 left-0 pointer-events-none hidden md:block"
      style={{
        zIndex: 10000,
        willChange: "transform",
        // Posiciona inicial fora da tela até primeiro mousemove
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
        {/* Sombra leve embaixo */}
        <ellipse cx="17" cy="29" rx="9" ry="2" fill="rgba(0,0,0,.35)" />

        {/* Carroceria */}
        <rect
          x="8" y="4" width="18" height="24" rx="5"
          fill="#FFD60A"
          stroke="#000000"
          strokeWidth="1.5"
        />

        {/* Para-brisa frontal (navy escuro) */}
        <path
          d="M 10 8 Q 17 6 24 8 L 23 12 L 11 12 Z"
          fill="#0A1F5C"
          stroke="#000"
          strokeWidth="0.8"
        />

        {/* Vidro traseiro */}
        <path
          d="M 11 22 L 23 22 L 23.5 25 Q 17 26 10.5 25 Z"
          fill="#0A1F5C"
          opacity="0.85"
        />

        {/* Faróis (frente) */}
        <circle cx="11" cy="5.5" r="1.2" fill="#FFFFFF" stroke="#000" strokeWidth="0.4" />
        <circle cx="23" cy="5.5" r="1.2" fill="#FFFFFF" stroke="#000" strokeWidth="0.4" />

        {/* Lanternas (traseira) */}
        <rect x="10" y="26.5" width="3" height="1.5" rx="0.5" fill="#dc2626" />
        <rect x="21" y="26.5" width="3" height="1.5" rx="0.5" fill="#dc2626" />

        {/* Retrovisores laterais */}
        <rect x="6" y="11" width="2.5" height="2.5" rx="0.6" fill="#000" />
        <rect x="25.5" y="11" width="2.5" height="2.5" rx="0.6" fill="#000" />

        {/* Linha do teto (detalhe) */}
        <line x1="10" y1="16" x2="24" y2="16" stroke="#000" strokeWidth="0.5" opacity="0.4" />
      </svg>
    </div>
  );
}
