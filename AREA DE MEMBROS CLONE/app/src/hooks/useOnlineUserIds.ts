import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─── useOnlineUserIds ────────────────────────────────────────────────────────
// Retorna o conjunto de user_ids online AGORA, lendo o mesmo canal de presença
// ("online-users") onde toda aluna logada na área de membros faz track()
// (ver usePresenceTracker em hooks/usePresence.ts). A chave de presença é o
// próprio user.id, então as chaves do presenceState() já são os user_ids.
//
// Usado no painel admin (aba Mensagens) pra mostrar quem está online em tempo
// real. Só lê — não faz track() — então não interfere na presença de ninguém.
// =============================================================================

export function useOnlineUserIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase.channel("online-users");
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setIds(new Set(Object.keys(state)));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return ids;
}
