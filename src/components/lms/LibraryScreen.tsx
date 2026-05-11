import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Product } from "@/types/lms";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ContinueWatchingBanner } from "./ContinueWatchingBanner";
import { WeeklyPlanCard } from "./WeeklyPlanCard";

// =============================================================================
// LibraryScreen — grid de cursos da área de membros
//
// O que mudou:
//   • Era uma galeria 3D (CourseGallery), 1 card por vez, navegação com cursor.
//     Removida porque o admin pode ter vários cursos publicados e o grid
//     mostra todos de uma vez (igual Netflix/Hotmart Members).
//   • Cursos LIBERADOS (aluna tem acesso via grupo) → thumbnail colorida,
//     badge "Liberado", CTA "Acessar" → /curso/:id.
//   • Cursos TRANCADOS (published mas sem acesso) → thumbnail preto-e-branco,
//     lock central, CTA "Saiba mais" → /curso-info/:id (página de venda).
//   • DRAFTS não aparecem pra aluna — só admin vê (badge "Oculto").
// =============================================================================

export function LibraryScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  // Cursos publicados aos quais a aluna NÃO tem acesso ainda — mostrados
  // como "trancados" com CTA pra desbloquear (entrar em contato).
  const [lockedProducts, setLockedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  // Admin vê TODOS os cursos (inclusive ocultos/draft) e ignora grupos de acesso.
  // Alunas só veem cursos `published` aos quais têm acesso via grupo.
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      checkAdminAndLoad();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function checkAdminAndLoad() {
    // Detecta se é admin via user_roles
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user!.id)
      .eq("role", "admin")
      .maybeSingle();
    const admin = !!role;
    setIsAdmin(admin);
    await loadAllowedProducts(admin);
  }

  async function loadAllowedProducts(admin: boolean) {
    setLoading(true);
    try {
      // ── ADMIN: vê todos os cursos (published + draft), sem filtro de grupo ──
      if (admin) {
        const { data: prodData } = await supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false });
        setProducts(prodData || []);
        setLockedProducts([]);
        setLoading(false);
        return;
      }

      // ── ALUNA: filtra por grupo + status published ──
      const { data: userGroups } = await supabase
        .from("access_group_users")
        .select("group_id")
        .eq("user_id", user!.id);

      const groupIds = userGroups?.map(ug => ug.group_id) || [];
      let allowedProductIds: string[] = [];

      if (groupIds.length > 0) {
        const { data: productLinks } = await supabase
          .from("access_group_products")
          .select("product_id")
          .in("group_id", groupIds);

        allowedProductIds = productLinks?.map(p => p.product_id) || [];
      }

      // Carrega TODOS os cursos publicados — separa em "liberados" e "trancados"
      // pra aluna. Cursos em draft NUNCA aparecem aqui.
      const { data: allPublished } = await supabase
        .from("products")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      const published = allPublished || [];
      const allowed = published.filter((p) => allowedProductIds.includes(p.id));
      const locked = published.filter((p) => !allowedProductIds.includes(p.id));

      setProducts(allowed);
      setLockedProducts(locked);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  // Grid único: liberados + trancados juntos, separados visualmente pelo
  // estado (cor x preto-e-branco). Liberados aparecem PRIMEIRO pra que a
  // aluna veja imediatamente o que tem disponível.
  const allItems: Array<{ product: Product; locked: boolean }> = [
    ...products.map((p) => ({ product: p, locked: false })),
    ...lockedProducts.map((p) => ({ product: p, locked: true })),
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 min-h-[calc(100vh-53px)] flex flex-col">
      {/* Plano semanal — "Esta semana você vai..." (1 prática + 1 aula + 1 missão). */}
      {!loading && <WeeklyPlanCard />}

      {/* Continue de onde parou — banner discreto que some se não houver progresso */}
      {!loading && <ContinueWatchingBanner />}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-primary">
          <div className="animate-spin size-10 border-4 border-primary border-t-transparent rounded-full mb-4" />
          <p className="font-bold">Carregando seus cursos...</p>
        </div>
      ) : allItems.length > 0 ? (
        <div>
          {/* Cabeçalho discreto da seção de cursos */}
          <div className="flex items-center justify-between mb-4 mt-2">
            <h2 className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
              Cursos
            </h2>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              {products.length} liberado{products.length === 1 ? "" : "s"} · {lockedProducts.length} para desbloquear
            </p>
          </div>

          {/* Grid responsivo: 1 col mobile / 2 cols sm / 3 cols lg */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {allItems.map(({ product, locked }) => (
              <CourseCard
                key={product.id}
                product={product}
                locked={locked}
                isAdmin={isAdmin}
                onClick={() => {
                  if (locked) {
                    navigate(`/curso-info/${product.id}`);
                  } else {
                    navigate(`/curso/${product.id}`);
                  }
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        /* Sem cursos disponíveis no catálogo todo (caso muito raro: nenhum
           curso publicado no banco). */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-muted-foreground text-5xl mb-3">video_library</span>
          <p className="text-sm font-bold text-muted-foreground">Nenhum curso disponível no momento</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Volte em breve.</p>
        </div>
      )}
    </div>
  );
}

// ─── CourseCard ──────────────────────────────────────────────────────────────
// Card individual do grid de cursos. Dois estados:
//
//   • locked = false  → thumbnail COLORIDA, badge "Liberado", CTA "Acessar"
//                       Clica → navega pra /curso/:id (área de aulas).
//   • locked = true   → thumbnail PRETO-E-BRANCO, lock no canto, CTA "Saiba mais"
//                       Clica → navega pra /curso-info/:id (página de venda).
//
// Admin extra: vê tudo, inclusive draft (badge "Oculto (só admin)" no canto).
// =============================================================================
function CourseCard({
  product,
  locked,
  isAdmin,
  onClick,
}: {
  product: Product;
  locked: boolean;
  isAdmin: boolean;
  onClick: () => void;
}) {
  const isDraft = (product as { status?: string }).status !== "published";

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative bg-black border border-white/10 rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 transition-all flex flex-col text-left"
      title={locked ? `Saiba mais sobre "${product.title}"` : `Acessar ${product.title}`}
    >
      {/* Thumbnail — 9:16 (formato vertical reels/stories) */}
      <div className="relative w-full aspect-[9/16] bg-muted overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title}
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
              locked ? "grayscale brightness-75 group-hover:grayscale-0 group-hover:brightness-100" : ""
            }`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`material-symbols-outlined text-6xl ${locked ? "text-white/20" : "text-border"}`}>
              movie
            </span>
          </div>
        )}

        {/* Overlay sutil pra contraste do título sobre a thumb */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

        {/* Ícone de cadeado central — só quando trancado */}
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="size-14 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-colors">
              <span className="material-symbols-outlined text-white text-2xl group-hover:text-primary-foreground transition-colors">
                lock
              </span>
            </div>
          </div>
        )}

        {/* Badges no topo */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2 z-10">
          {/* Badge esquerda: status */}
          {locked ? (
            <span className="bg-black/70 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded">
              Trancado
            </span>
          ) : (
            <span className="bg-[hsl(var(--success)/0.9)] text-[hsl(var(--success-foreground))] text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded">
              Liberado
            </span>
          )}

          {/* Badge direita: só admin vendo draft */}
          {isAdmin && isDraft && (
            <span className="bg-amber-500/90 text-black text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded">
              Oculto
            </span>
          )}
        </div>

        {/* Título sobreposto na parte inferior da thumb */}
        <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
          <h3 className="font-black text-base md:text-lg leading-tight tracking-tight text-white line-clamp-2" style={{ textWrap: "balance" }}>
            {product.title}
          </h3>
        </div>
      </div>

      {/* Rodapé do card — CTA */}
      <div className="p-3 md:p-4 flex items-center justify-between gap-2 bg-card/60">
        {locked ? (
          <>
            <span className="text-xs text-muted-foreground line-clamp-1 flex-1">
              Desbloqueie pra começar
            </span>
            <span className="shrink-0 inline-flex items-center gap-1.5 bg-primary/10 text-primary text-[11px] font-black uppercase tracking-widest px-3 py-2 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <span className="material-symbols-outlined text-sm">info</span>
              Saiba mais
            </span>
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground line-clamp-1 flex-1">
              Pronto pra continuar
            </span>
            <span className="shrink-0 inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-widest px-3 py-2 rounded-lg group-hover:brightness-110 transition-all">
              <span className="material-symbols-outlined text-sm">play_arrow</span>
              Acessar
            </span>
          </>
        )}
      </div>
    </motion.button>
  );
}
