import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// isAdmin  → pode ABRIR o /admin (admin OU support). Mantém os gates existentes.
// isReadOnly → support puro (só leitura + responder mensagens). O servidor é quem
//   garante: toda escrita é admin-only (RLS/RPCs). O banner só avisa a pessoa.
export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsReadOnly(false);
      setLoading(false);
      return;
    }

    const checkAdmin = async () => {
      if (user.email === "ocriativomarketing@gmail.com") {
        setIsAdmin(true);
        setIsReadOnly(false);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "support"]);

      const roles = (data || []).map((r: { role: string }) => r.role);
      const admin = roles.includes("admin");
      const support = roles.includes("support");
      setIsAdmin(admin || support);      // support também abre o /admin
      setIsReadOnly(support && !admin);  // support puro = somente leitura
      setLoading(false);
    };

    checkAdmin();
  }, [user]);

  return { isAdmin, isReadOnly, loading };
}
