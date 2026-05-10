import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── useDisplayName ──────────────────────────────────────────────────────────
// Hook compartilhado que retorna o nome do user logado vindo de
// profiles.display_name. Quando o user edita pelo ProfileScreen, dispara
// 'mddnm:display-name-updated' e todos os lugares (header, sidebar, etc.)
// atualizam juntos — sem refetch manual.
//
// Cada user vê APENAS seu próprio nome (filtrado por auth.uid()).
// =============================================================================

const EVENT_NAME = "mddnm:display-name-updated";

export function useDisplayName(initial?: string | null) {
  const { user } = useAuth();
  const [name, setName] = useState<string>(initial || "");

  useEffect(() => {
    if (!user) {
      setName("");
      return;
    }
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        const fromDb = data?.display_name;
        const fromMeta = user.user_metadata?.display_name as string | undefined;
        setName(fromDb || fromMeta || "");
      }
    }

    load();

    function onUpdate(e: Event) {
      const detail = (e as CustomEvent<{ name: string }>).detail;
      if (cancelled) return;
      if (detail?.name) setName(detail.name);
      else load();
    }
    window.addEventListener(EVENT_NAME, onUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener(EVENT_NAME, onUpdate);
    };
  }, [user]);

  return name;
}

/** Salva o nome no banco e avisa todos os componentes que escutam. */
export async function updateDisplayName(userId: string, name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new Error("Nome muito curto");
  if (trimmed.length > 60) throw new Error("Nome muito longo");
  const { error } = await supabase.from("profiles").upsert(
    { user_id: userId, display_name: trimmed },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { name: trimmed } }));
  return trimmed;
}
