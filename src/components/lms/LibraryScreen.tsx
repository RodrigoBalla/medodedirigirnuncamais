import React, { useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Product } from "@/types/lms";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// =============================================================================
// CourseGallery — galeria 3D com cards empilhados em profundidade
//
// Como funciona:
//   • O card ATIVO fica no centro/frente (slot 0).
//   • Os outros cards ficam ATRÁS, deslocados pra um lado, levemente rotacionados
//     em Y, com escala menor — sugerem que existem mais módulos.
//   • Quando o carrinho do cursor chega na borda esquerda/direita do container,
//     todos os cards se redistribuem pelos novos slots com uma rotação 3D no
//     sentido OPOSTO ao movimento do carro.
//     - Carro foi pra DIREITA → cards giram pra ESQUERDA (o de trás à direita
//       vem pra frente, o ativo gira pra trás-esquerda).
//     - Carro foi pra ESQUERDA → contrário.
//   • Cooldown de 800ms evita troca em cascata.
// =============================================================================
function CourseGallery<T>({
  items,
  renderItem,
  getKey,
}: {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [edgeHover, setEdgeHover] = useState<"left" | "right" | null>(null);
  const cooldown = useRef(false);
  const len = items.length;

  function navigate(dir: 1 | -1) {
    if (len <= 1) return;
    setIndex((i) => (i + dir + len) % len);
  }

  // Edge detection — só age dentro da faixa vertical do container (pra não
  // conflitar com sidebar à esquerda).
  useEffect(() => {
    if (len <= 1) return;
    const EDGE_ZONE = 70;

    function handleMove(e: MouseEvent) {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();

      const inVerticalBounds = e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inVerticalBounds) {
        if (edgeHover) setEdgeHover(null);
        return;
      }

      const distLeft = e.clientX - rect.left;
      const distRight = rect.right - e.clientX;

      if (distLeft < EDGE_ZONE && distLeft > -EDGE_ZONE) {
        if (edgeHover !== "left") setEdgeHover("left");
        if (!cooldown.current) {
          cooldown.current = true;
          navigate(-1);
          setTimeout(() => {
            cooldown.current = false;
          }, 800);
        }
      } else if (distRight < EDGE_ZONE && distRight > -EDGE_ZONE) {
        if (edgeHover !== "right") setEdgeHover("right");
        if (!cooldown.current) {
          cooldown.current = true;
          navigate(1);
          setTimeout(() => {
            cooldown.current = false;
          }, 800);
        }
      } else if (edgeHover) {
        setEdgeHover(null);
      }
    }

    document.addEventListener("mousemove", handleMove);
    return () => document.removeEventListener("mousemove", handleMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [len, edgeHover]);

  if (len === 0) return null;

  // Slot relativo ao ativo (caminho mais curto na lista circular).
  // 0 = frente, +1 = peek-direita, -1 = peek-esquerda, ±2 = mais atrás, etc.
  function getSlot(i: number): number {
    const raw = i - index;
    if (raw > len / 2) return raw - len;
    if (raw < -len / 2) return raw + len;
    return raw;
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Topo da galeria: guia + paginação + contador, tudo agrupado */}
      {len > 1 && (
        <div className="flex flex-col items-center gap-2 mb-5 relative z-10">
          {/* Guia de troca */}
          <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            <span className="text-primary">←</span>
            <span>Cursor pra trocar de módulo</span>
            <span className="text-primary">→</span>
          </div>

          {/* Dots clicáveis */}
          <div className="flex items-center gap-2">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index
                    ? "bg-primary w-8 shadow-md shadow-primary/40"
                    : "bg-white/20 w-2 hover:bg-white/40"
                }`}
                aria-label={`Ir para item ${i + 1}`}
              />
            ))}
          </div>

          {/* Contador 1/N */}
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            {index + 1} / {len}
          </div>
        </div>
      )}

      {/* Edge indicators (gradiente amarelo + chevron) */}
      {len > 1 && (
        <>
          <div
            className={`absolute left-0 top-0 bottom-0 w-16 z-40 pointer-events-none transition-opacity duration-200 flex items-center justify-start pl-2 ${
              edgeHover === "left" ? "opacity-100" : "opacity-0"
            }`}
            style={{
              background:
                "linear-gradient(to right, rgba(255, 214, 10, 0.25), transparent)",
            }}
            aria-hidden="true"
          >
            <span className="material-symbols-outlined text-primary text-3xl drop-shadow-lg">
              chevron_left
            </span>
          </div>
          <div
            className={`absolute right-0 top-0 bottom-0 w-16 z-40 pointer-events-none transition-opacity duration-200 flex items-center justify-end pr-2 ${
              edgeHover === "right" ? "opacity-100" : "opacity-0"
            }`}
            style={{
              background:
                "linear-gradient(to left, rgba(255, 214, 10, 0.25), transparent)",
            }}
            aria-hidden="true"
          >
            <span className="material-symbols-outlined text-primary text-3xl drop-shadow-lg">
              chevron_right
            </span>
          </div>
        </>
      )}

      {/* Palco 3D — perspective define a profundidade da cena */}
      <div
        className="relative"
        style={{
          perspective: "1600px",
          perspectiveOrigin: "50% 50%",
        }}
      >
        {/* Inner stage — preserva 3D pros filhos. min-height garante que os
            cards absolute tenham espaço pra renderizar suas alturas naturais. */}
        <div
          className="relative mx-auto"
          style={{
            transformStyle: "preserve-3d",
            // Altura aproximada do card (capa 16:9 + bloco de texto ~200px)
            // — a galeria reserva esse espaço pra layout estável.
            minHeight: "clamp(460px, 56vw, 620px)",
          }}
        >
          {items.map((item, i) => {
            const slot = getSlot(i);
            const abs = Math.abs(slot);
            const sign = Math.sign(slot); // -1, 0 ou 1

            // Quando carro vai pra DIREITA: index aumenta → o item que estava
            // ativo (slot 0) vai pra slot -1 (esquerda, atrás). O que estava
            // em slot +1 (peek-direita) vai pra slot 0 (frente).
            // A rotação Y inverte o sinal do slot pra rotacionar no SENTIDO
            // OPOSTO ao deslocamento horizontal — isso dá o efeito 3D de
            // "girar pra esquerda quando vai pra direita".
            const xPercent = sign * 16;          // deslocamento lateral
            const zPx = -180 * abs;              // afunda no eixo Z
            const rotYDeg = -sign * 22;          // rotação inversa
            const opacity = abs === 0 ? 1 : Math.max(0.42, 1 - 0.28 * abs);
            const scale = abs === 0 ? 1 : Math.max(0.85, 1 - 0.07 * abs);
            const zIndex = 100 - abs * 10;
            const isActive = abs === 0;

            return (
              <motion.div
                key={getKey(item, i)}
                className={`absolute inset-x-0 top-0 ${isActive ? "" : "pointer-events-none"}`}
                animate={{
                  x: `${xPercent}%`,
                  z: zPx,
                  rotateY: rotYDeg,
                  opacity,
                  scale,
                }}
                transition={{
                  duration: 0.65,
                  ease: [0.32, 0.72, 0.35, 1], // ease-out-quint suave
                }}
                style={{
                  transformStyle: "preserve-3d",
                  transformOrigin: "50% 50%",
                  zIndex,
                  // Filtro só nos cards de trás pra dar profundidade extra
                  filter: isActive ? "none" : "brightness(0.8)",
                }}
              >
                {renderItem(item, i)}
              </motion.div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

const FEATURED_COURSES = [
  {
    id: "featured-1",
    title: "Medo de Dirigir Nunca Mais - Método Completo",
    description: "O curso principal com todas as fases, simulados e treinos práticos para superar o medo de dirigir.",
    icon: "directions_car",
    color: "from-blue-600 to-primary",
    image: "/modulos/medo-de-dirigir-nunca-mais.jpg",
    lessons: 12,
    duration: "4h30",
  },
  {
    id: "featured-2",
    title: "Dominando as Ladeiras",
    description: "Aprenda a subir e descer ladeiras com segurança: saída em rampa, freio de mão, embreagem no ponto de arrancada e mais.",
    icon: "terrain",
    color: "from-amber-600 to-orange-500",
    image: "/modulos/dominando-as-ladeiras.jpg",
    lessons: 6,
    duration: "1h30",
  },
  {
    id: "featured-3",
    title: "O Manual do Motorista de Aplicativo",
    description: "Faça renda extra ao volante: cadastro na Uber e 99, primeiras corridas sem medo, dicas de segurança e como começar a faturar.",
    icon: "local_taxi",
    color: "from-emerald-600 to-green-500",
    image: "/modulos/manual-motorista-aplicativo.jpg",
    lessons: 10,
    duration: "3h00",
  },
];

export function LibraryScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAllowedProducts();
    }
  }, [user]);

  async function loadAllowedProducts() {
    setLoading(true);
    try {
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

      if (allowedProductIds.length > 0) {
        const { data: prodData } = await supabase
          .from("products")
          .select("*")
          .in("id", allowedProductIds)
          .eq("status", "published")
          .order("created_at", { ascending: false });

        setProducts(prodData || []);
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  return (
    // Container ocupa altura disponível (descontando header) e centraliza
    // o conteúdo verticalmente — sem cabeçalho redundante e sem necessidade
    // de scroll na maioria das viewports desktop.
    <div className="max-w-5xl mx-auto px-4 py-4 min-h-[calc(100vh-53px)] flex flex-col justify-center">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-primary">
          <div className="animate-spin size-10 border-4 border-primary border-t-transparent rounded-full mb-4" />
          <p className="font-bold">Carregando seus cursos...</p>
        </div>
      ) : products.length > 0 ? (
        // Galeria/gaveta — 1 card por vez, navega quando o cursor toca borda esq/dir
        <CourseGallery
          items={products}
          getKey={(p) => p.id}
          renderItem={(product) => (
            <div
              key={product.id}
              className="group bg-black border border-white/10 rounded-2xl overflow-hidden hover:shadow-xl hover:border-primary/40 transition-all flex flex-col"
            >
              {/* Capa do curso — 16:9, ocupa ~38% da largura em desktop */}
              <div className="w-full aspect-[16/9] bg-muted relative overflow-hidden flex items-center justify-center">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <span className="material-symbols-outlined text-border text-6xl group-hover:scale-110 transition-transform duration-500">movie</span>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-lg">
                  <span className="material-symbols-outlined text-white text-xs filled-icon">play_circle</span>
                  <span className="text-white text-xs font-bold font-mono">Curso</span>
                </div>
              </div>
              <div className="p-6 md:p-8 flex flex-col flex-1 justify-center">
                <h3 className="font-bold text-xl md:text-2xl mb-2 leading-tight group-hover:text-primary transition-colors">{product.title}</h3>
                <p className="text-sm md:text-base text-muted-foreground mb-5 leading-relaxed">
                  {product.description || "Nenhuma descrição disponível."}
                </p>
                <button
                  onClick={() => navigate(`/curso/${product.id}`)}
                  className="self-start bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-bold px-6 py-3 rounded-xl transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">school</span>
                  Acessar Curso
                </button>
              </div>
            </div>
          )}
        />
      ) : (
        /* Featured Courses Catalog when no purchased courses — também em galeria */
        <CourseGallery
          items={FEATURED_COURSES}
          getKey={(c) => c.id}
          renderItem={(course) => (
              <div
                className="group bg-black border border-white/10 rounded-[32px] overflow-hidden hover:shadow-xl hover:border-primary/40 transition-all flex flex-col"
              >
                <div className={`w-full aspect-[16/9] bg-gradient-to-br ${course.color} relative flex items-center justify-center overflow-hidden`}>
                  {/* Thumb real do módulo (cobre o frame 16:9 sem distorcer) */}
                  {course.image ? (
                    <img
                      src={course.image}
                      alt={course.title}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-white/20 text-8xl group-hover:scale-110 transition-transform duration-500">
                      {course.icon}
                    </span>
                  )}
                  {/* Overlay sutil pra contraste das pílulas */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/20 pointer-events-none" />
                  <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full z-10">
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">{course.lessons} aulas</span>
                  </div>
                  <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full z-10">
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">{course.duration}</span>
                  </div>
                </div>
                <div className="p-5 md:p-6 flex flex-col flex-1 justify-center gap-3">
                  {/* Eyebrow com metadados — pequeno selo discreto acima do título */}
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary/80">
                    <span>{course.lessons} aulas</span>
                    <span className="text-white/30">•</span>
                    <span>{course.duration}</span>
                  </div>

                  {/* Título: tamanho moderado, 2 linhas máx, balanceado */}
                  <h3
                    className="font-black text-lg md:text-xl leading-snug tracking-tight group-hover:text-primary transition-colors line-clamp-2"
                    style={{ textWrap: "balance" }}
                  >
                    {course.title}
                  </h3>

                  {/* Descrição: tamanho consistente, 2-3 linhas */}
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {course.description}
                  </p>

                  {/* CTA: padding moderado pra não esmagar o card */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toast.info("Entre em contato para desbloquear este curso! 📞")}
                    className="self-start mt-1 bg-primary text-primary-foreground font-black px-6 py-2.5 rounded-xl shadow-lg shadow-primary/20 text-xs uppercase tracking-widest flex items-center gap-2 hover:brightness-110 transition-all"
                  >
                    <span className="material-symbols-outlined text-base">lock_open</span>
                    Desbloquear
                  </motion.button>
                </div>
              </div>
          )}
        />
      )}
    </div>
  );
}
