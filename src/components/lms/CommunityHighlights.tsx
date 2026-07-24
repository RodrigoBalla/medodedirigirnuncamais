import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── CommunityHighlights ─────────────────────────────────────────────────────
// Prévia da Comunidade no topo da tela principal: stories ativos + posts de
// hoje. Serve de convite — a aluna vê que tem gente viva ali e é puxada pra
// participar (cada publicação vale 5 moedas).
// Custo no banco: 2 queries leves, 1x por montagem da tela.
// =============================================================================

type StoryLite = { id: string; user_id: string; display_name: string; image_url: string };
type PostLite = { id: string; content: string; image_url: string | null; created_at: string; authorName: string };

export function CommunityHighlights() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stories, setStories] = useState<StoryLite[]>([]);
  const [posts, setPosts] = useState<PostLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        // Início do dia (horário de Brasília) pra filtrar "posts de hoje"
        const agora = new Date();
        const sp = new Date(agora.getTime() - 3 * 3600e3);
        const inicioDoDia = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate(), 3, 0, 0)).toISOString();

        const [storiesRes, postsRes] = await Promise.all([
          supabase.rpc("list_active_stories"),
          supabase
            .from("community_posts")
            .select("id, user_id, content, image_url, created_at")
            .gte("created_at", inicioDoDia)
            .order("created_at", { ascending: false })
            .limit(3),
        ]);
        if (!alive) return;

        setStories(((storiesRes.data ?? []) as StoryLite[]).slice(0, 6));

        const rows = postsRes.data ?? [];
        if (rows.length > 0) {
          const ids = Array.from(new Set(rows.map((r) => r.user_id)));
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", ids);
          const nameBy = new Map((profs ?? []).map((p) => [p.user_id, p.display_name || "Aluna"]));
          if (!alive) return;
          setPosts(
            rows.map((r) => ({
              id: r.id,
              content: r.content,
              image_url: (r as { image_url?: string | null }).image_url ?? null,
              created_at: r.created_at,
              authorName: nameBy.get(r.user_id) ?? "Aluna",
            })),
          );
        } else {
          setPosts([]);
        }
      } catch (err) {
        console.warn("[CommunityHighlights]", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  if (!user || loading) return null;

  const vazio = stories.length === 0 && posts.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-card border border-border rounded-[24px] p-4 md:p-5 mb-6"
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-primary">
          💬 Comunidade hoje
        </p>
        <button
          onClick={() => navigate("/comunidade")}
          className="text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors shrink-0"
        >
          Ver tudo →
        </button>
      </div>

      {vazio ? (
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary">forum</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">Ninguém postou hoje ainda</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Seja a primeira e ganhe <span className="text-yellow-600 font-black">🪙 5 moedas</span>.
            </p>
          </div>
          <button
            onClick={() => navigate("/comunidade")}
            className="shrink-0 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest hover:opacity-90 transition-opacity"
          >
            Postar
          </button>
        </div>
      ) : (
        <>
          {/* Stories ativos */}
          {stories.length > 0 && (
            <button
              onClick={() => navigate("/comunidade")}
              className="flex items-center gap-2 mb-3 w-full text-left"
            >
              <div className="flex -space-x-3">
                {stories.map((s) => (
                  <div key={s.id} className="size-11 rounded-full p-0.5 bg-gradient-to-tr from-primary to-blue-300">
                    <img
                      src={s.image_url}
                      alt=""
                      loading="lazy"
                      className="size-full rounded-full object-cover border-2 border-card"
                    />
                  </div>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {stories.length} story{stories.length > 1 ? "s" : ""} ativo{stories.length > 1 ? "s" : ""} · toque pra ver
              </span>
            </button>
          )}

          {/* Últimos posts do dia */}
          {posts.length > 0 && (
            <div className="space-y-2">
              {posts.slice(0, 2).map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate("/comunidade")}
                  className="w-full flex items-center gap-3 text-left rounded-xl hover:bg-muted/40 transition-colors p-1.5 -m-1.5"
                >
                  <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {p.authorName.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-xs text-muted-foreground flex-1 min-w-0 truncate">
                    <span className="font-bold text-foreground">{p.authorName.split(" ")[0]}</span>{" "}
                    {p.content || "compartilhou uma foto 📸"}
                  </p>
                  {p.image_url && (
                    <img src={p.image_url} alt="" loading="lazy" className="size-9 rounded-lg object-cover shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => navigate("/comunidade")}
            className="mt-3 w-full py-2 rounded-xl bg-primary/10 text-primary font-black uppercase text-[10px] tracking-widest hover:bg-primary/20 transition-colors"
          >
            Participar e ganhar 🪙 5 moedas
          </button>
        </>
      )}
    </motion.div>
  );
}
