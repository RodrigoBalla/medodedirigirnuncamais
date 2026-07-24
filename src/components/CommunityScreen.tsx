import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { playCheckSound, playCoinSound } from "@/lib/sounds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrackMission } from "@/hooks/useTrackMission";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { compressImage } from "@/lib/imageCompress";
import { flyCoins } from "@/lib/coinFly";
import { getSeenStories, markStorySeen, pruneSeenStories } from "@/lib/storiesSeen";

// Recompensa por publicar (post OU story). Limite diário pra não virar
// fábrica de moedas — publicações além do teto continuam valendo, só não pagam.
const COINS_PER_PUBLICATION = 5;
const MAX_PAID_PUBLICATIONS_PER_DAY = 5;

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
  image_url: string | null;
  // Campos derivados (preenchidos depois do fetch):
  authorName: string;
  authorInitial: string;
  likeCount: number;
  isLiked: boolean;
  isSaved: boolean;
};

// Story real (tabela community_stories) — expira 24h depois de postado.
type Story = {
  id: string;
  user_id: string;
  display_name: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
};


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
  const { addCoins } = useUserProgress();
  const { trackProgress } = useTrackMission();
  const [activeTab, setActiveTab] = useState<TabId>("feed");
  const [postText, setPostText] = useState("");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [isQuestion, setIsQuestion] = useState(false);

  // ── Foto do post (comprimida no navegador antes de subir) ────────────
  const feedFileRef = useRef<HTMLInputElement>(null);
  const storyFileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; ext: string; preview: string } | null>(null);
  const [preparing, setPreparing] = useState(false);

  // ── Stories reais ────────────────────────────────────────────────────
  const [stories, setStories] = useState<Story[]>([]);
  // Visualizador: guarda uma CÓPIA da lista no momento do clique (pra reordenação
  // por "visto" não embaralhar o que está sendo visto) + o índice atual.
  const [viewer, setViewer] = useState<{ list: Story[]; index: number } | null>(null);
  // Ids dos stories já vistos (localStorage) — controla o anel colorido.
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  // ── Auto-track de tempo na comunidade (community_read_time) ──────────
  // Soma segundos enquanto o user está com a aba ativa. Reporta a cada
  // 60s pra evitar muito chatter, e pausa quando aba perde foco.
  const readSecondsRef = useRef(0);
  useEffect(() => {
    let interval: number | null = null;
    let isVisible = !document.hidden;

    function tick() {
      if (!isVisible) return;
      readSecondsRef.current += 1;
      if (readSecondsRef.current >= 60) {
        const toReport = readSecondsRef.current;
        readSecondsRef.current = 0;
        trackProgress("community_read_time", toReport);
      }
    }
    function onVis() { isVisible = !document.hidden; }
    document.addEventListener("visibilitychange", onVis);
    interval = window.setInterval(tick, 1000);
    return () => {
      if (interval) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
      // Flush ao sair: reporta o restante pra não perder
      if (readSecondsRef.current > 0) {
        trackProgress("community_read_time", readSecondsRef.current);
        readSecondsRef.current = 0;
      }
    };
  }, [trackProgress]);

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
          image_url: (p as { image_url?: string | null }).image_url ?? null,
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

  // ── Stories: carrega os ativos (RPC já traz o nome da autora) ────────
  async function loadStories() {
    try {
      const { data, error } = await supabase.rpc("list_active_stories");
      if (error) throw error;
      setStories((data ?? []) as Story[]);
    } catch (err) {
      console.warn("[community] loadStories:", err);
    }
  }
  useEffect(() => {
    if (!user) return;
    loadStories();
    const t = window.setInterval(loadStories, 120000); // revalida a cada 2min
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Carrega as "vistas" e poda os ids de stories que já expiraram
  useEffect(() => {
    if (!user) return;
    setSeenIds(stories.length > 0 ? pruneSeenStories(user.id, stories.map((s) => s.id)) : getSeenStories(user.id));
  }, [user?.id, stories]);

  // Ao abrir/avançar no visualizador, marca aquele story como visto
  useEffect(() => {
    if (!viewer || !user) return;
    const atual = viewer.list[viewer.index];
    if (atual) setSeenIds(markStorySeen(user.id, atual.id));
  }, [viewer, user?.id]);

  // TODOS os stories, um por bolinha (se a mesma aluna postou 3, aparecem 3).
  // Ordem: não vistos primeiro (anel colorido), depois os já vistos; dentro de
  // cada bloco, do mais recente pro mais antigo.
  const orderedStories: (Story & { unseen: boolean })[] = stories
    .map((s) => ({ ...s, unseen: !seenIds.has(s.id) }))
    .sort((a, b) => {
      if (a.unseen !== b.unseen) return a.unseen ? -1 : 1;
      return +new Date(b.created_at) - +new Date(a.created_at);
    });

  // ── Foto do feed: comprime na hora que escolhe e mostra preview ───────
  async function onPickFeedPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    setPreparing(true);
    try {
      const { blob, ext } = await compressImage(file);
      if (photo?.preview) URL.revokeObjectURL(photo.preview);
      setPhoto({ blob, ext, preview: URL.createObjectURL(blob) });
    } catch (err) {
      console.error("[community] compress:", err);
      toast.error(err instanceof Error ? err.message : "Não consegui preparar essa foto.");
    } finally {
      setPreparing(false);
    }
  }

  function clearPhoto() {
    if (photo?.preview) URL.revokeObjectURL(photo.preview);
    setPhoto(null);
  }

  /** Sobe pro bucket 'community' na pasta da própria aluna e devolve url+path. */
  async function uploadToCommunity(blob: Blob, ext: string, folder: "feed" | "stories") {
    if (!user) throw new Error("sem sessão");
    const path = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("community")
      .upload(path, blob, { contentType: blob.type, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("community").getPublicUrl(path);
    return { url: data.publicUrl, path };
  }

  // ── Publicar um story (expira em 24h pelo default da tabela) ─────────
  async function onPickStoryPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setPreparing(true);
    const t = toast.loading("Publicando seu story…");
    try {
      const { blob, ext } = await compressImage(file, { maxSize: 1280 });
      const { url, path } = await uploadToCommunity(blob, ext, "stories");
      const { error } = await supabase.from("community_stories").insert({
        user_id: user.id,
        image_url: url,
        storage_path: path,
      });
      if (error) throw error;
      playCoinSound();
      rewardPublication(storyFileRef.current?.parentElement ?? null);
      toast.success("Story publicado! Some em 24h ⏳", { id: t });
      loadStories();
    } catch (err) {
      console.error("[community] story:", err);
      toast.error("Não consegui publicar o story.", { id: t });
    } finally {
      setPreparing(false);
    }
  }

  // ── Recompensa por publicar: +5 moedas (até 5 publicações pagas/dia) ──
  function publicationsTodayByMe(): number {
    if (!user) return 0;
    const hoje = new Date().toLocaleDateString("pt-BR");
    const meus = posts.filter(
      (p) => p.user_id === user.id && new Date(p.created_at).toLocaleDateString("pt-BR") === hoje,
    ).length;
    const meusStories = stories.filter(
      (s) => s.user_id === user.id && new Date(s.created_at).toLocaleDateString("pt-BR") === hoje,
    ).length;
    return meus + meusStories;
  }

  function rewardPublication(originEl?: HTMLElement | null) {
    // `publicationsTodayByMe` ainda não conta a que acabou de ser criada
    if (publicationsTodayByMe() >= MAX_PAID_PUBLICATIONS_PER_DAY) return;
    flyCoins({
      fromEl: originEl ?? null,
      count: 10,
      label: `+${COINS_PER_PUBLICATION}`,
      onDone: () => void addCoins(COINS_PER_PUBLICATION),
    });
  }

  // ── Filtro por tab ───────────────────────────────────────────────────
  const filteredPosts = posts.filter((p) => p.category === activeTab);

  // ── Ações ────────────────────────────────────────────────────────────
  async function handlePost() {
    if (!user) {
      toast.error("Faça login pra postar.");
      return;
    }
    const content = postText.trim().replace(/^❓ Dúvida:\s*/i, "").trim();
    if (!content && !photo) {
      toast.error("Escreva algo ou escolha uma foto!");
      return;
    }
    setPosting(true);
    try {
      // Sobe a foto (se tiver) antes de criar o post
      let imageUrl: string | null = null;
      let imagePath: string | null = null;
      if (photo) {
        const up = await uploadToCommunity(photo.blob, photo.ext, "feed");
        imageUrl = up.url;
        imagePath = up.path;
      }
      const { error } = await supabase.from("community_posts").insert({
        user_id: user.id,
        content,
        is_question: isQuestion,
        category: activeTab,
        image_url: imageUrl,
        image_path: imagePath,
      });
      if (error) throw error;
      clearPhoto();
      playCoinSound();
      rewardPublication(document.getElementById("btn-postar"));
      // Auto-track missões de post na comunidade (intro/win/fear/tip/etc.)
      trackProgress("community_post", 1);
      // Bônus: post de manhã (antes das 9h) — missão "morning_post"
      const hour = new Date().getHours();
      if (hour < 9) trackProgress("community_morning_post", 1);
      toast.success("Postagem enviada! +5 moedas 🪙");
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
        // Auto-track missões de like (first_like, like_5, like_10)
        trackProgress("community_like", 1);
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

  // Avatar inicial do usuário logado pro card de criação
  const myInitial = user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-end justify-between mb-5 gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-0.5">
            🚗 Você não está sozinha
          </p>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Comunidade</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Compartilhe suas vitórias, tire dúvidas e acompanhe quem está no mesmo caminho.
          </p>
        </div>
        <button
          onClick={() => toast("Nenhuma notificação nova", { icon: "🔔" })}
          className="relative p-2 shrink-0 text-muted-foreground hover:bg-muted rounded-full transition-colors"
        >
          <span className="material-symbols-outlined">notifications</span>
        </button>
      </div>

      {/* Stories reais (expiram em 24h) — em card, com título */}
      <input ref={storyFileRef} type="file" accept="image/*" className="hidden" onChange={onPickStoryPhoto} />
      <div className="bg-card border border-border rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            📸 Stories da turma
          </p>
          <span className="text-[10px] font-bold text-muted-foreground/70 bg-muted px-2 py-0.5 rounded-full">
            somem em 24h
          </span>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
        {/* Seu story: abre a câmera/galeria */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => storyFileRef.current?.click()}
          disabled={preparing}
          className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60"
        >
          <div className="p-0.5 rounded-full bg-muted relative">
            <div className="h-14 w-14 rounded-full border-2 border-card bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">add_a_photo</span>
            </div>
          </div>
          <span className="text-xs font-medium text-muted-foreground">Seu story</span>
        </motion.button>

          {orderedStories.map((s, i) => (
            <motion.button
              key={s.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => setViewer({ list: orderedStories, index: i })}
              className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <div
                className={`p-0.5 rounded-full transition-colors ${
                  s.unseen ? "bg-gradient-to-tr from-primary via-amber-400 to-blue-300" : "bg-muted"
                }`}
              >
                <div className="h-14 w-14 rounded-full border-2 border-card overflow-hidden bg-primary/10 flex items-center justify-center">
                  <img
                    src={s.image_url}
                    alt=""
                    loading="lazy"
                    className={`h-full w-full object-cover transition-opacity ${s.unseen ? "" : "opacity-70"}`}
                  />
                </div>
              </div>
              <span className={`text-xs max-w-[64px] truncate ${s.unseen ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>
                {s.user_id === user?.id ? "Você" : s.display_name.split(" ")[0]}
              </span>
            </motion.button>
          ))}

          {orderedStories.length === 0 && (
            <div className="flex items-center text-xs text-muted-foreground italic pl-1">
              Nenhum story ainda — seja a primeira!
            </div>
          )}
        </div>
      </div>

      {/* Story Viewer — tela cheia, avança sozinho a cada 5s */}
      <AnimatePresence>
        {viewer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 md:p-6"
            onClick={() => setViewer(null)}
          >
            {/* Fechar (canto da tela) */}
            <button
              onClick={() => setViewer(null)}
              className="absolute top-4 right-4 z-10 size-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              aria-label="Fechar"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {/* Card no formato de story (9:16), centralizado */}
            <div
              className="relative w-full max-w-[400px] h-full max-h-[85vh] bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={viewer.list[viewer.index].image_url}
                alt=""
                className="w-full h-full object-contain"
              />

              {/* Gradiente pro texto do topo ficar legível sobre a foto */}
              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

              {/* Barrinha de progresso do story atual (avança pro próximo ao fim) */}
              <div className="absolute top-0 inset-x-0 flex gap-1 p-3">
                <div className="h-0.5 flex-1 bg-white/30 rounded-full overflow-hidden">
                  <motion.div
                    key={viewer.list[viewer.index].id}
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 5, ease: "linear" }}
                    onAnimationComplete={() =>
                      setViewer((v) => {
                        if (!v) return v;
                        return v.index + 1 < v.list.length ? { ...v, index: v.index + 1 } : null;
                      })
                    }
                    className="h-full bg-white"
                  />
                </div>
                <span className="text-white/70 text-[10px] font-bold tabular-nums shrink-0 -mt-1">
                  {viewer.index + 1}/{viewer.list.length}
                </span>
              </div>

              {/* Autora do story atual */}
              <div className="absolute top-6 inset-x-0 flex items-center gap-2.5 px-4">
                <div className="h-8 w-8 rounded-full bg-primary/30 border border-white/30 flex items-center justify-center text-white font-bold text-xs">
                  {viewer.list[viewer.index].display_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm truncate drop-shadow">
                    {viewer.list[viewer.index].user_id === user?.id ? "Você" : viewer.list[viewer.index].display_name}
                  </p>
                  <p className="text-white/70 text-[11px] drop-shadow">
                    {formatTimeAgo(viewer.list[viewer.index].created_at)}
                  </p>
                </div>
              </div>

              {/* Zonas de toque: voltar / avançar */}
              <button
                aria-label="Anterior"
                className="absolute left-0 top-16 bottom-0 w-1/3"
                onClick={() => setViewer((v) => (v && v.index > 0 ? { ...v, index: v.index - 1 } : v))}
              />
              <button
                aria-label="Próximo"
                className="absolute right-0 top-16 bottom-0 w-1/3"
                onClick={() =>
                  setViewer((v) => {
                    if (!v) return v;
                    return v.index + 1 < v.list.length ? { ...v, index: v.index + 1 } : null;
                  })
                }
              />

              {viewer.list[viewer.index].caption && (
                <p className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent text-white text-center text-sm px-6 pt-10 pb-6">
                  {viewer.list[viewer.index].caption}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Layout 2 colunas no desktop: feed + painel lateral */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
        <div className="min-w-0">

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

            {/* Preview da foto escolhida (já comprimida) */}
            {photo && (
              <div className="relative mt-2 rounded-xl overflow-hidden border border-border">
                <img src={photo.preview} alt="Prévia" className="w-full max-h-72 object-cover" />
                <button
                  onClick={clearPhoto}
                  className="absolute top-2 right-2 size-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                  aria-label="Remover foto"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            )}

            <input ref={feedFileRef} type="file" accept="image/*" className="hidden" onChange={onPickFeedPhoto} />

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => feedFileRef.current?.click()}
                  disabled={preparing}
                  className={`flex items-center gap-1 transition-colors disabled:opacity-60 ${
                    photo ? "text-primary" : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{preparing ? "hourglass_top" : "image"}</span>
                  <span className="text-xs font-medium hidden sm:inline">{preparing ? "Preparando…" : "Foto"}</span>
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
                id="btn-postar"
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
          <div className="text-center py-12 px-6 bg-card border border-dashed border-border rounded-2xl">
            <div className="inline-block p-4 rounded-full bg-primary/10 text-primary mb-4">
              <span className="material-symbols-outlined text-4xl">forum</span>
            </div>
            <h3 className="text-lg font-black">Sem posts em {TABS.find((t) => t.id === activeTab)?.label}</h3>
            <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto leading-snug">
              Seja a primeira a compartilhar! Pode ser a vitória de hoje, um medo que passou
              ou uma dúvida — tem alguém aqui passando pelo mesmo. 💛
            </p>
            <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
              <button
                onClick={() => storyFileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-black uppercase text-[11px] tracking-widest hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-base">add_a_photo</span>
                Postar um story
              </button>
              <button
                onClick={() => feedFileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-foreground font-black uppercase text-[11px] tracking-widest hover:border-primary/60 transition-colors"
              >
                <span className="material-symbols-outlined text-base">image</span>
                Compartilhar foto
              </button>
            </div>
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
                    post.content && <p className="text-sm leading-relaxed mb-3 whitespace-pre-wrap">{post.content}</p>
                  )}

                  {/* Foto do post */}
                  {post.image_url && (
                    <div className="-mx-4 md:-mx-6 mt-1">
                      <img
                        src={post.image_url}
                        alt="Foto da postagem"
                        loading="lazy"
                        className="w-full max-h-[520px] object-cover bg-muted"
                      />
                    </div>
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

        {/* ── Painel lateral (desktop) ─────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col gap-4 sticky top-20">
          {/* Como funciona */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-black text-sm mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg filled-icon">lightbulb</span>
              Como funciona
            </h3>
            <ul className="space-y-3 text-xs text-muted-foreground leading-snug">
              <li className="flex gap-2.5">
                <span className="material-symbols-outlined text-sm text-primary shrink-0 mt-0.5">edit</span>
                <span><b className="text-foreground">Poste sua vitória</b> — mesmo a pequena. Dirigiu até a padaria? Conta pra gente.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="material-symbols-outlined text-sm text-primary shrink-0 mt-0.5">help</span>
                <span><b className="text-foreground">Marque "Dúvida"</b> e sua pergunta ganha destaque pra ser respondida.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="material-symbols-outlined text-sm text-primary shrink-0 mt-0.5">photo_camera</span>
                <span><b className="text-foreground">Stories somem em 24h</b> — perfeito pro registro do dia sem compromisso.</span>
              </li>
            </ul>
          </div>

          {/* Combinados da turma */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-black text-sm mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg filled-icon">volunteer_activism</span>
              Combinados da turma
            </h3>
            <ul className="space-y-2 text-xs text-muted-foreground leading-snug">
              <li className="flex gap-2"><span className="text-[hsl(var(--success))]">✓</span> Aqui ninguém julga medo de dirigir.</li>
              <li className="flex gap-2"><span className="text-[hsl(var(--success))]">✓</span> Toda vitória conta — celebre a das colegas.</li>
              <li className="flex gap-2"><span className="text-[hsl(var(--success))]">✓</span> Dúvida "boba" não existe. Pergunte.</li>
              <li className="flex gap-2"><span className="text-destructive">✕</span> Sem vendas, spam ou link de fora.</li>
            </ul>
          </div>

          {/* Pulso da comunidade (dados reais do que está carregado) */}
          <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-2xl p-5">
            <h3 className="font-black text-sm mb-3">🔥 Pulso da comunidade</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xl font-black text-primary tabular-nums">{posts.length}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Posts</p>
              </div>
              <div>
                <p className="text-xl font-black text-primary tabular-nums">{orderedStories.length}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Stories ativos</p>
              </div>
            </div>
            <button
              onClick={() => storyFileRef.current?.click()}
              className="mt-4 w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-black uppercase text-[11px] tracking-widest hover:opacity-90 transition-opacity"
            >
              Postar um story 📸
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
