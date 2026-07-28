/**
 * dom.js — Utilitaires d'interface.
 *
 * Construction du DOM sans framework : le Tome XV ch. 7 exige des chargements
 * rapides et une faible consommation mémoire, et le Tome XII ch. 8 une
 * interface fluide. Des modules ES natifs et des éléments créés à la main
 * suffisent, sans dépendance ni étape de compilation.
 */

/**
 * Crée un élément.
 * @param {string} tag  balise, éventuellement suffixée de classes : 'div.card.tight'
 * @param {object|string|Array} [props] attributs, ou contenu si non-objet
 * @param {Array|string} [children]
 */
export function el(tag, props = {}, children = []) {
  const [tagName, ...classes] = tag.split('.');
  const node = document.createElement(tagName || 'div');

  // Appel raccourci : el('p', 'texte')
  if (typeof props === 'string' || Array.isArray(props) || props instanceof Node) {
    children = props;
    props = {};
  }

  if (classes.length) node.classList.add(...classes);

  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class' || key === 'className') {
      node.classList.add(...String(value).split(/\s+/).filter(Boolean));
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') {
      // Réservé aux contenus construits par le code, jamais à une saisie brute.
      node.innerHTML = value;
    } else if (key === 'text') {
      node.textContent = value;
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, value);
    }
  }

  append(node, children);
  return node;
}

/** Ajoute des enfants (texte, nœuds, tableaux imbriqués, valeurs nulles ignorées). */
export function append(parent, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false || child === '') continue;
    if (Array.isArray(child)) { append(parent, child); continue; }
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** Vide un conteneur puis y insère un nouveau contenu. */
export function render(container, children) {
  if (!container) return null;
  container.textContent = '';
  append(container, children);
  return container;
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

// ── Composants réutilisables ───────────────────────────────────────────────

export function card(title, children, options = {}) {
  return el(`div.card${options.tight ? '.card-tight' : ''}${options.hover ? '.card-hover' : ''}`, {}, [
    title ? el('div.card-title', {}, title) : null,
    ...(Array.isArray(children) ? children : [children]),
  ]);
}

export function stat(label, value, options = {}) {
  return el('div.stat', {}, [
    el('div.stat-label', {}, label),
    el(`div.stat-value${options.tone ? `.${options.tone}` : ''}`, {}, String(value)),
    options.sub ? el('div.stat-sub', {}, options.sub) : null,
  ]);
}

export function badge(text, tone = '') {
  return el(`span.badge${tone ? `.badge-${tone}` : ''}`, {}, text);
}

export function meter(value, max = 100, tone = '') {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return el('div.meter', {}, [
    el(`div.meter-fill${tone ? `.${tone}` : ''}`, { style: { width: `${pct}%` } }),
  ]);
}

export function attributeRow(name, value, max = 99) {
  const tone = value >= 80 ? 'ok' : value >= 60 ? '' : value >= 40 ? 'warn' : 'danger';
  return el('div.attr-row', {}, [
    el('span.name', {}, name),
    meter(value, max, tone),
    el('span.val', {}, Math.round(value)),
  ]);
}

export function button(label, onClick, options = {}) {
  return el('button.btn', {
    class: [
      options.variant ? `btn-${options.variant}` : '',
      options.size ? `btn-${options.size}` : '',
      options.block ? 'btn-block' : '',
    ].filter(Boolean).join(' '),
    onClick,
    disabled: options.disabled || false,
    title: options.title || '',
    type: 'button',
  }, label);
}

export function table(headers, rows, options = {}) {
  return el('div.table-wrap', {}, [
    el('table', {}, [
      el('thead', {}, el('tr', {}, headers.map((h) => el('th', {}, h)))),
      el('tbody', {}, rows.length
        ? rows.map((row) => el('tr', {}, row.map((cellValue, index) =>
            el(`td${options.numeric?.includes(index) ? '.num' : ''}`, {}, cellValue))))
        : el('tr', {}, el('td', { colspan: headers.length, class: 'dim center' }, options.empty || 'Aucune donnée.'))),
    ]),
  ]);
}

/** Formatage monétaire cohérent dans toute l'interface. */
export function money(amount) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(Math.round(amount || 0));
}

/** Format compact pour les grands nombres (abonnés, spectateurs). */
export function compact(value) {
  return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}

export function num(value) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(value || 0));
}

// ── Notifications ──────────────────────────────────────────────────────────

let toastHost = null;

export function toast({ title, body, level = 'info', duration = 4600 }) {
  if (!toastHost) {
    toastHost = el('div.toasts', { role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastHost);
  }

  const node = el(`div.toast${level !== 'info' ? `.${level}` : ''}`, {}, [
    el('div.toast-title', {}, title),
    body ? el('div.toast-body', {}, body) : null,
  ]);

  toastHost.appendChild(node);

  // Au-delà de cinq notifications simultanées, la plus ancienne disparaît.
  while (toastHost.children.length > 5) toastHost.firstChild.remove();

  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transform = 'translateX(24px)';
    setTimeout(() => node.remove(), 300);
  }, duration);

  return node;
}

// ── Modales ────────────────────────────────────────────────────────────────

/**
 * Ouvre une modale. Retourne une fonction de fermeture.
 * Gère l'échappement clavier et le clic sur le fond.
 */
export function modal({ title, body, footer, onClose, wide = false, dismissible = true }) {
  const backdrop = el('div.modal-backdrop');
  const dialog = el('div.modal', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': typeof title === 'string' ? title : 'Fenêtre',
    style: wide ? { width: 'min(1080px, 100%)' } : {},
  });

  const close = () => {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    if (typeof onClose === 'function') onClose();
  };

  const onKey = (event) => {
    if (event.key === 'Escape' && dismissible) close();
  };

  append(dialog, [
    el('div.modal-header', {}, [
      el('h3', {}, title),
      dismissible ? button('✕', close, { variant: 'ghost', size: 'sm' }) : null,
    ]),
    el('div.modal-body', {}, body),
    footer ? el('div.modal-footer', {}, footer) : null,
  ]);

  backdrop.appendChild(dialog);
  if (dismissible) {
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close();
    });
  }
  document.addEventListener('keydown', onKey);
  document.body.appendChild(backdrop);

  // Le focus part sur la modale pour les lecteurs d'écran.
  dialog.setAttribute('tabindex', '-1');
  dialog.focus();

  return { close, dialog, body: dialog.querySelector('.modal-body') };
}

// ── Effets visuels ─────────────────────────────────────────────────────────

/** Confettis — Tome VII ch. 8. Respecte le réglage d'animations réduites. */
export function confetti(count = 90) {
  if (document.documentElement.dataset.motion === 'reduced') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const colors = ['#c9a227', '#e5be3f', '#4c8dff', '#34d399', '#f87171', '#ffffff'];
  for (let i = 0; i < count; i++) {
    const piece = el('div.confetti-piece', {
      style: {
        left: `${Math.random() * 100}vw`,
        background: colors[Math.floor(Math.random() * colors.length)],
        animationDuration: `${2.2 + Math.random() * 2.2}s`,
        animationDelay: `${Math.random() * 0.7}s`,
      },
    });
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 5200);
  }
}

/** Attente utilitaire pour dérouler les séquences cinématiques. */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Écrit un texte progressivement, sauf si les animations sont réduites. */
export async function typeInto(node, text, speed = 18) {
  if (document.documentElement.dataset.motion === 'reduced') {
    node.textContent = text;
    return;
  }
  node.textContent = '';
  for (const char of text) {
    node.textContent += char;
    if (char !== ' ') await wait(speed);
  }
}

/** En-tête de site partagé par toutes les pages. */
export function siteHeader(current) {
  const links = [
    { href: 'index.html', label: 'Accueil', id: 'accueil' },
    { href: 'sim.html', label: 'Prototype jouable', id: 'sim' },
    { href: 'gdd.html', label: 'Game Design Document', id: 'gdd' },
    { href: 'traceability.html', label: 'Traçabilité', id: 'trace' },
    { href: 'tests.html', label: 'Tests', id: 'tests' },
  ];

  return el('header.site-header', {}, [
    el('div.container-wide', {}, [
      el('a.brand', { href: 'index.html' }, [
        el('span.brand-mark', {}, '⚽'),
        'Infinity Football',
      ]),
      el('nav.site-nav', { 'aria-label': 'Navigation principale' },
        links.map((link) => el('a', {
          href: link.href,
          'aria-current': link.id === current ? 'page' : null,
        }, link.label)),
      ),
    ]),
  ]);
}

export function siteFooter() {
  return el('footer.site-footer', {}, [
    el('div.container', {}, [
      el('p.mb-0', {}, [
        'Infinity Football — Game Design Document et prototype de simulation. ',
        el('span.dim', {}, 'Univers, clubs, marques et personnages entièrement fictifs.'),
      ]),
    ]),
  ]);
}

/** Applique les réglages d'accessibilité — Tome XII ch. 7. */
export function applyAccessibility(settings) {
  const root = document.documentElement;
  root.style.setProperty('--scale', settings.textScale || 1);
  root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
  root.dataset.motion = settings.reducedMotion ? 'reduced' : 'normal';
}
