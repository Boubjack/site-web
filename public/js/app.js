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

    toast(message) {
      let el = document.querySelector('.toast');
      if (!el) {
        el = document.createElement('div');
        el.className = 'toast';
        document.body.appendChild(el);
      }
      el.textContent = message;
      el.classList.add('show');
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove('show'), 3200);
    },

    track(type, payload = {}) {
      EM.api('/api/ai/events', { method: 'POST', body: { type, ...payload } }).catch(() => {});
    },
  };

  window.EM = EM;
})();
