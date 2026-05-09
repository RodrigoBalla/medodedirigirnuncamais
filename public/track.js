/* ════════════════════════════════════════════════════════════════
 * Track helper · MedoDeDirigirNuncaMais
 *
 * Coleta de comportamento do visitante na sales.html (e qualquer outra
 * página que carregar este script). Tudo fire-and-forget: nunca trava
 * o site se o servidor estiver fora do ar.
 *
 * Auto-tracks:
 *   pagina_visitada       → 1x por sessão (no boot)
 *   scroll_25/50/75/100   → quando passa cada milestone de profundidade
 *   tempo_na_pagina       → ao sair (visibilitychange hidden)
 *   web_vital             → LCP, INP, CLS via PerformanceObserver
 *
 * Manual tracks (chamar onde precisar):
 *   window.Track.event('clicou_cta_hero', { label: 'Quero começar' })
 *   window.Track.event('lead_capturado', { plano: 'Lançamento' })
 *
 * O admin não polui as métricas (se sessionStorage tiver auth admin,
 * não envia eventos).
 * ════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const ENDPOINT       = '/.netlify/functions/events';
  const SESSION_KEY    = 'mddnm_track_session_v1';
  const SCROLL_KEY     = 'mddnm_track_scroll_v1';
  const ENTERED_KEY    = 'mddnm_track_entered_v1';
  const PAUSED_KEY     = 'mddnm_track_paused_v1';   // localStorage flag

  // Tracking pausado? (admin pode pausar via /dash → "Modo teste")
  // Antes usava sessionStorage do admin auth, mas isso bagunçava quando
  // o admin abria o sales.html na mesma aba (auth herdada bloqueava tudo).
  // Agora é flag explícita em localStorage que admin liga/desliga.
  function isPaused() {
    try { return localStorage.getItem(PAUSED_KEY) === '1'; }
    catch { return false; }
  }
  // Mantém isAdmin() exposto pra compat, mas não bloqueia mais o track
  function isAdmin() { return false; }

  // Session ID (um por aba/refresh)
  function sessionId() {
    try {
      let id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch { return 's_anon'; }
  }

  // UTM params da URL (e do referrer interno se houver)
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

  // Device coarse (mobile / tablet / desktop)
  function deviceClass() {
    const w = window.innerWidth || 0;
    if (w < 640)  return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  }

  // Referrer enxuto (só hostname, sem query nem path completo)
  function shortRef() {
    try {
      const r = document.referrer;
      if (!r) return null;
      const u = new URL(r);
      // Se for o próprio site, retorna apenas o path
      if (u.hostname === location.hostname) return u.pathname.slice(0, 80);
      return u.hostname.slice(0, 80);
    } catch { return null; }
  }

  // Envia 1 evento (fire-and-forget, não trava nada)
  function send(name, meta) {
    if (isPaused()) return;
    if (!name) return;
    const body = {
      name,
      meta: meta || null,
      session: sessionId(),
      utm: readUTMs(),
      device: deviceClass(),
      referrer: shortRef(),
    };
    try {
      // keepalive=true permite que o request termine mesmo se o usuário
      // navegar pra outra página (importante pro tempo_na_pagina).
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
        credentials: 'omit',
      }).catch(() => {});
    } catch { /* nunca trava o site */ }
  }

  // ──────────────────────────────────────────────────────────
  // BOOT · pagina_visitada (1x por sessão)
  // ──────────────────────────────────────────────────────────
  function trackPageView() {
    if (isPaused()) return;
    try {
      if (sessionStorage.getItem(ENTERED_KEY) === '1') return;
      sessionStorage.setItem(ENTERED_KEY, '1');
      send('pagina_visitada', {
        path: location.pathname.slice(0, 80),
        ts_iso: new Date().toISOString().slice(0, 19),
      });
    } catch {}
  }

  // ──────────────────────────────────────────────────────────
  // SCROLL MILESTONES
  // ──────────────────────────────────────────────────────────
  function setupScrollTracking() {
    if (isPaused()) return;
    const milestones = [25, 50, 75, 100];
    const fired = new Set();

    // Carrega histórico de milestones já disparados nesta sessão
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
  }

  // ──────────────────────────────────────────────────────────
  // TEMPO NA PÁGINA (envia ao sair)
  // ──────────────────────────────────────────────────────────
  function setupTimeOnPage() {
    if (isPaused()) return;
    const start = Date.now();
    let sent = false;
    function sendTime() {
      if (sent) return;
      sent = true;
      const seconds = Math.round((Date.now() - start) / 1000);
      send('tempo_na_pagina', { seconds });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') sendTime();
    });
    window.addEventListener('pagehide', sendTime);
  }

  // ──────────────────────────────────────────────────────────
  // WEB VITALS (LCP, INP, CLS) — sem dependência externa
  // ──────────────────────────────────────────────────────────
  function setupWebVitals() {
    if (isPaused() || !('PerformanceObserver' in window)) return;

    // LCP (Largest Contentful Paint)
    try {
      let lcpVal = 0;
      const lcpObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) lcpVal = last.startTime || last.renderTime || 0;
      });
      lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
      // Reporta quando a aba ficar oculta (final stable LCP)
      addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && lcpVal > 0) {
          send('web_vital', { metric: 'LCP', value: Math.round(lcpVal) });
          lcpVal = 0;
        }
      }, { once: false });
    } catch {}

    // CLS (Cumulative Layout Shift)
    try {
      let clsVal = 0;
      const clsObs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (!e.hadRecentInput) clsVal += e.value;
        }
      });
      clsObs.observe({ type: 'layout-shift', buffered: true });
      addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          send('web_vital', { metric: 'CLS', value: Math.round(clsVal * 1000) / 1000 });
        }
      });
    } catch {}

    // INP (Interaction to Next Paint) — aproximação via 'event' timing
    try {
      let inpMax = 0;
      const inpObs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          // duration de interaction-events é o melhor proxy de INP
          if (e.duration > inpMax) inpMax = e.duration;
        }
      });
      inpObs.observe({ type: 'event', buffered: true, durationThreshold: 16 });
      addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && inpMax > 0) {
          send('web_vital', { metric: 'INP', value: Math.round(inpMax) });
        }
      });
    } catch {}
  }

  // ──────────────────────────────────────────────────────────
  // API PÚBLICA
  // ──────────────────────────────────────────────────────────
  window.Track = {
    event: send,
    sessionId,
    isAdmin,
  };

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      trackPageView();
      setupScrollTracking();
      setupTimeOnPage();
      setupWebVitals();
    });
  } else {
    trackPageView();
    setupScrollTracking();
    setupTimeOnPage();
    setupWebVitals();
  }
})();
