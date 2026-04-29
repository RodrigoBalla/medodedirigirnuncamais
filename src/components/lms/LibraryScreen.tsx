import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Product } from "@/types/lms";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";

const FEATURED_COURSES = [
  {
    id: "featured-1",
    title: "Medo de Dirigir Nunca Mais - Método Completo",
    description: "O curso principal com todas as fases, simulados e treinos práticos para superar o medo de dirigir.",
    icon: "directions_car",
    color: "from-blue-600 to-primary",
    lessons: 12,
    duration: "4h30",
  },
  {
    id: "featured-2",
    title: "Masterclass: Baliza Perfeita",
    description: "Domine a baliza de uma vez por todas com técnicas visuais e passo a passo guiado.",
    icon: "local_parking",
    color: "from-purple-600 to-pink-500",
    lessons: 6,
    duration: "1h45",
  },
  {
    id: "featured-3",
    title: "Rodovia Sem Medo",
    description: "Aprenda a se sentir segura na rodovia: ultrapassagem, faixa de aceleração e mais.",
    icon: "speed",
    color: "from-green-600 to-emerald-500",
    lessons: 8,
    duration: "2h10",
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
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Meus Cursos</h1>
        <p className="text-muted-foreground mt-2">Sua biblioteca de conteúdos exclusivos.</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-primary">
          <div className="animate-spin size-10 border-4 border-primary border-t-transparent rounded-full mb-4" />
          <p className="font-bold">Carregando seus cursos...</p>
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div key={product.id} className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl hover:border-primary/30 transition-all flex flex-col h-full">
              <div className="w-full aspect-video bg-muted relative overflow-hidden flex items-center justify-center">
                <span className="material-symbols-outlined text-border text-6xl group-hover:scale-110 transition-transform duration-500">movie</span>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-lg">
                  <span className="material-symbols-outlined text-white text-xs filled-icon">play_circle</span>
                  <span className="text-white text-xs font-bold font-mono">Curso</span>
                </div>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h3 className="font-bold text-lg mb-1 line-clamp-2 leading-tight group-hover:text-primary transition-colors">{product.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1 mb-4 flex-1">
                  {product.description || "Nenhuma descrição disponível."}
                </p>
                <button
                  onClick={() => navigate(`/curso/${product.id}`)}
                  className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">school</span>
                  Acessar Curso
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Featured Courses Catalog when no purchased courses */
        <div>
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-[32px] p-8 mb-8 text-center">
            <span className="material-symbols-outlined text-primary text-5xl mb-4">school</span>
            <h2 className="text-xl font-black uppercase italic tracking-tight mb-2">Catálogo de Cursos</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Explore nossos cursos disponíveis e desbloqueie seu potencial na direção.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURED_COURSES.map((course, i) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group bg-card border border-border rounded-[32px] overflow-hidden hover:shadow-xl hover:border-primary/30 transition-all flex flex-col"
              >
                <div className={`w-full aspect-video bg-gradient-to-br ${course.color} relative flex items-center justify-center`}>
                  <span className="material-symbols-outlined text-white/20 text-8xl group-hover:scale-110 transition-transform duration-500">
                    {course.icon}
                  </span>
                  <div className="absolute top-3 left-3 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">{course.lessons} aulas</span>
                  </div>
                  <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">{course.duration}</span>
                  </div>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-black text-lg mb-2 leading-tight group-hover:text-primary transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6 flex-1 leading-relaxed">
                    {course.description}
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toast.info("Entre em contato para desbloquear este curso! 📞")}
                    className="w-full bg-primary text-primary-foreground font-black py-3.5 rounded-2xl shadow-lg shadow-primary/20 text-sm uppercase tracking-widest italic flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">lock_open</span>
                    Desbloquear
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
