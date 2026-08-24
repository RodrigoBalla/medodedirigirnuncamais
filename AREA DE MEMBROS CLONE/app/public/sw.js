// ─── Service Worker (PWA) ────────────────────────────────────────────────────
// Objetivo: deixar a área de membros instalável no celular e abrir rápido,
// SEM correr o risco de servir uma versão velha do app (o pesadelo de SPA com
// cache: a aluna fica presa num bundle antigo depois de um deploy).
//
// Estratégia deliberadamente conservadora:
//   • navegações (HTML)     → SEMPRE rede primeiro; cache só se estiver offline
//   • assets com hash (/assets/…) → cache primeiro (o nome muda a cada build,
//                                    então nunca serve conteúdo desatualizado)
//   • ícones/manifest       → cache primeiro
//   • Supabase / APIs       → nunca cacheia (dados vivos)
// =============================================================================

const VERSION = "v1";
const APP_CACHE = `mddnm-app-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((c) =>
      c.addAll([OFFLINE_URL, "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"]).catch(() => {})
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Só mexe no que é do próprio site. Supabase, Panda, Eduzz, Meta: passa direto.
  if (url.origin !== self.location.origin) return;

  // Navegação (abrir/atualizar página): rede primeiro — nunca serve app velho.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error()))
    );
    return;
  }

  // Assets versionados por hash + ícones: cache primeiro (seguro, nome único).
  const cacheavel = url.pathname.startsWith("/assets/") ||
    /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname);
  if (!cacheavel) return;

  event.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((resp) => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(APP_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return resp;
      })
    )
  );
});
