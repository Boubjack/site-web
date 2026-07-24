/**
 * E-Market AI — widget d'assistant réutilisable et configurable.
 *
 * Un seul composant, piloté par la configuration renvoyée par le serveur
 * (GET /api/ai/assistants). Chaque assistant a sa propre identité (nom,
 * avatar, couleur d'accent, salutation, actions rapides, suggestions) et son
 * propre endpoint (/api/ai/assistants/:id/chat) — donc son propre historique
 * et son propre style. Deux modes de montage :
 *   EMAssistant.mountFloating(id)        → bouton flottant + fenêtre
 *   EMAssistant.mountPanel(element, id)  → panneau intégré dans une page
 */
(function () {
  async function fetchConfig(id) {
    const { assistants } = await EM.api('/api/ai/assistants');
    return assistants.find((a) => a.id === id) || null;
  }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /** Crée une instance de conversation attachée à un conteneur .chat-body + input. */
  function createConversation(cfg, { body, input, statusEl, onStart }) {
    const history = [];
    let busy = false;
    let suggestionsEl = null;

    function addMsg(clsName, text) {
      const m = el('div', `msg ${clsName}`);
      m.textContent = text;
      body.appendChild(m);
      body.scrollTop = body.scrollHeight;
      return m;
    }

    function addProducts(products) {
      if (!products || !products.length) return;
      const wrap = el('div', 'chat-products');
      wrap.innerHTML = products.map((p) => `
        <div class="chat-product" data-id="${p.id}">
          <div class="thumb">${p.emoji || '🛍️'}</div>
          <div class="info">
            <div class="p-name">${EM.esc(p.name)}</div>
            <div class="p-price">${EM.fcfa(p.price)}</div>
            <div class="p-seller">${EM.esc(p.seller ? p.seller.shop : '')}${p.rating ? ` · ★${p.rating}` : ''}</div>
          </div>
        </div>`).join('');
      wrap.addEventListener('click', (e) => {
        const c = e.target.closest('.chat-product');
        if (c && window.EMOpenProduct) window.EMOpenProduct(c.dataset.id);
      });
      body.appendChild(wrap);
      body.scrollTop = body.scrollHeight;
    }

    function addChart(chart) {
      if (!chart || !chart.bars || !chart.bars.length) return;
      const max = Math.max(...chart.bars.map((b) => b.value), 1);
      const wrap = el('div', 'chat-chart');
      wrap.style.setProperty('--accent', cfg.accent);
      wrap.innerHTML = `<div class="chart-title">${EM.esc(chart.title)}</div>` +
        chart.bars.map((b) => `
          <div class="chart-row">
            <span class="chart-label" title="${EM.esc(b.label)}">${EM.esc(b.label)}</span>
            <span class="chart-track"><span class="chart-bar" style="width:${Math.round((b.value / max) * 100)}%"></span></span>
            <span class="chart-value">${EM.fcfa(b.value)}</span>
          </div>`).join('');
      body.appendChild(wrap);
      body.scrollTop = body.scrollHeight;
    }

    function showSuggestions() {
      if (!cfg.suggestions || !cfg.suggestions.length) return;
      suggestionsEl = el('div', 'chat-suggestions');
      cfg.suggestions.forEach((s) => {
        const chip = el('button', 'chip', `💡 ${EM.esc(s)}`);
        chip.addEventListener('click', () => { removeSuggestions(); send(s); });
        suggestionsEl.appendChild(chip);
      });
      body.appendChild(suggestionsEl);
      body.scrollTop = body.scrollHeight;
    }
    function removeSuggestions() { if (suggestionsEl) { suggestionsEl.remove(); suggestionsEl = null; } }

    async function send(preset) {
      const text = (preset != null ? preset : input.value).trim();
      if (!text || busy) return;
      if (onStart) onStart();
      removeSuggestions();
      input.value = '';
      busy = true;
      addMsg('user', text);
      history.push({ role: 'user', content: text });

      const typing = el('div', 'msg ai');
      typing.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
      body.appendChild(typing);
      body.scrollTop = body.scrollHeight;

      let aiMsg = null; let streamed = '';
      const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };

      try {
        await EM.sse(`/api/ai/assistants/${cfg.id}/chat`, { messages: history }, {
          status: ({ tool }) => setStatus(`● ${tool}…`),
          text: ({ delta }) => {
            if (!aiMsg) { typing.remove(); aiMsg = addMsg('ai', ''); }
            streamed += delta;
            aiMsg.textContent = streamed;
            body.scrollTop = body.scrollHeight;
          },
          done: ({ text: finalText, products, chart }) => {
            typing.remove();
            if (!aiMsg) aiMsg = addMsg('ai', '');
            aiMsg.textContent = finalText || streamed;
            history.push({ role: 'assistant', content: finalText || streamed });
            if (cfg.features && cfg.features.products) addProducts(products);
            if (cfg.features && cfg.features.charts) addChart(chart);
          },
          error: ({ message }) => { typing.remove(); addMsg('ai', message || 'Erreur.'); },
        });
      } catch (err) {
        typing.remove();
        addMsg('ai', `⚠️ ${err.message}`);
      } finally {
        setStatus('● en ligne');
        busy = false;
        input.focus();
      }
    }

    async function restoreHistory() {
      if (!EM.token()) return;
      try {
        const { messages } = await EM.api(`/api/ai/assistants/${cfg.id}/history`);
        if (messages && messages.length) {
          messages.forEach((m) => { addMsg(m.role === 'user' ? 'user' : 'ai', m.content); history.push(m); });
          return true;
        }
      } catch { /* pas d'historique */ }
      return false;
    }

    return { send, addMsg, showSuggestions, restoreHistory };
  }

  function quickActionsBar(cfg, onPick) {
    if (!cfg.quickActions || !cfg.quickActions.length) return null;
    const bar = el('div', 'chat-quick');
    cfg.quickActions.forEach((qa) => {
      const b = el('button', 'quick-btn', EM.esc(qa.label));
      b.addEventListener('click', () => onPick(qa.prompt));
      bar.appendChild(b);
    });
    return bar;
  }

  /* ---------------- Mode flottant (storefront) ---------------- */
  async function mountFloating(id) {
    const cfg = await fetchConfig(id);
    if (!cfg) return;
    const root = el('div');
    root.innerHTML = `
      <button class="chat-fab" title="${EM.esc(cfg.name)}">${cfg.avatar}</button>
      <div class="chat-window glass">
        <div class="chat-head">
          <div class="avatar">${cfg.avatar}</div>
          <div><div class="title">${EM.esc(cfg.name)}</div><div class="status">● en ligne</div></div>
        </div>
        <div class="chat-quick-wrap"></div>
        <div class="chat-body"></div>
        <div class="chat-input"><input placeholder="Écrivez votre message…" maxlength="1000" /><button title="Envoyer">➤</button></div>
      </div>`;
    document.body.appendChild(root);

    const win = root.querySelector('.chat-window');
    const fab = root.querySelector('.chat-fab');
    const body = root.querySelector('.chat-body');
    const input = root.querySelector('.chat-input input');
    const statusEl = root.querySelector('.status');
    root.querySelector('.avatar').style.background = cfg.accent;
    fab.style.background = cfg.accent;
    root.querySelector('.chat-input button').style.background = cfg.accent;
    root.querySelector('.chat-fab').style.boxShadow = `0 8px 30px ${cfg.accent}80`;

    const conv = createConversation(cfg, { body, input, statusEl });
    let opened = false;
    fab.addEventListener('click', async () => {
      win.classList.toggle('open');
      if (win.classList.contains('open') && !opened) {
        opened = true;
        const had = await conv.restoreHistory();
        if (!had) { conv.addMsg('ai', cfg.greeting); conv.showSuggestions(); }
        input.focus();
      }
    });

    const qbar = quickActionsBar(cfg, (p) => { if (!win.classList.contains('open')) fab.click(); conv.send(p); });
    if (qbar) root.querySelector('.chat-quick-wrap').appendChild(qbar);
    root.querySelector('.chat-input button').addEventListener('click', () => conv.send());
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') conv.send(); });
  }

  /* ---------------- Mode panneau intégré (dashboards) ---------------- */
  async function mountPanel(container, id) {
    const cfg = await fetchConfig(id);
    if (!cfg) { container.innerHTML = '<p style="color:var(--gris)">Assistant non disponible pour votre rôle.</p>'; return; }
    container.classList.add('assistant-panel');
    container.style.setProperty('--accent', cfg.accent);
    container.innerHTML = `
      <div class="chat-head">
        <div class="avatar">${cfg.avatar}</div>
        <div><div class="title">${EM.esc(cfg.name)}</div><div class="status" style="color:var(--gris)">${EM.esc(cfg.style)}</div></div>
      </div>
      <div class="chat-quick-wrap"></div>
      <div class="chat-body glass"></div>
      <div class="chat-input"><input placeholder="Votre message…" maxlength="1000" /><button title="Envoyer">➤</button></div>`;
    const body = container.querySelector('.chat-body');
    const input = container.querySelector('.chat-input input');
    container.querySelector('.avatar').style.background = cfg.accent;
    container.querySelector('.chat-input button').style.background = cfg.accent;

    const conv = createConversation(cfg, { body, input });
    const had = await conv.restoreHistory();
    if (!had) { conv.addMsg('ai', cfg.greeting); conv.showSuggestions(); }

    const qbar = quickActionsBar(cfg, (p) => conv.send(p));
    if (qbar) container.querySelector('.chat-quick-wrap').appendChild(qbar);
    container.querySelector('.chat-input button').addEventListener('click', () => conv.send());
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') conv.send(); });
  }

  window.EMAssistant = { mountFloating, mountPanel };
})();
