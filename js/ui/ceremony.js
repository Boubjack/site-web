/**
 * ceremony.js — Déroulé des Boubjack Awards.
 *
 * Implémente la mise en scène du Tome VII, séquence par séquence :
 *   ch. 3 — tapis rouge : arrivées, interviews, photos, signatures
 *   ch. 4 — les dix temps de la cérémonie, 30 à 45 minutes annoncées
 *   ch. 6 — discours de la légende qui remet le trophée
 *   ch. 7 — suspense : nominés, statistiques, réactions du public, caméra sur
 *           le favori, ouverture de l'enveloppe, silence, annonce
 *   ch. 8 — montée collective sur scène, photo officielle, feux d'artifice,
 *           confettis, musique, filigrane permanent en bas à droite
 *
 * Le filigrane « Boubjack Awards » est appliqué par la classe `.ceremony`
 * (voir css/main.css) et reste visible pendant toute la cérémonie.
 */

import { el, badge, button, modal, render, wait, confetti, num } from './dom.js';

/** Durée d'une pause, annulée si les animations sont réduites. */
function beat(ms) {
  return wait(document.documentElement.dataset.motion === 'reduced' ? 0 : ms);
}

/**
 * Joue une cérémonie complète.
 * @param {object} ceremony objet produit par AwardsSystem.holdBoubjackAwards
 * @param {Function} onFinish rappel de rafraîchissement de l'interface
 */
export async function playCeremony(ceremony, onFinish) {
  const stage = el('div.ceremony-stage');
  const content = el('div.stack');
  const progress = el('div.meter', {}, el('div.meter-fill', { style: { width: '0%' } }));
  const skipHost = el('div.row');

  let skipped = false;
  const skipButton = button('Passer la cérémonie', () => { skipped = true; }, { variant: 'ghost', size: 'sm' });
  skipHost.appendChild(skipButton);

  const { close } = modal({
    title: `Boubjack Awards ${ceremony.season + 1} — ${ceremony.cityName}`,
    wide: true,
    dismissible: false,
    body: el('div.ceremony', {
      // Chaque édition possède son identité visuelle (Tome VII ch. 2).
      style: { borderColor: ceremony.design.palette[1] },
    }, [
      el('div.row-between.mb-4', {}, [
        el('div', {}, [
          el('div.xs.dim', {}, `Scénographie « ${ceremony.design.name} » — ${ceremony.design.set}`),
          el('div.xs.dim', {}, `${ceremony.venue} · durée ${ceremony.durationMinutes} minutes`),
        ]),
        skipHost,
      ]),
      progress,
      stage,
      content,
    ]),
    footer: [button('Fermer', () => { close(); if (onFinish) onFinish(); }, { variant: 'primary' })],
  });

  const setStage = (title, subtitle, extra) => {
    render(stage, [
      el('h3', { style: { color: ceremony.design.palette[1], margin: '0 0 0.5rem' } }, title),
      subtitle ? el('p.muted.mb-0', {}, subtitle) : null,
      extra || null,
    ]);
  };

  const totalSteps = ceremony.flow.length + ceremony.categories.length;
  let step = 0;
  const advance = () => {
    step++;
    progress.firstChild.style.width = `${Math.min(100, (step / totalSteps) * 100)}%`;
  };

  // ── Tapis rouge (ch. 3) ─────────────────────────────────────────────────
  setStage('Tapis rouge', `${num(ceremony.redCarpet.crowdSize)} personnes massées derrière les barrières · ${ceremony.redCarpet.photographers} photographes.`);

  const carpetList = el('div.stack');
  content.appendChild(carpetList);

  for (const arrival of ceremony.redCarpet.arrivals.slice(0, 12)) {
    if (skipped) break;
    carpetList.insertBefore(
      el('div.row', { style: arrival.isPlayer ? { borderLeft: '3px solid var(--gold)', paddingLeft: '0.5rem' } : {} }, [
        el('span.small.bold', { class: arrival.isPlayer ? 'gold' : '' }, arrival.name),
        el('span.xs.dim', {}, `— ${arrival.group}, ${arrival.outfit}`),
        arrival.interviewed ? badge('interview', 'ok') : null,
        arrival.photographed ? badge('photos') : null,
        arrival.signedAutographs ? badge('autographes') : null,
      ]),
      carpetList.firstChild,
    );
    await beat(320);
  }

  // ── Les dix temps de la cérémonie (ch. 4) ───────────────────────────────
  const flowTexts = {
    presentation: `${ceremony.host.name} ouvre la soirée depuis ${ceremony.venue}.`,
    ouverture: `Les lumières s'éteignent. ${ceremony.design.set} s'illumine.`,
    discours: `${ceremony.host.name} : « Le football change, mais l'émotion reste la même. »`,
    spectacles: 'Un spectacle mêlant danse et projections retrace la saison écoulée.',
    invites: 'Les légendes rejoignent leurs places au premier rang.',
    annonces: 'Les catégories de la soirée sont annoncées une à une.',
    revelations: 'Les premières enveloppes remontent vers la scène.',
    remise: 'Place à la remise des trophées.',
    photos: 'Photos officielles des lauréats.',
    cloture: 'Le rideau tombe sur cette édition.',
  };

  for (const phase of ceremony.flow) {
    if (skipped) break;
    if (phase.id === 'remise') break; // la remise se joue catégorie par catégorie
    setStage(phase.name, flowTexts[phase.id], el('div.xs.dim', {}, `${phase.minutes} min`));
    advance();
    await beat(700);
  }

  render(content, el('div.stack'));
  const winnersList = el('div.stack');
  content.appendChild(winnersList);

  // ── Remise des trophées, avec suspense (ch. 7) ──────────────────────────
  for (const category of ceremony.categories) {
    if (skipped) break;

    // 1. Le présentateur monte sur scène et prononce son discours.
    setStage(category.name, `Trophée remis par ${category.presenter.name} — ${category.presenter.trait}.`);
    await beat(600);

    // 2. Présentation des nominés avec leurs statistiques.
    const nomineeNodes = category.nominees.map((nominee) =>
      el(`div.nominee${nominee.isPlayer ? '.is-player' : ''}`, {}, [
        el('div', {}, [
          el('div.small.bold', {}, nominee.name),
          el('div.xs.dim', {}, nominee.detail),
        ]),
        nominee.isPlayer ? badge('Vous', 'gold') : null,
      ]));

    render(content, el('div.stack', {}, [
      el('div.xs.dim', {}, `« ${category.speech} »`),
      el('div.card-title', {}, 'Les nominés'),
      ...nomineeNodes,
    ]));
    await beat(900);

    // 3. Réaction du public et caméra sur le favori.
    setStage(category.name, `${category.suspense.crowdReaction} · caméra sur ${category.suspense.cameraOnFavourite}.`);
    await beat(600);

    // 4. Ouverture de l'enveloppe, puis silence.
    setStage(category.name, "L'enveloppe s'ouvre…");
    await beat(500);
    setStage(category.name, '…');
    await beat(700);

    // 5. Annonce du vainqueur.
    const winnerIndex = category.nominees.indexOf(category.winner);
    if (winnerIndex >= 0 && nomineeNodes[winnerIndex]) {
      nomineeNodes[winnerIndex].classList.add('winner', 'pulse');
    }

    setStage(
      `🏆 ${category.winner.name}`,
      `${category.name} — trophée ${category.trophy.design}, gravé « ${category.trophy.engraving} ».`,
    );

    if (category.playerWon) confetti(45);
    await beat(1000);

    winnersList.appendChild(el('div.row-between', {}, [
      el('span.small', { class: category.playerWon ? 'gold bold' : 'muted' }, category.name),
      el('span.small.bold', {}, category.winner.name),
    ]));

    advance();
  }

  // ── Final collectif (ch. 8) ─────────────────────────────────────────────
  setStage(
    'Photo officielle',
    ceremony.finale.text,
  );

  render(content, el('div.stack', {}, [
    el('div.card-title', {}, `Palmarès — Boubjack Awards ${ceremony.season + 1}`),
    winnersList,
    ceremony.playerWins.length
      ? el('div.notice', {}, [
          el('strong', {}, `Vous repartez avec ${ceremony.playerWins.length} trophée(s) : `),
          ceremony.playerWins.map((w) => w.name).join(', '),
          '.',
        ])
      : el('p.dim.small.mb-0', {}, ceremony.invited
          ? 'Vous étiez présent sur le tapis rouge, mais repartez sans trophée cette année.'
          : "Vous n'étiez pas invité à cette édition. Une réputation de 45 ouvre les portes de la cérémonie."),
  ]));

  progress.firstChild.style.width = '100%';
  if (!skipped) confetti(130);

  skipButton.remove();
  if (onFinish) onFinish();
}
