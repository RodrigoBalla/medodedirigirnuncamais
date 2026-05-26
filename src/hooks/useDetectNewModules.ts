import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── useDetectNewModules ─────────────────────────────────────────────────────
// Hook que detecta quando a aluna ganhou acesso a um módulo NOVO (que ela
// ainda não viu o overlay de "desbloqueado"). Compara os product_ids
// liberados pra ela contra um set de "já vistos" no localStorage.
//
// Funcionamento:
//   1. Carrega os produtos liberados da aluna via tabela access_group_products
//      (join: profiles → access_group_users → access_group_products → products)
//   2. Carrega o set "mddnm:seen_modules:<userId>" do localStorage
//   3. Calcula a DIFERENÇA: produtos liberados que não estão em "seen"
//   4. Retorna o primeiro produto novo (pra mostrar overlay)
//   5. Quando overlay fecha, chama markSeen() pra adicionar ao "seen"
//
// CRÍTICO: o seen é gravado APÓS o user fechar o overlay, não no carregamento.
// Assim, se ele recarregar a página antes de fechar, o overlay aparece de novo.
// =============================================================================

interface NewModule {
  product_id: string;
  title: string;
  image_url: string | null;
}

function storageKey(userId: string): string {
  return `mddnm:seen_modules:${userId}`;
}

function loadSeen(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeen(userId: string, seen: Set<string>) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...seen]));
  } catch {
    /* localStorage pode estar bloqueado (modo privado) — não bloqueia o fluxo */
  }
}

export function useDetectNewModules() {
  const { user } = useAuth();
  const [newModule, setNewModule] = useState<NewModule | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      try {
        // 1) Pega TODOS os product_ids liberados pra essa aluna
        const { data: groupRows } = await supabase
          .from("access_group_users")
          .select("group_id")
          .eq("user_id", user.id);

        const groupIds = (groupRows || []).map((r) => r.group_id);
        if (groupIds.length === 0) return;

        const { data: productLinks } = await supabase
          .from("access_group_products")
          .select("product_id, products(id, title, image_url)")
          .in("group_id", groupIds);

        if (cancelled) return;
        const products = (productLinks || [])
          .map((l: any) => l.products)
          .filter(Boolean) as Array<{ id: string; title: string; image_url: string | null }>;

        // 2) Compara com "já vistos"
        const seen = loadSeen(user.id);
        const novos = products.filter((p) => !seen.has(p.id));

        // PRIMEIRA VEZ DA ALUNA NO APP — ela acabou de criar conta, não queremos
        // mostrar a animação pra TODOS os cursos que já tem. Tratamento:
        //   - Se o seen está vazio E ela tem produtos liberados, marca TODOS
        //     como vistos sem mostrar animação (assumindo que é primeira entrada)
        //   - Animação só aparece pra produtos NOVOS adicionados DEPOIS do
        //     primeiro login (upsells)
        if (seen.size === 0 && products.length > 0) {
          const allIds = new Set(products.map((p) => p.id));
          saveSeen(user.id, allIds);
          return;
        }

        // 3) Se tem novo módulo, mostra o primeiro
        if (novos.length > 0) {
          // Pequeno delay pra dar tempo do app renderizar antes
          setTimeout(() => {
            if (!cancelled) {
              setNewModule({
                product_id: novos[0].id,
                title: novos[0].title,
                image_url: novos[0].image_url,
              });
            }
          }, 600);
        }
      } catch (err) {
        console.warn("[useDetectNewModules] erro:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  function markSeen(productId: string) {
    if (!user?.id) return;
    const seen = loadSeen(user.id);
    seen.add(productId);
    saveSeen(user.id, seen);
    setNewModule(null);
  }

  return { newModule, markSeen };
}
