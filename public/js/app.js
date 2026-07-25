/* E-Market — utilitaires partagés (API, auth, SSE, rendu produits). */
(function () {
  const TOKEN_KEY = 'emarket_token';
  const USER_KEY = 'emarket_user';

  const EM = {
    token: () => localStorage.getItem(TOKEN_KEY),
    user: () => {
      try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
    },
    setSession(token, user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    logout() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      location.reload();
    },

    async api(path, { method = 'GET', body } = {}) {
      const headers = { 'Content-Type': 'application/json' };
      const token = EM.token();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      return data;
    },

    /**
     * POST vers un endpoint SSE et dispatch des événements.
     * handlers: { text({delta}), status({tool}), done({text,products}), error({message}) }
     */
    async sse(path, body, handlers) {
      const headers = { 'Content-Type': 'application/json' };
      const token = EM.token();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop();
        for (const block of blocks) {
          let event = 'message';
          let data = '';
          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) event = line.slice(7).trim();
            else if (line.startsWith('data: ')) data += line.slice(6);
          }
          if (data && handlers[event]) {
            try { handlers[event](JSON.parse(data)); } catch { /* ignore */ }
          }
        }
      }
    },

    fcfa: (n) => `${Number(n).toLocaleString('fr-FR')} FCFA`,

    productCardHtml(p) {
      return `
        <div class="card glass" data-id="${p.id}">
          <div class="img cat-${p.category || ''}">${p.emoji}</div>
          <div class="body">
            <div class="name">${EM.esc(p.name)}</div>
            <div class="meta">
              <span>${EM.esc(p.seller ? p.seller.shop : 'E-Market')}</span>
              ${p.rating ? `<span class="rating">★ ${p.rating}${p.reviewCount ? ` (${p.reviewCount})` : ''}</span>` : ''}
            </div>
            <div class="price">${EM.fcfa(p.price)}</div>
          </div>
        </div>`;
    },

    /** Affiche des cartes fantômes pendant le chargement. */
    skeletonGrid(id, n = 8) {
      const grid = document.getElementById(id);
      if (grid) grid.innerHTML = Array.from({ length: n }, () => '<div class="skeleton"></div>').join('');
    },

    esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[c]));
    },

    /** Toast empilé façon Sonner. type: 'info' | 'success' | 'error'. */
    toast(message, type = 'info') {
      let host = document.querySelector('.toaster');
      if (!host) {
        host = document.createElement('div');
        host.className = 'toaster';
        document.body.appendChild(host);
      }
      const el = document.createElement('div');
      el.className = `toast${type && type !== 'info' ? ' ' + type : ''}`;
      el.textContent = message;
      host.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));
      const dismiss = () => {
        el.classList.remove('show');
        el.classList.add('hide');
        el.addEventListener('transitionend', () => el.remove(), { once: true });
        setTimeout(() => el.remove(), 500);
      };
      el.addEventListener('click', dismiss);
      setTimeout(dismiss, 3600);
    },

    track(type, payload = {}) {
      EM.api('/api/ai/events', { method: 'POST', body: { type, ...payload } }).catch(() => {});
    },
  };

  // Accessibilité : thème clair/sombre (persisté) + lien d'évitement.
  EM.applyTheme = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('emarket_theme', t); } catch { /* ignore */ }
    const btn = document.querySelector('.theme-toggle');
    if (btn) { btn.textContent = t === 'light' ? '🌙' : '☀️'; btn.setAttribute('aria-label', t === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair'); }
  };
  EM.initA11y = () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    // Lien d'évitement.
    const target = document.querySelector('main, header');
    if (target) {
      if (!target.id) target.id = 'contenu';
      const skip = document.createElement('a');
      skip.className = 'skip-link'; skip.href = `#${target.id}`; skip.textContent = 'Aller au contenu';
      document.body.prepend(skip);
    }
    // Bascule de thème.
    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.addEventListener('click', () => EM.applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'));
    document.body.appendChild(btn);
    EM.applyTheme(current);
  };
  if (document.readyState !== 'loading') EM.initA11y();
  else document.addEventListener('DOMContentLoaded', EM.initA11y);

  window.EM = EM;

  // PWA : enregistrement du service worker (mode hors ligne + chargement rapide).
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* silencieux */ });
    });
  }
})();
