import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── FullAccessBanner ────────────────────────────────────────────────────────
// Botão/banner no TOPO da área de membros: "Liberar acesso completo (OFERTA
// ESPECIAL)" → leva pro checkout Eduzz da oferta que entrega o grupo
// "Acesso completo a plataforma" (libera TODOS os cursos, atuais e futuros,
// por 12 meses).
//
// Visibilidade: só aparece pra quem AINDA NÃO tem esse grupo. Quem já comprou o
// acesso completo à plataforma não vê (não faz sentido "liberar" o que já tem).
// A checagem é por membership em access_group_users (mesmo critério que a
// Biblioteca usa pra destravar curso).
// =============================================================================

// Grupo criado no banco (migration) — libera todos os produtos via trigger.
const FULL_PLATFORM_GROUP_ID = "87b174f5-f094-4fe4-895e-dbc62c422da8";
const CHECKOUT_URL = "https://chk.eduzz.com/6W4GVO430Z";

export function FullAccessBanner() {
  const { user } = useAuth();
  // null = ainda carregando (não pisca o banner à toa); false = não tem → mostra.
  const [hasFullAccess, setHasFullAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setHasFullAccess(null);
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
      if (!cancelled) setHasFullAccess(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Enquanto carrega OU já tem o acesso completo → não renderiza nada.
  if (hasFullAccess !== false) return null;

  return (
    <a
      href={CHECKOUT_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Liberar acesso completo à plataforma — oferta especial"
      className="group block w-full bg-gradient-to-r from-primary to-yellow-400 text-primary-foreground shadow-sm"
    >
      <div className="flex items-center justify-center gap-2 md:gap-3 px-3 py-2.5 md:py-3">
        <span className="material-symbols-outlined text-xl md:text-2xl filled-icon animate-pulse shrink-0">
          bolt
        </span>
        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest bg-black/85 text-primary px-2 py-0.5 rounded-full shrink-0">
          Oferta especial
        </span>
        <span className="text-xs md:text-sm font-black leading-tight">
          <span className="hidden sm:inline">Libere o acesso completo à plataforma — </span>
          Liberar acesso completo
        </span>
        <span className="material-symbols-outlined text-base md:text-lg shrink-0 group-hover:translate-x-0.5 transition-transform">
          arrow_forward
        </span>
      </div>
    </a>
  );
}
