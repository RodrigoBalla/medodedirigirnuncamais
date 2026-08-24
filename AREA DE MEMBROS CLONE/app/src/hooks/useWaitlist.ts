import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── useWaitlist ─────────────────────────────────────────────────────────────
// A área de membros NÃO tem mais checkout. Todo CTA de compra virou inscrição
// na LISTA DE ESPERA (tabela `waitlist_signups`), que o admin acompanha na aba
// "Lista de Espera".
//
// productId = null  → interesse na plataforma completa (banner / acesso expirado).
// productId = uuid  → interesse num curso específico (biblioteca / página do curso).
//
// A aluna só pode se inscrever uma vez por produto (índice único no banco); um
// insert duplicado (código 23505) é tratado como sucesso — ela já está na lista.
// =============================================================================

export type WaitlistSource = "library" | "course-info" | "banner" | "access-expired";

const DUPLICATE_KEY = "23505";

export function useWaitlist(productId: string | null = null) {
  const { user } = useAuth();
  const [joined, setJoined] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  // Já está na lista?
  useEffect(() => {
    if (!user?.id) {
      setJoined(null);
      return;
    }
    let cancelled = false;
    (async () => {
      let query = supabase
        .from("waitlist_signups")
        .select("id")
        .eq("user_id", user.id);
      query = productId ? query.eq("product_id", productId) : query.is("product_id", null);

      const { data } = await query.maybeSingle();
      if (!cancelled) setJoined(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, productId]);

  const join = useCallback(
    async (source: WaitlistSource): Promise<boolean> => {
      if (!user?.id) return false;
      setSaving(true);
      try {
        const { error } = await supabase.from("waitlist_signups").insert({
          user_id: user.id,
          product_id: productId,
          email: user.email ?? null,
          name: (user.user_metadata?.display_name as string | undefined) ?? null,
          source,
        });
        // Duplicata = ela já estava na lista, então continua sendo sucesso.
        if (error && error.code !== DUPLICATE_KEY) {
          console.error("[waitlist] erro ao inscrever:", error);
          return false;
        }
        setJoined(true);
        return true;
      } finally {
        setSaving(false);
      }
    },
    [user?.id, user?.email, user?.user_metadata, productId],
  );

  return { joined, saving, join };
}
