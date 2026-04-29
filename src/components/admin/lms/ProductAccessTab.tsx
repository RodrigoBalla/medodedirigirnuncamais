import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AccessGroup } from "@/types/lms";

interface Props {
  productId: string;
}

export default function ProductAccessTab({ productId }: Props) {
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [productGroupIds, setProductGroupIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");

  useEffect(() => {
    fetchGroups();
  }, [productId]);

  async function fetchGroups() {
    setLoading(true);
    // Fetch all existing groups
    const { data: allGroups } = await supabase.from("access_groups").select("*").order("name");
    if (allGroups) setGroups(allGroups);

    // Fetch the groups linked to this product
    const { data: linked } = await supabase.from("access_group_products").select("group_id").eq("product_id", productId);
    if (linked) {
      setProductGroupIds(linked.map(l => l.group_id));
    }
    setLoading(false);
  }

  async function handleToggleGroupAccess(groupId: string, hasAccess: boolean) {
    if (hasAccess) {
      // Remove
      const { error } = await supabase.from("access_group_products").delete().match({ group_id: groupId, product_id: productId });
      if (error) toast.error("Erro ao remover permissão");
      else setProductGroupIds(prev => prev.filter(id => id !== groupId));
    } else {
      // Add
      const { error } = await supabase.from("access_group_products").insert({ group_id: groupId, product_id: productId });
      if (error) toast.error("Erro ao conceder permissão");
      else setProductGroupIds(prev => [...prev, groupId]);
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const { data, error } = await supabase.from("access_groups").insert({
      name: newGroupName.trim(),
      description: newGroupDesc.trim()
    }).select().single();

    if (error) {
      toast.error("Erro ao criar grupo");
    } else {
      toast.success("Grupo criado!");
      setGroups(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));
      setIsModalOpen(false);
      setNewGroupName("");
      setNewGroupDesc("");
      // link directly
      handleToggleGroupAccess(data.id, false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h3 className="text-xl font-bold">Grupos de Acesso</h3>
           <p className="text-sm text-muted-foreground mt-1">
             Selecione quais grupos de alunos têm acesso a este produto.
           </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 border border-border rounded-xl text-sm font-bold hover:bg-accent transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-lg">group_add</span>
          Criar Novo Grupo
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full"/></div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
           <span className="material-symbols-outlined text-4xl mb-2">group_off</span>
           <p>Nenhum grupo de acesso no sistema.<br/>Crie um para segmentar o acesso dos alunos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(g => {
            const hasAccess = productGroupIds.includes(g.id);
            return (
              <label key={g.id} className={`flex items-start gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                 hasAccess ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' : 'border-border bg-accent/20 hover:border-border hover:bg-accent'
              }`}>
                <div className={`mt-0.5 size-5 rounded border flex items-center justify-center shrink-0 ${
                   hasAccess ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 bg-background'
                }`}>
                  {hasAccess && <span className="material-symbols-outlined text-[14px] font-bold">check</span>}
                </div>
                {/* Hidden checkbox for accessibility/logic */}
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={hasAccess} 
                  onChange={() => handleToggleGroupAccess(g.id, hasAccess)} 
                />
                <div className="flex-1">
                   <p className={`font-bold text-sm ${hasAccess ? 'text-primary' : 'text-foreground'}`}>{g.name}</p>
                   {g.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{g.description}</p>}
                </div>
              </label>
            )
          })}
        </div>
      )}

      {/* New Group Modal */}
      {isModalOpen && (
         <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold mb-4">Novo Grupo de Acesso</h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                 <label className="text-xs font-bold block mb-1">Nome do Grupo</label>
                 <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Ex: Alunos VIP" className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:border-primary transition-all text-sm" autoFocus required />
              </div>
              <div>
                 <label className="text-xs font-bold block mb-1">Descrição</label>
                 <textarea value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} placeholder="Breve descritivo..." rows={2} className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:border-primary transition-all text-sm resize-none" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-xl">Cancelar</button>
                 <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-sm">Salvar Grupo</button>
              </div>
            </form>
          </div>
         </div>
      )}
    </div>
  );
}
