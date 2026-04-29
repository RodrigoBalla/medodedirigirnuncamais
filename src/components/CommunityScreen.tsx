import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { playCheckSound, playCoinSound } from "@/lib/sounds";

const MOCK_POSTS = [
  {
    id: 1,
    author: "Karla Margaretch",
    initial: "K",
    role: "Mentora",
    roleColor: "bg-primary/10 text-primary",
    time: "Há 2 horas",
    content: "Ótima sessão de baliza hoje! Lembre-se: respire fundo e use os pontos de referência que treinamos. Você está no controle! 🚗✨",
    likes: 128,
    comments: 24,
    tab: "feed",
  },
  {
    id: 2,
    author: "Sarah P.",
    initial: "S",
    role: "Aluna",
    roleColor: "bg-muted text-muted-foreground",
    time: "Há 4 horas",
    content: "Meninas, ainda tenho muita dúvida sobre a preferência em rotatórias. Quem já está dentro sempre tem a preferência? 🤔",
    isDuvida: true,
    reply: {
      author: "Coach Anna",
      initial: "A",
      content: "Isso mesmo! A preferência é de quem já circula pela rotatória. Na dúvida, reduza e espere a passagem.",
      time: "Há 1h",
    },
    likes: 85,
    comments: 12,
    tab: "feed",
  },
  {
    id: 3,
    author: "Coach Anna",
    initial: "A",
    role: "Mentora",
    roleColor: "bg-primary/10 text-primary",
    time: "Amanhã, 19h",
    content: "📹 Mentoria ao vivo: 'Como vencer o medo da primeira vez na rodovia'. Vagas limitadas!",
    likes: 256,
    comments: 48,
    tab: "mentorias",
  },
  {
    id: 4,
    author: "Karla Margaretch",
    initial: "K",
    role: "Mentora",
    roleColor: "bg-primary/10 text-primary",
    time: "Há 1 dia",
    content: "💡 Dica rápida: Antes de entrar no carro, ajuste todos os espelhos. 90% dos alunos esquecem o retrovisor interno!",
    likes: 342,
    comments: 67,
    tab: "dicas",
  },
  {
    id: 5,
    author: "Coach Anna",
    initial: "A",
    role: "Mentora",
    roleColor: "bg-primary/10 text-primary",
    time: "Há 3 dias",
    content: "💡 Na subida com embreagem: o segredo é encontrar o ponto de arrancada (o carro treme levemente). Solte o freio de mão SÓ depois de sentir isso.",
    likes: 189,
    comments: 33,
    tab: "dicas",
  },
];

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
];

export function CommunityScreen() {
  const [activeTab, setActiveTab] = useState("feed");
  const [postText, setPostText] = useState("");
  const [likedPosts, setLikedPosts] = useState<number[]>([]);
  const [savedPosts, setSavedPosts] = useState<number[]>([]);
  const [selectedStory, setSelectedStory] = useState<string | null>(null);

  const filteredPosts = activeTab === "feed"
    ? MOCK_POSTS.filter(p => p.tab === "feed")
    : MOCK_POSTS.filter(p => p.tab === activeTab);

  const handleLike = (postId: number) => {
    playCheckSound();
    if (likedPosts.includes(postId)) {
      setLikedPosts(prev => prev.filter(id => id !== postId));
    } else {
      setLikedPosts(prev => [...prev, postId]);
    }
  };

  const handleSave = (postId: number) => {
    playCheckSound();
    if (savedPosts.includes(postId)) {
      setSavedPosts(prev => prev.filter(id => id !== postId));
      toast("Removido dos salvos");
    } else {
      setSavedPosts(prev => [...prev, postId]);
      toast.success("Salvo! 🔖");
    }
  };

  const handlePost = () => {
    if (!postText.trim()) {
      toast.error("Escreva algo antes de postar!");
      return;
    }
    playCoinSound();
    toast.success("Postagem enviada! +5 XP 🎉");
    setPostText("");
  };

  const handleStoryClick = (name: string) => {
    setSelectedStory(name);
    setTimeout(() => setSelectedStory(null), 3000);
  };

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
            V
          </div>
          <div className="flex-1">
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 text-base placeholder:text-muted-foreground resize-none h-16 focus:outline-none"
              placeholder="Compartilhe seu progresso..."
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
                    setPostText(prev => prev ? prev : "❓ Dúvida: ");
                    toast("Modo dúvida ativado! Sua pergunta será destacada.", { icon: "❓" });
                  }}
                  className="flex items-center gap-1 text-primary font-bold hover:bg-primary/10 transition-colors bg-primary/5 px-2 py-1 rounded-lg"
                >
                  <span className="material-symbols-outlined text-lg">help</span>
                  <span className="text-xs">Dúvida</span>
                </button>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handlePost}
                className="bg-primary text-primary-foreground px-4 py-1.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
              >
                Postar
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Feed tabs */}
      <div className="flex gap-6 mb-6 border-b border-border">
        {TABS.map(tab => (
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
        <AnimatePresence mode="wait">
          {filteredPosts.map((post) => {
            const isLiked = likedPosts.includes(post.id);
            const isSaved = savedPosts.includes(post.id);
            return (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`bg-card rounded-2xl border overflow-hidden shadow-sm ${
                  post.isDuvida ? "border-2 border-primary/20" : "border-border"
                } relative`}
              >
                {post.isDuvida && (
                  <div className="absolute top-3 right-4 bg-primary text-primary-foreground text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-md shadow-primary/20">
                    <span className="material-symbols-outlined text-xs">bolt</span> Dúvida
                  </div>
                )}
                <div className="p-4 md:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {post.initial}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">
                          {post.author}
                          <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${post.roleColor}`}>
                            {post.role}
                          </span>
                        </h4>
                        <p className="text-xs text-muted-foreground">{post.time}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toast("Opções: Denunciar, Silenciar", { icon: "⚙️" })}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <span className="material-symbols-outlined">more_horiz</span>
                    </button>
                  </div>

                  {post.isDuvida ? (
                    <div className="bg-primary/5 rounded-xl p-4 mb-4">
                      <p className="text-sm leading-relaxed font-medium italic">"{post.content}"</p>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed mb-3">{post.content}</p>
                  )}

                  {/* Coach reply */}
                  {post.reply && (
                    <div className="flex items-start gap-3 pl-3 border-l-2 border-primary/20 mb-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {post.reply.initial}
                      </div>
                      <div className="flex-1">
                        <div className="bg-muted rounded-xl p-3">
                          <p className="text-xs font-bold text-primary mb-1">
                            {post.reply.author}
                            <span className="text-muted-foreground font-normal ml-2">{post.reply.time}</span>
                          </p>
                          <p className="text-sm text-muted-foreground">{post.reply.content}</p>
                        </div>
                      </div>
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
                          isLiked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
                        }`}
                      >
                        <span className={`material-symbols-outlined text-lg ${isLiked ? "filled-icon" : ""}`}>favorite</span>
                        <span className="text-sm font-bold">{post.likes + (isLiked ? 1 : 0)}</span>
                      </motion.button>
                      <button
                        onClick={() => toast("💬 Comentários em breve!", { icon: "🔜" })}
                        className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">mode_comment</span>
                        <span className="text-sm font-bold">{post.comments}</span>
                      </button>
                    </div>
                    <motion.button
                      whileTap={{ scale: 1.3 }}
                      onClick={() => handleSave(post.id)}
                      className={`transition-colors ${
                        isSaved ? "text-primary" : "text-muted-foreground hover:text-primary"
                      }`}
                    >
                      <span className={`material-symbols-outlined text-lg ${isSaved ? "filled-icon" : ""}`}>bookmark</span>
                    </motion.button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>

      {/* End of feed */}
      <div className="mt-10 text-center py-6">
        <div className="inline-block p-3 rounded-full bg-primary/10 text-primary mb-3">
          <span className="material-symbols-outlined text-3xl">check_circle</span>
        </div>
        <h3 className="text-lg font-bold">Você está em dia!</h3>
        <p className="text-muted-foreground text-sm mt-1">Volte mais tarde para novas postagens.</p>
      </div>
    </div>
  );
}
