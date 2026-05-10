import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── useAvatarUrl ────────────────────────────────────────────────────────────
// Hook compartilhado que retorna a URL do avatar do user LOGADO. Cada user vê
// a SUA foto — busca em profiles.avatar_url usando auth.uid().
//
// Quando o AvatarUploader faz upload com sucesso, ele dispara um custom event
// 'mddnm:avatar-updated' no window. Todos os componentes que usam esse hook
// (header, sidebar, profile, etc.) escutam e atualizam ao mesmo tempo —
// sem precisar de contexto pesado.
//
// Uso:
//   const { url, loading } = useAvatarUrl();
// =============================================================================

const EVENT_NAME = "mddnm:avatar-updated";

export function useAvatarUrl() {
  const { user } = useAuth();
  const [url, setUrl]         = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setUrl(data?.avatar_url ?? null);
        setLoading(false);
      }
    }

    load();

    // Escuta evento de atualização (disparado pelo AvatarUploader após upload)
    function onUpdate(e: Event) {
      const detail = (e as CustomEvent<{ url: string | null }>).detail;
      if (cancelled) return;
      if (detail && typeof detail.url !== "undefined") {
        setUrl(detail.url);
      } else {
        // Sem detail → faz refetch
        load();
      }
    }
    window.addEventListener(EVENT_NAME, onUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener(EVENT_NAME, onUpdate);
    };
  }, [user]);

  return { url, loading };
}

/** Helper exportado pro AvatarUploader (ou outro componente) avisar que a
 *  foto mudou. Todos os componentes que usam useAvatarUrl reagem juntos. */
export function broadcastAvatarUpdate(url: string | null) {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { url } }));
}
