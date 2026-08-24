import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { annDb, type Announcement } from "@/lib/announcements";

// ─── useAnnouncements ────────────────────────────────────────────────────────
// Busca o próximo aviso pendente pra aluna logada (RPC get_pending_announcements)
// e devolve pra mostrar no popup. `dismiss()` grava "visto" no banco (RPC) e
// remove localmente — o mesmo aviso não volta a aparecer, em nenhum dispositivo.
//
// Só há um aviso por vez na tela; se houver mais de um pendente, mostra o mais
// antigo primeiro e o próximo aparece no login seguinte (ou já no dismiss, se
// re-buscar — aqui mantemos simples: 1 por sessão).
// =============================================================================

export function useAnnouncements() {
  const { user } = useAuth();
  const [current, setCurrent] = useState<Announcement | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        const { data, error } = await annDb.rpc("get_pending_announcements");
        if (cancelled || error) return;
        if (!Array.isArray(data) || data.length === 0) return;
        // Pequeno respiro pro app renderizar antes do popup subir.
        timer = setTimeout(() => {
          if (!cancelled) setCurrent(data[0] as Announcement);
        }, 900);
      } catch {
        /* não-fatal: se a RPC falhar, simplesmente não mostra aviso */
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [user?.id]);

  const dismiss = useCallback(async () => {
    const a = current;
    setCurrent(null); // fecha na hora (otimista)
    if (!a) return;
    try {
      await annDb.rpc("dismiss_announcement", { p_id: a.id });
    } catch {
      /* não-fatal: no pior caso o aviso reaparece no próximo login */
    }
  }, [current]);

  return { announcement: current, dismiss };
}
