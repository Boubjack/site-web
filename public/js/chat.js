/* E-Market AI — widget de chat flottant (assistant client + service client). */
(function () {
  const history = []; // {role, content}
  let mode = 'shopping';
  let busy = false;

  const root = document.createElement('div');
  root.innerHTML = `
    <button class="chat-fab" id="em-chat-fab" title="Parler à E-Market AI">✨</button>
    <div class="chat-window glass" id="em-chat-win">
      <div class="chat-head">
        <div class="avatar">✨</div>
        <div>
          <div class="title">E-Market AI</div>
          <div class="status" id="em-chat-status">● en ligne</div>
        </div>
        <div class="mode-switch">
          <button data-mode="shopping" class="active">🛍️ Shopping</button>
          <button data-mode="support">🎧 Support</button>
        </div>
      </div>
      <div class="chat-body" id="em-chat-body">
        <div class="msg ai">Bonjour 👋 Je suis <b>E-Market AI</b>, votre assistant personnel.
Décrivez-moi ce que vous cherchez — par exemple :
« Je cherche une tenue pour un mariage à Bamako avec un budget de 50 000 FCFA »</div>
      </div>
      <div class="chat-input">
        <input id="em-chat-input" placeholder="Écrivez votre message…" maxlength="1000" />
        <button id="em-chat-send" title="Envoyer">➤</button>
      </div>
    </div>`;
  document.body.appendChild(root);

  const fab = root.querySelector('#em-chat-fab');
  const win = root.querySelector('#em-chat-win');
  const body = root.querySelector('#em-chat-body');
  const input = root.querySelector('#em-chat-input');

  fab.addEventListener('click', () => {
    win.classList.toggle('open');
    if (win.classList.contains('open')) input.focus();
  });

  root.querySelectorAll('.mode-switch button').forEach((b) => {
    b.addEventListener('click', () => {
      root.querySelectorAll('.mode-switch button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      mode = b.dataset.mode;
      addMsg('ai', mode === 'support'
        ? 'Mode support 🎧 — commandes, livraison, paiement, retours… Comment puis-je vous aider ?'
        : 'Mode shopping 🛍️ — dites-moi ce que vous cherchez !');
    });
  });

  function addMsg(cls, text) {
    const el = document.createElement('div');
    el.className = `msg ${cls}`;
    el.textContent = text;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  function addProducts(products) {
    if (!products || !products.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'chat-products';
    wrap.innerHTML = products.map((p) => `
      <div class="chat-product" data-id="${p.id}">
        <div class="thumb">${p.emoji}</div>
        <div class="info">
          <div class="p-name">${EM.esc(p.name)}</div>
          <div class="p-price">${EM.fcfa(p.price)}</div>
          <div class="p-seller">${EM.esc(p.seller ? p.seller.shop : '')}${p.rating ? ` · ★${p.rating}` : ''}</div>
        </div>
      </div>`).join('');
    wrap.addEventListener('click', (e) => {
      const card = e.target.closest('.chat-product');
      if (card && window.EMOpenProduct) window.EMOpenProduct(card.dataset.id);
    });
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  async function send() {
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    busy = true;
    addMsg('user', text);
    history.push({ role: 'user', content: text });

    const typing = document.createElement('div');
    typing.className = 'msg ai';
    typing.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;

    let aiMsg = null;
    let streamed = '';
    const statusEl = root.querySelector('#em-chat-status');

    try {
      await EM.sse('/api/ai/chat', { messages: history, mode }, {
        status: ({ tool }) => {
          statusEl.textContent = '● recherche dans le catalogue…';
          if (tool === 'get_my_orders') statusEl.textContent = '● consultation de vos commandes…';
        },
        text: ({ delta }) => {
          if (!aiMsg) { typing.remove(); aiMsg = addMsg('ai', ''); }
          streamed += delta;
          aiMsg.textContent = streamed;
          body.scrollTop = body.scrollHeight;
        },
        done: ({ text: finalText, products }) => {
          typing.remove();
          if (!aiMsg) aiMsg = addMsg('ai', '');
          aiMsg.textContent = finalText || streamed;
          history.push({ role: 'assistant', content: finalText || streamed });
          addProducts(products);
        },
        error: ({ message }) => {
          typing.remove();
          addMsg('ai', message || 'Une erreur est survenue. Réessayez.');
        },
      });
    } catch (err) {
      typing.remove();
      addMsg('ai', `⚠️ ${err.message}`);
    } finally {
      statusEl.textContent = '● en ligne';
      busy = false;
      input.focus();
    }
  }

  root.querySelector('#em-chat-send').addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
})();
