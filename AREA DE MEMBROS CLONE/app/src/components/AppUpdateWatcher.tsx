import { useEffect, useRef } from "react";
import { toast } from "sonner";

// ─── AppUpdateWatcher ────────────────────────────────────────────────────────
// Resolve o "deixei a aba aberta e continuo na versão velha".
//
// A infra já está certa (index.html com must-revalidate + SW rede-primeiro): um
// RELOAD sempre traz a última versão. O problema é a aba que fica ABERTA rodando
// o JS antigo. Este watcher compara o hash do bundle carregado (booted) com o do
// index.html no servidor; quando sai um deploy novo, mostra um aviso discreto
// "Atualizar" (a aluna decide quando — nada recarrega sozinho no meio do uso).
//
// Só roda em produção (em dev o bundle não tem hash). Renderiza nada.
// =============================================================================

const entryFile = (s: string): string => (s.match(/index-[A-Za-z0-9_-]+\.js/) || [])[0] || "";

function bootedEntry(): string {
  const src = Array.from(document.querySelectorAll('script[type="module"][src]'))
    .map((n) => (n as HTMLScriptElement).getAttribute("src") || "")
    .find((s) => /\/assets\/index-[A-Za-z0-9_-]+\.js/.test(s));
  return entryFile(src || "");
}

export function AppUpdateWatcher() {
  const bootRef = useRef<string>(bootedEntry());
  const notifiedRef = useRef(false);

  useEffect(() => {
    // Sem hash (dev/localhost) → não há o que vigiar.
    if (!bootRef.current) return;
    let stopped = false;

    const check = async () => {
      if (stopped || notifiedRef.current || document.visibilityState !== "visible") return;
      try {
        const html = await fetch("/", { cache: "no-store" }).then((r) => r.text());
        const latest = entryFile((html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0] || "");
        if (latest && latest !== bootRef.current) {
          notifiedRef.current = true;
          toast("✨ Nova versão disponível", {
            description: "Atualize pra pegar as últimas melhorias.",
            duration: Infinity,
            action: { label: "Atualizar", onClick: () => window.location.reload() },
          });
        }
      } catch { /* offline/erro de rede → tenta na próxima checagem */ }
    };

    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    const first = window.setTimeout(check, 30_000);           // 30s após abrir
    const interval = window.setInterval(check, 15 * 60_000);  // a cada 15 min

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  return null;
}
