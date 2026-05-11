import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  checkout_url: string | null;
  created_at: string;
}

export default function ProductsManager() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  // Modal de edição do checkout_url (URL do checkout Eduzz)
  const [editingCheckout, setEditingCheckout] = useState<Product | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);

  useEffect(() => { fetchProducts(); }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id, title, status, image_url, checkout_url, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar cursos");
      setLoading(false);
      return;
    }
    setProducts((data || []) as Product[]);
    setLoading(false);
  }

  function openCheckoutEditor(p: Product) {
    setEditingCheckout(p);
    setDraftUrl(p.checkout_url || "");
  }

  async function saveCheckoutUrl() {
    if (!editingCheckout) return;
    const trimmed = draftUrl.trim();
    // Validação simples — aceita vazio (limpa o link) ou URL http(s)
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast.error("URL precisa começar com http:// ou https://");
      return;
    }
    setSavingUrl(true);
    const { error } = await supabase
      .from("products")
      .update({ checkout_url: trimmed || null })
      .eq("id", editingCheckout.id);
    setSavingUrl(false);
    if (error) {
      toast.error("Erro ao salvar link");
      return;
    }
    toast.success(trimmed ? "Link do checkout salvo" : "Link removido");
    setProducts((prev) =>
      prev.map((x) => (x.id === editingCheckout.id ? { ...x, checkout_url: trimmed || null } : x)),
    );
    setEditingCheckout(null);
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
              <div
                key={p.id}
                onClick={() => navigate(`/curso/${p.id}`)}
                className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/40 hover:bg-accent/20 transition-colors"
                title="Abrir o curso na área de membros (você é admin, vê mesmo se estiver oculto)"
              >
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
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        Adicionado em {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 leading-none ${
                        p.checkout_url
                          ? "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      }`}>
                        <span className="material-symbols-outlined text-[10px]">
                          {p.checkout_url ? "link" : "link_off"}
                        </span>
                        {p.checkout_url ? "Link compra OK" : "Sem link de compra"}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStatus(p); }}
                      disabled={toggling === p.id}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
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
                    <button
                      onClick={(e) => { e.stopPropagation(); openCheckoutEditor(p); }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      title="Definir/editar URL do checkout Eduzz"
                    >
                      <span className="material-symbols-outlined text-base">link</span>
                      Link compra
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: editar URL do checkout (Eduzz) */}
      {editingCheckout && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
          onClick={() => !savingUrl && setEditingCheckout(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5">
              <h3 className="text-lg font-bold">Link de compra</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Curso: <strong>{editingCheckout.title}</strong>
              </p>
            </div>

            <label className="text-xs font-bold text-foreground block mb-1.5">
              URL do checkout Eduzz
            </label>
            <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
              Cole aqui o link do checkout do produto na Eduzz. Esse é o destino
              do botão "Quero comprar" que a aluna vê quando o curso ainda
              está trancado pra ela. Deixe em branco pra remover o link.
            </p>
            <input
              type="url"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder="https://sun.eduzz.com/..."
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary text-sm font-mono"
            />

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setEditingCheckout(null)}
                disabled={savingUrl}
                className="flex-1 py-3 rounded-xl bg-muted text-foreground font-bold text-sm hover:bg-accent transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveCheckoutUrl}
                disabled={savingUrl}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:brightness-110 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {savingUrl && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
