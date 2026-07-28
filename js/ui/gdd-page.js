/**
 * gdd-page.js — Lecteur du Game Design Document.
 *
 * Rend l'intégralité du corpus des tomes, sans résumé ni troncature, avec :
 *   - un sommaire latéral suivant la lecture
 *   - une recherche plein texte
 *   - les annotations éditoriales (doublons, tomes non transmis)
 */

import { TOMES, GDD_META, countChapters, countRequirements } from '../data/gdd.js';
import { el, render, card, stat, badge, siteHeader, siteFooter, $ } from './dom.js';

export function renderGddPage(root) {
  document.body.prepend(siteHeader('gdd'));

  const toc = el('nav.doc-toc', { 'aria-label': 'Sommaire' });
  const content = el('div');

  render(root, el('div.shell', {}, [
    el('div.container-wide', {}, [
      el('div', { style: { paddingTop: '2rem' } }, [
        el('h1', {}, 'Game Design Document'),
        el('p.muted', {}, `${GDD_META.project} — version ${GDD_META.version} · classification ${GDD_META.classification}`),
        el('div.grid.grid-4.mb-4', {}, [
          stat('Tomes', TOMES.filter((t) => !t.missing).length),
          stat('Chapitres', countChapters()),
          stat('Exigences recensées', countRequirements()),
          stat('Emplacements réservés', TOMES.filter((t) => t.missing).length),
        ]),
        el('div.notice.mb-4', {}, [
          el('strong', {}, 'Notes éditoriales. '),
          el('ul.mb-0', {}, GDD_META.editorialNotes.map((note) => el('li', {}, note))),
        ]),
        searchBox(content),
      ]),
      el('div.doc-shell', {}, [toc, content]),
    ]),
    siteFooter(),
  ]));

  renderToc(toc);
  renderTomes(content);
  installScrollSpy();
}

function searchBox(content) {
  const input = el('input', {
    type: 'search',
    placeholder: 'Rechercher dans le document (ex. « arbitre », « musée », « exclusivité »)…',
  });
  const summary = el('p.small.dim', {}, '');

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();

    // Réinitialisation
    for (const mark of Array.from(content.querySelectorAll('mark'))) {
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    }

    if (query.length < 3) {
      for (const tome of Array.from(content.querySelectorAll('.tome'))) tome.hidden = false;
      summary.textContent = query.length ? 'Saisissez au moins trois caractères.' : '';
      return;
    }

    let matches = 0;
    let visibleTomes = 0;

    for (const tome of Array.from(content.querySelectorAll('.tome'))) {
      const hit = tome.textContent.toLowerCase().includes(query);
      tome.hidden = !hit;
      if (!hit) continue;
      visibleTomes++;

      // Surlignage des occurrences dans les nœuds texte.
      const walker = document.createTreeWalker(tome, NodeFilter.SHOW_TEXT);
      const targets = [];
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue.toLowerCase().includes(query)) targets.push(node);
      }
      for (const textNode of targets) {
        const value = textNode.nodeValue;
        const index = value.toLowerCase().indexOf(query);
        if (index === -1) continue;
        const fragment = document.createDocumentFragment();
        fragment.appendChild(document.createTextNode(value.slice(0, index)));
        const mark = document.createElement('mark');
        mark.style.background = 'rgba(201,162,39,0.35)';
        mark.style.color = 'inherit';
        mark.textContent = value.slice(index, index + query.length);
        fragment.appendChild(mark);
        fragment.appendChild(document.createTextNode(value.slice(index + query.length)));
        textNode.parentNode.replaceChild(fragment, textNode);
        matches++;
      }
    }

    summary.textContent = matches
      ? `${matches} occurrence(s) dans ${visibleTomes} tome(s).`
      : 'Aucun résultat.';
  });

  return el('div.field', {}, [input, summary]);
}

function renderToc(toc) {
  render(toc, [
    el('div.card-title', {}, 'Sommaire'),
    ...TOMES.map((tome) =>
      el('a', {
        href: `#${tome.id}`,
        class: tome.missing ? 'dim' : '',
      }, [
        el('span.numeral', {}, tome.numeral),
        tome.title,
      ])),
  ]);
}

function renderTomes(content) {
  render(content, TOMES.map((tome) => el('section.tome', { id: tome.id }, [
    el('div.tome-header', {}, [
      el('div.tome-numeral', {}, `Tome ${tome.numeral}`),
      el('h2.mb-0', {}, tome.title),
      el('div.row.mt-4', {}, [
        badge(`Version ${tome.version}`),
        badge(`${tome.chapters.length} chapitre(s)`),
        tome.missing ? badge('Non transmis', 'warn') : null,
      ]),
      tome.note ? el('div.tome-note', {}, tome.note) : null,
    ]),

    ...tome.chapters.map((chapter) => el('article.chapter', { id: `${tome.id}-ch${chapter.n}` }, [
      el('h3.chapter-title', {}, [
        el('span.n', {}, `Chapitre ${chapter.n}`),
        chapter.title,
      ]),
      ...(chapter.lead || []).map((line) => el('p', {}, line)),
      chapter.bullets?.length ? el('ul', {}, chapter.bullets.map((b) => el('li', {}, b))) : null,
      ...(chapter.tail || []).map((line) => el('p', {}, line)),

      ...(chapter.subsections || []).map((sub) => el('div.subsection', {}, [
        el('h5', {}, sub.title),
        ...(sub.lead || []).map((line) => el('p', {}, line)),
        sub.bullets?.length ? el('ul', {}, sub.bullets.map((b) => el('li', {}, b))) : null,
        ...(sub.tail || []).map((line) => el('p', {}, line)),
      ])),
    ])),
  ])));
}

/** Met en évidence le tome en cours de lecture dans le sommaire. */
function installScrollSpy() {
  const links = Array.from(document.querySelectorAll('.doc-toc a'));
  const sections = Array.from(document.querySelectorAll('.tome'));
  if (!('IntersectionObserver' in window) || sections.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const id = entry.target.id;
      for (const link of links) {
        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
      }
    }
  }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });

  sections.forEach((section) => observer.observe(section));
}

void card;
void $;
