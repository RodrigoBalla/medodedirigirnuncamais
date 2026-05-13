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
  const initialized = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    injectBridgeOnce();

    // Polling pra esperar o bridge expor window.Eduzz.Checkout.
    // O script é async + type=module, então pode demorar uns ms até ficar disponível.
    const start = Date.now();
    const TIMEOUT_MS = 10_000;
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

      {/* Mensagem de erro se o bridge não carregar (rede, CSP, ad-block) */}
      {status === "error" && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-2xl p-4 mb-4">
          <p className="font-bold text-sm">Não foi possível carregar o checkout.</p>
          <p className="text-xs opacity-80 mt-1">
            Verifique se há bloqueador de anúncios ativo e atualize a página. Se persistir, fale com a Carla.
          </p>
        </div>
      )}

      {/* Container onde o bridge injeta o checkout. Min-height pra evitar
          collapse enquanto carrega. */}
      <div
        id={targetId}
        className="min-h-[600px] rounded-2xl overflow-hidden bg-card border border-border"
      />
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
