/* ════════════════════════════════════════════════════════════════
 * Track helper · MedoDeDirigirNuncaMais
 *
 * Coleta de comportamento do visitante na sales.html. Tudo
 * fire-and-forget: nunca trava o site se o servidor estiver fora.
 *
 * AUTO-TRACKS (todos disparam SEM precisar plugar):
 *   pagina_visitada   → 1× por page load (cada refresh é 1 visita)
 *   scroll_25/50/75/100 → quando passa cada milestone (1× por aba)
 *   tempo_na_pagina   → 1× ao sair (pagehide / hidden)
 *   web_vital LCP     → 1× ao sair (último valor estável)
 *   web_vital CLS     → 1× ao sair (acumulado total)
 *   web_vital INP     → 1× ao sair (max entre interações)
 *
 * MANUAL TRACKS (chamar onde precisar):
 *   window.Track.event('clicou_cta_hero', { label: 'hero' })
 *   window.Track.event('lead_capturado', { plano: 'Lançamento' })
 *
 * PAUSE (admin):
 *   localStorage.setItem('mddnm_track_paused_v1', '1')
 *   ou clicar no botão olho/visibility no /dash
 *
 * DEBUG (no console):
 *   window.Track.debug = true   → loga cada envio
 *   window.Track.session()      → mostra ID da sessão
 * ════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const ENDPOINT       = '/.netlify/functions/events';
  const SESSION_KEY    = 'mddnm_track_session_v1';
  const SCROLL_KEY     = 'mddnm_track_scroll_v1';
  const PAUSED_KEY     = 'mddnm_track_paused_v1';   // localStorage flag
  const VERSION        = 'v2';                       // bump pra forçar reload de cache

  // Tracking pausado? (admin liga via botão "olho" no /dash)
  function isPaused() {
    try { return localStorage.getItem(PAUSED_KEY) === '1'; }
    catch { return false; }
  }
  // Compat: sempre false (gating é via isPaused agora)
  function isAdmin() { return false; }

  // Session ID (um por aba/janela; sobrevive a refreshes da MESMA aba)
  function sessionId() {
    try {
      let id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      return 's_anon_' + Math.random().toString(36).slice(2, 8);
    }
  }

  function readUTMs() {
    try {
      const u = new URLSearchParams(location.search);
      const utm = {};
      ['source', 'medium', 'campaign', 'content', 'term'].forEach(f => {
        const v = u.get('utm_' + f);
        if (v) utm[f] = v.slice(0, 80);
      });
      return Object.keys(utm).length ? utm : null;
    } catch { return null; }
  }

  function deviceClass() {
    const w = window.innerWidth || 0;
    if (w < 640)  return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  }

  function shortRef() {
    try {
      const r = document.referrer;
      if (!r) return null;
      const u = new URL(r);
      if (u.hostname === location.hostname) return u.pathname.slice(0, 80);
      return u.hostname.slice(0, 80);
    } catch { return null; }
  }

  // ──────────────────────────────────────────────────────────
  // SEND · usa sendBeacon quando disponível (mais confiável em
  // pagehide/visibilitychange). Fallback fetch keepalive.
  // ──────────────────────────────────────────────────────────
  function send(name, meta, opts) {
    if (isPaused() || !name) return false;
    const body = {
      name,
      meta: meta || null,
      session: sessionId(),
      utm: readUTMs(),
      device: deviceClass(),
      referrer: shortRef(),
    };
    const json = JSON.stringify(body);

    if (window.Track && window.Track.debug) {
      try { console.log('[Track]', name, body); } catch {}
    }

    // Beacon: melhor pra eventos de saída (pagehide/visibilitychange).
    // Função sempre disponível em browsers modernos. Não bloqueia navigation.
    if (opts?.beacon && navigator.sendBeacon) {
      try {
        const blob = new Blob([json], { type: 'application/json' });
        if (navigator.sendBeacon(ENDPOINT, blob)) return true;
      } catch {}
    }

    // Default: fetch keepalive
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json,
        keepalive: true,
        credentials: 'omit',
      }).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────
  // BOOT · pagina_visitada — DISPARA EM CADA LOAD
  // (cada refresh conta como visita; "users únicos" é por sessionId)
  // ──────────────────────────────────────────────────────────
  function trackPageView() {
    send('pagina_visitada', {
      path: location.pathname.slice(0, 80),
      title: (document.title || '').slice(0, 80),
    });
  }

  // ──────────────────────────────────────────────────────────
  // SCROLL MILESTONES (1× por aba, persistido em sessionStorage)
  // ──────────────────────────────────────────────────────────
  function setupScrollTracking() {
    if (isPaused()) return;
    const milestones = [25, 50, 75, 100];
    const fired = new Set();
    try {
      const saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '[]');
      saved.forEach(m => fired.add(m));
    } catch {}

    function check() {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      if (docH <= 0) return;
      const pct = Math.round((window.scrollY / docH) * 100);
      for (const m of milestones) {
        if (pct >= m && !fired.has(m)) {
          fired.add(m);
          try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify([...fired])); } catch {}
          send(`scroll_${m}`, null);
        }
      }
    }

    let raf = null;
    window.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { check(); raf = null; });
    }, { passive: true });
    // Roda 1× no init (caso a página carregue com scroll já em pos.>0)
    check();
  }

  // ──────────────────────────────────────────────────────────
  // SAÍDA · agrupa tudo que envia ao sair (1× por load)
  //   tempo_na_pagina + web_vital LCP/CLS/INP
  // Usa flag global "exitSent" pra não duplicar.
  // ──────────────────────────────────────────────────────────
  function setupExitTracking() {
    if (isPaused()) return;
    const start = Date.now();
    let exitSent = false;
    const sentVitals = { LCP: false, CLS: false, INP: false };

    let lcpVal = 0;
    let clsVal = 0;
    let inpMax = 0;

    if ('PerformanceObserver' in window) {
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) lcpVal = last.startTime || last.renderTime || 0;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {}

      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (!e.hadRecentInput) clsVal += e.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch {}

      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (e.duration > inpMax) inpMax = e.duration;
          }
        }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
      } catch {}
    }

    function flushExit() {
      if (exitSent) return;
      exitSent = true;
      const seconds = Math.round((Date.now() - start) / 1000);
      // Tempo na página
      send('tempo_na_pagina', { seconds }, { beacon: true });
      // Web Vitals (cada um só uma vez)
      if (!sentVitals.LCP && lcpVal > 0) {
        sentVitals.LCP = true;
        send('web_vital', { metric: 'LCP', value: Math.round(lcpVal) }, { beacon: true });
      }
      if (!sentVitals.CLS) {
        sentVitals.CLS = true;
        send('web_vital', { metric: 'CLS', value: Math.round(clsVal * 1000) / 1000 }, { beacon: true });
      }
      if (!sentVitals.INP && inpMax > 0) {
        sentVitals.INP = true;
        send('web_vital', { metric: 'INP', value: Math.round(inpMax) }, { beacon: true });
      }
    }

    // pagehide é o evento mais confiável pra "vou sair de fato"
    window.addEventListener('pagehide', flushExit);
    // visibilitychange hidden cobre quando o usuário troca de aba
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushExit();
    });
  }

  // ──────────────────────────────────────────────────────────
  // API PÚBLICA
  // ──────────────────────────────────────────────────────────
  window.Track = {
    event: send,
    session: sessionId,
    sessionId,        // alias (compat)
    isAdmin,
    isPaused,
    debug: false,
    version: VERSION,
  };

  // Boot — roda 1× por page load
  function boot() {
    trackPageView();      // SEMPRE grava (cada load = 1 visita)
    setupScrollTracking();
    setupExitTracking();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
