import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { playCheckSound, playCoinSound } from "@/lib/sounds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// =============================================================================
// COMUNIDADE — agora 100% conectada ao Supabase.
//
// Tabelas:
//   - public.community_posts   (posts dos usuários)
//   - public.community_likes   (curtidas, 1 por user/post)
//   - public.community_saves   (bookmarks privados)
//
// RLS garante que cada usuário só escreve em nome próprio.
// Realtime: novos posts aparecem ao vivo via channel subscription.
//
// "Stories" e algumas mentorias/dicas continuam mockadas (V1) — a base
// pra eles seria outra tabela/feature, fora do escopo do MVP de comunidade.
// =============================================================================

type CommunityPost = {
  id: string;
  user_id: string;
  content: string;
  is_question: boolean;
  category: string;
  created_at: string;
  // Campos derivados (preenchidos depois do fetch):
  authorName: string;
  authorInitial: string;
  likeCount: number;
  isLiked: boolean;
  isSaved: boolean;
};

const STORIES = [
  { name: "Karla M.", online: true },
  { name: "Sarah P.", online: false },
  { name: "Coach Anna", online: true },
  { name: "Regras", online: false, icon: "menu_book" },
  { name: "Eventos", online: false, icon: "event" },
];

const TABS = [
  { id: "feed", label: "Para Você" },
  { id: "mentorias", label: "Mentorias" },
  { id: "dicas", label: "Dicas" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Formata "há X horas/min" a partir do created_at
function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function CommunityScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("feed");
  const [postText, setPostText] = useState("");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [selectedStory, setSelectedStory] = useState<string | null>(null);
  const [isQuestion, setIsQuestion] = useState(false);

  // ── Carrega posts + curtidas + saves do usuário ──────────────────────
  async function loadPosts() {
    setLoading(true);
    try {
      // 1. Posts (RLS: autenticado lê tudo)
      const { data: rawPosts, error: postsErr } = await supabase
        .from("community_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (postsErr) throw postsErr;
      const postRows = rawPosts ?? [];

      if (postRows.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      const postIds = postRows.map((p) => p.id);
      const userIds = Array.from(new Set(postRows.map((p) => p.user_id)));

      // 2. Profiles dos autores (1 query batched)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      const profilesByUser = new Map(
        (profiles ?? []).map((p) => [p.user_id, p.display_name || "Aluna"]),
      );

      // 3. Contagem de curtidas por post (1 query agregada)
      const { data: likesAll } = await supabase
        .from("community_likes")
        .select("post_id, user_id")
        .in("post_id", postIds);
      const likeCountByPost = new Map<string, number>();
      const likedByMe = new Set<string>();
      (likesAll ?? []).forEach((l) => {
        likeCountByPost.set(l.post_id, (likeCountByPost.get(l.post_id) ?? 0) + 1);
        if (user && l.user_id === user.id) likedByMe.add(l.post_id);
      });

      // 4. Saves do usuário atual (RLS: só vê os próprios)
      const savedByMe = new Set<string>();
      if (user) {
        const { data: mySaves } = await supabase
          .from("community_saves")
          .select("post_id")
          .in("post_id", postIds);
        (mySaves ?? []).forEach((s) => savedByMe.add(s.post_id));
      }

      const enriched: CommunityPost[] = postRows.map((p) => {
        const name = profilesByUser.get(p.user_id) ?? "Aluna";
        return {
          id: p.id,
          user_id: p.user_id,
          content: p.content,
          is_question: p.is_question,
          category: p.category,
          created_at: p.created_at,
          authorName: name,
          authorInitial: name.charAt(0).toUpperCase(),
          likeCount: likeCountByPost.get(p.id) ?? 0,
          isLiked: likedByMe.has(p.id),
          isSaved: savedByMe.has(p.id),
        };
      });
      setPosts(enriched);
    } catch (err) {
      console.error("[community] loadPosts error:", err);
      toast.error("Não consegui carregar os posts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPosts();

    // Realtime: insere novos posts no topo conforme chegam
    const channel = supabase
      .channel("community_posts_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_posts" },
        () => {
          // Recarrega — mais simples e barato que reconciliar joins manualmente
          loadPosts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Filtro por tab ───────────────────────────────────────────────────
  const filteredPosts = posts.filter((p) => p.category === activeTab);

  // ── Ações ────────────────────────────────────────────────────────────
  async function handlePost() {
    if (!user) {
      toast.error("Faça login pra postar.");
      return;
    }
    const content = postText.trim().replace(/^❓ Dúvida:\s*/i, "").trim();
    if (!content) {
      toast.error("Escreva algo antes de postar!");
      return;
    }
    setPosting(true);
    try {
      const { error } = await supabase.from("community_posts").insert({
        user_id: user.id,
        content,
        is_question: isQuestion,
        category: activeTab,
      });
      if (error) throw error;
      playCoinSound();
      toast.success("Postagem enviada! +5 XP 🎉");
      setPostText("");
      setIsQuestion(false);
      // Realtime já vai trazer; mas força um refresh imediato pra UX
      loadPosts();
    } catch (err) {
      console.error("[community] handlePost error:", err);
      toast.error("Não consegui publicar. Tenta de novo.");
    } finally {
      setPosting(false);
    }
  }

  async function handleLike(postId: string) {
    if (!user) {
      toast.error("Faça login pra curtir.");
      return;
    }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    playCheckSound();

    // Otimista: atualiza local imediatamente
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, isLiked: !p.isLiked, likeCount: p.likeCount + (p.isLiked ? -1 : 1) }
          : p,
      ),
    );

    try {
      if (post.isLiked) {
        await supabase
          .from("community_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
      } else {
        await supabase.from("community_likes").insert({
          post_id: postId,
          user_id: user.id,
        });
      }
    } catch (err) {
      console.error("[community] handleLike error:", err);
      // Reverte otimismo se falhar
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, isLiked: post.isLiked, likeCount: post.likeCount }
            : p,
        ),
      );
      toast.error("Erro ao curtir.");
    }
  }

  async function handleSave(postId: string) {
    if (!user) {
      toast.error("Faça login pra salvar.");
      return;
    }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    playCheckSound();

    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, isSaved: !p.isSaved } : p)),
    );

    try {
      if (post.isSaved) {
        await supabase
          .from("community_saves")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
        toast("Removido dos salvos");
      } else {
        await supabase
          .from("community_saves")
          .insert({ post_id: postId, user_id: user.id });
        toast.success("Salvo! 🔖");
      }
    } catch (err) {
      console.error("[community] handleSave error:", err);
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, isSaved: post.isSaved } : p)),
      );
      toast.error("Erro ao salvar.");
    }
  }

  function handleStoryClick(name: string) {
    setSelectedStory(name);
    setTimeout(() => setSelectedStory(null), 3000);
  }

  // Avatar inicial do usuário logado pro card de criação
  const myInitial = user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Comunidade</h1>
        <button
          onClick={() => toast("Nenhuma notificação nova", { icon: "🔔" })}
          className="relative p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
        >
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-card"></span>
        </button>
      </div>

      {/* Stories */}
      <div className="flex gap-4 overflow-x-auto pb-4 mb-6 no-scrollbar">
        {STORIES.map((s, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleStoryClick(s.name)}
            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <div className={`p-0.5 rounded-full ${s.online ? "bg-gradient-to-tr from-primary to-blue-300" : "bg-muted"}`}>
              <div className="h-14 w-14 rounded-full border-2 border-card bg-primary/10 flex items-center justify-center">
                {s.icon ? (
                  <span className="material-symbols-outlined text-primary text-2xl">{s.icon}</span>
                ) : (
                  <span className="font-bold text-primary text-lg">{s.name.charAt(0)}</span>
                )}
              </div>
            </div>
            <span className="text-xs font-medium text-muted-foreground">{s.name}</span>
          </motion.button>
        ))}
      </div>

      {/* Story Viewer */}
      <AnimatePresence>
        {selectedStory && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6 mb-6 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-bold text-primary">{selectedStory.charAt(0)}</span>
            </div>
            <p className="font-bold">{selectedStory}</p>
            <p className="text-xs text-muted-foreground mt-1">Nenhum story recente</p>
            <div className="h-1 w-full bg-muted rounded-full mt-4 overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3, ease: "linear" }}
                className="h-full bg-primary rounded-full"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post creation */}
      <div className="bg-card rounded-2xl p-4 md:p-6 border border-border mb-6 shadow-sm">
        <div className="flex gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
            {myInitial}
          </div>
          <div className="flex-1">
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 text-base placeholder:text-muted-foreground resize-none h-16 focus:outline-none"
              placeholder="Compartilhe seu progresso..."
              maxLength={2000}
            />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toast("📸 Upload de fotos em breve!", { icon: "🔜" })}
                  className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">image</span>
                  <span className="text-xs font-medium hidden sm:inline">Foto</span>
                </button>
                <button
                  onClick={() => {
                    setIsQuestion((v) => !v);
                    if (!isQuestion) {
                      toast("Modo dúvida ativado! Sua pergunta será destacada.", { icon: "❓" });
                    }
                  }}
                  className={`flex items-center gap-1 font-bold transition-colors px-2 py-1 rounded-lg ${
                    isQuestion
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-primary bg-primary/5 hover:bg-primary/10"
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">help</span>
                  <span className="text-xs">Dúvida</span>
                </button>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handlePost}
                disabled={posting}
                className="bg-primary text-primary-foreground px-4 py-1.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {posting ? "Enviando…" : "Postar"}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Feed tabs */}
      <div className="flex gap-6 mb-6 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 border-b-2 font-bold text-sm transition-colors ${
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Posts */}
      <div className="flex flex-col gap-6">
        {loading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Carregando posts…
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-10">
            <div className="inline-block p-3 rounded-full bg-primary/10 text-primary mb-3">
              <span className="material-symbols-outlined text-3xl">forum</span>
            </div>
            <h3 className="text-lg font-bold">Sem posts em {TABS.find((t) => t.id === activeTab)?.label}</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Seja a primeira a compartilhar algo aqui!
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredPosts.map((post) => (
              <motion.article
                key={post.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`bg-card rounded-2xl border overflow-hidden shadow-sm ${
                  post.is_question ? "border-2 border-primary/20" : "border-border"
                } relative`}
              >
                {post.is_question && (
                  <div className="absolute top-3 right-4 bg-primary text-primary-foreground text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-md shadow-primary/20">
                    <span className="material-symbols-outlined text-xs">bolt</span> Dúvida
                  </div>
                )}
                <div className="p-4 md:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {post.authorInitial}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">
                          {post.authorName}
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-muted-foreground">
                            Aluna
                          </span>
                        </h4>
                        <p className="text-xs text-muted-foreground">{formatTimeAgo(post.created_at)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toast("Opções: Denunciar, Silenciar", { icon: "⚙️" })}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <span className="material-symbols-outlined">more_horiz</span>
                    </button>
                  </div>

                  {post.is_question ? (
                    <div className="bg-primary/5 rounded-xl p-4 mb-4">
                      <p className="text-sm leading-relaxed font-medium italic">"{post.content}"</p>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed mb-3 whitespace-pre-wrap">{post.content}</p>
                  )}
                </div>

                <div className="px-4 md:px-6 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <motion.button
                        whileTap={{ scale: 1.3 }}
                        onClick={() => handleLike(post.id)}
                        className={`flex items-center gap-1.5 transition-colors ${
                          post.isLiked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
                        }`}
                      >
                        <span className={`material-symbols-outlined text-lg ${post.isLiked ? "filled-icon" : ""}`}>favorite</span>
                        <span className="text-sm font-bold">{post.likeCount}</span>
                      </motion.button>
                      <button
                        onClick={() => toast("💬 Comentários em breve!", { icon: "🔜" })}
                        className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">mode_comment</span>
                        <span className="text-sm font-bold">0</span>
                      </button>
                    </div>
                    <motion.button
                      whileTap={{ scale: 1.3 }}
                      onClick={() => handleSave(post.id)}
                      className={`transition-colors ${
                        post.isSaved ? "text-primary" : "text-muted-foreground hover:text-primary"
                      }`}
                    >
                      <span className={`material-symbols-outlined text-lg ${post.isSaved ? "filled-icon" : ""}`}>bookmark</span>
                    </motion.button>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* End of feed */}
      {!loading && filteredPosts.length > 0 && (
        <div className="mt-10 text-center py-6">
          <div className="inline-block p-3 rounded-full bg-primary/10 text-primary mb-3">
            <span className="material-symbols-outlined text-3xl">check_circle</span>
          </div>
          <h3 className="text-lg font-bold">Você está em dia!</h3>
          <p className="text-muted-foreground text-sm mt-1">Volte mais tarde para novas postagens.</p>
        </div>
      )}
    </div>
  );
}
