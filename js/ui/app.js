/**
 * app.js — Coque de l'application jouable.
 *
 * Assure :
 *   - l'écran de création de personnage (Tome IV ch. 1)
 *   - le HUD personnalisable (Tome XII ch. 4)
 *   - la navigation entre les écrans
 *   - le menu Pause : reprendre, sauvegarder, charger, paramètres, quitter
 *     (Tome XII ch. 3) — « le monde reprend exactement où il s'était arrêté »
 *   - les options d'accessibilité (Tome XII ch. 7)
 *   - la console développeur (Tome XXII ch. 7)
 */

import { game } from '../game.js';
import { bus, EVENTS } from '../core/events.js';
import {
  el, render, card, stat, badge, button, table,
  money, num, toast, modal, siteHeader, siteFooter, applyAccessibility, $,
} from './dom.js';
import {
  dashboardView, careerView, worldView, economyView, phoneView,
  mediaView, legacyView, statsView, mapView, eventsView,
} from './views.js';
import { CLUBS, getCity, getClub, COUNTRIES } from '../data/world.js';

const TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: '📊', view: dashboardView },
  { id: 'career', label: 'Carrière', icon: '⚽', view: careerView },
  { id: 'events', label: 'Calendrier', icon: '📅', view: eventsView },
  { id: 'world', label: 'Monde ouvert', icon: '🌍', view: worldView },
  { id: 'map', label: 'Carte', icon: '🗺️', view: mapView },
  { id: 'phone', label: 'Téléphone', icon: '📱', view: phoneView },
  { id: 'economy', label: 'Patrimoine', icon: '💰', view: economyView },
  { id: 'media', label: 'Médias', icon: '📰', view: mediaView },
  { id: 'stats', label: 'Statistiques', icon: '📈', view: statsView },
  { id: 'legacy', label: 'Héritage', icon: '🏆', view: legacyView },
];

let activeTab = 'dashboard';
let hudNode = null;
let contentNode = null;
let navNode = null;

// ── Point d'entrée ─────────────────────────────────────────────────────────

export function boot(root) {
  document.body.prepend(siteHeader('sim'));

  const shell = el('div.shell', {}, [
    el('div.container-wide', {}, [el('div', { id: 'app-body' })]),
    siteFooter(),
  ]);
  render(root, shell);

  // Les notifications du moteur deviennent des toasts d'interface.
  bus.on(EVENTS.NOTIFY, (payload) => toast(payload));

  // Les événements marquants du monde s'affichent également.
  bus.on(EVENTS.WORLD_EVENT, (payload) => {
    if (payload.kind === 'discovery' || payload.kind === 'rare' || payload.kind === 'honour') {
      toast({ title: payload.title, body: payload.body, level: 'success', duration: 6500 });
    }
  });

  bus.on(EVENTS.HALL_OF_FAME, (induction) => {
    modal({
      title: 'Intronisation au Hall of Fame',
      body: el('div.stack', {}, [
        el('p', {}, induction.speech),
        el('ul', {}, [
          el('li', {}, induction.jacket),
          el('li', {}, induction.plaque),
          el('li', {}, induction.video),
        ]),
        el('p.muted.mb-0', {}, `Cérémonie présidée par ${induction.presenter}.`),
      ]),
    });
  });

  // Raccourcis clavier — Tome XII ch. 3 et 7.
  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input, select, textarea')) return;
    if (event.key === 'Escape' && game.started && !document.querySelector('.modal-backdrop')) {
      openPauseMenu();
    }
  });

  const saves = game.listSaves();
  if (saves.length > 0) showTitleScreen(saves);
  else showCreationScreen();
}

// ── Écran-titre ────────────────────────────────────────────────────────────

function showTitleScreen(saves) {
  render($('#app-body'), el('div.stack', { style: { paddingTop: '3rem', maxWidth: '760px', margin: '0 auto' } }, [
    el('div.center', {}, [
      el('h1', {}, 'Infinity Football'),
      el('p.muted', {}, 'Reprenez une carrière ou commencez-en une nouvelle.'),
    ]),

    card('Sauvegardes', table(
      ['Emplacement', 'Joueur', 'Club', 'Saison', 'Date', ''],
      saves.map((save) => [
        save.label,
        save.playerName,
        save.club,
        String(save.season),
        new Date(save.savedAt).toLocaleString('fr-FR'),
        el('div.row', {}, [
          button('Charger', () => {
            const result = game.load(save.slot);
            if (result.ok) {
              applyAccessibility(game.state.settings.accessibility);
              renderGame();
              toast({ title: 'Partie chargée', body: `${save.playerName} — saison ${save.season}.`, level: 'success' });
            } else {
              toast({ title: 'Chargement impossible', body: result.reason, level: 'error' });
            }
          }, { size: 'sm', variant: 'primary' }),
          button('Supprimer', () => {
            game.deleteSave(save.slot);
            showTitleScreen(game.listSaves());
          }, { size: 'sm', variant: 'danger' }),
        ]),
      ]),
      { empty: 'Aucune sauvegarde.' },
    )),

    el('div.row.center', { style: { justifyContent: 'center' } }, [
      button('Nouvelle carrière', () => showCreationScreen(), { variant: 'primary', size: 'lg' }),
      button('Importer une sauvegarde', () => importDialog(), { variant: 'ghost' }),
    ]),
  ]));
}

// ── Création de personnage (Tome IV ch. 1) ─────────────────────────────────

function showCreationScreen() {
  const name = el('input', { type: 'text', value: 'Boubacar Touré', maxlength: '40' });
  const nationality = el('select', {}, COUNTRIES.map((c) =>
    el('option', { value: c.name, selected: c.id === 'ml' }, c.name)));
  const position = el('select', {}, [
    ['AT', 'Attaquant'], ['MO', 'Meneur de jeu'], ['MC', 'Milieu central'],
    ['MD', 'Milieu défensif'], ['DL', 'Latéral'], ['DC', 'Défenseur central'], ['GB', 'Gardien'],
  ].map(([value, label]) => el('option', { value }, label)));
  const foot = el('select', {}, ['droit', 'gauche', 'ambidextre'].map((f) => el('option', { value: f }, f)));
  const style = el('select', {}, [
    'Finisseur', 'Créateur', 'Dribbleur', 'Box-to-box', 'Sentinelle',
    'Percuteur', '技 Technicien', 'Athlète',
  ].map((s) => el('option', { value: s }, s)));
  const age = el('input', { type: 'number', value: '17', min: '16', max: '24' });
  const club = el('select', {}, CLUBS
    .filter((c) => c.tier >= 2)
    .sort((a, b) => a.prestige - b.prestige)
    .map((c) => el('option', { value: c.id, selected: c.id === 'stade-malien' },
      `${c.name} — ${c.league} (prestige ${c.prestige})`)));
  const seed = el('input', { type: 'text', value: String(Date.now() % 1000000) });

  render($('#app-body'), el('div.stack', { style: { paddingTop: '2.5rem', maxWidth: '860px', margin: '0 auto' } }, [
    el('div.center', {}, [
      el('h1', {}, 'Créer votre joueur'),
      el('p.muted', {}, 'Chaque choix influence votre progression, vos opportunités et votre histoire.'),
    ]),

    card('Identité', [
      el('div.grid.grid-2', {}, [
        el('div.field', {}, [el('label', {}, 'Nom complet'), name]),
        el('div.field', {}, [el('label', {}, 'Nationalité'), nationality]),
        el('div.field', {}, [el('label', {}, 'Âge de début'), age]),
        el('div.field', {}, [el('label', {}, 'Pied fort'), foot]),
      ]),
    ]),

    card('Profil sportif', [
      el('div.grid.grid-2', {}, [
        el('div.field', {}, [el('label', {}, 'Poste'), position]),
        el('div.field', {}, [el('label', {}, 'Style de jeu'), style]),
      ]),
      el('div.field', {}, [el('label', {}, 'Club formateur'), club]),
      el('p.xs.dim.mb-0', {}, 'Un club modeste rend la progression plus difficile mais l\'ascension plus mémorable.'),
    ]),

    card('Monde', [
      el('div.field', {}, [
        el('label', {}, 'Graine du monde'),
        seed,
        el('p.xs.dim.mt-4.mb-0', {}, 'Une même graine reproduit exactement le même monde : calendrier, adversaires, villes hôtes et événements.'),
      ]),
    ]),

    el('div.row.center', { style: { justifyContent: 'center' } }, [
      game.listSaves().length ? button('Retour', () => showTitleScreen(game.listSaves()), { variant: 'ghost' }) : null,
      button('Commencer la carrière', () => {
        game.newGame({
          name: name.value.trim() || 'Joueur Anonyme',
          nationality: nationality.value,
          position: position.value,
          foot: foot.value,
          style: style.value,
          age: Math.max(16, Math.min(24, Number(age.value) || 17)),
          clubId: club.value,
          seed: seed.value.trim() || String(Date.now()),
        });
        applyAccessibility(game.state.settings.accessibility);
        game.save('auto');
        renderGame();
      }, { variant: 'primary', size: 'lg' }),
    ]),
  ]));
}

// ── Interface de jeu ───────────────────────────────────────────────────────

function renderGame() {
  hudNode = el('div.hud');
  contentNode = el('div');
  navNode = el('nav.game-nav', { 'aria-label': 'Sections du jeu' });

  render($('#app-body'), el('div', {}, [
    hudNode,
    el('div.game-shell', {}, [navNode, contentNode]),
  ]));

  refresh();
}

/** Redessine HUD, navigation et écran courant. */
function refresh() {
  if (!game.started) return;
  renderHud();
  renderNav();
  renderContent();
}

function renderHud() {
  const s = game.snapshot();
  const hud = s.settings.hud;

  render(hudNode, [
    el('div.hud-item', { hidden: !hud.heure }, [
      el('span.label', {}, 'Date'),
      el('span.value', {}, `${s.clock.dateLabel} · ${s.clock.timeLabel}`),
    ]),
    el('div.hud-item', { hidden: !hud.meteo }, [
      el('span.label', {}, 'Météo'),
      el('span.value', {}, `${s.weather.icon} ${s.weather.tempC} °C`),
    ]),
    el('div.hud-item', { hidden: !hud.minimap }, [
      el('span.label', {}, 'Lieu'),
      el('span.value', {}, s.city?.name || '—'),
    ]),
    el('div.hud-item', {}, [
      el('span.label', {}, 'Club'),
      el('span.value', {}, s.club?.name || '—'),
    ]),
    el('div.hud-item', {}, [
      el('span.label', {}, 'Solde'),
      el('span.value', { class: s.finance.courant < 0 ? 'danger' : '' }, money(s.finance.courant)),
    ]),
    el('div.hud-item', {}, [
      el('span.label', {}, 'Réputation'),
      el('span.value.gold', {}, s.reputation.global.toFixed(1)),
    ]),
    el('div.grow'),
    el('div.row', {}, [
      button('+1 h', () => { game.advance(1); refresh(); }, { size: 'sm', variant: 'ghost' }),
      button('+1 jour', () => { game.advanceDays(1); refresh(); }, { size: 'sm', variant: 'ghost' }),
      button('+1 semaine', () => { game.advanceDays(7); refresh(); }, { size: 'sm', variant: 'ghost' }),
      button('Au prochain match', () => {
        const result = game.advanceToNextMatch();
        if (!result.ok) toast({ title: 'Calendrier', body: result.reason, level: 'info' });
        else if (result.daysAdvanced > 0) toast({ title: `${result.daysAdvanced} jour(s) écoulés`, body: `${result.fixture.competition} contre ${result.fixture.opponentName}.`, level: 'info' });
        refresh();
      }, { size: 'sm' }),
      button('☰ Pause', () => openPauseMenu(), { size: 'sm', variant: 'ghost' }),
    ]),
  ]);
}

function renderNav() {
  const s = game.snapshot();
  render(navNode, TABS.map((tab) =>
    el('button', {
      class: tab.id === activeTab ? 'active' : '',
      onClick: () => { activeTab = tab.id; refresh(); },
    }, [
      el('span', {}, tab.icon),
      el('span', {}, tab.label),
      tab.id === 'phone' && s.phone.unread > 0 ? el('span.nav-badge', {}, String(s.phone.unread)) : null,
      tab.id === 'media' && game.systems.media.pendingConference ? el('span.nav-badge', {}, '!') : null,
    ])));
}

function renderContent() {
  const tab = TABS.find((t) => t.id === activeTab) || TABS[0];
  try {
    render(contentNode, tab.view(game, refresh));
  } catch (error) {
    console.error('[ui] échec du rendu :', error);
    render(contentNode, el('div.notice.warn', {}, [
      el('strong', {}, 'Erreur d\'affichage. '),
      'Le moteur continue de tourner ; consultez la console développeur pour le détail. ',
      el('div.mono.xs.mt-4', {}, String(error.message)),
    ]));
  }
}

// ── Menu Pause (Tome XII ch. 3) ────────────────────────────────────────────

function openPauseMenu() {
  const wasRunning = game.clock.running;
  game.clock.pause();

  const { close } = modal({
    title: 'Pause',
    body: el('div.stack', {}, [
      el('p.muted', {}, 'Le monde est suspendu. Il reprendra exactement où il s\'est arrêté.'),
      el('div.grid.grid-2', {}, [
        button('▶ Reprendre', () => { close(); }, { block: true, variant: 'primary' }),
        button('💾 Sauvegarder', () => {
          const slot = `manuel-${Date.now().toString(36)}`;
          const ok = game.save(slot);
          toast({
            title: ok ? 'Partie sauvegardée' : 'Sauvegarde impossible',
            body: ok ? `Emplacement : ${slot}` : 'Vérifiez l\'espace de stockage du navigateur.',
            level: ok ? 'success' : 'error',
          });
        }, { block: true }),
        button('📂 Charger', () => { close(); showTitleScreen(game.listSaves()); }, { block: true }),
        button('⚙️ Paramètres', () => { close(); openSettings(); }, { block: true }),
        button('🎯 Objectifs', () => { close(); openObjectives(); }, { block: true }),
        button('🔧 Console développeur', () => { close(); openDevTools(); }, { block: true }),
        button('📤 Exporter', () => {
          const json = game.exportSave();
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = el('a', { href: url, download: `infinity-football-${game.state.player.name.replace(/\s/g, '-')}.json` });
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          toast({ title: 'Sauvegarde exportée', level: 'success' });
        }, { block: true }),
        button('🚪 Quitter', () => {
          game.save('auto');
          close();
          showTitleScreen(game.listSaves());
        }, { block: true, variant: 'danger' }),
      ]),
    ]),
    onClose: () => { if (wasRunning) game.clock.start(); refresh(); },
  });
}

// ── Paramètres (Tome XII ch. 4 et 7) ───────────────────────────────────────

function openSettings() {
  const settings = game.state.settings;

  const hudChecks = Object.entries(settings.hud).map(([key, value]) => {
    const input = el('input', { type: 'checkbox', id: `hud-${key}`, checked: value });
    input.addEventListener('change', () => {
      settings.hud[key] = input.checked;
      renderHud();
    });
    return el('div.check-row', {}, [input, el('label', { for: `hud-${key}` }, key)]);
  });

  const scale = el('input', { type: 'range', min: '0.85', max: '1.4', step: '0.05', value: String(settings.accessibility.textScale) });
  scale.addEventListener('input', () => {
    settings.accessibility.textScale = Number(scale.value);
    applyAccessibility(settings.accessibility);
  });

  const contrast = el('input', { type: 'checkbox', id: 'a11y-contrast', checked: settings.accessibility.highContrast });
  contrast.addEventListener('change', () => {
    settings.accessibility.highContrast = contrast.checked;
    applyAccessibility(settings.accessibility);
  });

  const motion = el('input', { type: 'checkbox', id: 'a11y-motion', checked: settings.accessibility.reducedMotion });
  motion.addEventListener('change', () => {
    settings.accessibility.reducedMotion = motion.checked;
    applyAccessibility(settings.accessibility);
  });

  const subtitles = el('input', { type: 'checkbox', id: 'a11y-subs', checked: settings.accessibility.subtitles });
  subtitles.addEventListener('change', () => { settings.accessibility.subtitles = subtitles.checked; });

  const autosave = el('input', { type: 'checkbox', id: 'autosave', checked: settings.autosave });
  autosave.addEventListener('change', () => { settings.autosave = autosave.checked; });

  const lang = el('select', {}, ['fr', 'en', 'es', 'pt', 'ar'].map((code) =>
    el('option', { value: code, selected: code === settings.audio.commentaryLang }, code.toUpperCase())));
  lang.addEventListener('change', () => { settings.audio.commentaryLang = lang.value; });

  modal({
    title: 'Paramètres',
    body: el('div.stack', {}, [
      card('HUD', [
        el('p.small.muted', {}, 'Affichez ou masquez chaque élément de l\'interface de jeu.'),
        ...hudChecks,
      ]),
      card('Accessibilité', [
        el('div.field', {}, [
          el('label', {}, `Taille du texte — ${Math.round(settings.accessibility.textScale * 100)} %`),
          scale,
        ]),
        el('div.check-row', {}, [contrast, el('label', { for: 'a11y-contrast' }, 'Contraste renforcé')]),
        el('div.check-row', {}, [motion, el('label', { for: 'a11y-motion' }, 'Réduire les animations')]),
        el('div.check-row', {}, [subtitles, el('label', { for: 'a11y-subs' }, 'Sous-titres')]),
      ]),
      card('Audio et sauvegarde', [
        el('div.field', {}, [el('label', {}, 'Langue des commentaires'), lang]),
        el('div.check-row', {}, [autosave, el('label', { for: 'autosave' }, 'Sauvegarde automatique hebdomadaire')]),
      ]),
    ]),
    onClose: () => refresh(),
  });
}

function openObjectives() {
  const s = game.snapshot();
  const objectives = [
    { label: 'Devenir titulaire indiscutable', done: ['Titulaire indiscutable', "Star de l'équipe"].includes(s.squadStatus) },
    { label: 'Atteindre 50 buts en carrière', done: s.stats.career.buts >= 50, progress: `${s.stats.career.buts}/50` },
    { label: 'Être appelé en sélection nationale', done: game.state.career.nationalTeam.called },
    { label: 'Remporter un trophée collectif', done: s.legacy.trophies > 0 },
    { label: 'Gagner une récompense individuelle', done: s.legacy.awards > 0 },
    { label: 'Atteindre 1 M€ de patrimoine', done: s.finance.netWorth >= 1000000, progress: money(s.finance.netWorth) },
    { label: 'Acquérir un bien immobilier', done: game.state.economy.properties.length > 0 },
    { label: 'Signer un contrat de sponsoring', done: game.state.endorsements.active.length > 0 },
    { label: 'Atteindre le statut de superstar (75)', done: s.reputation.global >= 75, progress: s.reputation.global.toFixed(1) },
    { label: 'Construire son musée personnel', done: s.legacy.museum.built },
    { label: 'Entrer au Hall of Fame', done: s.legacy.hallOfFame },
    { label: 'Découvrir tous les lieux secrets', done: game.state.world.discoveries.length >= 8, progress: `${game.state.world.discoveries.length}/8` },
  ];

  modal({
    title: 'Objectifs',
    body: el('div.stack', {}, objectives.map((o) =>
      el('div.row-between.panel', {}, [
        el('span.small', { class: o.done ? 'ok' : 'muted' }, `${o.done ? '✓' : '○'} ${o.label}`),
        o.progress ? badge(o.progress, o.done ? 'ok' : '') : (o.done ? badge('Accompli', 'ok') : null),
      ]))),
  });
}

// ── Console développeur (Tome XXII ch. 7) ──────────────────────────────────

function openDevTools() {
  const diagnostics = game.diagnostics();
  const validation = game.validate();

  const logHost = el('div.scroll-y.mono.xs', {},
    bus.journal(40).map((entry) => el('div', {}, `${entry.type}`)));

  const commandInput = el('input', { type: 'text', placeholder: "ex. advance 30, validate, seed, reputation 80" });
  const commandOutput = el('div.mono.xs.scroll-y', { style: { maxHeight: '160px' } });

  const runCommand = () => {
    const raw = commandInput.value.trim();
    if (!raw) return;
    const [command, ...args] = raw.split(/\s+/);
    let output;

    try {
      switch (command) {
        case 'advance':
          game.advanceDays(Number(args[0]) || 1);
          output = `Horloge avancée de ${args[0] || 1} jour(s) → ${game.clock.dateLabel}`;
          break;
        case 'validate':
          output = game.validate().ok ? 'Aucune anomalie.' : game.validate().problems.join(' | ');
          break;
        case 'seed':
          output = `Graine : ${game.state.seed}`;
          break;
        case 'reputation':
          game.state.reputation.global = Math.max(0, Math.min(100, Number(args[0]) || 0));
          output = `Réputation fixée à ${game.state.reputation.global}`;
          break;
        case 'money':
          game.state.economy.accounts.courant += Number(args[0]) || 0;
          output = `Solde : ${money(game.state.economy.accounts.courant)}`;
          break;
        case 'state':
          output = `Taille de l'état : ${diagnostics.stateSizeKb} Ko · version ${game.state.version}`;
          break;
        case 'systems':
          output = diagnostics.systems.join(', ');
          break;
        case 'help':
          output = 'advance <j> · validate · seed · reputation <n> · money <n> · state · systems · help';
          break;
        default:
          output = `Commande inconnue : ${command}. Tapez « help ».`;
      }
    } catch (error) {
      output = `Erreur : ${error.message}`;
    }

    commandOutput.insertBefore(el('div', {}, [el('span.gold', {}, '> '), raw, el('div.muted', {}, output)]), commandOutput.firstChild);
    commandInput.value = '';
    refresh();
  };

  commandInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runCommand(); });

  modal({
    title: 'Console développeur',
    wide: true,
    body: el('div.stack', {}, [
      card('Diagnostic', el('div.grid.grid-4', {}, [
        stat('Version état', diagnostics.version),
        stat('Graine', diagnostics.seed),
        stat('Heures simulées', num(diagnostics.totalHours)),
        stat('Matchs simulés', diagnostics.matchesSimulated),
        stat('Écritures comptables', num(diagnostics.ledgerEntries)),
        stat('Articles publiés', num(diagnostics.headlines)),
        stat('Mémoire du monde', num(diagnostics.worldMemory)),
        stat('Taille sauvegarde', `${diagnostics.stateSizeKb} Ko`),
        stat('PNJ suivis', diagnostics.npcs),
        stat('Rencontres', diagnostics.fixtures),
        stat('Événements monde', diagnostics.worldEvents),
        stat('Systèmes actifs', diagnostics.systems.length),
      ])),

      card('Validation des données', validation.ok
        ? el('p.ok.mb-0', {}, '✓ Aucune anomalie détectée : références, bornes et comptabilité cohérentes.')
        : el('ul.danger', {}, validation.problems.map((p) => el('li', {}, p)))),

      card('Journal du bus (40 derniers événements)', logHost),

      card('Console', [
        el('div.row', {}, [el('div.grow', {}, commandInput), button('Exécuter', runCommand, { size: 'sm' })]),
        el('p.xs.dim', {}, 'Commandes : advance · validate · seed · reputation · money · state · systems · help'),
        commandOutput,
      ]),
    ]),
    onClose: () => refresh(),
  });
}

// ── Import ─────────────────────────────────────────────────────────────────

function importDialog() {
  const input = el('input', { type: 'file', accept: '.json' });

  modal({
    title: 'Importer une sauvegarde',
    body: el('div.stack', {}, [
      el('p.muted', {}, 'Sélectionnez un fichier de sauvegarde Infinity Football exporté depuis ce jeu.'),
      input,
    ]),
    footer: [
      button('Importer', () => {
        const file = input.files?.[0];
        if (!file) {
          toast({ title: 'Aucun fichier sélectionné', level: 'warn' });
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const result = game.importSave(String(reader.result));
          if (result.ok) {
            document.querySelector('.modal-backdrop')?.remove();
            applyAccessibility(game.state.settings.accessibility);
            renderGame();
            toast({ title: 'Sauvegarde importée', body: `${game.state.player.name}, saison ${game.state.clock.season}.`, level: 'success' });
          } else {
            toast({ title: 'Import impossible', body: result.reason, level: 'error' });
          }
        };
        reader.readAsText(file);
      }, { variant: 'primary' }),
    ],
  });
}

// Utilisé par views.js pour les liens croisés éventuels.
export { refresh, getCity, getClub };
