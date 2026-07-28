/**
 * trace-page.js — Matrice de traçabilité GDD → implémentation.
 *
 * Rend la table honnête de ce qui tourne, de ce qui est modélisé et de ce qui
 * relève du moteur 3D. Exigé implicitement par le Tome XV ch. 1 : « aucune
 * fonctionnalité incomplète ne doit être publiée » — donc rien ne doit être
 * déclaré terminé sans l'être.
 */

import { TRACE, STATUS_LABELS, coverage } from '../data/traceability.js';
import { TOMES } from '../data/gdd.js';
import { el, render, card, stat, badge, button, siteHeader, siteFooter } from './dom.js';

export function renderTracePage(root) {
  document.body.prepend(siteHeader('trace'));

  const cov = coverage();
  const listHost = el('div');
  let filter = 'all';
  let tomeFilter = 'all';

  const draw = () => {
    const rows = TRACE.filter((entry) =>
      (filter === 'all' || entry.status === filter) &&
      (tomeFilter === 'all' || entry.tome === tomeFilter));

    render(listHost, rows.length
      ? el('div.card', { style: { padding: '0' } }, rows.map((entry) =>
          el('div.trace-row', {}, [
            el('div', {}, [
              el('div.tome-ref', {}, entry.tome),
              el('div.chapter-ref', {}, entry.chapter),
            ]),
            el('div', {}, [
              el('div.req', {}, entry.requirement),
              el('div.note', {}, entry.note),
              entry.module !== '—' ? el('div.module', {}, entry.module) : null,
            ]),
            el('div', {}, badge(
              STATUS_LABELS[entry.status].label,
              STATUS_LABELS[entry.status].color === 'ok' ? 'ok'
                : STATUS_LABELS[entry.status].color === 'warn' ? 'warn' : 'engine',
            )),
          ])))
      : el('p.dim', {}, 'Aucune entrée pour ce filtre.'));
  };

  const filterButton = (label, value, kind) => button(label, () => {
    if (kind === 'status') filter = value; else tomeFilter = value;
    draw();
    // Reflet visuel de l'état actif.
    for (const b of Array.from(document.querySelectorAll(`[data-filter-kind="${kind}"]`))) {
      b.classList.toggle('btn-primary', b.dataset.filterValue === String(value));
    }
  }, { size: 'sm', variant: value === (kind === 'status' ? filter : tomeFilter) ? 'primary' : 'ghost' });

  const withData = (node, kind, value) => {
    node.dataset.filterKind = kind;
    node.dataset.filterValue = String(value);
    return node;
  };

  const tomeNumerals = Array.from(new Set(TRACE.map((t) => t.tome)));

  render(root, el('div.shell', {}, [
    el('div.container', { style: { paddingTop: '2rem' } }, [
      el('h1', {}, 'Traçabilité'),
      el('p.muted', {}, 'Ce que le prototype exécute réellement, chapitre par chapitre du Game Design Document. Cette page est délibérément franche : elle sert à distinguer une spécification d\'une implémentation.'),

      el('div.grid.grid-4.mb-4', {}, [
        stat('Exigences suivies', cov.total),
        stat('Implémentées', `${cov.implemented} · ${cov.implementedPct} %`, { tone: 'ok' }),
        stat('Modélisées', `${cov.modelled} · ${cov.modelledPct} %`),
        stat('Moteur requis', `${cov.engine} · ${cov.enginePct} %`),
      ]),

      card('Couverture', [
        el('div.coverage-bar', {}, [
          el('div.coverage-seg.implemented', { style: { flex: String(cov.implemented) } }, `${cov.implementedPct} %`),
          el('div.coverage-seg.modelled', { style: { flex: String(cov.modelled) } }, `${cov.modelledPct} %`),
          el('div.coverage-seg.engine', { style: { flex: String(cov.engine) } }, `${cov.enginePct} %`),
        ]),
        el('div.grid.grid-3.mt-4', {}, Object.entries(STATUS_LABELS).map(([key, meta]) =>
          el('div.panel', {}, [
            badge(meta.label, meta.color === 'ok' ? 'ok' : meta.color === 'warn' ? 'warn' : 'engine'),
            el('p.xs.muted.mt-4.mb-0', {}, meta.description),
            el('div.xs.dim', {}, `${cov[key]} exigence(s)`),
          ]))),
      ]),

      el('div.notice.warn.mb-4', {}, [
        el('strong', {}, 'Pourquoi tout n\'est pas « implémenté ». '),
        'Un moteur de rendu 3D, 100 000 animations capturées, 500 000 lignes de commentaire enregistrées en studio, ',
        'de l\'audio spatialisé et un netcode multijoueur sont des chantiers de studio, chiffrés en années-personnes. ',
        'Les déclarer terminés ici serait faux. Ce qui figure en « implémenté » a été écrit, exécuté et testé.',
      ]),

      card('Filtrer', [
        el('div.row.mb-4', {}, [
          el('span.small.muted', {}, 'Statut :'),
          withData(filterButton('Tout', 'all', 'status'), 'status', 'all'),
          withData(filterButton('Implémenté', 'implemented', 'status'), 'status', 'implemented'),
          withData(filterButton('Modélisé', 'modelled', 'status'), 'status', 'modelled'),
          withData(filterButton('Moteur requis', 'engine', 'status'), 'status', 'engine'),
        ]),
        el('div.row', {}, [
          el('span.small.muted', {}, 'Tome :'),
          withData(filterButton('Tous', 'all', 'tome'), 'tome', 'all'),
          ...tomeNumerals.map((numeral) => withData(filterButton(numeral, numeral, 'tome'), 'tome', numeral)),
        ]),
      ]),

      listHost,

      card('Tomes du corpus', el('div.row', {}, TOMES.map((tome) =>
        badge(`${tome.numeral} — ${tome.title}`, tome.missing ? 'warn' : '')))),
    ]),
    siteFooter(),
  ]));

  draw();
}
