import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Product } from "@/types/lms";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { extractEduzzContentId } from "@/components/lms/EduzzCheckoutEmbed";
import { CheckoutModal } from "@/components/lms/CheckoutModal";

// ─── /curso-info/:id ─────────────────────────────────────────────────────────
// Página de "saiba mais" — destino do botão dos cards TRANCADOS no grid de
// cursos. Layout otimizado pra conversão:
//
// DESKTOP (lg+):
//   • 2 colunas: descrição à ESQUERDA (col 7), checkout à DIREITA (col 5)
//   • Checkout é STICKY — acompanha o scroll enquanto a aluna lê a descrição
//   • Thumb 9:16 compacta dentro da coluna de descrição (não domina mais a tela)
//
// MOBILE (<lg):
//   • Tudo empilhado verticalmente
//   • Thumb grande no topo, descrição depois, checkout no fim
//
// Sem duplicação de info: o nome do curso aparece no topo da nossa página E
// dentro do checkout (vem da Eduzz). Os selos do nosso lado foram removidos
// porque a Eduzz já mostra "Compra segura / Privacidade protegida / Eduzz
// verificada / 7 dias garantia" no rodapé do próprio checkout.
//
// Após a compra, o webhook da Eduzz libera o grupo de acesso automaticamente.
// =============================================================================

export default function CourseInfo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  // Modal "popup" do checkout — abre por cima da página (não é aba nova).
  const [checkoutOpen, setCheckoutOpen] = useState(false);

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
      // Mostra a página (e monta o checkout) ASSIM QUE o produto carrega —
      // não espera a checagem de acesso. Pra curso trancado (o caso de compra)
      // a aluna não tem acesso, então o checkout aparece o quanto antes.
      setLoading(false);

      // Checagem de acesso em SEGUNDO PLANO: só serve pra, se ela JÁ tiver o
      // curso, trocar o checkout pelo aviso "você já tem acesso".
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
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin size-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!product) return null;

  const contentId = extractEduzzContentId(product.checkout_url);
  const showCheckout = !hasAccess;
  const canCheckout = showCheckout && !!contentId;

  return (
    <div className="min-h-screen bg-background overflow-x-clip">
      {/* Topbar mínima: voltar + título curto */}
      <div className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="caution-tape h-1.5 w-full" aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="size-9 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors"
            aria-label="Voltar"
            title="Voltar"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
          </button>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground line-clamp-1">
            Saiba mais sobre o curso
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6 md:pt-10 pb-28 lg:pb-10">
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

        {/* Layout 2 colunas no desktop (info à esquerda + checkout sticky à
            direita). No mobile empilha e tem uma barra fixa "Comprar agora" no
            rodapé pra compra sempre estar a um toque. */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          {/* INFO DO CURSO (esquerda) ───────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="lg:col-span-7"
          >
            {/* Thumb + título — layout interno que adapta:
                • mobile: thumb cheia em cima, texto embaixo
                • sm+: thumb compacta à esquerda, texto à direita */}
            <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 mb-6">
              {/* Thumb — width fixa em sm+, full em mobile */}
              <div className="w-full sm:w-[180px] md:w-[200px] shrink-0">
                <div className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden bg-muted border border-white/10 shadow-xl shadow-primary/10">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="material-symbols-outlined text-border text-6xl">movie</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                </div>
              </div>

              {/* Título + eyebrow + selos resumidos */}
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                  Curso · Medo de Dirigir Nunca Mais
                </p>
                <h1
                  className="text-2xl sm:text-3xl md:text-4xl font-black leading-[1.05] tracking-tight"
                  style={{ textWrap: "balance" }}
                >
                  {product.title}
                </h1>

                {/* Selos compactos — usados como reforço RÁPIDO de confiança
                    antes da aluna ler a descrição. Os selos completos vêm
                    do próprio checkout Eduzz no rodapé dele. */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1">
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-primary">bolt</span>
                    Acesso liberado automaticamente
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-primary">all_inclusive</span>
                    Acesso vitalício
                  </span>
                </div>
              </div>
            </div>

            {/* Descrição — agora largura toda da coluna esquerda */}
            <div className="prose prose-invert max-w-none">
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed whitespace-pre-line">
                {product.description || "Em breve mais informações sobre esse curso."}
              </p>
            </div>
          </motion.div>

          {/* CHECKOUT (direita, sticky no desktop) ──────────────────────── */}
          {showCheckout && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 }}
              className="lg:col-span-5 lg:sticky lg:top-24"
            >
              {canCheckout ? (
                <div className="bg-card border border-border rounded-2xl p-6 shadow-xl shadow-black/20">
                  {/* Header curto do checkout */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-primary text-lg">shopping_bag</span>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-foreground">
                      Finalize sua inscrição
                    </p>
                  </div>

                  {/* Reforços rápidos de confiança */}
                  <ul className="space-y-2 mb-5 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-base">bolt</span>
                      Acesso liberado na hora após o pagamento
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-base">credit_card</span>
                      Cartão, Pix ou boleto
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-base">verified_user</span>
                      Checkout seguro Eduzz · 7 dias de garantia
                    </li>
                  </ul>

                  {/* COMPRAR AGORA — abre o checkout num MODAL popup por cima da
                      página (não abre aba nova). */}
                  <button
                    type="button"
                    onClick={() => setCheckoutOpen(true)}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black uppercase tracking-widest text-base px-4 py-4 rounded-xl hover:brightness-110 active:scale-[0.99] transition shadow-lg shadow-primary/20"
                  >
                    <span className="material-symbols-outlined">lock</span>
                    Comprar agora
                  </button>

                  {/* Segundo botão: abre o checkout numa NOVA GUIA (externo). */}
                  <a
                    href={`https://chk.eduzz.com/${contentId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 w-full flex items-center justify-center gap-2 border border-border text-foreground font-bold uppercase tracking-widest text-xs px-4 py-3 rounded-xl hover:bg-accent hover:border-primary/40 transition"
                  >
                    <span className="material-symbols-outlined text-base">open_in_new</span>
                    Abrir checkout externo
                  </a>

                  <p className="text-[11px] text-muted-foreground mt-3 text-center leading-relaxed">
                    Use o <strong className="text-foreground">e-mail dessa conta</strong> no checkout pra liberação imediata.
                  </p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-2xl p-6 text-center">
                  <span className="material-symbols-outlined text-muted-foreground text-3xl mb-2 block">
                    link_off
                  </span>
                  <p className="text-sm font-bold text-muted-foreground">Checkout ainda não configurado</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Fale com a Carla pra liberar a compra deste curso.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* ─── MOBILE: barra fixa "Comprar agora" no rodapé ─────────────────
          Sempre acessível enquanto a aluna lê a página, sem precisar rolar até
          o card. Some no desktop (lá o card fica sticky ao lado). */}
      {showCheckout && canCheckout && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-md px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setCheckoutOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black uppercase tracking-widest text-sm px-4 py-3.5 rounded-xl active:scale-[0.99] transition shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-base">lock</span>
            Comprar agora
          </button>
          <a
            href={`https://chk.eduzz.com/${contentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-sm">open_in_new</span>
            Abrir checkout externo
          </a>
        </div>
      )}

      {/* Popup PADRÃO do checkout (mesmo componente usado em toda a plataforma). */}
      {contentId && (
        <CheckoutModal
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          contentId={contentId}
          title={product.title}
        />
      )}
    </div>
  );
}
