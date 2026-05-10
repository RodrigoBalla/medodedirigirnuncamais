import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ─── useStreak ───────────────────────────────────────────────────────────────
// Chama RPC tick_user_streak() uma vez por mount (idempotente — Postgres
// detecta se já foi acionada hoje e não dá moedas duplicadas). Retorna o
// streak atual + sinaliza marcos pra UI mostrar celebração.
//
// Marcos: 3, 7, 15, 30, 60, 100 dias.
// Recompensas (definidas na RPC):
//   3d  = +10 moedas    7d  = +25 moedas    15d = +50 moedas
//   30d = +100 moedas   60d = +250 moedas   100d = +500 moedas
//   (mais 5 moedas todo dia comum)
// =============================================================================

interface StreakState {
  streak: number;
  longestYet: number;
  loading: boolean;
}

export function useStreak(): StreakState {
  const { user } = useAuth();
  const [state, setState] = useState<StreakState>({
    streak: 0, longestYet: 0, loading: true,
  });

  useEffect(() => {
    if (!user) {
      setState({ streak: 0, longestYet: 0, loading: false });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("tick_user_streak");
        if (cancelled) return;
        if (error) {
          console.warn("[streak] tick falhou:", error.message);
          setState((s) => ({ ...s, loading: false }));
          return;
        }
        const row = (data as Array<{
          streak: number;
          gained_coins: number;
          milestone_reached: number;
          longest_yet: number;
        }>)?.[0];
        if (!row) {
          setState((s) => ({ ...s, loading: false }));
          return;
        }
        setState({ streak: row.streak, longestYet: row.longest_yet, loading: false });

        // Celebra recompensas só se ganhou algo (evita spam em re-mount)
        if (row.gained_coins > 0 && row.streak > 1) {
          toast.success(`🔥 ${row.streak} dias seguidos!`, {
            description: `+${row.gained_coins} moedas pela constância`,
            duration: 4000,
          });
        }
        if (row.milestone_reached > 0) {
          // Marco grande — toast em destaque
          setTimeout(() => {
            toast(`🏆 Medalha desbloqueada: ${row.milestone_reached} dias!`, {
              description: "Continue assim que você vai longe.",
              duration: 6000,
            });
          }, 1500);
        }
      } catch (err) {
        console.warn("[streak] erro:", err);
        setState((s) => ({ ...s, loading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return state;
}
