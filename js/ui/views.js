/**
 * views.js — Écrans du prototype jouable.
 *
 * Chaque fonction retourne un fragment DOM pour un onglet de l'interface.
 * Aucune ne modifie l'état directement : elles appellent les systèmes du jeu,
 * puis demandent un rafraîchissement via le rappel `refresh`.
 *
 * Tome XII ch. 1 : le joueur doit voir le moins de menus possible — les vues
 * privilégient donc l'action directe plutôt que les sous-menus imbriqués.
 */

import {
  el, card, stat, badge, meter, attributeRow, button, table,
  money, num, compact, toast, modal, render, wait, confetti,
} from './dom.js';

import {
  CITIES, TRANSPORTS, INVESTMENT_TYPES, PROPERTY_TYPES, STAFF_ROLES,
  LUXURY_ITEMS, VEHICLES, getCity, getCountry, getClub, distanceKm, worldStats,
} from '../data/world.js';
import { TRAINING_SESSIONS, STAR_ACTIVITIES } from '../systems/career.js';
import { APPS, POST_TYPES, ORDERABLE, DELIVERY_POINTS } from '../systems/phone.js';
import { PRESS_ANSWERS } from '../systems/media.js';
import { FAN_INTERACTIONS } from '../systems/reputation.js';
import { playCeremony } from './ceremony.js';

// ── Tableau de bord ────────────────────────────────────────────────────────

export function dashboardView(game, refresh) {
  const s = game.snapshot();
  const brief = game.systems.phone.secretaryBriefing();
  const player = s.player;

  return el('div.stack', {}, [
    // Bandeau d'identité
    card(null, [
      el('div.row-between', {}, [
        el('div', {}, [
          el('h3.mb-0', {}, player.name),
          el('div.muted.small', {}, [
            `${player.positionLabel} · ${player.age} ans · pied ${player.foot} · ${player.style}`,
          ]),
          el('div.row.mt-4', {}, [
            badge(s.club?.name || '—', 'gold'),
            badge(s.squadStatus),
            badge(s.reputation.tier.label),
            player.retired ? badge('Retraité', 'engine') : null,
            player.injury ? badge(`Blessé — ${player.injury.daysLeft} j`, 'danger') : null,
          ]),
        ]),
        el('div.right', {}, [
          el('div.stat-label', {}, 'Niveau global'),
          el('div', { style: { fontSize: '3rem', fontWeight: '700', lineHeight: '1', color: 'var(--gold)' } }, String(player.overall)),
          el('div.stat-sub', {}, money(s.marketValue)),
        ]),
      ]),
    ]),

    // Indicateurs clés
    el('div.grid.grid-4', {}, [
      stat('Réputation', `${s.reputation.global.toFixed(1)}`, { tone: 'gold', sub: s.reputation.tier.label }),
      stat('Patrimoine net', money(s.finance.netWorth), { sub: `${money(s.finance.monthlyIncome - s.finance.monthlyBurn)} / mois` }),
      stat('Buts en carrière', num(s.stats.career.buts), { sub: `${num(s.stats.career.matchs)} matchs` }),
      stat('Palmarès', `${s.legacy.trophies} 🏆`, { sub: `${s.legacy.awards} récompense(s)` }),
    ]),

    el('div.grid.grid-2', {}, [
      // Condition physique
      card('Condition', [
        el('div.stack', {}, [
          conditionRow('Forme', player.condition.forme, 'ok'),
          conditionRow('Fatigue', player.condition.fatigue, player.condition.fatigue > 75 ? 'danger' : player.condition.fatigue > 50 ? 'warn' : 'ok', true),
          conditionRow('Moral', player.condition.moral, 'accent'),
          conditionRow('Confiance', player.condition.confiance, 'accent'),
          conditionRow('Bien-être', game.state.personal.wellbeing, 'ok'),
        ]),
        player.injury
          ? el('div.notice.warn.mt-4', {}, [
              el('strong', {}, `Blessure : ${player.injury.type}`),
              ` (${player.injury.severity}) — ${player.injury.daysLeft} jours d'indisponibilité.`,
            ])
          : null,
      ]),

      // Briefing de l'IA secrétaire
      card('IA Secrétaire', [
        el('p.small.muted', {}, brief.greeting),
        brief.agenda.length
          ? el('div.stack', {}, brief.agenda.slice(0, 6).map((item) =>
              el('div.row', { style: { alignItems: 'flex-start', gap: '0.5rem' } }, [
                el('span', {}, item.icon),
                el('span.small', { class: item.priority === 'haute' ? 'warn' : 'muted' }, item.text),
              ])))
          : el('p.small.dim', {}, 'Journée libre, rien à votre agenda.'),
        brief.weatherWarning ? el('div.notice.warn.mt-4', {}, brief.weatherWarning) : null,
      ]),
    ]),

    // Prochain match
    s.nextFixture ? nextMatchCard(game, s, refresh) : card('Calendrier', el('p.dim.mb-0', {}, 'Aucune rencontre programmée.')),

    el('div.grid.grid-2', {}, [
      // Attributs
      card('Attributs', el('div.stack', {},
        Object.entries(player.attributes)
          .sort((a, b) => b[1] - a[1])
          .map(([name, value]) => attributeRow(name, value)),
      )),

      // Actualités
      card('Une du jour', game.state.media.headlines.length
        ? el('div.stack', {}, game.state.media.headlines.slice(0, 5).map((h) =>
            el('div', {}, [
              el('div.small.bold', {}, h.title),
              el('div.xs.dim', {}, `${h.outlet} · ${h.date}`),
            ])))
        : el('p.dim.mb-0', {}, 'Pas encore d\'actualité.')),
    ]),

    // Analyse de carrière
    card('Analyse de carrière', [
      el('div.grid.grid-3', {}, [
        stat('Note moyenne', brief.analysis.averageRating || '—'),
        stat('Buts / match', brief.analysis.goalsPerMatch),
        stat('Tendance', brief.analysis.trend, { tone: brief.analysis.trend === 'en progression' ? 'ok' : brief.analysis.trend === 'en baisse' ? 'danger' : '' }),
      ]),
      el('div.grid.grid-2.mt-4', {}, [
        el('div', {}, [
          el('div.card-title', {}, 'Points forts'),
          el('div.row', {}, brief.analysis.strengths.map((s2) => badge(s2, 'ok'))),
        ]),
        el('div', {}, [
          el('div.card-title', {}, 'À travailler'),
          el('div.row', {}, brief.analysis.weaknesses.map((w) => badge(w, 'warn'))),
        ]),
      ]),
      el('p.small.muted.mt-4.mb-0', {}, `💡 ${brief.analysis.recommendation}`),
    ]),
  ]);
}

function conditionRow(label, value, tone, inverse = false) {
  return el('div', {}, [
    el('div.row-between', {}, [
      el('span.small.muted', {}, label),
      el('span.small.bold.nums', {}, `${Math.round(value)}${inverse ? ' %' : ''}`),
    ]),
    meter(value, 100, tone),
  ]);
}

function nextMatchCard(game, s, refresh) {
  const fixture = s.nextFixture;
  const opponent = getClub(fixture.opponentId);
  const daysUntil = Math.round(
    (new Date(fixture.date.year, fixture.date.month, fixture.date.day) -
      new Date(s.clock.year, s.clock.month, s.clock.day)) / 86400000,
  );

  return card('Prochaine rencontre', [
    el('div.row-between', {}, [
      el('div', {}, [
        el('h4.mb-0', {}, `${s.club?.name} ${fixture.home ? 'reçoit' : 'se déplace chez'} ${fixture.opponentName}`),
        el('div.small.muted', {}, [
          `${fixture.competition} · ${fixture.date.day}/${fixture.date.month + 1}/${fixture.date.year}`,
          daysUntil > 0 ? ` · dans ${daysUntil} jour(s)` : ' · aujourd\'hui',
        ]),
        el('div.row.mt-4', {}, [
          badge(fixture.home ? 'Domicile' : 'Extérieur', fixture.home ? 'ok' : ''),
          opponent ? badge(`Prestige ${opponent.prestige}`) : null,
          badge(`Enjeu ${Math.round((fixture.importance || 0.5) * 100)} %`, fixture.importance > 0.75 ? 'gold' : ''),
        ]),
      ]),
      el('div.row', {}, [
        daysUntil > 0
          ? button(`Avancer de ${daysUntil} j`, () => {
              game.advanceDays(daysUntil);
              refresh();
            }, { variant: 'ghost' })
          : null,
        button('Jouer le match', () => openMatch(game, fixture, refresh), { variant: 'primary', disabled: daysUntil > 0 }),
      ]),
    ]),
  ]);
}

// ── Match ──────────────────────────────────────────────────────────────────

/**
 * Ouvre la fenêtre de match et déroule la rencontre minute par minute.
 * Tome XVI ch. 2 : la mise en scène du match day précède le coup d'envoi.
 */
export async function openMatch(game, fixture, refresh) {
  const result = game.systems.career.playFixture(fixture.id);
  if (!result.ok) {
    toast({ title: 'Match indisponible', body: result.reason, level: 'warn' });
    return;
  }

  const report = result.report;
  const feed = el('div.match-feed');
  const scoreNode = el('div', { style: { fontSize: '2.5rem', fontWeight: '700', textAlign: 'center' } }, '0 - 0');
  const statusNode = el('div.center.small.muted', {}, "Arrivée du bus · Entrée dans le stade · Tunnel · Hymnes");

  // Un rapport d'absence ne porte ni stade, ni arbitre, ni météo : les entêtes
  // ne sont construits que lorsque le joueur figure sur la feuille de match.
  const contextBadges = report.absent ? [] : [
    badge(`${report.weather.icon} ${report.weather.type}, ${report.weather.tempC} °C`),
    badge(`Pelouse ${report.weather.pitchQuality}/100`),
    badge(`Arbitre ${report.referee.name} — ${report.referee.style}`),
    badge(`Adversaire en ${report.opponentStyle}`),
  ];

  const { close, body } = modal({
    title: `${report.club} — ${report.opponent}`,
    wide: true,
    body: el('div.stack', {}, [
      el('div.panel', {}, [
        el('div.center.small.dim', {}, report.absent
          ? `${report.competition} · ${report.home ? 'domicile' : 'extérieur'}`
          : `${report.stadium.name} · ${num(report.attendance)} spectateurs`),
        scoreNode,
        statusNode,
      ]),
      contextBadges.length
        ? el('div.row.center', { style: { justifyContent: 'center' } }, contextBadges)
        : null,
      feed,
    ]),
    footer: [button('Fermer', () => { close(); refresh(); })],
  });

  if (report.absent) {
    render(feed, el('div.notice.warn', {}, [
      el('strong', {}, `${game.state.player.name} n'est pas sur la feuille de match. `),
      `Motif : ${report.absenceReason}. La rencontre s'est jouée sans vous — le monde n'attend pas.`,
    ]));
    statusNode.textContent = `Résultat final : ${report.resultat}`;
    scoreNode.textContent = report.scoreLabel;
    refresh();
    return;
  }

  // Déroulé du match : les commentaires arrivent au fil du temps.
  statusNode.textContent = 'Coup d\'envoi';
  let home = 0;
  let away = 0;
  const isHome = report.home;

  for (const line of report.commentary) {
    if (body.isConnected === false) break;
    const type = line.startsWith('⚽') ? 'but'
      : line.startsWith('😐') ? 'but-adverse'
      : line.startsWith('🟨') ? 'jaune'
      : line.startsWith('🟥') ? 'rouge'
      : line.startsWith('🚑') ? 'blessure'
      : '';

    feed.appendChild(el(`div.match-line${type ? `.${type}` : ''}`, {}, line));
    feed.scrollTop = feed.scrollHeight;

    if (type === 'but') { if (isHome) home++; else away++; }
    if (type === 'but-adverse') { if (isHome) away++; else home++; }
    scoreNode.textContent = `${home} - ${away}`;

    await wait(document.documentElement.dataset.motion === 'reduced' ? 0 : 240);
  }

  // Score définitif : le récit peut ne pas couvrir tous les buts collectifs.
  scoreNode.textContent = report.scoreLabel;
  statusNode.textContent = `Coup de sifflet final — ${report.resultat}`;

  // Rapport d'après-match : note, statistiques, analyse, carte de chaleur.
  feed.appendChild(el('hr'));
  feed.appendChild(matchReportBlock(report));

  if (report.motm) confetti(50);
  refresh();
}

function matchReportBlock(report) {
  const s = report.stats;
  const maxHeat = Math.max(1, ...Object.values(report.heatmap || {}));
  const zones = ['att. gauche', 'att. centre', 'att. droite', 'milieu gauche', 'milieu centre', 'milieu droit', 'déf. gauche', 'déf. centre', 'déf. droite'];

  return el('div.stack', {}, [
    el('div.grid.grid-4', {}, [
      stat('Note', report.rating, { tone: report.rating >= 7.5 ? 'ok' : report.rating < 5.5 ? 'danger' : '' }),
      stat('Buts', s.buts),
      stat('Passes D.', s.passesD),
      stat('Minutes', s.minutes),
    ]),
    el('div.grid.grid-4', {}, [
      stat('Tirs', `${s.tirsCadres}/${s.tirs}`),
      stat('Passes', `${s.passesReussies}/${s.passes}`),
      stat('Duels', `${s.duelsGagnes}/${s.duels}`),
      stat('Distance', `${s.kilometres} km`, { sub: `${s.vitesseMax} km/h max` }),
    ]),

    report.analysis ? card('Analyse tactique (IA)', [
      el('p.small.muted', {}, report.analysis.summary),
      report.analysis.strengths.length
        ? el('div', {}, [el('div.card-title', {}, 'Points forts'), el('ul.small.muted', {}, report.analysis.strengths.map((t) => el('li', {}, t)))])
        : null,
      report.analysis.errors.length
        ? el('div', {}, [el('div.card-title', {}, 'Erreurs'), el('ul.small.muted', {}, report.analysis.errors.map((t) => el('li', {}, t)))])
        : null,
      report.analysis.advice.length
        ? el('div', {}, [el('div.card-title', {}, 'Conseils'), el('ul.small.muted', {}, report.analysis.advice.map((t) => el('li', {}, t)))])
        : null,
    ]) : null,

    card('Carte de chaleur', el('div.heatmap', {}, zones.map((zone) => {
      const value = report.heatmap?.[zone] || 0;
      const intensity = value / maxHeat;
      return el('div.heat-cell', {
        style: { background: `rgba(201, 162, 39, ${0.08 + intensity * 0.82})` },
        title: `${zone} : ${value} action(s)`,
      }, value || '');
    }))),
  ]);
}

// ── Carrière ───────────────────────────────────────────────────────────────

export function careerView(game, refresh) {
  const s = game.snapshot();
  const career = game.state.career;
  const offers = game.systems.career.transferOffers;
  const endorsements = game.state.endorsements;

  return el('div.stack', {}, [
    // Entraînement
    card('Entraînement', [
      el('p.small.muted', {}, 'Chaque séance influence la progression, la fatigue, le moral et le risque de blessure.'),
      el('div.grid.grid-3', {}, TRAINING_SESSIONS.map((session) =>
        el('div.panel', {}, [
          el('div.bold', {}, session.name),
          el('div.xs.dim.mb-4', {}, session.description),
          el('div.row.xs.mb-4', {}, [
            badge(`${session.duration} h`),
            badge(session.fatigue > 0 ? `+${session.fatigue} fatigue` : `${session.fatigue} fatigue`, session.fatigue > 0 ? 'warn' : 'ok'),
            session.injuryRisk > 0.02 ? badge('Risque élevé', 'danger') : null,
          ]),
          button('Effectuer', () => {
            const result = game.systems.career.train(session.id);
            if (!result.ok) {
              toast({ title: result.injured ? 'Blessure' : 'Séance impossible', body: result.reason, level: result.injured ? 'error' : 'warn' });
            } else {
              const gains = Object.entries(result.gains).filter(([, v]) => v > 0)
                .map(([k, v]) => `${k} +${v}`).join(', ');
              toast({ title: session.name, body: gains || 'Récupération effectuée.', level: 'success' });
              game.advance(session.duration);
            }
            refresh();
          }, { block: true, size: 'sm' }),
        ]))),
    ]),

    // Contrat
    card('Contrat actuel', [
      el('div.grid.grid-4', {}, [
        stat('Salaire', money(career.contract.salary), { sub: 'par saison' }),
        stat('Échéance', career.contract.endSeason, { sub: `${Math.max(0, career.contract.endSeason - s.clock.season)} saison(s)` }),
        stat('Prime / but', money(career.contract.goalBonus)),
        stat('Valeur marchande', money(s.marketValue), { tone: 'gold' }),
      ]),
      el('div.row.mt-4', {}, career.contract.clauses.map((c) => badge(c, 'gold'))),
      el('div.row.mt-4', {}, [
        button('Prolonger', () => {
          const result = game.systems.career.renewContract();
          toast({
            title: result.ok ? 'Contrat prolongé' : 'Prolongation refusée',
            body: result.ok ? `${money(result.salary)} par saison sur ${result.years} ans.` : result.reason,
            level: result.ok ? 'success' : 'warn',
          });
          refresh();
        }),
        button('Solliciter le mercato', () => {
          const list = game.systems.career.generateTransferOffers();
          toast({
            title: 'Mercato',
            body: list.length ? `${list.length} offre(s) reçue(s).` : "Aucun club n'a formulé d'offre pour l'instant.",
            level: list.length ? 'success' : 'info',
          });
          refresh();
        }, { variant: 'ghost' }),
      ]),
    ]),

    // Offres de transfert
    offers.length ? card('Offres de transfert', el('div.stack', {}, offers.map((offer) =>
      el('div.panel', {}, [
        el('div.row-between', {}, [
          el('div', {}, [
            el('div.bold', {}, offer.clubName),
            el('div.xs.dim', {}, `${offer.league} · prestige ${offer.prestige} · ${getCity(offer.cityId)?.name}`),
          ]),
          el('div.right', {}, [
            el('div.bold.gold', {}, money(offer.fee)),
            el('div.xs.dim', {}, 'indemnité'),
          ]),
        ]),
        el('div.grid.grid-4.mt-4', {}, [
          stat('Salaire', money(offer.contract.salary)),
          stat('Durée', `${offer.contract.years} ans`),
          stat('Prime signature', money(offer.contract.signingBonus)),
          stat('Statut', offer.squadStatus),
        ]),
        el('div.row.mt-4', {}, offer.contract.clauses.map((c) => badge(c))),
        el('div.row.mt-4', {}, [
          ...['salaire', 'duree', 'statut', 'liberatoire'].map((demand) =>
            button(`Négocier : ${demand}`, () => {
              const result = game.systems.career.negotiate(offer.id, demand);
              toast({
                title: result.ok && result.accepted ? 'Négociation réussie' : 'Négociation',
                body: result.ok
                  ? (result.accepted ? `${offer.clubName} accepte votre demande.` : `${offer.clubName} refuse et se montre plus réservé.`)
                  : result.reason,
                level: result.ok && result.accepted ? 'success' : 'warn',
              });
              refresh();
            }, { size: 'sm', variant: 'ghost' })),
          button('Accepter le transfert', () => acceptTransferFlow(game, offer, refresh), { variant: 'primary', size: 'sm' }),
        ]),
      ])))) : null,

    // Vie de star
    card('Vie de star', [
      el('p.small.muted', {}, 'Interviews, campagnes et événements font vivre votre image publique.'),
      el('div.grid.grid-3', {}, STAR_ACTIVITIES.map((activity) =>
        el('div.panel', {}, [
          el('div.bold', {}, activity.name),
          el('div.row.xs.mb-4', {}, [
            badge(activity.fee >= 0 ? `+${money(activity.fee)}` : money(activity.fee), activity.fee >= 0 ? 'ok' : 'warn'),
            badge(`Réputation +${activity.reputation}`, 'gold'),
            badge(`${activity.duration} h`),
          ]),
          button('Participer', () => {
            const result = game.systems.career.doStarActivity(activity.id);
            toast({
              title: result.ok ? activity.name : 'Indisponible',
              body: result.ok ? 'Engagement honoré.' : result.reason,
              level: result.ok ? 'success' : 'warn',
            });
            if (result.ok) game.advance(activity.duration);
            refresh();
          }, { block: true, size: 'sm' }),
        ]))),
    ]),

    // Sponsoring
    card('Contrats de marque', [
      endorsements.active.length
        ? el('div.stack', {}, endorsements.active.map((deal) =>
            el('div.panel', {}, [
              el('div.row-between', {}, [
                el('div', {}, [
                  el('div.bold', {}, deal.brandName),
                  el('div.xs.dim', {}, `${deal.category} · jusqu'en ${deal.endSeason}`),
                ]),
                el('div.right', {}, [
                  el('div.bold.gold', {}, `${money(deal.annualValue)}/an`),
                  deal.exclusive ? badge('Exclusif', 'warn') : null,
                ]),
              ]),
              el('ul.xs.muted.mt-4', {}, (deal.obligations || []).map((o) => el('li', {}, o))),
              button('Résilier', () => {
                const result = game.systems.career.terminateEndorsement(deal.id);
                toast({
                  title: result.ok ? 'Contrat résilié' : 'Résiliation impossible',
                  body: result.ok ? `Indemnité versée : ${money(result.penalty)}.` : result.reason,
                  level: result.ok ? 'info' : 'warn',
                });
                refresh();
              }, { size: 'sm', variant: 'danger' }),
            ])))
        : el('p.dim', {}, 'Aucun contrat de sponsoring en cours.'),

      endorsements.blockedBrands.length
        ? el('div.notice.warn', {}, [
            el('strong', {}, 'Marques bloquées par exclusivité : '),
            endorsements.blockedBrands.join(', '),
            ' — tout achat les concernant sera refusé tant que le contrat court.',
          ])
        : null,

      endorsements.offersPending.length
        ? el('div', {}, [
            el('div.card-title.mt-4', {}, 'Offres reçues'),
            el('div.stack', {}, endorsements.offersPending.map((offer) =>
              el('div.panel', {}, [
                el('div.row-between', {}, [
                  el('div', {}, [
                    el('div.bold', {}, offer.brandName),
                    el('div.xs.dim', {}, `${offer.category} · ${offer.years} ans`),
                  ]),
                  el('div.bold.gold', {}, `${money(offer.annualValue)}/an`),
                ]),
                el('ul.xs.muted', {}, offer.obligations.map((o) => el('li', {}, o))),
                button('Signer', () => {
                  const result = game.systems.career.signEndorsement(offer.id);
                  toast({
                    title: result.ok ? `Accord signé avec ${offer.brandName}` : 'Signature impossible',
                    body: result.ok ? 'Le contrat prend effet immédiatement.' : result.reason,
                    level: result.ok ? 'success' : 'warn',
                  });
                  refresh();
                }, { size: 'sm', variant: 'primary' }),
              ])))])
        : button('Consulter le marché du sponsoring', () => {
            const list = game.systems.career.generateEndorsementOffers();
            toast({
              title: 'Sponsoring',
              body: list.length ? `${list.length} marque(s) intéressée(s).` : 'Aucune marque ne vous approche pour le moment.',
              level: 'info',
            });
            refresh();
          }, { variant: 'ghost' }),
    ]),

    // Retraite
    s.player.age >= 30 || s.player.retired ? card('Fin de carrière', [
      s.player.retired
        ? el('div.stack', {}, [
            el('p.muted', {}, `Retraite prise à ${s.player.retiredAt?.age} ans, saison ${s.player.retiredAt?.season}.`),
            game.state.legacy.postCareerRole
              ? el('p', {}, [el('strong', {}, 'Fonction actuelle : '), game.state.legacy.postCareerRole.name])
              : el('div', {}, [
                  el('div.card-title', {}, 'Choisir une reconversion'),
                  el('div.grid.grid-3', {}, game.systems.career.availablePostCareerRoles().map((role) =>
                    el('div.panel', {}, [
                      el('div.bold.small', {}, role.name),
                      el('div.xs.dim.mb-4', {}, `${money(role.income)} / an`),
                      button('Accepter', () => {
                        const result = game.systems.career.takePostCareerRole(role.id);
                        toast({
                          title: result.ok ? `Vous devenez ${role.name}` : 'Impossible',
                          body: result.ok ? 'Une nouvelle vie commence.' : result.reason,
                          level: result.ok ? 'success' : 'warn',
                        });
                        refresh();
                      }, { size: 'sm', block: true }),
                    ]))),
                ]),
          ])
        : el('div', {}, [
            el('p.muted', {}, 'Annoncer votre retraite conserve toute votre carrière et ouvre votre musée personnel.'),
            button('Annoncer ma retraite', () => {
              modal({
                title: 'Confirmer la retraite',
                body: el('p', {}, 'Cette décision est définitive pour cette sauvegarde. Votre carrière sera archivée, un documentaire produit et votre musée ouvert au public.'),
                footer: [
                  button('Annuler', () => document.querySelector('.modal-backdrop')?.remove()),
                  button('Confirmer', () => {
                    document.querySelector('.modal-backdrop')?.remove();
                    const result = game.systems.career.retire();
                    if (result.ok) {
                      toast({ title: 'Fin de carrière', body: 'Votre héritage commence.', level: 'info' });
                      confetti(60);
                    }
                    refresh();
                  }, { variant: 'danger' }),
                ],
              });
            }, { variant: 'danger' }),
          ]),
    ]) : null,
  ]);
}

/** Déroule la mise en scène du transfert — Tome IV ch. 3, Tome XVI ch. 3. */
async function acceptTransferFlow(game, offer, refresh) {
  const result = game.systems.career.acceptTransfer(offer.id);
  if (!result.ok) {
    toast({ title: 'Transfert impossible', body: result.reason, level: 'warn' });
    return;
  }

  const list = el('div.stack');
  const { close } = modal({
    title: `Transfert vers ${result.club.name}`,
    body: list,
    footer: [button('Terminer', () => { close(); refresh(); }, { variant: 'primary' })],
    dismissible: false,
  });

  for (const step of result.sequence) {
    list.appendChild(el('div.panel', {}, [
      el('div.bold.small', {}, step.title),
      el('div.xs.muted', {}, step.body),
    ]));
    await wait(document.documentElement.dataset.motion === 'reduced' ? 0 : 550);
  }
  confetti(40);
}

// ── Monde ouvert ───────────────────────────────────────────────────────────

export function worldView(game, refresh) {
  const summary = game.systems.world.currentCitySummary();
  if (!summary) return el('p', {}, 'Localisation inconnue.');

  const { city, country, transformed } = summary;

  return el('div.stack', {}, [
    card(null, [
      el('div.row-between', {}, [
        el('div', {}, [
          el('h3.mb-0', {}, city.name),
          el('div.muted.small', {}, `${country?.name} · ${num(city.population)} habitants · ${country?.currency}`),
          el('p.small.muted.mt-4.mb-0', {}, city.description),
          el('div.row.mt-4', {}, [
            badge(summary.weatherText),
            badge(`${summary.venueCount} lieux`),
            badge(`${summary.npcCount} habitants suivis`),
            badge(`Reconnaissance ${summary.recognitionChance} %`, summary.recognitionChance > 50 ? 'gold' : ''),
            city.hub ? badge('Hub social', 'ok') : null,
          ]),
        ]),
      ]),
      transformed
        ? el('div.notice.mt-4', {}, [
            el('strong', {}, `${city.name} est en configuration « ${transformed.name} ». `),
            `Fan zones, écrans géants et animations de rue. Prix majorés de ${Math.round((transformed.effects.priceMultiplier - 1) * 100)} %, ${num(transformed.effects.touristInflux)} visiteurs supplémentaires.`,
          ])
        : null,
      summary.hazard ? el('div.notice.warn.mt-4', {}, summary.hazard.message) : null,
    ]),

    // Événements de rue
    summary.streetEvents.length ? card('Dans la rue aujourd\'hui', el('div.stack', {},
      summary.streetEvents.map((event) => el('div.panel', {}, [
        el('div.bold.small', {}, event.name),
        el('div.xs.muted', {}, event.text),
      ])))) : null,

    // Lieux
    card('Lieux visitables', el('div.grid.grid-3', {},
      game.systems.world.venuesHere().map((venue) =>
        el('button.panel', {
          style: { textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' },
          onClick: () => openVenue(game, venue.id, refresh),
        }, [
          el('div.row', {}, [el('span', {}, venue.icon), el('span.bold.small', {}, venue.name)]),
          el('div.xs.dim', {}, venue.typeLabel),
        ])))),

    // Activités
    card('Activités', el('div.grid.grid-3', {},
      game.systems.world.activitiesHere().map((activity) =>
        el('div.panel', {}, [
          el('div.bold.small', {}, activity.name),
          el('div.row.xs.mb-4', {}, [
            badge(activity.cost ? money(activity.cost) : 'Gratuit'),
            badge(`${activity.duration} h`),
            activity.risk ? badge('À risque', 'danger') : null,
          ]),
          activity.available
            ? button('Pratiquer', () => {
                const result = game.systems.world.doActivity(activity.id);
                toast({
                  title: result.ok ? activity.name : 'Indisponible',
                  body: result.ok ? 'Activité effectuée.' : result.reason,
                  level: result.ok ? 'success' : result.injured ? 'error' : 'warn',
                });
                if (result.ok) game.advance(activity.duration);
                refresh();
              }, { size: 'sm', block: true })
            : el('div.xs.warn', {}, activity.reason),
        ])))),

    // Voyage
    travelCard(game, refresh),

    // Vacances
    holidayCard(game, refresh),

    // Découvertes
    card('Découvertes', [
      el('p.small.muted', {}, `${game.state.world.discoveries.length} lieu(x) secret(s) trouvé(s) sur ${game.systems.world.discoveries().length}.`),
      el('div.grid.grid-2', {}, game.systems.world.discoveries().map((secret) =>
        el('div.panel', { style: secret.found ? {} : { opacity: '0.45' } }, [
          el('div.bold.small', {}, secret.found ? secret.name : '??? — lieu non découvert'),
          el('div.xs.dim', {}, `${secret.cityName} · ${secret.type}`),
          secret.found ? el('div.xs.muted.mt-4', {}, secret.text) : null,
        ]))),
    ]),
  ]);
}

function openVenue(game, venueId, refresh) {
  const result = game.systems.world.enterVenue(venueId);
  if (!result.ok) {
    toast({ title: 'Lieu inaccessible', body: result.reason, level: 'warn' });
    return;
  }

  const { close, body } = modal({
    title: `${result.venue.name}`,
    body: el('div.stack', {}, [
      el('p.muted', {}, result.entryText),
      el('div.card-title', {}, 'Interactions disponibles'),
      el('div.row', {}, result.interactions.map((action) => badge(action))),
      result.npcs.length
        ? el('div', {}, [
            el('div.card-title.mt-4', {}, 'Personnes présentes'),
            el('div.stack', {}, result.npcs.map((npc) => el('div.panel', {}, [
              el('div.bold.small', {}, `${npc.name}, ${npc.age} ans — ${npc.job}`),
              el('div.xs.muted', {}, npc.reaction),
            ]))),
          ])
        : null,
    ]),
    footer: [button('Sortir', () => { close(); refresh(); })],
  });

  // Rencontre avec un supporter — Tome XXVI ch. 4.
  if (result.encounter) {
    const block = el('div.stack', {}, [
      el('div.card-title', {}, 'Un supporter vous aborde'),
      el('p.small.muted', {}, result.encounter.text),
      el('div.row', {}, FAN_INTERACTIONS.map((interaction) =>
        button(interaction.name, () => {
          const outcome = game.systems.reputation.respondToFan(interaction.id, game.systems.economy);
          toast({
            title: outcome.ok ? interaction.name : 'Impossible',
            body: outcome.ok
              ? `Relation aux supporters : ${Math.round(game.state.reputation.fanRelation)}/100.`
              : outcome.reason,
            level: outcome.ok ? (interaction.id === 'refuser' ? 'warn' : 'success') : 'warn',
          });
          block.remove();
          refresh();
        }, { size: 'sm', variant: interaction.id === 'refuser' ? 'danger' : 'ghost' }))),
    ]);
    body.appendChild(el('hr'));
    body.appendChild(block);
  }
}

function travelCard(game, refresh) {
  const currentId = game.state.world.currentCityId;
  const select = el('select', {},
    CITIES.filter((c) => c.id !== currentId).map((c) =>
      el('option', { value: c.id }, `${c.name} — ${getCountry(c.country)?.name} (${num(distanceKm(currentId, c.id))} km)`)));

  const optionsHost = el('div.stack');

  const showOptions = () => {
    const destination = select.value;
    const transports = game.systems.world.availableTransports(destination);
    render(optionsHost, transports.length
      ? transports.map((option) => el('div.panel', {}, [
          el('div.row-between', {}, [
            el('div', {}, [
              el('div.bold.small', {}, `${option.icon} ${option.name}`),
              el('div.xs.dim', {}, `${num(option.km)} km · ${option.hours} h · confort ${option.comfort}/100`),
            ]),
            el('div.row', {}, [
              option.delayed ? badge('Retardé', 'warn') : null,
              el('div.bold', {}, option.cost ? money(option.cost) : 'Gratuit'),
              button('Partir', () => runTravel(game, destination, option.id, refresh), { size: 'sm', variant: 'primary' }),
            ]),
          ]),
        ]))
      : el('p.dim', {}, 'Aucun moyen de transport ne dessert cette destination depuis votre position.'));
  };

  select.addEventListener('change', showOptions);
  queueMicrotask(showOptions);

  return card('Voyager', [
    el('div.field', {}, [el('label', {}, 'Destination'), select]),
    optionsHost,
  ]);
}

/** Voyage joué étape par étape — Tome XXX v2 ch. 3. */
async function runTravel(game, cityId, transportId, refresh) {
  const result = game.systems.world.travel(cityId, transportId);
  if (!result.ok) {
    toast({ title: 'Trajet impossible', body: result.reason, level: 'warn' });
    return;
  }

  const list = el('div.stack');
  const { close } = modal({
    title: `Trajet vers ${result.destination.name}`,
    body: el('div', {}, [
      list,
      el('div.meter.mt-4', {}, el('div.meter-fill', { style: { width: '0%' }, id: 'travel-progress' })),
    ]),
    footer: [button('Terminer', () => { close(); refresh(); }, { variant: 'primary' })],
    dismissible: false,
  });

  const stageNodes = result.stages.map((s) => {
    const node = el('div.travel-stage', {}, [el('span', {}, '○'), el('span', {}, s.label)]);
    list.appendChild(node);
    return node;
  });

  const progress = document.getElementById('travel-progress');
  for (let i = 0; i < result.stages.length; i++) {
    stageNodes.forEach((n, j) => n.className = `travel-stage${j < i ? ' done' : j === i ? ' current' : ''}`);
    stageNodes[i].firstChild.textContent = '◉';
    if (progress) progress.style.width = `${result.stages[i].progress}%`;
    await wait(document.documentElement.dataset.motion === 'reduced' ? 0 : 420);
    stageNodes[i].firstChild.textContent = '●';
  }
  stageNodes.forEach((n) => n.className = 'travel-stage done');

  list.appendChild(el('div.notice.mt-4', {}, result.arrivalText));
  game.advance(result.hours);
  refresh();
}

function holidayCard(game, refresh) {
  const citySelect = el('select', {}, CITIES.map((c) => el('option', { value: c.id }, `${c.name} — ${getCountry(c.country)?.name}`)));
  const daysInput = el('input', { type: 'number', value: '7', min: '1', max: '30' });
  const companionSelect = el('select', {}, [
    ['seul', 'Seul'], ['couple', 'En couple'], ['famille', 'En famille'],
    ['enfants', 'Avec les enfants'], ['amis', 'Avec des amis'], ['coequipiers', 'Avec les coéquipiers'],
  ].map(([value, label]) => el('option', { value }, label)));
  const starsSelect = el('select', {}, [3, 4, 5].map((n) => el('option', { value: String(n), selected: n === 4 }, `${n} étoiles`)));

  return card('Vacances', [
    el('div.grid.grid-4', {}, [
      el('div.field', {}, [el('label', {}, 'Destination'), citySelect]),
      el('div.field', {}, [el('label', {}, 'Durée (jours)'), daysInput]),
      el('div.field', {}, [el('label', {}, 'Accompagnement'), companionSelect]),
      el('div.field', {}, [el('label', {}, 'Hôtel'), starsSelect]),
    ]),
    button('Organiser le séjour', () => {
      const result = game.systems.world.planHoliday({
        cityId: citySelect.value,
        days: Math.max(1, Number(daysInput.value) || 7),
        companions: companionSelect.value,
        hotelStars: Number(starsSelect.value),
      });
      if (!result.ok) {
        toast({ title: 'Séjour impossible', body: result.reason, level: 'warn' });
      } else {
        toast({
          title: `Vacances à ${result.holiday.cityName}`,
          body: `${result.holiday.days} jours · ${money(result.holiday.cost)} · ${result.holiday.activities.join(', ')}`,
          level: 'success',
        });
        game.advanceDays(result.holiday.days);
      }
      refresh();
    }, { variant: 'primary' }),
  ]);
}

// ── Économie ───────────────────────────────────────────────────────────────

export function economyView(game, refresh) {
  const eco = game.state.economy;
  const economy = game.systems.economy;

  return el('div.stack', {}, [
    el('div.grid.grid-4', {}, [
      stat('Compte courant', money(eco.accounts.courant), { tone: eco.accounts.courant < 0 ? 'danger' : '' }),
      stat('Épargne', money(eco.accounts.epargne)),
      stat('Professionnel', money(eco.accounts.professionnel)),
      stat('Patrimoine net', money(economy.netWorth()), { tone: 'gold' }),
    ]),

    card('Trésorerie', [
      el('div.grid.grid-3', {}, [
        stat('Revenus mensuels', money(economy.monthlyIncome()), { tone: 'ok' }),
        stat('Charges mensuelles', money(economy.monthlyBurn()), { tone: 'warn' }),
        stat('Solde mensuel', money(economy.monthlyIncome() - economy.monthlyBurn()), {
          tone: economy.monthlyIncome() - economy.monthlyBurn() >= 0 ? 'ok' : 'danger',
        }),
      ]),
      el('div.card-title.mt-4', {}, 'Répartition des dépenses'),
      economy.breakdown().length
        ? el('div.stack', {}, economy.breakdown().slice(0, 8).map((row) => {
            const max = economy.breakdown()[0].total || 1;
            return el('div', {}, [
              el('div.row-between.xs', {}, [el('span.muted', {}, row.category), el('span.nums', {}, money(row.total))]),
              meter(row.total, max, 'warn'),
            ]);
          }))
        : el('p.dim', {}, 'Aucune dépense enregistrée.'),
      el('div.row.mt-4', {}, [
        transferForm(game, refresh),
      ]),
    ]),

    // Investissements
    card('Investissements', [
      eco.investments.length
        ? table(
            ['Actif', 'Investi', 'Valeur', 'Rendement', 'Risque', ''],
            eco.investments.map((i) => [
              i.name,
              money(i.invested),
              el('span', { class: i.currentValue >= i.invested ? 'ok' : 'danger' }, money(i.currentValue)),
              `${(i.yield * 100).toFixed(1)} %`,
              badge(i.risk, i.risk.includes('élevé') ? 'danger' : i.risk === 'moyen' ? 'warn' : 'ok'),
              button('Céder', () => {
                const result = economy.divest(i.id);
                toast({
                  title: result.ok ? 'Cession réalisée' : 'Cession impossible',
                  body: result.ok ? `${money(result.proceeds)} crédités.` : result.reason,
                  level: result.ok ? 'success' : 'warn',
                });
                refresh();
              }, { size: 'sm' }),
            ]),
            { numeric: [1, 2, 3] },
          )
        : el('p.dim', {}, 'Aucun investissement.'),

      el('div.card-title.mt-4', {}, 'Nouveaux placements'),
      el('div.grid.grid-3', {}, INVESTMENT_TYPES.map((type) => {
        const input = el('input', { type: 'number', value: String(type.minTicket), min: String(type.minTicket) });
        return el('div.panel', {}, [
          el('div.bold.small', {}, type.name),
          el('div.row.xs.mb-4', {}, [
            badge(`${(type.yield * 100).toFixed(1)} %/an`, 'ok'),
            badge(type.risk, type.risk.includes('élevé') ? 'danger' : 'warn'),
          ]),
          el('div.xs.dim.mb-4', {}, `Ticket minimum : ${money(type.minTicket)}`),
          input,
          button('Investir', () => {
            const result = economy.invest(type.id, Number(input.value));
            toast({
              title: result.ok ? 'Investissement réalisé' : 'Investissement refusé',
              body: result.ok ? `${type.name} — ${money(Number(input.value))}.` : result.reason,
              level: result.ok ? 'success' : 'warn',
            });
            refresh();
          }, { size: 'sm', block: true }),
        ]);
      })),
    ]),

    // Immobilier
    card('Immobilier', [
      eco.properties.length
        ? el('div.stack', {}, eco.properties.map((property) =>
            el('div.panel', {}, [
              el('div.row-between', {}, [
                el('div', {}, [
                  el('div.bold.small', {}, property.name),
                  el('div.xs.dim', {}, `Acheté ${money(property.purchasePrice)} · entretien ${money(property.upkeep)}/mois · confort ${property.comfort}`),
                ]),
                el('div.right', {}, [
                  el('div.bold', { class: property.currentValue >= property.purchasePrice ? 'ok' : 'danger' }, money(property.currentValue)),
                  property.rented ? badge(`Loué ${money(property.rentalIncome)}/mois`, 'ok') : null,
                ]),
              ]),
              el('div.row.mt-4', {}, [
                button('Rénover', () => {
                  const r = economy.renovateProperty(property.id, 'renovation');
                  toast({ title: r.ok ? 'Travaux terminés' : 'Travaux impossibles', body: r.ok ? `Nouvelle valeur : ${money(r.newValue)}.` : r.reason, level: r.ok ? 'success' : 'warn' });
                  refresh();
                }, { size: 'sm' }),
                button('Agrandir', () => {
                  const r = economy.renovateProperty(property.id, 'agrandissement');
                  toast({ title: r.ok ? 'Agrandissement terminé' : 'Impossible', body: r.ok ? `Nouvelle valeur : ${money(r.newValue)}.` : r.reason, level: r.ok ? 'success' : 'warn' });
                  refresh();
                }, { size: 'sm' }),
                button(property.rented ? 'Cesser la location' : 'Mettre en location', () => {
                  const r = economy.toggleRental(property.id);
                  toast({ title: 'Location', body: r.rented ? `Loyer : ${money(r.monthly)}/mois.` : 'Bien retiré de la location.', level: 'info' });
                  refresh();
                }, { size: 'sm' }),
                button('Vendre', () => {
                  const r = economy.sellProperty(property.id);
                  toast({ title: r.ok ? 'Bien vendu' : 'Vente impossible', body: r.ok ? `${money(r.proceeds)} nets.` : r.reason, level: r.ok ? 'success' : 'warn' });
                  refresh();
                }, { size: 'sm', variant: 'danger' }),
              ]),
            ])))
        : el('p.dim', {}, 'Vous ne possédez aucun bien.'),

      el('div.card-title.mt-4', {}, 'Acheter un bien'),
      propertyPurchaseForm(game, refresh),
    ]),

    // Personnel
    card('Personnel', [
      eco.staff.length
        ? table(
            ['Poste', 'Compétence', 'Salaire', ''],
            eco.staff.map((member) => [
              member.name,
              el('div', {}, [meter(member.skill, 100, member.skill > 75 ? 'ok' : 'warn'), el('span.xs', {}, ` ${member.skill}/100`)]),
              money(member.salary),
              button('Licencier', () => {
                const r = economy.fireStaff(member.id);
                toast({ title: r.ok ? 'Employé licencié' : 'Impossible', body: r.ok ? 'Indemnité versée.' : r.reason, level: 'info' });
                refresh();
              }, { size: 'sm', variant: 'danger' }),
            ]),
            { numeric: [2] },
          )
        : el('p.dim', {}, 'Aucun employé.'),

      el('div.card-title.mt-4', {}, 'Recruter'),
      el('div.grid.grid-4', {}, STAFF_ROLES.filter((r) => !eco.staff.some((s) => s.roleId === r.id)).map((role) =>
        el('div.panel', {}, [
          el('div.bold.small', {}, role.name),
          el('div.xs.dim.mb-4', {}, `~${money(role.salary)}/mois`),
          button('Recruter', () => {
            const r = economy.hireStaff(role.id);
            toast({
              title: r.ok ? `${role.name} recruté` : 'Recrutement impossible',
              body: r.ok ? `Compétence ${r.skill}/100, salaire ${money(r.salary)}/mois.` : r.reason,
              level: r.ok ? 'success' : 'warn',
            });
            refresh();
          }, { size: 'sm', block: true }),
        ]))),
    ]),

    // Garage et collection
    el('div.grid.grid-2', {}, [
      card('Garage', [
        eco.garage.length
          ? el('div.stack', {}, eco.garage.map((v) => el('div.panel', {}, [
              el('div.row-between', {}, [
                el('div', {}, [el('div.bold.small', {}, v.name), el('div.xs.dim', {}, `${v.category} · ${v.topSpeed} km/h`)]),
                el('div.right', {}, [
                  el('div.small.bold', { class: v.appreciates ? 'ok' : '' }, money(v.currentValue)),
                  el('div.xs.dim', {}, `${money(v.upkeep)}/mois`),
                ]),
              ]),
            ])))
          : el('p.dim', {}, 'Garage vide.'),
        el('div.card-title.mt-4', {}, 'Concessionnaire'),
        el('div.grid.grid-2', {}, VEHICLES.map((v) =>
          el('div.panel', {}, [
            el('div.bold.xs', {}, v.name),
            el('div.xs.dim.mb-4', {}, money(v.price)),
            button('Acheter', () => {
              const r = economy.buyVehicle(v.id);
              toast({ title: r.ok ? 'Véhicule commandé' : 'Achat impossible', body: r.ok ? 'Livraison mise en scène à venir.' : r.reason, level: r.ok ? 'success' : 'warn' });
              refresh();
            }, { size: 'sm', block: true }),
          ]))),
      ]),

      card('Collection', [
        eco.collection.length
          ? el('div.stack', {}, eco.collection.map((item) => el('div.row-between', {}, [
              el('div', {}, [el('div.bold.small', {}, item.name), el('div.xs.dim', {}, item.category)]),
              el('div.right.small', { class: item.currentValue >= item.purchasePrice ? 'ok' : 'danger' }, money(item.currentValue)),
            ])))
          : el('p.dim', {}, 'Aucun objet de collection.'),
        el('div.card-title.mt-4', {}, 'Objets disponibles'),
        el('div.grid.grid-2', {}, LUXURY_ITEMS.map((item) =>
          el('div.panel', {}, [
            el('div.bold.xs', {}, item.name),
            el('div.xs.dim.mb-4', {}, `${money(item.price)} · +${(item.appreciation * 100).toFixed(0)} %/an`),
            button('Acquérir', () => {
              const r = economy.buyLuxury(item.id);
              toast({ title: r.ok ? 'Objet acquis' : 'Achat impossible', body: r.ok ? item.name : r.reason, level: r.ok ? 'success' : 'warn' });
              refresh();
            }, { size: 'sm', block: true }),
          ]))),
      ]),
    ]),

    // Philanthropie
    card('Philanthropie et succession', [
      el('div.grid.grid-2', {}, [
        stat('Total donné', money(eco.philanthropy.totalDonated), { tone: 'ok' }),
        stat('Fondations', eco.philanthropy.foundations.length),
      ]),
      eco.philanthropy.foundations.length
        ? el('div.stack.mt-4', {}, eco.philanthropy.foundations.map((f) => el('div.panel', {}, [
            el('div.bold.small', {}, f.name),
            el('div.xs.dim', {}, `Dotation ${money(f.endowment)} · budget annuel ${money(f.annualBudget)} · depuis ${f.since}`),
          ])))
        : null,
      el('div.grid.grid-2.mt-4', {}, [donationForm(game, refresh), foundationForm(game, refresh)]),
    ]),

    // Journal comptable
    card('Journal des transactions', table(
      ['Date', 'Libellé', 'Catégorie', 'Montant', 'Solde'],
      eco.ledger.slice(-40).reverse().map((entry) => [
        entry.dateLabel,
        entry.label,
        badge(entry.category),
        el('span', { class: entry.amount >= 0 ? 'ok' : 'danger' }, money(entry.amount)),
        money(entry.balanceAfter),
      ]),
      { numeric: [3, 4], empty: 'Aucune transaction.' },
    )),
  ]);
}

function transferForm(game, refresh) {
  const from = el('select', {}, ['courant', 'epargne', 'professionnel'].map((a) => el('option', { value: a }, a)));
  const to = el('select', {}, ['epargne', 'courant', 'professionnel'].map((a) => el('option', { value: a }, a)));
  const amount = el('input', { type: 'number', value: '10000', min: '1' });

  return el('div.row', {}, [
    el('div', {}, [el('label.xs', {}, 'De'), from]),
    el('div', {}, [el('label.xs', {}, 'Vers'), to]),
    el('div', {}, [el('label.xs', {}, 'Montant'), amount]),
    button('Virer', () => {
      const ok = game.systems.economy.transfer(from.value, to.value, Number(amount.value));
      if (ok) toast({ title: 'Virement effectué', body: `${money(Number(amount.value))} de ${from.value} vers ${to.value}.`, level: 'success' });
      refresh();
    }, { size: 'sm' }),
  ]);
}

function propertyPurchaseForm(game, refresh) {
  const typeSelect = el('select', {}, PROPERTY_TYPES.map((p) => el('option', { value: p.id }, `${p.name} — dès ${money(p.basePrice)}`)));
  const citySelect = el('select', {}, CITIES.map((c) => el('option', { value: c.id, selected: c.id === game.state.world.currentCityId }, c.name)));

  return el('div.row', {}, [
    el('div.grow', {}, [el('label.xs', {}, 'Type de bien'), typeSelect]),
    el('div.grow', {}, [el('label.xs', {}, 'Ville'), citySelect]),
    button('Acheter', () => {
      const r = game.systems.economy.buyProperty(typeSelect.value, citySelect.value);
      toast({ title: r.ok ? 'Acquisition réalisée' : 'Achat impossible', body: r.ok ? 'Remise des clés en cours.' : r.reason, level: r.ok ? 'success' : 'warn' });
      refresh();
    }, { variant: 'primary' }),
  ]);
}

function donationForm(game, refresh) {
  const cause = el('input', { type: 'text', value: 'Association locale' });
  const amount = el('input', { type: 'number', value: '50000', min: '1' });
  return el('div.panel', {}, [
    el('div.card-title', {}, 'Faire un don'),
    el('div.field', {}, [el('label.xs', {}, 'Bénéficiaire'), cause]),
    el('div.field', {}, [el('label.xs', {}, 'Montant'), amount]),
    button('Donner', () => {
      const r = game.systems.economy.donate(Number(amount.value), cause.value);
      toast({
        title: r.ok ? 'Don effectué' : 'Don impossible',
        body: r.ok ? `Réputation +${r.reputationGain.toFixed(1)}.` : r.reason,
        level: r.ok ? 'success' : 'warn',
      });
      refresh();
    }, { size: 'sm', block: true }),
  ]);
}

function foundationForm(game, refresh) {
  const name = el('input', { type: 'text', value: `Fondation ${game.state.player.name.split(' ')[0]}` });
  const endowment = el('input', { type: 'number', value: '500000', min: '250000' });
  return el('div.panel', {}, [
    el('div.card-title', {}, 'Créer une fondation'),
    el('div.field', {}, [el('label.xs', {}, 'Nom'), name]),
    el('div.field', {}, [el('label.xs', {}, 'Dotation (min. 250 000)'), endowment]),
    button('Fonder', () => {
      const r = game.systems.economy.createFoundation(name.value, Number(endowment.value));
      toast({
        title: r.ok ? 'Fondation créée' : 'Création impossible',
        body: r.ok ? `Budget annuel : ${money(r.foundation.annualBudget)}.` : r.reason,
        level: r.ok ? 'success' : 'warn',
      });
      refresh();
    }, { size: 'sm', block: true }),
  ]);
}

// ── Téléphone ──────────────────────────────────────────────────────────────

export function phoneView(game, refresh) {
  const screen = el('div.app-screen');
  const phone = game.state.phone;

  const openApp = (appId) => render(screen, renderApp(game, appId, refresh, openApp));

  const frame = el('div.phone-frame', {}, [
    el('div.phone-status', {}, [
      el('span', {}, game.snapshot().clock.timeLabel),
      el('span', {}, [game.snapshot().weather.icon, ' ', `${game.snapshot().weather.tempC}°`]),
      el('span', {}, phone.unread > 0 ? `🔴 ${phone.unread}` : '📶'),
    ]),
    screen,
  ]);

  openApp('accueil');

  return el('div.grid', { style: { gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: '2rem', alignItems: 'start' } }, [
    frame,
    el('div.stack', {}, [
      card('IA Secrétaire — dialogue', secretaryChat(game)),
      card('Réseaux sociaux', socialPanel(game, refresh)),
    ]),
  ]);
}

function renderApp(game, appId, refresh, openApp) {
  const phone = game.state.phone;
  const back = button('← Accueil', () => openApp('accueil'), { size: 'sm', variant: 'ghost' });

  if (appId === 'accueil') {
    return el('div.app-grid', {}, APPS.map((app) =>
      el('button.app-icon', { onClick: () => openApp(app.id), title: app.name }, [
        el('span.glyph', {}, app.icon),
        el('span', {}, app.name),
        (app.id === 'messages' && phone.messages.some((m) => !m.read))
          || (app.id === 'actualites' && phone.notifications.some((n) => !n.read))
          ? el('span.dot') : null,
      ])));
  }

  const wrap = (title, content) => el('div.stack', {}, [
    el('div.row-between', {}, [el('div.bold', {}, title), back]),
    content,
  ]);

  switch (appId) {
    case 'messages':
      game.systems.phone.markAllRead();
      return wrap('Messages', phone.messages.length
        ? el('div.scroll-y', {}, phone.messages.slice(0, 30).map((m) => el('div.msg', { class: m.read ? '' : 'unread' }, [
            el('span.from', {}, m.from), el('span.time', {}, m.at),
            el('div', {}, m.text),
          ])))
        : el('p.dim.xs', {}, 'Aucun message.'));

    case 'actualites':
      return wrap('Actualités', game.state.media.headlines.length
        ? el('div.scroll-y', {}, game.state.media.headlines.slice(0, 25).map((h) => el('div.msg', {}, [
            el('span.from', {}, h.title), el('span.time', {}, h.date),
            el('div.dim', {}, h.body),
          ])))
        : el('p.dim.xs', {}, 'Pas d\'actualité.'));

    case 'banque': {
      const eco = game.state.economy;
      return wrap('Banque', el('div.stack', {}, [
        el('div.msg', {}, [el('span.from', {}, 'Compte courant'), el('span.time', {}, money(eco.accounts.courant))]),
        el('div.msg', {}, [el('span.from', {}, 'Épargne'), el('span.time', {}, money(eco.accounts.epargne))]),
        el('div.msg', {}, [el('span.from', {}, 'Professionnel'), el('span.time', {}, money(eco.accounts.professionnel))]),
        el('div.msg', {}, [el('span.from', {}, 'Patrimoine net'), el('span.time', {}, money(game.systems.economy.netWorth()))]),
        el('div.card-title.mt-4', {}, 'Dernières opérations'),
        el('div.scroll-y', {}, eco.ledger.slice(-12).reverse().map((e) =>
          el('div.msg.xs', {}, [
            el('span.from', {}, e.label),
            el('span.time', { class: e.amount >= 0 ? 'ok' : 'danger' }, money(e.amount)),
          ]))),
      ]));
    }

    case 'meteo': {
      const w = game.systems.weather.at(game.state.world.currentCityId);
      return wrap('Météo', el('div.stack', {}, [
        el('div.center', { style: { fontSize: '3rem' } }, w.icon),
        el('div.center.bold', {}, `${w.tempC} °C — ${w.type}`),
        el('div.center.xs.dim', {}, `${getCity(game.state.world.currentCityId)?.name} · vent ${w.windKph} km/h`),
        el('div.card-title.mt-4', {}, 'Ailleurs dans le monde'),
        el('div.scroll-y', {}, CITIES.slice(0, 12).map((c) => {
          const cw = game.systems.weather.at(c.id);
          return el('div.msg.xs', {}, [
            el('span.from', {}, c.name),
            el('span.time', {}, `${cw.icon} ${cw.tempC}°`),
          ]);
        })),
      ]));
    }

    case 'commandes':
    case 'livraison':
      return wrap('Commandes', el('div.stack', {}, [
        phone.orders.length
          ? el('div.stack', {}, phone.orders.map((o) => el('div.msg', {}, [
              el('span.from', {}, o.itemName),
              el('span.time', {}, o.status),
              el('div.xs.dim', {}, `${o.trackingId} → ${o.deliveryPointName} · ${o.daysLeft > 0 ? `${o.daysLeft} j` : 'aujourd\'hui'}`),
            ])))
          : el('p.dim.xs', {}, 'Aucune commande en cours.'),
        el('div.card-title.mt-4', {}, 'Commander'),
        orderForm(game, refresh),
      ]));

    case 'boutique':
      return wrap('Boutique', el('div.stack', {}, ORDERABLE.map((item) =>
        el('div.msg', {}, [
          el('span.from', {}, item.name),
          el('span.time', {}, money(item.basePrice)),
          el('div.xs.dim', {}, `Livraison en ${item.deliveryDays} jour(s)`),
        ]))));

    case 'snapstreak': {
      const relations = game.state.personal.relationships;
      return wrap('Snapstreak', el('div.stack', {}, relations.map((r) =>
        el('div.msg', {}, [
          el('span.from', {}, r.name),
          el('span.time', {}, phone.streaks[r.name] ? `🔥 ${phone.streaks[r.name]}` : '—'),
          el('div.row.mt-4', {}, [
            button('Envoyer un snap', () => {
              const result = game.systems.phone.sendSnap(r.id);
              if (result.ok) {
                toast({
                  title: `Snap envoyé à ${r.name}`,
                  body: result.reply ? `${result.reply.from} : « ${result.reply.text} » — 🔥 ${result.streak}` : `🔥 ${result.streak}`,
                  level: 'success',
                });
              }
              refresh();
            }, { size: 'sm' }),
          ]),
        ]))));
    }

    case 'contacts': {
      const relations = game.state.personal.relationships;
      return wrap('Contacts', el('div.stack', {}, relations.map((r) => el('div.msg', {}, [
        el('span.from', {}, r.name),
        el('span.time', {}, `${Math.round(r.closeness)}/100`),
        el('div.xs.dim', {}, r.role),
        meter(r.closeness, 100, r.closeness > 70 ? 'ok' : r.closeness > 40 ? 'warn' : 'danger'),
        el('div.row.mt-4', {}, [
          ...['appel', 'sortie', 'diner', 'invitation'].map((kind) =>
            button(kind, () => {
              const result = game.systems.phone.spendTime(r.id, kind);
              toast({
                title: result.ok ? result.label : 'Impossible',
                body: result.ok ? `Proximité : ${result.closeness}/100.` : result.reason,
                level: result.ok ? 'success' : 'warn',
              });
              if (result.ok) game.advance(result.hours);
              refresh();
            }, { size: 'sm', variant: 'ghost' })),
        ]),
      ]))));
    }

    case 'musique': {
      const playing = game.systems.phone.nowPlaying('menus');
      return wrap('Musique', el('div.stack', {}, [
        el('div.msg', {}, [
          el('span.from', {}, playing.playlist),
          el('div.xs.dim', {}, `${playing.track} · source : ${playing.source}`),
        ]),
        el('div.stack', {}, phone.playlists.map((p) => el('div.msg.xs', {}, [
          el('span.from', {}, p.name),
          el('span.time', {}, `${p.tracks} titres`),
        ]))),
        button('Connecter un compte streaming', () => {
          game.systems.phone.connectMusicAccount('Spotify');
          toast({ title: 'Compte connecté', body: 'Vos playlists sont disponibles en menus, en voiture et à la maison.', level: 'success' });
          refresh();
        }, { size: 'sm', block: true }),
      ]));
    }

    case 'agenda':
    case 'calendrier': {
      const events = game.systems.calendar.upcomingEvents(8);
      const fixtures = game.systems.calendar.fixtures.filter((f) => !f.played).slice(0, 8);
      return wrap('Calendrier', el('div.stack', {}, [
        el('div.card-title', {}, 'Matchs'),
        ...fixtures.map((f) => el('div.msg.xs', {}, [
          el('span.from', {}, f.opponentName),
          el('span.time', {}, `${f.date.day}/${f.date.month + 1}`),
          el('div.dim', {}, f.competition),
        ])),
        el('div.card-title.mt-4', {}, 'Événements mondiaux'),
        ...events.map((e) => el('div.msg.xs', {}, [
          el('span.from', {}, e.name),
          el('span.time', {}, `J-${e.daysUntil}`),
          el('div.dim', {}, e.cityName),
        ])),
      ]));
    }

    case 'gps': {
      const currentId = game.state.world.currentCityId;
      return wrap('GPS', el('div.stack', {}, [
        el('div.msg', {}, [el('span.from', {}, 'Position'), el('span.time', {}, getCity(currentId)?.name)]),
        el('div.card-title.mt-4', {}, 'Destinations proches'),
        ...CITIES
          .filter((c) => c.id !== currentId)
          .map((c) => ({ c, km: distanceKm(currentId, c.id) }))
          .sort((a, b) => a.km - b.km)
          .slice(0, 10)
          .map(({ c, km }) => el('div.msg.xs', {}, [
            el('span.from', {}, c.name),
            el('span.time', {}, `${num(km)} km`),
          ])),
      ]));
    }

    case 'secretaire':
      return wrap('IA Secrétaire', secretaryChat(game));

    case 'social':
      return wrap('Réseaux sociaux', socialPanel(game, refresh));

    case 'galerie':
    case 'camera':
      return wrap('Galerie', el('div.stack', {}, [
        el('p.xs.dim', {}, `${phone.posts.length} publication(s) archivée(s).`),
        ...phone.posts.slice(0, 12).map((p) => el('div.msg.xs', {}, [
          el('span.from', {}, p.typeName),
          el('span.time', {}, p.at),
          el('div', {}, p.caption),
        ])),
      ]));

    case 'notes':
      return wrap('Notes', el('div.stack', {}, [
        el('div.msg.xs', {}, [el('span.from', {}, 'Objectif de saison'), el('div', {}, 'Gagner ma place de titulaire.')]),
        el('div.msg.xs', {}, [el('span.from', {}, 'Rappel'), el('div', {}, 'Ne jamais négliger la récupération.')]),
      ]));

    case 'mail':
      return wrap('Mail', el('div.stack', {},
        phone.notifications.slice(0, 15).map((n) => el('div.msg.xs', { class: n.read ? '' : 'unread' }, [
          el('span.from', {}, n.title),
          el('span.time', {}, n.at),
          el('div.dim', {}, n.body),
        ]))));

    default:
      return wrap(APPS.find((a) => a.id === appId)?.name || 'Application', el('div.stack', {}, [
        el('p.xs.muted', {}, "Cette application est disponible dans le téléphone. Ses fonctions détaillées sont accessibles depuis les onglets correspondants de l'interface."),
        el('div.scroll-y', {}, phone.notifications.slice(0, 10).map((n) => el('div.msg.xs', {}, [
          el('span.from', {}, n.title), el('div.dim', {}, n.body),
        ]))),
      ]));
  }
}

function orderForm(game, refresh) {
  const itemSelect = el('select', {}, ORDERABLE.map((i) => el('option', { value: i.id }, `${i.name} — ${money(i.basePrice)}`)));
  const pointSelect = el('select', {}, DELIVERY_POINTS.map((p) => el('option', { value: p.id }, p.name)));

  return el('div.stack', {}, [
    itemSelect,
    pointSelect,
    button('Commander', () => {
      const result = game.systems.phone.order(itemSelect.value, pointSelect.value);
      toast({
        title: result.ok ? 'Commande confirmée' : 'Commande refusée',
        body: result.ok ? `${result.order.itemName} — livraison dans ${result.order.daysLeft} jour(s). Suivi ${result.order.trackingId}.` : result.reason,
        level: result.ok ? 'success' : 'warn',
      });
      refresh();
    }, { size: 'sm', block: true }),
  ]);
}

function secretaryChat(game) {
  const log = el('div.scroll-y', { style: { maxHeight: '260px' } });
  const input = el('input', { type: 'text', placeholder: 'Posez une question (finances, match, santé, carrière…)' });

  const ask = () => {
    const question = input.value.trim();
    if (!question) return;
    log.appendChild(el('div.msg', {}, [el('span.from', {}, 'Vous'), el('div', {}, question)]));
    const answer = game.systems.phone.ask(question);
    log.appendChild(el('div.msg.unread', {}, [el('span.from', {}, '🤖 Secrétaire'), el('div', {}, answer)]));
    log.scrollTop = log.scrollHeight;
    input.value = '';
  };

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(); });

  const suggestions = ['Mon solde ?', 'Prochain match ?', 'Ma santé ?', 'Analyse ma carrière', 'Conseils d\'investissement', 'Ma réputation ?'];

  return el('div.stack', {}, [
    log,
    el('div.row', {}, [el('div.grow', {}, input), button('Envoyer', ask, { size: 'sm', variant: 'primary' })]),
    el('div.row', {}, suggestions.map((q) => button(q, () => { input.value = q; ask(); }, { size: 'sm', variant: 'ghost' }))),
  ]);
}

function socialPanel(game, refresh) {
  const typeSelect = el('select', {}, POST_TYPES.map((t) => el('option', { value: t.id }, t.name)));
  const caption = el('input', { type: 'text', placeholder: 'Légende (facultative)' });

  return el('div.stack', {}, [
    el('div.row', {}, [
      badge(`${compact(game.state.phone.followers)} abonnés`, 'gold'),
      badge(`${game.state.phone.posts.length} publications`),
    ]),

    el('div.row', {}, game.systems.phone.trends.map((t) =>
      badge(`${t.tag} ${compact(t.posts)}`, t.aboutPlayer ? 'gold' : ''))),

    el('div.row', {}, [
      el('div', {}, typeSelect),
      el('div.grow', {}, caption),
      button('Publier', () => {
        const result = game.systems.phone.publishPost(typeSelect.value, caption.value);
        if (result.ok) {
          toast({
            title: 'Publication en ligne',
            body: `${compact(result.post.reach)} vues · ${compact(result.post.likes)} likes · +${result.gainedFollowers} abonnés`,
            level: 'success',
          });
          caption.value = '';
        }
        refresh();
      }, { variant: 'primary', size: 'sm' }),
    ]),

    game.state.phone.posts.length
      ? el('div.scroll-y', {}, game.state.phone.posts.slice(0, 8).map((post) =>
          el('div.panel.mb-4', {}, [
            el('div.row-between', {}, [
              el('span.bold.small', {}, post.typeName),
              el('span.xs.dim', {}, post.at),
            ]),
            el('div.small', {}, post.caption),
            el('div.row.xs.dim.mt-4', {}, [
              `❤️ ${compact(post.likes)}`, `👁 ${compact(post.reach)}`, `💬 ${compact(post.commentCount)}`,
            ]),
            post.comments.length
              ? el('div.mt-4', {}, post.comments.map((c) => el('div.xs', {}, [
                  el('span.bold', { class: c.tone === 'négatif' ? 'danger' : c.tone === 'marque' ? 'gold' : 'muted' }, `${c.author} `),
                  c.text,
                ])))
              : null,
          ])))
      : el('p.dim.small', {}, 'Aucune publication.'),
  ]);
}

// ── Médias ─────────────────────────────────────────────────────────────────

export function mediaView(game, refresh) {
  const media = game.systems.media;
  const pending = media.pendingConference;

  return el('div.stack', {}, [
    pending ? card('Conférence de presse en attente', pressConferenceBlock(game, pending, refresh)) : null,

    card('Programme TV', el('div.grid.grid-2', {}, media.tvSchedule().map((channel) =>
      el('div.panel', {}, [
        el('div.row-between', {}, [
          el('span.bold.small', {}, channel.name),
          channel.live ? badge('En direct', 'danger') : badge(channel.schedule),
        ]),
        el('div.xs.dim', {}, channel.genre),
        el('div.small.mt-4', {}, channel.programme),
      ])))),

    card('Podcasts', el('div.grid.grid-2', {}, media.podcastEpisodes().map((podcast) =>
      el('div.panel', {}, [
        el('div.bold.small', {}, podcast.name),
        el('div.xs.dim', {}, podcast.genre),
        el('div.small.mt-4', {}, podcast.episode),
      ])))),

    card('Presse', game.state.media.headlines.length
      ? el('div.scroll-y', {}, game.state.media.headlines.map((h) =>
          el('div.panel.mb-4', {}, [
            el('div.row-between', {}, [
              el('span.bold.small', {}, h.title),
              badge(h.tone, h.tone === 'positif' || h.tone === 'majeur' ? 'ok' : h.tone === 'negatif' ? 'danger' : ''),
            ]),
            el('div.small.muted', {}, h.body),
            el('div.xs.dim', {}, `${h.outlet} · ${h.date}`),
          ])))
      : el('p.dim', {}, 'Aucun article publié.')),

    card('Conférences passées', game.state.media.pressConferences.length
      ? el('div.stack', {}, game.state.media.pressConferences.slice(0, 6).map((conf) =>
          el('div.panel', {}, [
            el('div.row-between', {}, [
              el('span.bold.small', {}, `${conf.journalist} — ${conf.outlet}`),
              badge(`${conf.reputationDelta >= 0 ? '+' : ''}${conf.reputationDelta} rép.`, conf.reputationDelta >= 0 ? 'ok' : 'danger'),
            ]),
            ...conf.outcomes.map((o) => el('div.xs.mt-4', {}, [
              el('div.muted', {}, `Q : ${o.question}`),
              el('div', { class: o.negative ? 'danger' : 'ok' }, `→ ${o.answer} — ${o.result}`),
            ])),
          ])))
      : el('p.dim', {}, 'Aucune conférence donnée.')),

    game.state.media.documentaries.length
      ? card('Documentaires', el('div.stack', {}, game.state.media.documentaries.map((doc) =>
          el('div.panel', {}, [
            el('div.row-between', {}, [
              el('span.bold', {}, doc.title),
              doc.exclusive ? badge('Exclusif', 'gold') : null,
            ]),
            el('div.xs.dim.mb-4', {}, `${doc.platform} · ${doc.duration} min · ${doc.chapters.length} chapitres`),
            ...doc.chapters.map((ch) => el('div.mb-4', {}, [
              el('div.bold.small', {}, ch.title),
              el('div.small.muted', {}, ch.body),
            ])),
          ]))))
      : null,

    button('Convoquer une conférence de presse', () => {
      media.pendingConference = media.buildConference(null);
      refresh();
    }, { variant: 'ghost' }),
  ]);
}

function pressConferenceBlock(game, conference, refresh) {
  const answers = new Array(conference.questions.length).fill('humble');

  const questionBlocks = conference.questions.map((question, index) =>
    el('div.panel', {}, [
      el('div.small.bold', {}, `${conference.journalist.name} : « ${question} »`),
      el('div.row.mt-4', {}, PRESS_ANSWERS.map((answer) => {
        const btn = button(answer.label, () => {
          answers[index] = answer.id;
          questionBlocks[index].querySelectorAll('.btn').forEach((b) => b.classList.remove('btn-primary'));
          btn.classList.add('btn-primary');
        }, { size: 'sm', variant: answer.id === 'humble' ? 'primary' : 'ghost' });
        return btn;
      })),
    ]));

  return el('div.stack', {}, [
    el('p.small.muted', {}, `${conference.journalist.name} (${conference.journalist.outlet}) — angle « ${conference.journalist.angle} ». Chaque réponse influence votre réputation.`),
    ...questionBlocks,
    button('Répondre', () => {
      const record = game.systems.media.answerConference(conference, answers);
      toast({
        title: record.controversy ? 'Polémique déclenchée' : 'Conférence terminée',
        body: `Réputation ${record.reputationDelta >= 0 ? '+' : ''}${record.reputationDelta}.`,
        level: record.controversy ? 'warn' : 'success',
      });
      game.advance(2);
      refresh();
    }, { variant: 'primary' }),
  ]);
}

// ── Héritage ───────────────────────────────────────────────────────────────

export function legacyView(game, refresh) {
  const legacy = game.state.legacy;
  const awards = game.systems.awards;
  const invitations = awards.legendInvitations();

  return el('div.stack', {}, [
    el('div.grid.grid-4', {}, [
      stat('Trophées', legacy.trophies.length, { tone: 'gold' }),
      stat('Récompenses', legacy.awards.length, { tone: 'gold' }),
      stat('Hall of Fame', legacy.hallOfFame ? `Oui (${legacy.hallOfFameSeason})` : 'Pas encore'),
      stat('Statues', legacy.statues.length),
    ]),

    // Musée
    card('Musée personnel', legacy.museum.built
      ? el('div.stack', {}, [
          el('div.grid.grid-3', {}, [
            stat('Visiteurs', num(legacy.museum.visitors)),
            stat('Recettes en attente', money(legacy.museum.revenue)),
            stat('Note des visiteurs', `${legacy.museum.rating.toFixed(1)}/5`, { tone: 'gold' }),
          ]),
          el('div.card-title.mt-4', {}, `Collection (${legacy.museum.exhibits.length} pièces)`),
          el('div.row', {}, legacy.museum.exhibits.slice(0, 30).map((e) => badge(`${e.name}${e.season ? ` (${e.season})` : ''}`))),
        ])
      : el('div', {}, [
          el('p.muted', {}, 'Votre musée personnel exposera trophées, maillots, crampons et photos. Il ouvre automatiquement à la retraite, ou peut être construit dès maintenant.'),
          button('Construire le musée (2 500 000 €)', () => {
            const r = game.systems.career.buildMuseum();
            toast({ title: r.ok ? 'Musée inauguré' : 'Construction impossible', body: r.ok ? 'Les portes sont ouvertes au public.' : r.reason, level: r.ok ? 'success' : 'warn' });
            refresh();
          }, { variant: 'primary' }),
        ])),

    // Palmarès
    el('div.grid.grid-2', {}, [
      card('Trophées collectifs', legacy.trophies.length
        ? el('div.stack', {}, legacy.trophies.map((t) => el('div.row-between', {}, [
            el('span.small', {}, `🏆 ${t.name}`),
            el('span.xs.dim', {}, `${t.clubName} · ${t.season}`),
          ])))
        : el('p.dim.mb-0', {}, 'Aucun trophée.')),

      card('Récompenses individuelles', legacy.awards.length
        ? el('div.stack', {}, legacy.awards.map((a) => el('div.row-between', {}, [
            el('span.small', {}, `🥇 ${a.category}`),
            el('span.xs.dim', {}, `${a.cityName} · ${a.season}`),
          ])))
        : el('p.dim.mb-0', {}, 'Aucune récompense.')),
    ]),

    // Records
    card('Records personnels', Object.keys(game.state.stats.records).length
      ? table(
          ['Record', 'Valeur', 'Saison', 'Contexte'],
          Object.entries(game.state.stats.records).map(([, r]) => [r.label, String(r.value), String(r.season), r.context]),
          { numeric: [1] },
        )
      : el('p.dim.mb-0', {}, 'Aucun record établi.')),

    // Chronologie
    card('Chronologie de carrière', legacy.timeline.length
      ? el('div.timeline', {}, legacy.timeline.slice().reverse().map((item) =>
          el('div.timeline-item', {}, [
            el('div.season', {}, `Saison ${item.season}`),
            el('div.title', {}, item.title),
            el('div.detail', {}, item.detail),
          ])))
      : el('p.dim.mb-0', {}, 'La chronologie se remplira au fil de votre carrière.')),

    // Honneurs culturels
    game.state.reputation.honours.length
      ? card('Héritage culturel', el('div.stack', {}, game.state.reputation.honours.map((h) =>
          el('div.row-between', {}, [
            el('span.small', {}, `🏛️ ${h.name}`),
            el('span.xs.dim', {}, `${h.cityName} · ${h.season}`),
          ]))))
      : null,

    // Maillots encadrés
    legacy.framedShirts.length
      ? card('Maillots encadrés des légendes côtoyées', el('div.grid.grid-3', {},
          legacy.framedShirts.map((s) => el('div.panel', {}, [
            el('div.bold.small', {}, s.legend),
            el('div.xs.dim', {}, `Saison ${s.season}`),
            el('div.xs.muted', {}, `« ${s.inscription} »`),
          ]))))
      : null,

    // Hall of Fame
    card('Hall of Fame mondial', el('div.stack', {},
      awards.hallOfFameRoster().map((entry) => el('div.row-between', {
        class: entry.isPlayer ? 'panel' : '',
        style: entry.isPlayer ? { borderColor: 'var(--gold)' } : {},
      }, [
        el('div', {}, [
          el('span.small.bold', { class: entry.isPlayer ? 'gold' : '' }, entry.name),
          el('span.xs.dim', {}, ` · ${entry.category} · ${entry.era}`),
        ]),
        el('span.xs.muted', {}, entry.note),
      ])))),

    // Invitations de légende
    invitations.length
      ? card('Invitations reçues', el('div.grid.grid-2', {}, invitations.map((inv) =>
          el('div.panel', {}, [
            el('div.bold.small', {}, inv.name),
            el('div.xs.dim.mb-4', {}, `${inv.role} · ${inv.cityName}`),
            button('Accepter', () => {
              const r = awards.acceptInvitation(inv.id, game.systems.economy);
              toast({
                title: r.ok ? inv.name : 'Impossible',
                body: r.ok ? `${inv.role}. Cachet : ${money(r.fee)}.` : r.reason,
                level: r.ok ? 'success' : 'warn',
              });
              refresh();
            }, { size: 'sm', block: true }),
          ]))))
      : null,

    // Cérémonie
    card('Boubjack Awards', [
      el('p.small.muted', {}, `La prochaine édition se tiendra à ${getCity(game.state.world.awardsHosts[game.snapshot().clock.season])?.name || 'une ville hôte à confirmer'}. Une ville différente chaque année.`),
      button('Assister à la cérémonie', () => {
        const ceremony = awards.holdBoubjackAwards({ cityId: game.state.world.awardsHosts[game.snapshot().clock.season] });
        playCeremony(ceremony, refresh);
      }, { variant: 'primary' }),
    ]),

    // Mémoire du monde
    game.state.world.worldMemory.length
      ? card('Mémoire du monde', el('div.scroll-y', {}, game.state.world.worldMemory.slice().reverse().slice(0, 30).map((m) =>
          el('div.xs.muted.mb-4', {}, [el('span.gold', {}, `[${m.season}] `), m.text]))))
      : null,
  ]);
}

// ── Statistiques ───────────────────────────────────────────────────────────

export function statsView(game) {
  const career = game.state.stats.career;
  const seasons = game.state.stats.seasons;
  const seasonKeys = Object.keys(seasons).sort();

  const avg = (line) => line.notes?.length
    ? (line.notes.reduce((a, b) => a + b, 0) / line.notes.length).toFixed(2)
    : '—';

  const influence = game.systems.reputation.influence();

  return el('div.stack', {}, [
    card('Carrière complète', el('div.grid.grid-4', {}, [
      stat('Matchs', num(career.matchs)),
      stat('Titularisations', num(career.titularisations)),
      stat('Minutes', num(career.minutes)),
      stat('Buts', num(career.buts), { tone: 'gold' }),
      stat('Passes décisives', num(career.passesD)),
      stat('Tirs cadrés', `${num(career.tirsCadres)}/${num(career.tirs)}`),
      stat('Passes réussies', career.passes ? `${Math.round((career.passesReussies / career.passes) * 100)} %` : '—'),
      stat('Duels gagnés', career.duels ? `${Math.round((career.duelsGagnes / career.duels) * 100)} %` : '—'),
      stat('Cartons', `${career.cartonsJaunes} 🟨 / ${career.cartonsRouges} 🟥`),
      stat('Distance', `${Math.round(career.kilometres)} km`),
      stat('Vitesse max', `${career.vitesseMax} km/h`),
      stat('Note moyenne', avg(career), { tone: 'gold' }),
    ])),

    card('Bilan par saison', table(
      ['Saison', 'M', 'Tit.', 'Min.', 'Buts', 'PD', 'Note', 'V/N/D'],
      seasonKeys.map((key) => {
        const s = seasons[key];
        return [
          key, String(s.matchs), String(s.titularisations), num(s.minutes),
          String(s.buts), String(s.passesD), avg(s),
          `${s.victoires}/${s.nuls}/${s.defaites}`,
        ];
      }),
      { numeric: [1, 2, 3, 4, 5, 6], empty: 'Aucune saison complétée.' },
    )),

    // Comparateur de saisons — Tome XXVIII ch. 5
    seasonKeys.length >= 2 ? card('Comparer deux saisons', seasonComparator(game, seasonKeys)) : null,

    card('Influence sur le monde', [
      el('p.small.muted', {}, 'Votre réputation agit réellement sur votre écosystème.'),
      el('div.grid.grid-3', {}, [
        stat('Maillots vendus', num(influence.shirtSales), { sub: 'par saison' }),
        stat('Affluence', `+${influence.attendanceBoost} %`, { sub: influence.clubName }),
        stat('Popularité du championnat', `+${influence.leaguePopularity} %`, { sub: influence.leagueName }),
        stat('Valorisation du club', money(influence.clubValueBoost)),
        stat('Tourisme généré', num(influence.tourismBoost), { sub: 'visiteurs / grand événement' }),
        stat('Relation supporters', `${Math.round(game.state.reputation.fanRelation)}/100`),
      ]),
    ]),

    card('Réputation par pays', game.systems.reputation.topCountries(10).length
      ? el('div.stack', {}, game.systems.reputation.topCountries(10).map((c) =>
          el('div', {}, [
            el('div.row-between.small', {}, [el('span', {}, c.name), el('span.nums', {}, c.value)]),
            meter(c.value, 100, c.value > 70 ? 'ok' : c.value > 40 ? 'warn' : 'danger'),
          ])))
      : el('p.dim.mb-0', {}, 'Aucune réputation nationale établie.')),
  ]);
}

function seasonComparator(game, seasonKeys) {
  const a = el('select', {}, seasonKeys.map((k) => el('option', { value: k }, k)));
  const b = el('select', {}, seasonKeys.map((k, i) => el('option', { value: k, selected: i === seasonKeys.length - 1 }, k)));
  const output = el('div');

  const compare = () => {
    const sa = game.state.stats.seasons[a.value];
    const sb = game.state.stats.seasons[b.value];
    if (!sa || !sb) return;

    const metrics = [
      ['Matchs', sa.matchs, sb.matchs],
      ['Buts', sa.buts, sb.buts],
      ['Passes décisives', sa.passesD, sb.passesD],
      ['Minutes', sa.minutes, sb.minutes],
      ['Victoires', sa.victoires, sb.victoires],
    ];

    render(output, el('div.stack', {}, metrics.map(([label, va, vb]) => {
      const max = Math.max(va, vb, 1);
      return el('div', {}, [
        el('div.row-between.small', {}, [
          el('span.muted', {}, label),
          el('span.nums', {}, `${va} vs ${vb}`),
        ]),
        el('div.row', {}, [
          el('div.grow', {}, meter(va, max, 'accent')),
          el('div.grow', {}, meter(vb, max, 'warn')),
        ]),
      ]);
    })));
  };

  a.addEventListener('change', compare);
  b.addEventListener('change', compare);
  queueMicrotask(compare);

  return el('div.stack', {}, [
    el('div.row', {}, [
      el('div', {}, [el('label.xs', {}, 'Saison A'), a]),
      el('div', {}, [el('label.xs', {}, 'Saison B'), b]),
    ]),
    output,
  ]);
}

// ── Carte du monde ─────────────────────────────────────────────────────────

export function mapView(game, refresh) {
  const currentId = game.state.world.currentCityId;
  const search = el('input', { type: 'search', placeholder: 'Rechercher une ville, un stade, un hôtel, une boutique…' });
  const resultsHost = el('div.stack');
  const stats = worldStats();

  const doSearch = () => {
    const query = search.value.trim().toLowerCase();
    if (query.length < 2) {
      render(resultsHost, el('p.dim.small', {}, 'Saisissez au moins deux caractères.'));
      return;
    }

    const hits = [];
    for (const city of CITIES) {
      if (city.name.toLowerCase().includes(query)) {
        hits.push({ kind: 'ville', name: city.name, city, detail: getCountry(city.country)?.name });
      }
      for (const venue of city.venues) {
        if (venue.name.toLowerCase().includes(query) || (venue.type || '').includes(query)) {
          hits.push({ kind: 'lieu', name: venue.name, city, detail: `${venue.type} · ${city.name}` });
        }
      }
    }

    render(resultsHost, hits.length
      ? hits.slice(0, 25).map((hit) => el('div.panel', {}, [
          el('div.row-between', {}, [
            el('div', {}, [
              el('div.bold.small', {}, hit.name),
              el('div.xs.dim', {}, `${hit.kind} · ${hit.detail} · ${num(distanceKm(currentId, hit.city.id))} km`),
            ]),
            hit.city.id !== currentId
              ? button('Itinéraire', () => showRoute(game, hit.city.id, refresh), { size: 'sm' })
              : badge('Vous êtes ici', 'gold'),
          ]),
        ]))
      : el('p.dim.small', {}, 'Aucun résultat.'));
  };

  search.addEventListener('input', doSearch);

  // Projection équirectangulaire simple sur la boîte de la carte.
  const pins = CITIES.map((city) => {
    const x = ((city.lon + 180) / 360) * 100;
    const y = ((90 - city.lat) / 180) * 100;
    return el('div', {}, [
      el('div', {
        class: `map-pin${city.id === currentId ? ' current' : city.hub ? ' hub' : ''}`,
        style: { left: `${x}%`, top: `${y}%` },
        title: `${city.name} — ${getCountry(city.country)?.name}`,
        onClick: () => showRoute(game, city.id, refresh),
      }),
      el('div.map-label', { style: { left: `${x}%`, top: `${y}%` } }, city.name),
    ]);
  });

  return el('div.stack', {}, [
    el('div.grid.grid-4', {}, [
      stat('Pays', stats.countries),
      stat('Villes', stats.cities),
      stat('Lieux visitables', stats.venues),
      stat('Clubs', stats.clubs),
    ]),

    card('Carte du monde', [
      el('div.world-map', {}, pins),
      el('div.row.mt-4.xs', {}, [
        badge('Position actuelle', 'gold'),
        badge('Hub social'),
        el('span.dim', {}, 'Cliquez sur une ville pour calculer un itinéraire.'),
      ]),
    ]),

    card('Recherche', [search, resultsHost]),
  ]);
}

function showRoute(game, cityId, refresh) {
  if (cityId === game.state.world.currentCityId) {
    toast({ title: 'Vous y êtes déjà', level: 'info' });
    return;
  }

  const city = getCity(cityId);
  const options = game.systems.world.availableTransports(cityId);
  const best = options[0];

  modal({
    title: `Itinéraire vers ${city.name}`,
    body: el('div.stack', {}, [
      el('p.muted', {}, city.description),
      el('div.grid.grid-3', {}, [
        stat('Distance', `${num(distanceKm(game.state.world.currentCityId, cityId))} km`),
        stat('Meilleur trajet', best ? best.name : '—'),
        stat('Durée estimée', best ? `${best.hours} h` : '—'),
      ]),
      el('div.card-title.mt-4', {}, 'Options disponibles'),
      options.length
        ? el('div.stack', {}, options.map((option) => el('div.row-between.panel', {}, [
            el('div', {}, [
              el('span.small.bold', {}, `${option.icon} ${option.name}`),
              el('div.xs.dim', {}, `${option.hours} h · confort ${option.comfort}/100`),
            ]),
            el('div.row', {}, [
              el('span.small', {}, option.cost ? money(option.cost) : 'Gratuit'),
              button('Partir', () => {
                document.querySelector('.modal-backdrop')?.remove();
                runTravel(game, cityId, option.id, refresh);
              }, { size: 'sm', variant: 'primary' }),
            ]),
          ])))
        : el('p.dim', {}, 'Aucun transport disponible pour cette distance.'),
    ]),
  });
}

// ── Événements mondiaux ────────────────────────────────────────────────────

export function eventsView(game, refresh) {
  const upcoming = game.systems.calendar.upcomingEvents(12);
  const fixtures = game.systems.calendar.fixtures.filter((f) => !f.played).slice(0, 15);
  const cinematics = game.consumeCinematics();

  return el('div.stack', {}, [
    cinematics.length
      ? card('Séquences récentes', el('div.stack', {}, cinematics.map((c) => el('div.panel', {}, [
          el('div.bold.small', {}, `🎬 ${c.title}`),
          el('div.xs.dim', {}, c.at),
          el('div.small.muted', {}, c.body),
        ]))))
      : null,

    card('Calendrier des rencontres', table(
      ['Date', 'Compétition', 'Adversaire', 'Lieu', 'Enjeu', ''],
      fixtures.map((f) => [
        `${f.date.day}/${f.date.month + 1}`,
        f.competition,
        f.opponentName,
        f.home ? 'Domicile' : 'Extérieur',
        `${Math.round((f.importance || 0.5) * 100)} %`,
        button('Jouer', () => openMatch(game, f, refresh), { size: 'sm', variant: 'primary' }),
      ]),
      { empty: 'Aucune rencontre programmée.' },
    )),

    card('Événements mondiaux', upcoming.length
      ? el('div.grid.grid-2', {}, upcoming.map((event) =>
          el('div.panel', {}, [
            el('div.row-between', {}, [
              el('span.bold.small', {}, event.name),
              badge(`J-${event.daysUntil}`, event.daysUntil <= 7 ? 'gold' : ''),
            ]),
            el('div.xs.dim', {}, `${event.cityName} · ${event.date.day}/${event.date.month + 1}/${event.date.year}`),
            el('div.row.mt-4', {}, [
              badge(event.type),
              event.transformsCity ? badge('Transforme la ville', 'warn') : null,
              event.fanZones ? badge('Fan zones', 'ok') : null,
            ]),
          ])))
      : el('p.dim.mb-0', {}, 'Aucun événement à venir.')),

    game.state.world.activeEvents.length
      ? card('Villes en configuration événement', el('div.stack', {}, game.state.world.activeEvents.map((e) =>
          el('div.panel', {}, [
            el('div.bold.small', {}, `${getCity(e.cityId)?.name} — ${e.name}`),
            el('div.xs.muted', {}, [
              `Prix ×${e.effects.priceMultiplier.toFixed(2)} · ${num(e.effects.touristInflux)} visiteurs · `,
              Object.entries(e.effects).filter(([, v]) => v === true).map(([k]) => k).join(', '),
            ]),
          ]))))
      : null,
  ]);
}
