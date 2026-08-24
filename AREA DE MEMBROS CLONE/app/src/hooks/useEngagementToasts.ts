import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ─── useEngagementToasts ─────────────────────────────────────────────────────
// Quando a aluna entra na área de membros, verifica se ela tem `email_sends`
// com opened_at/clicked_at MAS notified_in_app=false. Pra cada um, mostra
// um toast tipo "🎉 Você ganhou 50 XP por abrir nosso email!" e marca o
// registro como notificado pra não mostrar de novo.
//
// O XP em si JÁ foi creditado pelo brevo-webhook (em coin_transactions +
// user_progress). Aqui é só a notificação visual.
// =============================================================================

interface PendingEngagement {
  id: string;
  opened_at: string | null;
  clicked_at: string | null;
  xp_open_awarded: boolean;
  xp_click_awarded: boolean;
}

export function useEngagementToasts() {
  const { user } = useAuth();
  const firedRef = useRef(false);

  useEffect(() => {
    if (!user?.id || firedRef.current) return;
    firedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        // Pega registros com abertura/clique que ainda não foram notificados in-app
        const { data, error } = await supabase
          .from("email_sends" as never)
          .select("id, opened_at, clicked_at, xp_open_awarded, xp_click_awarded")
          .eq("user_id" as never, user.id as never)
          .eq("notified_in_app" as never, false as never)
          .or("opened_at.not.is.null,clicked_at.not.is.null" as never)
          .order("sent_at" as never, { ascending: false } as never)
          .limit(5 as never);

        if (cancelled || error || !data || (data as unknown as any[]).length === 0) return;

        const rows = data as unknown as PendingEngagement[];

        // Total de XP ganho nesse lote (somando abertura/clique)
        let totalXp = 0;
        let openCount = 0;
        let clickCount = 0;
        for (const r of rows) {
          if (r.xp_open_awarded) { totalXp += 50; openCount++; }
          if (r.xp_click_awarded) { totalXp += 150; clickCount++; }
        }

        if (totalXp > 0) {
          // Mostra UM toast resumido em vez de N toasts
          const partes: string[] = [];
          if (clickCount > 0) partes.push(`${clickCount} clique${clickCount === 1 ? "" : "s"}`);
          if (openCount > 0) partes.push(`${openCount} abertura${openCount === 1 ? "" : "s"}`);
          const detail = partes.join(" + ");

          toast.success(`🎉 +${totalXp} XP por engajamento!`, {
            description: `Você ganhou pontos por ${detail} em nossos emails. Bora dirigir? 🚗`,
            duration: 7000,
          });
        }

        // Marca todos como notificados (mesmo se XP foi 0 — evita rodar de novo)
        const ids = rows.map((r) => r.id);
        await supabase
          .from("email_sends" as never)
          .update({ notified_in_app: true } as never)
          .in("id" as never, ids as never);
      } catch (e) {
        console.warn("[useEngagementToasts] error:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);
}
