import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── ProductsManager (simplificado) ──────────────────────────────────────────
// O conteúdo dos cursos (módulos/aulas/imagens) vem do banco — cadastrado
// via Claude/SQL direto, NÃO por esta UI. Aqui o admin só:
//   • Vê a lista de cursos do catálogo
//   • Liga/desliga a visibilidade (status: published ↔ draft)
//
// Curso em "draft" não aparece pra aluna na área de membros.
// Curso em "published" aparece na biblioteca.
// =============================================================================

interface Product {
  id: string;
  title: string;
  status: "published" | "draft" | string;
  image_url: string | null;
  created_at: string;
}

export default function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => { fetchProducts(); }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id, title, status, image_url, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar cursos");
      setLoading(false);
      return;
    }
    setProducts((data || []) as Product[]);
    setLoading(false);
  }

  async function toggleStatus(p: Product) {
    setToggling(p.id);
    const newStatus = p.status === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("products")
      .update({ status: newStatus })
      .eq("id", p.id);
    if (error) {
      toast.error("Erro ao alterar status");
    } else {
      toast.success(newStatus === "published" ? "Curso ativado · agora aparece pras alunas" : "Curso ocultado · não aparece mais pras alunas");
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: newStatus } : x)));
    }
    setToggling(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Cursos do catálogo</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Aqui você só ativa ou oculta os cursos. O conteúdo (módulos/aulas) é cadastrado por fora, via Claude.
        </p>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <span className="material-symbols-outlined animate-spin text-primary text-2xl">progress_activity</span>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <span className="material-symbols-outlined text-muted-foreground text-3xl mb-2 block">video_library</span>
          <p className="text-sm font-bold text-muted-foreground">Nenhum curso cadastrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Avise no Claude pra cadastrar o primeiro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => {
            const isPublished = p.status === "published";
            return (
              <div key={p.id} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-4">
                  <div className="size-14 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden border border-border">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-muted-foreground">image</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-foreground line-clamp-1">{p.title}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 leading-none ${
                        isPublished
                          ? "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        <span className="material-symbols-outlined text-[10px]">
                          {isPublished ? "visibility" : "visibility_off"}
                        </span>
                        {isPublished ? "Ativo" : "Oculto"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Adicionado em {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleStatus(p)}
                    disabled={toggling === p.id}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                      isPublished
                        ? "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                    title={isPublished ? "Ocultar das alunas" : "Ativar pras alunas verem"}
                  >
                    {toggling === p.id ? (
                      <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-base">
                        {isPublished ? "visibility_off" : "visibility"}
                      </span>
                    )}
                    {isPublished ? "Ocultar" : "Ativar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
