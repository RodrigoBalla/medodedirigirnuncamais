import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { npsDb, checkoutSlug } from "@/lib/nps";

// ─── useNpsSurvey ────────────────────────────────────────────────────────────
// Controla se a pesquisa deve aparecer, envia as respostas (creditando a
// recompensa no servidor) e carrega os módulos que a aluna AINDA NÃO tem
// (pro fluxo "usar saldo pra comprar").
// =============================================================================

export interface LockedModule {
  id: string;
  title: string;
  image_url: string | null;
  checkout_slug: string | null;
}

interface NpsStatus {
  shouldShow: boolean;
  rewardCoins: number;
}

export function useNpsSurvey() {
  const { user } = useAuth();
  const [status, setStatus] = useState<NpsStatus | null>(null);
  const [lockedModules, setLockedModules] = useState<LockedModule[]>([]);

  // Status (deve mostrar?) + módulos que faltam, em paralelo.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await npsDb.rpc("get_my_nps_status");
        if (cancelled || error) return;
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          setStatus({
            shouldShow: !!row.should_show,
            rewardCoins: Number(row.reward_coins) || 1000,
          });
        }
      } catch {
        /* não-fatal */
      }
    })();

    (async () => {
      try {
        // Produtos liberados pra ela
        const { data: groupRows } = await npsDb
          .from("access_group_users")
          .select("group_id")
          .eq("user_id", user.id);
        const groupIds = (groupRows || []).map((r: any) => r.group_id);
        const ownedIds = new Set<string>();
        if (groupIds.length) {
          const { data: links } = await npsDb
            .from("access_group_products")
            .select("product_id")
            .in("group_id", groupIds);
          (links || []).forEach((l: any) => ownedIds.add(l.product_id));
        }
        // Todos os produtos publicados → tira os que ela já tem
        const { data: prods } = await npsDb
          .from("products")
          .select("id, title, image_url, checkout_url, status")
          .eq("status", "published");
        if (cancelled) return;
        const locked = (prods || [])
          .filter((p: any) => !ownedIds.has(p.id) && checkoutSlug(p.checkout_url))
          .map((p: any) => ({
            id: p.id,
            title: p.title,
            image_url: p.image_url,
            checkout_slug: checkoutSlug(p.checkout_url),
          }));
        setLockedModules(locked);
      } catch {
        /* não-fatal */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Envia as respostas e credita a recompensa (1x no servidor). Retorna o
  // saldo atualizado + quantas moedas foram creditadas agora.
  const submit = useCallback(
    async (answers: Record<string, unknown>): Promise<{ reward: number; balance: number } | null> => {
      try {
        const { data, error } = await npsDb.rpc("submit_nps_response", { p: answers });
        if (error) return null;
        const row = Array.isArray(data) ? data[0] : data;
        return {
          reward: Number(row?.reward_coins) || 0,
          balance: Number(row?.balance) || 0,
        };
      } catch {
        return null;
      }
    },
    [],
  );

  return { status, lockedModules, submit };
}
