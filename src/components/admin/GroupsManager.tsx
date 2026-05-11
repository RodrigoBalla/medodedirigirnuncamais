import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── GroupsManager ───────────────────────────────────────────────────────────
// Gerencia mapeamento Grupo de Acesso ↔ Produto da Eduzz.
//
// Cada grupo de acesso (ex: "Acesso Completo") tem 2 campos novos:
//   • eduzz_product_ids   — array de IDs de produtos da Eduzz que disparam
//                            esse grupo (ex: ["AB12CD", "9X8Y7W"])
//   • eduzz_product_names — array de nomes (fallback se ID não bater)
//
// Quando alguém compra na Eduzz, o webhook lê o produto e busca aqui qual
// grupo liberar pra essa pessoa. Quando a aluna criar conta, o grupo é
// automaticamente atribuído.
// =============================================================================

interface GroupWithMapping {
  id: string;
  name: string;
  description: string | null;
  eduzz_product_ids: string[];
  eduzz_product_names: string[];
  member_count: number;
  product_count: number;
}

export function GroupsManager() {
  const [groups, setGroups] = useState<GroupWithMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGroup, setEditingGroup] = useState<GroupWithMapping | null>(null);
  const [draftIds, setDraftIds] = useState<string>("");
  const [draftNames, setDraftNames] = useState<string>("");

  async function fetchGroups() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_groups_with_mapping");
    if (error) {
      toast.error("Erro ao carregar grupos");
      setLoading(false);
      return;
    }
    const rows = (data || []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: String(r.name),
      description: r.description ? String(r.description) : null,
      eduzz_product_ids: Array.isArray(r.eduzz_product_ids) ? r.eduzz_product_ids as string[] : [],
      eduzz_product_names: Array.isArray(r.eduzz_product_names) ? r.eduzz_product_names as string[] : [],
      member_count: Number(r.member_count ?? 0),
      product_count: Number(r.product_count ?? 0),
    })) as GroupWithMapping[];
    setGroups(rows);
    setLoading(false);
  }

  useEffect(() => { fetchGroups(); }, []);

  function openEdit(g: GroupWithMapping) {
    setEditingGroup(g);
    setDraftIds(g.eduzz_product_ids.join(", "));
    setDraftNames(g.eduzz_product_names.join(", "));
  }

  async function saveMapping() {
    if (!editingGroup) return;
    const idsArr = draftIds.split(",").map((s) => s.trim()).filter(Boolean);
    const namesArr = draftNames.split(",").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.rpc("admin_set_group_eduzz_mapping", {
      p_group_id: editingGroup.id,
      p_product_ids: idsArr,
      p_product_names: namesArr,
    });
    if (error) { toast.error("Erro ao salvar mapeamento"); return; }
    toast.success("Mapeamento salvo");
    setEditingGroup(null);
    fetchGroups();
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <span className="material-symbols-outlined animate-spin text-primary text-2xl">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Grupos de acesso</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Mapeie cada grupo a um ou mais produtos da Eduzz. Quando alguém comprar lá,
          o webhook reconhece e libera automaticamente o curso quando a aluna criar conta.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <span className="material-symbols-outlined text-muted-foreground text-3xl mb-2 block">lock_open</span>
          <p className="text-sm font-bold text-muted-foreground">Nenhum grupo cadastrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Crie grupos pela aba <strong>Cursos</strong> primeiro (clica num curso → "Gerenciar grupos").
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{g.name}</p>
                  {g.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>
                  )}
                </div>
                <button
                  onClick={() => openEdit(g)}
                  className="shrink-0 px-3 py-2 rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-foreground text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  Editar mapeamento
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-accent/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Cursos liberados</p>
                  <p className="font-bold">{g.product_count}</p>
                </div>
                <div className="bg-accent/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Alunas no grupo</p>
                  <p className="font-bold">{g.member_count}</p>
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  🛞 Acionado pela Eduzz quando:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {g.eduzz_product_ids.length === 0 && g.eduzz_product_names.length === 0 && (
                    <p className="text-xs italic text-muted-foreground/70">
                      Nenhum produto da Eduzz configurado — esse grupo só é atribuído manualmente.
                    </p>
                  )}
                  {g.eduzz_product_ids.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                      ID: {id}
                    </span>
                  ))}
                  {g.eduzz_product_names.map((name) => (
                    <span key={name} className="inline-flex items-center gap-1 text-[10px] bg-accent text-foreground px-2 py-0.5 rounded border border-border">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de edição do mapeamento */}
      {editingGroup && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setEditingGroup(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5">
              <h3 className="text-lg font-bold">Mapear produtos Eduzz</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Grupo: <strong>{editingGroup.name}</strong>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  IDs de produtos na Eduzz
                </label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Separe por vírgula. Você encontra o ID em <strong>Eduzz → Produtos → seu produto → URL</strong>
                  (parte depois de <code>/produto/</code>) ou na coluna <code>product_cod</code> dos webhooks.
                </p>
                <input
                  type="text"
                  value={draftIds}
                  onChange={(e) => setDraftIds(e.target.value)}
                  placeholder="Ex: AB12CD, 9X8Y7W"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  Nomes de produtos (fallback)
                </label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Se o ID não bater, o webhook tenta pelo nome. Use exatamente o título do produto na Eduzz.
                </p>
                <input
                  type="text"
                  value={draftNames}
                  onChange={(e) => setDraftNames(e.target.value)}
                  placeholder="Ex: Medo de Dirigir Nunca Mais"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setEditingGroup(null)}
                className="flex-1 py-3 rounded-xl bg-muted text-foreground font-bold text-sm hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveMapping}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
              >
                Salvar mapeamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
