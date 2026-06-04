import { useEffect, useRef, useState } from "react";

// ─── EduzzCheckoutEmbed ──────────────────────────────────────────────────────
// Renderiza o checkout oficial da Eduzz inline dentro da nossa página, sem
// abrir nova aba e sem hack de iframe.
//
// Como funciona:
//   1. Injeta o `bridge.js` da Eduzz no <head> (singleton — só uma vez por
//      sessão, mesmo se múltiplos checkouts renderizarem).
//   2. Quando o bridge expõe `window.Eduzz.Checkout`, chama `.init()` com o
//      `contentId` (o slug do produto, ex: "E05NOV749X" — parte depois de
//      `chk.eduzz.com/`).
//   3. O bridge popula o `<div id={targetId}>` com o checkout completo
//      (campos de cartão, parcelas, pix, order bumps, tudo).
//
// Quando a aluna finaliza a compra:
//   • A Eduzz dispara o postback pro nosso webhook (já testado)
//   • O grupo de acesso é liberado automaticamente
//   • A aluna pode logar e ver o curso desbloqueado
//
// IMPORTANTE: o CSP em `netlify.toml` precisa liberar:
//   • script-src:  https://cdn.eduzzcdn.com https://*.eduzz.com
//   • connect-src: https://*.eduzz.com
//   • frame-src:   https://*.eduzz.com
// =============================================================================

const BRIDGE_SRC = "https://cdn.eduzzcdn.com/sun/bridge/bridge.js";

// Tipagem mínima do SDK Eduzz (só o que usamos)
declare global {
  interface Window {
    Eduzz?: {
      Checkout?: {
        init: (opts: {
          contentId: string;
          target: string;
          errorCover?: boolean;
        }) => void;
      };
    };
  }
}

function injectBridgeOnce(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[src="${BRIDGE_SRC}"]`)) return;
  const s = document.createElement("script");
  s.src = BRIDGE_SRC;
  s.async = true;
  // O snippet oficial usa type=module; respeitamos.
  s.setAttribute("type", "module");
  document.head.appendChild(s);
}

interface Props {
  /**
   * ID/slug do checkout Eduzz — parte final da URL.
   * Ex: pra `https://chk.eduzz.com/E05NOV749X`, passe `"E05NOV749X"`.
   */
  contentId: string;
}

export function EduzzCheckoutEmbed({ contentId }: Props) {
  // ID único pro container — permite múltiplos checkouts na mesma página
  // (futuro: combos/upsell), embora hoje só renderizemos um por vez.
  const targetId = `eduzz-checkout-${contentId}`;
  // URL do checkout hospedado da Eduzz — usada como FALLBACK garantido caso o
  // embed inline não apareça (mobile lento, ad-block, bridge.js fora do ar).
  // chk.eduzz.com/<código> abre o mesmo checkout numa página própria.
  const directUrl = `https://chk.eduzz.com/${contentId}`;
  const initialized = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    injectBridgeOnce();

    // Polling pra esperar o bridge expor window.Eduzz.Checkout.
    // O script é async + type=module, então pode demorar uns ms até ficar disponível.
    // Timeout generoso (25s) porque em 4G fraco / Wi-Fi de casa o bridge.js
    // demora bem mais que no desktop. Antes era 10s e estourava no mobile,
    // mostrando "não carregou" mesmo com o checkout a caminho.
    const start = Date.now();
    const TIMEOUT_MS = 25_000;
    const interval = window.setInterval(() => {
      if (initialized.current) {
        window.clearInterval(interval);
        return;
      }
      const init = window.Eduzz?.Checkout?.init;
      if (init) {
        try {
          init({ contentId, target: targetId, errorCover: false });
          initialized.current = true;
          setStatus("ready");
        } catch (err) {
          console.error("[EduzzCheckoutEmbed] init falhou:", err);
          setStatus("error");
        }
        window.clearInterval(interval);
        return;
      }
      if (Date.now() - start > TIMEOUT_MS) {
        console.error("[EduzzCheckoutEmbed] timeout esperando bridge.js carregar");
        setStatus("error");
        window.clearInterval(interval);
      }
    }, 80);

    return () => {
      window.clearInterval(interval);
    };
  }, [contentId, targetId]);

  return (
    <div className="relative">
      {/* Skeleton enquanto o bridge.js carrega */}
      {status === "loading" && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-card/60 backdrop-blur-sm rounded-2xl border border-border z-10 pointer-events-none"
          aria-hidden="true"
        >
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full" />
            <p className="text-xs font-black uppercase tracking-widest">Carregando checkout seguro…</p>
          </div>
        </div>
      )}

      {/* Mensagem de erro se o bridge não carregar (rede, CSP, ad-block).
          Em vez de um beco sem saída, oferece o caminho que SEMPRE funciona:
          abrir o checkout hospedado da Eduzz numa nova aba. */}
      {status === "error" && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-2xl p-4 mb-4">
          <p className="font-bold text-sm">O checkout não carregou aqui.</p>
          <p className="text-xs opacity-80 mt-1 mb-3">
            Pode ser conexão lenta ou bloqueador de anúncios. Toque no botão pra
            finalizar a compra com segurança numa nova aba.
          </p>
          <a
            href={directUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-black uppercase tracking-widest px-4 py-2.5 rounded-xl hover:brightness-110 transition"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            Abrir checkout seguro
          </a>
        </div>
      )}

      {/* Container onde o bridge injeta o checkout. Min-height pra evitar
          collapse enquanto carrega. */}
      <div
        id={targetId}
        className="min-h-[600px] rounded-2xl overflow-hidden bg-card border border-border"
      />

      {/* Escotilha de segurança SEMPRE visível: mesmo quando o embed "carrega"
          mas fica em branco (comum em webview mobile / ad-block), a aluna tem
          um caminho garantido pra comprar. Discreto pra não competir com o
          checkout inline quando ele funciona. */}
      <a
        href={directUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        <span className="material-symbols-outlined text-sm">open_in_new</span>
        Não está vendo o checkout? Abrir em nova aba
      </a>
    </div>
  );
}

/**
 * Extrai o `contentId` (slug) de uma URL de checkout Eduzz.
 * Ex: `https://chk.eduzz.com/E05NOV749X` → `"E05NOV749X"`.
 * Retorna `null` se a URL não bater no padrão esperado.
 */
export function extractEduzzContentId(url: string | null | undefined): string | null {
  if (!url) return null;
  // Padrão oficial: chk.eduzz.com/<slug>
  const match = url.match(/chk\.eduzz\.com\/([A-Za-z0-9]+)/i);
  if (match?.[1]) return match[1];
  // Fallback: pega o último segmento depois da última `/` (caso o admin
  // tenha colado a URL num formato diferente).
  const tail = url.split("/").filter(Boolean).pop();
  return tail && /^[A-Za-z0-9]+$/.test(tail) ? tail : null;
}
