import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ─── useSessionGuard ─────────────────────────────────────────────────────────
// Sessão única (1 device por aluno). Quando o aluno loga:
//   1. Gera um session_token aleatório
//   2. Chama RPC register_active_session(token) — Postgres atualiza o token
//      ativo deste user. Se havia outro, o token muda
//   3. Escuta a tabela active_sessions via Realtime — se o session_token do
//      banco mudar pra um valor diferente do nosso, significa que outro
//      device logou. Faz signOut() e mostra toast.
//
// Pulado pra admins (Carla pode estar em vários lugares ao mesmo tempo).
// =============================================================================

const STORAGE_KEY = "mddnm_session_token";

function genToken(): string {
  // 32 chars hex (~128 bits de entropia)
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getOrCreateToken(): string {
  let t = sessionStorage.getItem(STORAGE_KEY);
  if (!t) {
    t = genToken();
    sessionStorage.setItem(STORAGE_KEY, t);
  }
  return t;
}

export function useSessionGuard() {
  const { user, signOut } = useAuth();
  const myTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const myToken = getOrCreateToken();
    myTokenRef.current = myToken;

    // 1. Registra esta sessão no servidor
    (async () => {
      try {
        const deviceInfo = navigator.userAgent.slice(0, 200);
        const { data, error } = await supabase.rpc("register_active_session", {
          p_session_token: myToken,
          p_device_info: deviceInfo,
        });
        if (cancelled) return;
        if (error) {
          console.warn("[session-guard] registro falhou:", error.message);
          return;
        }
        const wasReplaced = (data as Array<{ was_replaced: boolean }>)?.[0]?.was_replaced;
        if (wasReplaced) {
          toast.info("Sessão anterior em outro dispositivo foi encerrada.");
        }
      } catch (err) {
        console.warn("[session-guard] erro:", err);
      }
    })();

    // 2. Escuta mudanças na tabela active_sessions deste user
    const ch = supabase
      .channel(`session-guard-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "active_sessions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newToken = (payload.new as { session_token?: string })?.session_token;
          if (newToken && newToken !== myTokenRef.current) {
            // Outro device assumiu — derruba este aqui
            toast.error("Sua conta foi acessada em outro dispositivo.", {
              description: "Você foi desconectado por segurança.",
              duration: 6000,
            });
            sessionStorage.removeItem(STORAGE_KEY);
            setTimeout(() => { signOut(); }, 1500);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user, signOut]);
}
