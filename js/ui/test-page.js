/**
 * test-page.js — Exécution de la suite de tests dans le navigateur.
 *
 * Tome XV ch. 2 : tests unitaires, d'intégration et de sauvegarde avant chaque
 * mise à jour. La même suite tourne en Node (`node tests/run.js`) et ici, sur
 * le moteur réellement chargé par le navigateur — ce qui vérifie du même coup
 * que tous les modules se résolvent correctement en conditions réelles.
 */

import { el, render, card, stat, badge, button, siteHeader, siteFooter } from './dom.js';

export async function renderTestPage(root) {
  document.body.prepend(siteHeader('tests'));

  const host = el('div');
  render(root, el('div.shell', {}, [
    el('div.container', { style: { paddingTop: '2rem' } }, [
      el('h1', {}, 'Suite de tests'),
      el('p.muted', {}, 'La même suite s\'exécute ici et en ligne de commande via ' + '`node tests/run.js`. Elle couvre le bus d\'événements, le générateur déterministe, l\'horloge, l\'état, les migrations de sauvegarde, la cohérence des données du monde, la traçabilité et une série de scénarios d\'intégration bout en bout.'),
      host,
    ]),
    siteFooter(),
  ]));

  render(host, el('p.muted', {}, 'Exécution en cours…'));

  let report;
  try {
    const module = await import('../../tests/run.js');
    report = module.runTests();
  } catch (error) {
    render(host, el('div.notice.warn', {}, [
      el('strong', {}, 'La suite n\'a pas pu être chargée. '),
      'Servez le dossier via HTTP : les modules ES ne se résolvent pas en protocole fichier.',
      el('div.mono.xs.mt-4', {}, String(error.message)),
    ]));
    return;
  }

  const bySuite = {};
  for (const result of report.results) {
    (bySuite[result.suite] ||= []).push(result);
  }

  const allPassed = report.failed.length === 0;

  const rerun = button('Relancer', () => window.location.reload(), { variant: 'ghost' });

  render(host, el('div.stack', {}, [
    el('div.grid.grid-4', {}, [
      stat('Total', report.total),
      stat('Réussis', report.passed, { tone: 'ok' }),
      stat('Échecs', report.failed.length, { tone: report.failed.length ? 'danger' : '' }),
      stat('Suites', Object.keys(bySuite).length),
    ]),

    allPassed
      ? el('div.notice', { style: { borderLeftColor: 'var(--ok)' } }, [
          el('strong.ok', {}, `✓ ${report.passed}/${report.total} tests réussis. `),
          'Le moteur se comporte comme spécifié sur l\'ensemble des scénarios couverts.',
        ])
      : el('div.notice.warn', {}, [
          el('strong.danger', {}, `${report.failed.length} échec(s). `),
          'Détail ci-dessous.',
        ]),

    el('div.row', {}, [rerun]),

    ...Object.entries(bySuite).map(([suite, entries]) => {
      const passed = entries.filter((e) => e.ok).length;
      return card(null, [
        el('div.row-between.mb-4', {}, [
          el('h4.mb-0', {}, suite),
          badge(`${passed}/${entries.length}`, passed === entries.length ? 'ok' : 'danger'),
        ]),
        el('div.stack', {}, entries.map((entry) =>
          el('div', {}, [
            el('div.small', { class: entry.ok ? '' : 'danger' }, `${entry.ok ? '✓' : '✗'} ${entry.name}`),
            entry.ok ? null : el('div.mono.xs.danger', { style: { paddingLeft: '1.2rem' } }, `→ ${entry.error}`),
          ]))),
      ]);
    }),
  ]));
}
