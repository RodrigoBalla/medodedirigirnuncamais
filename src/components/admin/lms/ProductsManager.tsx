import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Product, Module, Lesson, AccessGroup } from "@/types/lms";
import ProductEditor from "./ProductEditor";

export default function ProductsManager() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // States for "Novo Produto" Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  // States for "Delete Confirmation" Modal
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      toast.error("Erro ao carregar produtos");
      console.error(error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return toast.error("O título é obrigatório");

    const { data, error } = await supabase
      .from("products")
      .insert({ title: newTitle.trim(), status: 'draft' })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar produto");
      console.error(error);
    } else {
      toast.success("Produto criado!");
      setProducts([data, ...products]);
      setIsModalOpen(false);
      setNewTitle("");
      setSelectedProductId(data.id);
    }
  }

  async function handleDeleteProduct() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      // 1. Get all modules of this product
      const { data: modules } = await supabase
        .from("modules")
        .select("id")
        .eq("product_id", deleteConfirm.id);

      const moduleIds = modules?.map(m => m.id) || [];

      // 2. Delete all lessons from those modules
      if (moduleIds.length > 0) {
        await supabase
          .from("lessons")
          .delete()
          .in("module_id", moduleIds);
      }

      // 3. Delete all modules
      await supabase
        .from("modules")
        .delete()
        .eq("product_id", deleteConfirm.id);

      // 4. Delete access group links
      await supabase
        .from("access_group_products")
        .delete()
        .eq("product_id", deleteConfirm.id);

      // 5. Delete the product itself
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", deleteConfirm.id);

      if (error) throw error;

      toast.success("Curso excluído com sucesso!");
      setProducts(prev => prev.filter(p => p.id !== deleteConfirm.id));
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir o curso.");
    }
    setDeleting(false);
    setDeleteConfirm(null);
  }

  if (selectedProductId) {
    return <ProductEditor productId={selectedProductId} onBack={() => setSelectedProductId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Cursos / Produtos</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-primary-foreground font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-sm font-bold">add</span>
          Novo Produto
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Título</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Acesso</th>
                <th className="text-right px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    <span className="material-symbols-outlined text-4xl mb-2">inventory_2</span>
                    <p>Nenhum produto cadastrado ainda.</p>
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="size-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden border border-border">
                          {p.image_url ? (
                            <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-muted-foreground">image</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-foreground line-clamp-1">{p.title}</p>
                          <p className="text-xs text-muted-foreground">Criado em {new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full flex w-fit items-center gap-1 leading-none ${
                        p.status === 'published' 
                          ? 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <span className="material-symbols-outlined text-[10px]">
                          {p.status === 'published' ? 'check_circle' : 'draft'}
                        </span>
                        {p.status === 'published' ? 'Publicado' : 'Rascunho'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-muted-foreground">—</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button 
                           onClick={() => setSelectedProductId(p.id)}
                           className="px-4 py-2 bg-accent hover:bg-accent/80 text-sm font-medium rounded-lg transition-colors border border-border"
                        >
                           Gerenciar
                        </button>
                        <button 
                           onClick={() => setDeleteConfirm({ id: p.id, title: p.title })}
                           className="px-3 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive text-sm font-medium rounded-lg transition-colors border border-destructive/20"
                           title="Excluir curso"
                        >
                           <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Criar Produto</h3>
              <button onClick={() => setIsModalOpen(false)} className="size-8 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="text-sm font-bold block mb-1.5">Título do Curso/Produto</label>
                <input 
                  type="text" 
                  value={newTitle} 
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Alcatéia Cast EP.#12"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary transition-all"
                  autoFocus
                />
              </div>
              <button type="submit" className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors">
                Criar Produto
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-destructive text-3xl">warning</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">Excluir Curso</h3>
                <p className="text-sm text-muted-foreground">
                  Tem certeza que deseja excluir <strong className="text-foreground">"{deleteConfirm.title}"</strong>?
                </p>
                <p className="text-xs text-destructive mt-2 font-medium">
                  ⚠️ Todos os módulos, aulas e vínculos de acesso serão removidos permanentemente.
                </p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-xl font-bold text-sm border border-border hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteProduct}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <div className="animate-spin size-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">delete_forever</span>
                      Excluir
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
