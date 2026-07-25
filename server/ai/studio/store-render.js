/**
 * RENDU BOUTIQUE — transforme un blueprint (studio/storebuilder) + les produits
 * réels du vendeur en une VRAIE page boutique premium, autonome (CSS + JS
 * inline, aucune dépendance), responsive et animée.
 *
 * Le rendu applique les tokens de design du blueprint : chaque boutique est
 * donc visuellement unique. Aucun style de site existant n'est copié.
 */
const catalog = require('../services/catalog');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const fcfa = (n) => `${Number(n).toLocaleString('fr-FR')} FCFA`;

function css(bp) {
  const p = bp.designSystem.palette;
  const t = bp.designSystem.typography;
  const m = bp.designSystem.motion;
  const heroBg = p.scheme === 'dark'
    ? `radial-gradient(1200px 600px at 80% -10%, ${p.accent}22, transparent 60%), radial-gradient(800px 500px at -10% 20%, ${p.accent2}18, transparent 60%), ${p.bg}`
    : `radial-gradient(1000px 520px at 82% -8%, ${p.accent}18, transparent 60%), ${p.bg}`;
  return `
  :root{--bg:${p.bg};--surface:${p.surface};--surface2:${p.surface2};--text:${p.text};--soft:${p.textSoft};
    --accent:${p.accent};--accent2:${p.accent2};--accent3:${p.accent3};--ink:${p.accentInk};--on-accent:${p.onAccent};
    --border:${p.border};--r:${bp.designSystem.radius};--grad:${p.gradient};--ease:${m.ease};--dur:${m.duration};}
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{background:var(--bg);color:var(--text);font-family:${t.body};line-height:1.55;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  img{max-width:100%;display:block}
  h1,h2,h3{font-family:${t.display};font-weight:${t.weightDisplay};letter-spacing:-0.02em;line-height:1.05}
  .wrap{max-width:1200px;margin:0 auto;padding:0 22px}
  .nav{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:18px;padding:16px 22px;
    background:color-mix(in srgb, var(--bg) 78%, transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--border)}
  .brand{font-family:${t.display};font-weight:800;font-size:1.15rem;display:flex;align-items:center;gap:10px}
  .brand .logo{width:34px;height:34px;border-radius:9px;background:var(--grad);display:grid;place-items:center;color:var(--on-accent);font-weight:800}
  .nav .menu{display:flex;gap:20px;margin-left:8px;color:var(--soft);font-size:.92rem}
  .nav .menu a:hover{color:var(--text)}
  .nav .actions{margin-left:auto;display:flex;gap:10px;align-items:center}
  .search{background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:9px 16px;color:var(--soft);font-size:.85rem}
  .btn{display:inline-flex;align-items:center;gap:8px;border:none;cursor:pointer;font-weight:600;font-family:inherit;
    padding:12px 22px;border-radius:999px;background:var(--grad);color:var(--on-accent);transition:transform var(--dur) var(--ease),box-shadow var(--dur) var(--ease)}
  .btn:hover{transform:translateY(-2px);box-shadow:0 12px 34px ${p.accent}55}
  .btn.ghost{background:var(--surface);color:var(--text);border:1px solid var(--border)}
  .hero{min-height:${bp.layout.heroHeight};display:flex;align-items:center;background:${heroBg};padding:80px 0}
  .hero .eyebrow{color:var(--accent);font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:.72rem;margin-bottom:16px}
  .hero h1{font-size:clamp(2.4rem,6.5vw,${4.4 * t.scale}rem);max-width:16ch}
  .hero h1 .em{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
  .hero p{color:var(--soft);font-size:1.12rem;margin:20px 0 30px;max-width:52ch}
  .hero .cta{display:flex;gap:14px;flex-wrap:wrap}
  section{padding:72px 0}
  .sec-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:30px}
  .sec-head h2{font-size:clamp(1.5rem,3.4vw,2.1rem)}
  .sec-head p{color:var(--soft)}
  .pill{display:inline-block;background:${p.accent}1f;color:var(--accent);border:1px solid ${p.accent}44;padding:4px 12px;border-radius:999px;font-size:.7rem;font-weight:700;letter-spacing:.04em}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:${bp.designSystem.density === 'dense' ? '16px' : '24px'}}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;cursor:pointer;
    transition:transform var(--dur) var(--ease),box-shadow var(--dur) var(--ease),border-color var(--dur)}
  .card:hover{transform:translateY(-6px);box-shadow:0 26px 60px rgba(0,0,0,.4);border-color:${p.accent}66}
  .card .im{height:210px;display:grid;place-items:center;font-size:4.6rem;
    background:radial-gradient(140px 140px at 30% 25%,${p.accent}22,transparent 70%),var(--surface2);transition:transform .5s var(--ease)}
  .card:hover .im{transform:scale(1.06)}
  .card .bd{padding:16px}
  .card .nm{font-weight:600;min-height:2.6em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .card .mt{display:flex;justify-content:space-between;align-items:center;margin-top:10px}
  .card .pr{font-family:${t.display};font-weight:800;color:var(--accent);font-size:1.1rem}
  .card .rt{color:#f5a524;font-size:.82rem}
  .bands{display:flex;flex-wrap:wrap;gap:12px}
  .band{flex:1;min-width:200px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px 20px}
  .band b{color:var(--accent)}
  .tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px}
  .tile{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:22px;text-align:center;transition:transform var(--dur) var(--ease)}
  .tile:hover{transform:translateY(-4px)}
  .tile .ic{font-size:2rem}
  .reviews{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
  .review{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:20px}
  .review .st{color:#f5a524}
  .faq details{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:16px 20px;margin-bottom:12px}
  .faq summary{cursor:pointer;font-weight:600;list-style:none}
  .faq summary::-webkit-details-marker{display:none}
  .faq p{color:var(--soft);margin-top:10px}
  .about{background:var(--surface);border:1px solid var(--border);border-radius:calc(var(--r) + 6px);padding:40px}
  .about p{color:var(--soft);max-width:70ch}
  .news{text-align:center;background:${p.scheme === 'dark' ? `linear-gradient(160deg,${p.accent}18,transparent)` : 'var(--surface)'};border:1px solid var(--border);border-radius:calc(var(--r) + 8px);padding:48px 22px}
  .news .row{display:flex;gap:10px;max-width:440px;margin:20px auto 0}
  .news input{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:12px 18px;color:var(--text)}
  footer{border-top:1px solid var(--border);padding:44px 0;color:var(--soft);margin-top:20px}
  .fcol{display:flex;flex-wrap:wrap;gap:40px;justify-content:space-between}
  .reveal{opacity:0;transform:translateY(22px);transition:opacity .7s var(--ease),transform .7s var(--ease)}
  .reveal.in{opacity:1;transform:none}
  .badge{position:fixed;left:14px;bottom:14px;z-index:60;background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:8px 14px;font-size:.72rem;color:var(--soft)}
  @media(max-width:640px){.nav .menu{display:none}.card .im{height:170px;font-size:3.4rem}.hero{padding:56px 0}}
  `;
}

function cardHtml(p) {
  const seller = p.seller ? p.seller.shop : '';
  return `<article class="card" data-id="${esc(p.id)}">
    <div class="im">${p.emoji || '🛍️'}</div>
    <div class="bd"><div class="nm">${esc(p.name)}</div>
      <div class="mt"><span class="pr">${esc(fcfa(p.price))}</span>${p.rating ? `<span class="rt">★ ${p.rating}</span>` : ''}</div>
    </div></article>`;
}

function sectionMarket(key, bp, products) {
  const grid = (list) => `<div class="grid">${list.map(cardHtml).join('')}</div>`;
  const head = (title, sub) => `<div class="sec-head"><div><span class="pill">${esc(bp.sectorLabel)}</span><h2 style="margin-top:10px">${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div></div>`;
  switch (key) {
    case 'nouveautes': return `<section class="wrap reveal">${head('Nouveautés', 'Les dernières arrivées')}${grid(products.slice(0, 8))}</section>`;
    case 'bestsellers': return `<section class="wrap reveal">${head('Best-sellers', 'Les préférés de nos clients')}${grid(products.slice(0, 4))}</section>`;
    case 'lookbook': case 'collections': case 'signature': case 'plats-signature': case 'menu':
      return `<section class="wrap reveal">${head(bp.sector === 'restaurant' ? 'Notre menu' : 'Collections', '')}${grid(products.slice(0, 8))}</section>`;
    case 'categories': {
      const cats = [...new Set(products.map((p) => p.subcategory || p.category).filter(Boolean))].slice(0, 8);
      return `<section class="wrap reveal">${head('Catégories', 'Explorez la boutique')}<div class="tiles">${cats.map((c) => `<a class="tile"><div class="ic">✦</div><div style="margin-top:8px;font-weight:600">${esc(c)}</div></a>`).join('')}</div></section>`;
    }
    case 'ingredients': case 'bienfaits': case 'specs-cles': case 'savoir-faire': case 'ambiance': case 'routine': case 'avant-apres': case 'editorial': case 'comparateur': case 'accessoires': case 'reservation': case 'sur-mesure': case 'edition-limitee': case 'horaires-acces': case 'avantages': {
      const labels = { ingredients: 'Nos ingrédients', bienfaits: 'Les bienfaits', 'specs-cles': 'Caractéristiques clés', 'savoir-faire': 'Notre savoir-faire', ambiance: "L'ambiance", routine: 'Votre routine', 'avant-apres': 'Avant / Après', editorial: 'Le journal', comparateur: 'Comparez', accessoires: 'Accessoires', reservation: 'Réservez', 'sur-mesure': 'Sur-mesure', 'edition-limitee': 'Édition limitée', 'horaires-acces': 'Horaires & accès', avantages: 'Nos avantages' };
      return `<section class="wrap reveal">${head(labels[key] || key, '')}<div class="bands">
        <div class="band"><b>✓</b> Qualité vérifiée et sélection exigeante</div>
        <div class="band"><b>✓</b> Livraison 24-72h à Bamako</div>
        <div class="band"><b>✓</b> Paiement Orange Money · Wave · à la livraison</div></div></section>`;
    }
    default: return '';
  }
}

/** Rend la boutique complète en HTML autonome. */
function renderStorefront(bp, { seller, products = [] }) {
  const brand = (bp.brief && bp.brief.brandName) || (seller && (seller.shop || seller.name)) || 'Boutique';
  const cards = products.map((p) => catalog.productCard(p));
  const tagline = bp.content.tagline[0];
  const menu = ['Accueil', 'Boutique', 'Nouveautés', bp.sector === 'restaurant' ? 'Réserver' : 'Collections', 'À propos'];
  const reviews = [
    { n: 'Awa T.', s: 5, t: 'Qualité au rendez-vous et livraison rapide. Je recommande !' },
    { n: 'Ibrahim K.', s: 5, t: 'Boutique élégante, produits conformes. Très satisfait.' },
    { n: 'Fatou D.', s: 4, t: 'Belle expérience d\'achat, je reviendrai.' },
  ];
  const marketing = bp.content.marketingSections.map((k) => sectionMarket(k, bp, cards)).join('');

  return `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(brand)} — ${esc(tagline)}</title>
<meta name="description" content="${esc(bp.content.about.slice(0, 160))}">
<meta name="theme-color" content="${bp.designSystem.palette.bg}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap">
<style>${css(bp)}</style></head>
<body>
<nav class="nav">
  <a class="brand"><span class="logo">${esc(brand[0] || 'B')}</span>${esc(brand)}</a>
  <div class="menu">${menu.map((x) => `<a>${esc(x)}</a>`).join('')}</div>
  <div class="actions"><span class="search">🔎 Rechercher…</span><a class="btn ghost">🛒 Panier</a></div>
</nav>

<header class="hero"><div class="wrap">
  <div class="eyebrow">${esc(bp.brief.positioning)} · ${esc(bp.sectorLabel)}</div>
  <h1>${esc(tagline.split('—')[0].trim())} <span class="em">${esc((tagline.split('—')[1] || bp.content.tagline[1] || '').trim())}</span></h1>
  <p>${esc(bp.content.about.slice(0, 170))}</p>
  <div class="cta"><a class="btn">Découvrir la boutique</a><a class="btn ghost">${bp.sector === 'restaurant' ? 'Réserver une table' : 'Voir les nouveautés'}</a></div>
</div></header>

<section class="wrap reveal"><div class="bands">
  ${bp.content.banners.map((b) => `<div class="band"><b>★</b> ${esc(b.title)}</div>`).join('')}
  <div class="band"><b>★</b> ${esc(bp.brief.positioning)} — sélection exigeante</div>
</div></section>

<section class="wrap reveal">
  <div class="sec-head"><div><span class="pill">Boutique</span><h2 style="margin-top:10px">${bp.sector === 'restaurant' ? 'Notre carte' : 'Nos produits'}</h2><p>${esc(bp.components.card)}</p></div></div>
  <div class="grid">${cards.length ? cards.map(cardHtml).join('') : '<p style="color:var(--soft)">Ajoutez des produits à votre boutique pour les voir ici.</p>'}</div>
</section>

${marketing}

<section class="wrap reveal">
  <div class="sec-head"><div><span class="pill">Confiance</span><h2 style="margin-top:10px">Avis clients</h2></div></div>
  <div class="reviews">${reviews.map((r) => `<div class="review"><div class="st">${'★'.repeat(r.s)}</div><p style="margin:8px 0;color:var(--soft)">${esc(r.t)}</p><b>${esc(r.n)}</b></div>`).join('')}</div>
</section>

<section class="wrap reveal"><div class="about"><span class="pill">À propos</span><h2 style="margin:12px 0">${esc(brand)}</h2><p>${esc(bp.content.about)}</p></div></section>

<section class="wrap reveal"><div class="sec-head"><div><span class="pill">Aide</span><h2 style="margin-top:10px">Questions fréquentes</h2></div></div>
  <div class="faq">${bp.content.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
</section>

<section class="wrap reveal"><div class="news"><span class="pill">Newsletter</span><h2 style="margin:12px 0">Restez informé${bp.sector === 'cosmetique' ? 'e' : ''}</h2>
  <p style="color:var(--soft)">Nouveautés et offres, directement chez vous.</p>
  <div class="row"><input placeholder="Votre email"><button class="btn">S'inscrire</button></div></div>
</section>

<footer><div class="wrap fcol">
  <div><div class="brand"><span class="logo">${esc(brand[0] || 'B')}</span>${esc(brand)}</div><p style="margin-top:10px;max-width:34ch">${esc(bp.content.tagline[0])}</p></div>
  <div><b>Boutique</b><p style="margin-top:8px">Nouveautés · Collections · Best-sellers</p></div>
  <div><b>Aide</b><p style="margin-top:8px">Livraison · Retours · FAQ · Contact</p></div>
  <div><b>Paiement</b><p style="margin-top:8px">Orange Money · Moov Money · Wave · Livraison</p></div>
</div><div class="wrap" style="margin-top:24px;font-size:.8rem">© ${new Date().getFullYear()} ${esc(brand)} — Propulsé par E-Market. Design original généré par IA.</div></footer>

<div class="badge">✨ ${esc(bp.name)} — boutique générée par E-Market AI</div>
<script>
  const io=new IntersectionObserver((es)=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
  document.querySelectorAll('.card').forEach(c=>c.addEventListener('click',()=>{if(c.dataset.id)location.href='/?p='+encodeURIComponent(c.dataset.id)}));
</script>
</body></html>`;
}

module.exports = { renderStorefront };
