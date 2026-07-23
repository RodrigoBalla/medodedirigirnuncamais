// ─── coinFly ─────────────────────────────────────────────────────────────────
// Animação: um punhado de moedas douradas sobe da origem (ex: card de missões)
// e voa pro saldo acumulado da aluna (chip #onboarding-coins no header). Se o
// chip não estiver visível na aba atual (ele só aparece em Missões/Perfil/
// Ranking), as moedas sobem pro topo-direito — onde o saldo mora — e um selo
// "+N 🪙" pousa ali pra confirmar que foi creditado.
//
// Implementado com a Web Animations API (element.animate) direto no <body>, fora
// do React, pra ficar fluido e não disparar re-render. Respeita reduced-motion.
// =============================================================================

const Z = 2147483600;

export interface FlyCoinsOptions {
  /** Elemento de origem (as moedas partem do centro-superior dele). */
  fromEl?: HTMLElement | null;
  /** Quantas moedas-sprite animar (visual). Default 16, cap 24. */
  count?: number;
  /** Selo mostrado no ponto de chegada, ex: "+50". */
  label?: string;
  /** Chamado 1x depois que a última moeda pousa (ex: creditar de fato). */
  onDone?: () => void;
}

function coinTarget(): { x: number; y: number; el: HTMLElement | null } {
  const el = document.getElementById("onboarding-coins");
  if (el) {
    const r = el.getBoundingClientRect();
    if (r.width > 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2, el };
  }
  // Fallback: topo-direito, onde o chip de saldo aparece nas outras abas.
  return { x: Math.max(40, window.innerWidth - 46), y: 56, el: null };
}

function makeCoin(): HTMLElement {
  const c = document.createElement("div");
  c.setAttribute("aria-hidden", "true");
  c.style.cssText = [
    "position:fixed", "left:0", "top:0", "width:22px", "height:22px",
    "border-radius:50%",
    "background:radial-gradient(circle at 34% 28%, #FFF3AE 0%, #FFD60A 46%, #E0A500 100%)",
    "box-shadow:0 0 0 1px rgba(160,110,0,.55) inset, 0 2px 6px rgba(0,0,0,.35), 0 0 14px rgba(255,214,10,.65)",
    `z-index:${Z}`, "pointer-events:none", "will-change:transform,opacity",
  ].join(";");
  return c;
}

function landingBadge(x: number, y: number, label: string) {
  const b = document.createElement("div");
  b.textContent = `🪙 ${label}`;
  b.style.cssText = [
    "position:fixed", `left:${x}px`, `top:${y}px`,
    "transform:translate(-50%,-50%) scale(.4)", "opacity:0",
    "font-family:'Lexend',system-ui,sans-serif", "font-weight:900", "font-size:14px",
    "color:#0B1A38", "background:#FFD60A", "padding:5px 12px", "border-radius:999px",
    "box-shadow:0 6px 18px rgba(0,0,0,.35)", `z-index:${Z}`, "pointer-events:none",
    "white-space:nowrap",
  ].join(";");
  document.body.appendChild(b);
  b.animate(
    [
      { transform: "translate(-50%,-50%) scale(.4)", opacity: 0, offset: 0 },
      { transform: "translate(-50%,-160%) scale(1)", opacity: 1, offset: 0.25 },
      { transform: "translate(-50%,-260%) scale(1)", opacity: 1, offset: 0.7 },
      { transform: "translate(-50%,-360%) scale(.9)", opacity: 0, offset: 1 },
    ],
    { duration: 1300, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
  ).onfinish = () => b.remove();
}

function popTarget(el: HTMLElement | null) {
  if (!el) return;
  el.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.28)" },
      { transform: "scale(1)" },
    ],
    { duration: 420, easing: "cubic-bezier(.34,1.56,.64,1)" },
  );
}

export function flyCoins({ fromEl, count = 16, label, onDone }: FlyCoinsOptions): void {
  if (typeof document === "undefined" || typeof window === "undefined") { onDone?.(); return; }

  const { x: tx, y: ty, el: targetEl } = coinTarget();
  const src = fromEl?.getBoundingClientRect();
  const sx = src ? src.left + src.width / 2 : window.innerWidth / 2;
  const sy = src ? src.top + src.height * 0.35 : window.innerHeight / 2;

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduce) {
    popTarget(targetEl);
    if (label) landingBadge(tx, ty, label);
    onDone?.();
    return;
  }

  const n = Math.max(6, Math.min(count, 24));
  let landed = 0;
  let doneFired = false;
  const finishOne = () => {
    landed += 1;
    if (landed >= n && !doneFired) {
      doneFired = true;
      popTarget(targetEl);
      if (label) landingBadge(tx, ty, label);
      onDone?.();
    }
  };

  for (let i = 0; i < n; i++) {
    const coin = makeCoin();
    document.body.appendChild(coin);

    const startX = sx + (Math.random() - 0.5) * 130;
    const startY = sy + (Math.random() - 0.5) * 44;
    const cx = (startX + tx) / 2 + (Math.random() - 0.5) * 90; // controle do arco
    const cy = Math.min(startY, ty) - 90 - Math.random() * 70;  // sobe antes de cair no saldo
    const delay = i * 42 + Math.random() * 40;
    const duration = 760 + Math.random() * 260;

    let settled = false;
    const settle = () => { if (settled) return; settled = true; coin.remove(); finishOne(); };

    const anim = coin.animate(
      [
        { transform: `translate(${startX}px, ${startY}px) scale(.3)`, opacity: 0, offset: 0 },
        { transform: `translate(${startX}px, ${startY}px) scale(1)`, opacity: 1, offset: 0.12 },
        { transform: `translate(${cx}px, ${cy}px) scale(1.12)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${tx}px, ${ty}px) scale(.45)`, opacity: 0.85, offset: 1 },
      ],
      { duration, delay, easing: "cubic-bezier(.42,0,.58,1)", fill: "forwards" },
    );
    anim.onfinish = settle;
    // rede de segurança: conta a moeda mesmo se onfinish não disparar (guardado por `settled`)
    window.setTimeout(settle, delay + duration + 400);
  }
}
