import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Product } from "@/types/lms";
import { motion } from "framer-motion";
import { toast } from "sonner";

// ─── /curso-info/:id ─────────────────────────────────────────────────────────
// Página de "saiba mais" — destino do botão dos cards TRANCADOS no grid de
// cursos. Mostra:
//   • Hero grande com a thumb do curso (colorida — aqui já é o ponto de
//     desejo, então sem grayscale).
//   • Título + descrição.
//   • CTA "Quero comprar" que abre `products.checkout_url` numa nova aba.
//     Se a URL não estiver setada no admin, mostra um fallback de contato.
//
// IMPORTANTE: a página NÃO valida acesso. Mesmo quem já tem o curso pode
// abrir essa rota — útil pra admin testar e pra futuras feature de "indicar
// um amigo". Quem já tem, vê uma faixa avisando que já pode acessar.
//
// Após a compra, o webhook da Eduzz já cadastrado libera o grupo de acesso
// automaticamente (mesma conta de e-mail).
// =============================================================================

export default function CourseInfo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);

      // Carrega o produto. RLS permite (cursos published são públicos).
      const { data: prod, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id!)
        .maybeSingle();

      if (cancelled) return;
      if (error || !prod) {
        toast.error("Curso não encontrado");
        navigate("/biblioteca", { replace: true });
        return;
      }

      setProduct(prod as Product);

      // Detecta se a aluna logada já tem acesso (pra mostrar atalho "Acessar").
      if (user) {
        const { data: userGroups } = await supabase
          .from("access_group_users")
          .select("group_id")
          .eq("user_id", user.id);

        const groupIds = (userGroups || []).map((g) => g.group_id);
        if (groupIds.length > 0) {
          const { data: links } = await supabase
            .from("access_group_products")
            .select("product_id")
            .in("group_id", groupIds)
            .eq("product_id", id!);
          if (!cancelled) setHasAccess(!!(links && links.length > 0));
        }
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, user, navigate]);

  function handleBuy() {
    if (!product) return;
    if (product.checkout_url) {
      window.open(product.checkout_url, "_blank", "noopener,noreferrer");
    } else {
      toast.info("Em breve a compra estará disponível por aqui. Fale com a Carla pra liberar agora.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin size-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen bg-background overflow-x-clip">
      {/* Topbar mínima: voltar + título curto */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="caution-tape h-1.5 w-full" aria-hidden="true" />
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="size-9 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors"
            aria-label="Voltar"
            title="Voltar"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
          </button>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
            Saiba mais sobre o curso
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        {/* Faixa de aviso se a aluna já tem acesso */}
        {hasAccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-[hsl(var(--success)/0.12)] border border-[hsl(var(--success)/0.35)] text-[hsl(var(--success))] rounded-2xl p-4 flex items-center gap-3"
          >
            <span className="material-symbols-outlined">check_circle</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Você já tem acesso a esse curso</p>
              <p className="text-xs opacity-80">Pode entrar direto na área de aulas.</p>
            </div>
            <button
              onClick={() => navigate(`/curso/${product.id}`)}
              className="shrink-0 px-4 py-2 rounded-xl bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] text-xs font-black uppercase tracking-widest hover:brightness-110 transition"
            >
              Acessar
            </button>
          </motion.div>
        )}

        {/* Hero — thumb + título + descrição lado a lado em desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-10 items-start">
          {/* Thumb (coluna esquerda, 2/5 em desktop) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="lg:col-span-2"
          >
            <div className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden bg-muted border border-white/10 shadow-2xl shadow-primary/10">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-border text-8xl">movie</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            </div>
          </motion.div>

          {/* Texto + CTA (coluna direita, 3/5 em desktop) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="lg:col-span-3 flex flex-col gap-5"
          >
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary mb-2">
                Curso · Medo de Dirigir Nunca Mais
              </p>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black leading-[1.05] tracking-tight" style={{ textWrap: "balance" }}>
                {product.title}
              </h1>
            </div>

            <p className="text-base md:text-lg text-muted-foreground leading-relaxed whitespace-pre-line">
              {product.description || "Em breve mais informações sobre esse curso."}
            </p>

            {/* CTA principal — só aparece se a aluna ainda NÃO tem acesso */}
            {!hasAccess && (
              <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-2">
                  Quero esse curso
                </p>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  Clique abaixo pra ir ao checkout seguro da Eduzz. Após a compra, o acesso é liberado automaticamente nessa mesma conta.
                </p>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleBuy}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black px-6 py-4 rounded-xl shadow-lg shadow-primary/30 uppercase tracking-widest text-sm hover:brightness-110 transition-all"
                >
                  <span className="material-symbols-outlined">shopping_bag</span>
                  Quero comprar
                  <span className="material-symbols-outlined text-base">open_in_new</span>
                </motion.button>

                {!product.checkout_url && (
                  <p className="text-[11px] text-muted-foreground/70 mt-3">
                    O link de compra ainda não foi configurado pra esse curso. Fale com a Carla pra liberar.
                  </p>
                )}
              </div>
            )}

            {/* Selo de segurança / explicação curta */}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-primary">verified_user</span>
                Pagamento seguro Eduzz
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-primary">bolt</span>
                Liberação automática
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-primary">all_inclusive</span>
                Acesso vitalício
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
