import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── useAccessStatus ─────────────────────────────────────────────────────────
// Lê o profiles.access_status da aluna logada via RPC get_my_access_status.
// Valores possíveis:
//   • 'active' — acesso normal (default)
//   • 'expired' — matrícula vencida → app deve mostrar AccessExpiredScreen
//   • 'loading' — ainda buscando
//
// Admin não é checado aqui (admin sempre tem acesso, mesmo com flag expired).
// A checagem de admin fica no componente que consome esse hook.
//
// Re-fetch a cada mudança de user.id. Sem realtime — se admin marcar como
// expirado, aluna só vai ver na próxima navegação/refresh (aceitável).
// =============================================================================

export type AccessStatus = "active" | "expired" | "loading";

export function useAccessStatus(): AccessStatus {
  const { user } = useAuth();
  const [status, setStatus] = useState<AccessStatus>("loading");

  useEffect(() => {
    if (!user) {
      setStatus("loading");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // @ts-ignore — RPC nova, types ainda não regenerados
        const { data, error } = await supabase.rpc("get_my_access_status");
        if (cancelled) return;
        if (error) {
          console.warn("[useAccessStatus] rpc error:", error);
          setStatus("active"); // fail-open — não trava aluna por erro de rede
          return;
        }
        const val = (data as unknown as string) || "active";
        setStatus(val === "expired" ? "expired" : "active");
      } catch (e) {
        if (cancelled) return;
        console.warn("[useAccessStatus] exception:", e);
        setStatus("active");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return status;
}
