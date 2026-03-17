export function CommunityScreen() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Comunidade</h1>
        <button className="relative p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-card"></span>
        </button>
      </div>

      {/* Stories */}
      <div className="flex gap-4 overflow-x-auto pb-4 mb-6 no-scrollbar">
        {[
          { name: "Karla M.", online: true },
          { name: "Sarah P.", online: false },
          { name: "Coach Anna", online: true },
          { name: "Regras", online: false, icon: "menu_book" },
          { name: "Eventos", online: false, icon: "event" },
        ].map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
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
          </div>
        ))}
      </div>

      {/* Post creation */}
      <div className="bg-card rounded-2xl p-4 md:p-6 border border-border mb-6 shadow-sm">
        <div className="flex gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
            V
          </div>
          <div className="flex-1">
            <textarea
              className="w-full bg-transparent border-none focus:ring-0 text-base placeholder:text-muted-foreground resize-none h-16"
              placeholder="Compartilhe seu progresso..."
            />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-lg">image</span>
                  <span className="text-xs font-medium hidden sm:inline">Foto</span>
                </button>
                <button className="flex items-center gap-1 text-primary font-bold hover:bg-primary/10 transition-colors bg-primary/5 px-2 py-1 rounded-lg">
                  <span className="material-symbols-outlined text-lg">help</span>
                  <span className="text-xs">Dúvida</span>
                </button>
              </div>
              <button className="bg-primary text-primary-foreground px-4 py-1.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all">
                Postar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feed tabs */}
      <div className="flex gap-6 mb-6 border-b border-border">
        <button className="pb-3 border-b-2 border-primary font-bold text-sm transition-colors">Para Você</button>
        <button className="pb-3 border-b-2 border-transparent text-muted-foreground font-medium text-sm hover:text-primary transition-colors">Mentorias</button>
        <button className="pb-3 border-b-2 border-transparent text-muted-foreground font-medium text-sm hover:text-primary transition-colors">Dicas</button>
      </div>

      {/* Posts */}
      <div className="flex flex-col gap-6">
        {/* Post 1 */}
        <article className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">K</div>
                <div>
                  <h4 className="font-bold text-sm">
                    Karla Margaretch
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase">Mentora</span>
                  </h4>
                  <p className="text-xs text-muted-foreground">Há 2 horas</p>
                </div>
              </div>
              <button className="text-muted-foreground hover:text-foreground">
                <span className="material-symbols-outlined">more_horiz</span>
              </button>
            </div>
            <p className="text-sm leading-relaxed mb-3">
              Ótima sessão de baliza hoje! Lembre-se: respire fundo e use os pontos de referência que treinamos. Você está no controle! 🚗✨
            </p>
          </div>
          <div className="p-4 md:p-6 pt-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <button className="flex items-center gap-1.5 text-muted-foreground hover:text-red-500 transition-colors">
                  <span className="material-symbols-outlined text-lg">favorite</span>
                  <span className="text-sm font-bold">128</span>
                </button>
                <button className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-lg">mode_comment</span>
                  <span className="text-sm font-bold">24</span>
                </button>
              </div>
              <button className="text-muted-foreground hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-lg">bookmark</span>
              </button>
            </div>
          </div>
        </article>

        {/* Post 2 - Help Request */}
        <article className="bg-card rounded-2xl border-2 border-primary/20 overflow-hidden relative shadow-sm">
          <div className="absolute top-3 right-4 bg-primary text-primary-foreground text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-md shadow-primary/20">
            <span className="material-symbols-outlined text-xs">bolt</span> Dúvida
          </div>
          <div className="p-4 md:p-6">
            <div className="flex items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center font-bold text-accent-foreground">S</div>
                <div>
                  <h4 className="font-bold text-sm">
                    Sarah P.
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground uppercase">Aluna</span>
                  </h4>
                  <p className="text-xs text-muted-foreground">Há 4 horas</p>
                </div>
              </div>
            </div>
            <div className="bg-primary/5 rounded-xl p-4 mb-4">
              <p className="text-sm leading-relaxed font-medium italic">
                "Meninas, ainda tenho muita dúvida sobre a preferência em rotatórias. Quem já está dentro sempre tem a preferência? 🤔"
              </p>
            </div>
            {/* Coach response */}
            <div className="flex items-start gap-3 pl-3 border-l-2 border-primary/20">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">A</div>
              <div className="flex-1">
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-xs font-bold text-primary mb-1">Coach Anna <span className="text-muted-foreground font-normal ml-2">Há 1h</span></p>
                  <p className="text-sm text-muted-foreground">Isso mesmo! A preferência é de quem já circula pela rotatória. Na dúvida, reduza e espere a passagem.</p>
                </div>
              </div>
            </div>
          </div>
        </article>
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
