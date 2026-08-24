import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Grupo "Acesso completo a plataforma" (criado via migration) — libera TODOS os
// cursos, atuais e futuros (trigger), por 12 meses. Entregue pela oferta
// especial (checkout Eduzz 6W4GVO430Z / produto 3084222).
export const FULL_PLATFORM_GROUP_ID = "87b174f5-f094-4fe4-895e-dbc62c422da8";
export const FULL_PLATFORM_CHECKOUT_ID = "6W4GVO430Z";

// ─── useHasFullPlatformAccess ────────────────────────────────────────────────
// Retorna: null enquanto carrega (ou sem user logado) · true se a aluna já tem
// o grupo de acesso completo · false se ainda não tem (→ mostra a oferta).
// Usado no AppLayout (visibilidade do banner + offset da sidebar) e na página
// da oferta (mostra "você já tem" em vez do checkout).
// =============================================================================
export function useHasFullPlatformAccess(): boolean | null {
  const { user } = useAuth();
  const [has, setHas] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setHas(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("access_group_users")
        .select("group_id")
        .eq("user_id", user.id)
        .eq("group_id", FULL_PLATFORM_GROUP_ID)
        .maybeSingle();
      if (!cancelled) setHas(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return has;
}
