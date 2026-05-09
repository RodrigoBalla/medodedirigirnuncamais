import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Cache do JWT do Panda Watermark — evita pedir um novo a cada aula
// (o token vale 24h, então uma vez por sessão é suficiente).
let _pandaWatermarkPromise: Promise<string | null> | null = null;
let _pandaWatermarkExpiresAt = 0;

async function getPandaWatermarkJWT(): Promise<string | null> {
  // Reusa o promise existente se ainda estiver vivo
  if (_pandaWatermarkPromise && Date.now() < _pandaWatermarkExpiresAt) {
    return _pandaWatermarkPromise;
  }
  _pandaWatermarkExpiresAt = Date.now() + 23 * 60 * 60 * 1000; // 23h cache
  _pandaWatermarkPromise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("panda-jwt", {
        method: "GET",
      });
      if (error) {
        console.warn("[panda-jwt] erro:", error.message);
        return null;
      }
      return (data as { token?: string })?.token || null;
    } catch (e) {
      console.warn("[panda-jwt] fetch falhou:", e);
      return null;
    }
  })();
  return _pandaWatermarkPromise;
}

// =============================================================================
// VideoPlayer — abstrai 3 fontes (YouTube, Vimeo, nativo MP4) atrás de uma
// API única com callbacks de progresso (a cada N segundos), conclusão e
// retomada de posição. Usado no CoursePlayerScreen.
//
// YouTube: usa o IFrame Player API (script remoto carregado uma vez)
// Vimeo:   usa o Vimeo Player API (script remoto carregado uma vez)
// Native:  usa <video> HTML5 com eventos timeupdate/ended/loadedmetadata
// =============================================================================

export type VideoEmbed =
  | { kind: "youtube"; videoId: string }
  | { kind: "vimeo"; videoId: string }
  | { kind: "panda"; videoId: string; pullzone: string }
  | { kind: "native"; src: string };

interface VideoPlayerProps {
  embed: VideoEmbed | null;
  /** Posição inicial em segundos (resume) */
  startAt?: number;
  /** Callback chamado periodicamente (~5s) com posição atual e duração */
  onProgress?: (currentSeconds: number, durationSeconds: number) => void;
  /** Disparado quando o vídeo chega ao fim */
  onEnded?: () => void;
  /** Disparado quando duração for conhecida (pra salvar no banco) */
  onDurationChange?: (durationSeconds: number) => void;
  /** Email/identificador do aluno — usado pra marca d'água anti-pirataria
   *  no Panda Video (parâmetros watermark/customParam.). */
  viewerId?: string;
  className?: string;
}

// ─── helpers pra detectar URL e extrair videoId ──────────────────────────────
export function parseVideoUrl(url: string | null | undefined): VideoEmbed | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return { kind: "youtube", videoId: yt[1] };
  const vimeo = url.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/);
  if (vimeo) return { kind: "vimeo", videoId: vimeo[1] };
  // Panda Video: https://player-vz-<pullzone>.tv.pandavideo.com.br/embed/?v=<UUID>
  // Pullzone tem múltiplos hífens (ex: vz-438412f4-a64), então usa [a-z0-9-]+
  const panda = url.match(/player-(vz-[a-z0-9-]+)\.tv\.pandavideo\.com\.br\/embed\/\?v=([0-9a-f-]{36})/i);
  if (panda) return { kind: "panda", pullzone: panda[1], videoId: panda[2] };
  return { kind: "native", src: url };
}

// ─── carregamento lazy dos SDKs externos ─────────────────────────────────────
let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  // @ts-expect-error YT é injetado globalmente
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.body.appendChild(script);
    // @ts-expect-error API global
    const previous = window.onYouTubeIframeAPIReady;
    // @ts-expect-error API global
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
  });
  return ytApiPromise;
}

let pandaApiPromise: Promise<void> | null = null;
function loadPandaApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  // @ts-expect-error PandaPlayer global
  if (window.PandaPlayer) return Promise.resolve();
  if (pandaApiPromise) return pandaApiPromise;
  pandaApiPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://player.pandavideo.com.br/api.js";
    script.async = true;
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
  return pandaApiPromise;
}

let vimeoApiPromise: Promise<void> | null = null;
function loadVimeoApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  // @ts-expect-error Vimeo global
  if (window.Vimeo?.Player) return Promise.resolve();
  if (vimeoApiPromise) return vimeoApiPromise;
  vimeoApiPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://player.vimeo.com/api/player.js";
    script.async = true;
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
  return vimeoApiPromise;
}

// ─── componente principal ────────────────────────────────────────────────────
export function VideoPlayer({
  embed,
  startAt = 0,
  onProgress,
  onEnded,
  onDurationChange,
  viewerId,
  className,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const progressInterval = useRef<number | null>(null);
  const [iframeReady, setIframeReady] = useState(false);

  // Reset player quando o embed muda (nova aula)
  useEffect(() => {
    if (!embed) return;

    let cancelled = false;
    const cleanup: Array<() => void> = [];

    async function setup() {
      const container = containerRef.current;
      if (!container) return;

      // Limpa player anterior, se existir
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = null;
      container.innerHTML = "";

      if (embed.kind === "youtube") {
        await loadYouTubeApi();
        if (cancelled) return;
        const div = document.createElement("div");
        div.id = `yt-player-${embed.videoId}-${Date.now()}`;
        // Wrapper que aplica o "crop" via scale — expande o iframe pra fora
        // do container; o overflow:hidden do container come o topo (título,
        // canal, logo do YouTube) sem precisar de tarjas pretas.
        // transform-origin: center bottom mantém o BOTTOM (controles) visível.
        const wrap = document.createElement("div");
        wrap.className = "yt-clean-wrapper";
        wrap.appendChild(div);
        container.appendChild(wrap);
        // @ts-expect-error YT API
        const YT = window.YT;
        playerRef.current = new YT.Player(div.id, {
          width: "100%",
          height: "100%",
          videoId: embed.videoId,
          playerVars: {
            autoplay: 1,
            rel: 0,                 // remove "videos relacionados" no fim
            modestbranding: 1,      // tenta esconder logo (parcial)
            playsinline: 1,         // play inline em mobile
            iv_load_policy: 3,      // remove annotations
            cc_load_policy: 0,      // remove closed captions automáticas
            fs: 1,                  // permite fullscreen
            disablekb: 0,
            color: "white",         // barra de progresso branca (não vermelha)
            start: Math.floor(startAt) || 0,
          },
          events: {
            onReady: (e: any) => {
              setIframeReady(true);
              if (startAt > 0) {
                try { e.target.seekTo(startAt, true); } catch {}
              }
              const dur = e.target.getDuration?.() ?? 0;
              if (dur > 0) onDurationChange?.(dur);
            },
            onStateChange: (e: any) => {
              if (e.data === YT.PlayerState.ENDED) onEnded?.();
            },
          },
        });

        // Tracking via polling — YouTube IFrame não emite timeupdate
        progressInterval.current = window.setInterval(() => {
          try {
            const t = playerRef.current?.getCurrentTime?.() ?? 0;
            const d = playerRef.current?.getDuration?.() ?? 0;
            if (t > 0 && d > 0) onProgress?.(t, d);
          } catch {}
        }, 5000);
        cleanup.push(() => {
          if (progressInterval.current) clearInterval(progressInterval.current);
        });
        return;
      }

      if (embed.kind === "vimeo") {
        await loadVimeoApi();
        if (cancelled) return;
        // @ts-expect-error Vimeo global
        const VimeoPlayer = window.Vimeo.Player;
        playerRef.current = new VimeoPlayer(container, {
          id: parseInt(embed.videoId, 10),
          autoplay: true,
          responsive: true,
          dnt: true,
        });
        playerRef.current.ready().then(async () => {
          if (cancelled) return;
          setIframeReady(true);
          if (startAt > 0) {
            try { await playerRef.current.setCurrentTime(startAt); } catch {}
          }
          try {
            const dur = await playerRef.current.getDuration();
            if (dur > 0) onDurationChange?.(dur);
          } catch {}
        });
        playerRef.current.on("ended", () => onEnded?.());
        // Vimeo emite 'timeupdate' em alta frequência; faço throttle pra cada 5s
        let lastSent = 0;
        playerRef.current.on("timeupdate", (data: { seconds: number; duration: number }) => {
          if (Date.now() - lastSent > 5000) {
            lastSent = Date.now();
            onProgress?.(data.seconds, data.duration);
          }
        });
        return;
      }

      if (embed.kind === "panda") {
        // Panda Video — fluxo:
        // 1. Busca JWT do Panda Watermark (Edge Function panda-jwt) em paralelo
        //    pra adicionar &watermark={JWT} na URL do iframe (DRM por aluno)
        // 2. Cria iframe com autoplay + startTime + watermark via querystring
        // 3. Após iframe.onload, instancia o SDK PandaPlayer pra capturar
        //    eventos de timeupdate/ended sem reiniciar o player

        // Pega watermark JWT (fire-and-forget — se falhar, vídeo carrega
        // sem watermark em vez de quebrar tudo)
        const watermarkPromise = getPandaWatermarkJWT();
        const watermarkJWT = await Promise.race([
          watermarkPromise,
          new Promise<null>((r) => setTimeout(() => r(null), 2500)), // 2.5s timeout
        ]);
        if (cancelled) return;

        const iframeId = `panda-${embed.videoId}-${Date.now()}`;
        const iframe = document.createElement("iframe");
        iframe.id = iframeId;
        // Parâmetros do iframe (Panda Video):
        //   v: ID do vídeo
        //   autoplay: tenta auto-play (browser pode forçar mute primeiro)
        //   startTime: posição inicial (resume) — só passa se >0 pra evitar bug
        //              de scrub-trava em modo preview com startTime=0
        //   muted: começa mudo (necessário pra autoplay funcionar em browsers)
        //   hideShareButton: oculta botão de compartilhar URL
        //   hidePopupButton: oculta botão "abrir em nova aba" (anti-share)
        //   hidePlayerControls: false — mantém play/seek/volume etc
        //   smartAutoplay: deixa o Panda decidir se faz autoplay safe
        const paramsObj: Record<string, string> = {
          v: embed.videoId,
          smartAutoplay: "true",
          muted: "true",
          hideShareButton: "true",
          hidePopupButton: "true",
        };
        if (startAt > 0) {
          paramsObj.startTime = String(Math.floor(startAt));
        }
        // DRM Watermark: o JWT vem da Edge Function panda-jwt (assinado
        // com a chave secreta do Panda no servidor). Carrega:
        // string1="Medo de Dirigir Nunca Mais", string2=email do aluno,
        // string3="ID: <user_id_short>". Renderizado dinamicamente sobre
        // o vídeo se o vídeo estiver no grupo DRM configurado no painel.
        if (watermarkJWT) {
          paramsObj.watermark = watermarkJWT;
        }
        // Fallback compat: passa email também como customParam pro caso de
        // grupos DRM que usem placeholders diferentes
        if (viewerId) {
          paramsObj["customParam.user"]  = viewerId;
          paramsObj["customParam.email"] = viewerId;
        }
        const params = new URLSearchParams(paramsObj);
        iframe.src = `https://player-${embed.pullzone}.tv.pandavideo.com.br/embed/?${params}`;
        iframe.allow =
          "accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen";
        iframe.setAttribute("allowfullscreen", "true");
        iframe.setAttribute("frameborder", "0");
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "0";
        container.appendChild(iframe);
        playerRef.current = iframe;
        setIframeReady(true);

        // Carrega SDK do Panda em paralelo (não bloqueia o autoplay)
        loadPandaApi().then(() => {
          if (cancelled) return;
          // @ts-expect-error PandaPlayer global injetado pelo api.js
          const PandaPlayer = window.PandaPlayer;
          if (!PandaPlayer) return;

          let lastSent = 0;
          let lastDuration = 0;

          try {
            // SDK observa o iframe existente (não recria)
            const player = new PandaPlayer(iframeId, {
              onReady: () => {
                if (cancelled) return;
                try {
                  const dur = player.getDuration?.();
                  if (typeof dur === "number" && dur > 0) {
                    lastDuration = dur;
                    onDurationChange?.(dur);
                  }
                } catch {}
                try {
                  player.onEvent?.((msg: any) => {
                    if (!msg) return;
                    const type = msg.message || msg.event || msg.type;
                    if (type === "panda_timeupdate" || type === "timeupdate") {
                      const t = msg.currentTime ?? player.getCurrentTime?.() ?? 0;
                      let dur = msg.duration ?? lastDuration;
                      if ((!dur || dur <= 0) && player.getDuration) {
                        try { dur = player.getDuration(); } catch {}
                      }
                      if (dur > 0 && dur !== lastDuration) {
                        lastDuration = dur;
                        onDurationChange?.(dur);
                      }
                      if (Date.now() - lastSent > 5000) {
                        lastSent = Date.now();
                        onProgress?.(t, dur);
                      }
                    }
                    if (type === "panda_ended" || type === "ended") {
                      onEnded?.();
                    }
                  });
                } catch {}
              },
            });
            // Substitui ref do iframe pelo player (pra saveFinalPosition usar getCurrentTime)
            playerRef.current = player;
          } catch {}
        });

        return;
      }

      // Native MP4
      const video = document.createElement("video");
      video.src = embed.src;
      video.controls = true;
      video.autoplay = true;
      video.className = "w-full h-full object-contain";
      video.setAttribute("controlsList", "nodownload");
      if (startAt > 0) video.currentTime = startAt;
      video.addEventListener("loadedmetadata", () => {
        if (video.duration > 0) onDurationChange?.(video.duration);
        if (startAt > 0 && video.currentTime < startAt) {
          try { video.currentTime = startAt; } catch {}
        }
      });
      let lastSent = 0;
      video.addEventListener("timeupdate", () => {
        if (Date.now() - lastSent > 5000) {
          lastSent = Date.now();
          onProgress?.(video.currentTime, video.duration);
        }
      });
      video.addEventListener("ended", () => onEnded?.());
      container.appendChild(video);
      playerRef.current = video;
      setIframeReady(true);
    }

    setup();

    return () => {
      cancelled = true;
      cleanup.forEach((fn) => fn());
      if (progressInterval.current) clearInterval(progressInterval.current);
      try { playerRef.current?.destroy?.(); } catch {}
      try { playerRef.current?.unload?.(); } catch {}
      playerRef.current = null;
    };
    // Reagimos só quando muda a aula. startAt é aplicado uma vez no setup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embed?.kind, (embed as any)?.videoId, (embed as any)?.src, (embed as any)?.pullzone]);

  // Salva posição final ao desmontar (caso usuário feche aba/pular aula)
  useEffect(() => {
    function saveFinalPosition() {
      try {
        const p = playerRef.current;
        if (!p || !embed) return;
        let t = 0, d = 0;
        if (embed.kind === "youtube") {
          t = p.getCurrentTime?.() ?? 0;
          d = p.getDuration?.() ?? 0;
        } else if (embed.kind === "vimeo") {
          // Vimeo é assíncrono, getCurrentTime retorna Promise. No beforeunload
          // não dá tempo de await — o último onProgress já cuidou disso.
          return;
        } else if (embed.kind === "panda") {
          // SDK Panda tem getters síncronos
          try {
            t = p.getCurrentTime?.() ?? 0;
            d = p.getDuration?.() ?? 0;
          } catch { return; }
        } else {
          t = (p as HTMLVideoElement).currentTime ?? 0;
          d = (p as HTMLVideoElement).duration ?? 0;
        }
        if (t > 0) onProgress?.(t, d);
      } catch {}
    }
    window.addEventListener("beforeunload", saveFinalPosition);
    return () => {
      saveFinalPosition();
      window.removeEventListener("beforeunload", saveFinalPosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embed?.kind, (embed as any)?.videoId, (embed as any)?.src]);

  if (!embed) {
    return (
      <div className={`flex flex-col items-center justify-center text-white/40 ${className ?? ""}`}>
        <span className="material-symbols-outlined text-6xl mb-3">article</span>
        <p className="font-medium tracking-widest uppercase text-sm">Sem vídeo</p>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className ?? ""}`}>
      <div ref={containerRef} className="absolute inset-0" />
      {!iframeReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
          <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
