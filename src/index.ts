/**
 * Infinity Football — Point d'entrée public du moteur.
 *
 * Réexporte l'API stable : façade du jeu, systèmes, modèles et données.
 * Tout ce qui n'est pas exporté ici est considéré comme interne et peut
 * évoluer sans préavis (Tome XXII — évolutivité sur dix ans).
 */

// Façade
export { InfinityFootball, SAVE_FORMAT_VERSION } from './game.js';
export type { GameOptions, CareerSetup, WorldSnapshot, MatchReport } from './game.js';

// Noyau
export { SimulationContext, DEFAULT_WORLD_CONFIG } from './core/context.js';
export type { WorldConfig } from './core/context.js';
export { GameClock, formatDateFr, formatTimeFr, formatDateTimeFr, seasonFor } from './core/clock.js';
export type { GameDate, Season } from './core/clock.js';
export { EventBus } from './core/event-bus.js';
export type { GameEvent, GameEventType, GameEventMap, Significance } from './core/events.js';
export { Rng } from './core/rng.js';
export { Logger } from './core/logger.js';
export { Profiler } from './core/profiler.js';
export { SystemScheduler } from './core/system.js';
export type { GameSystem, SystemMetadata } from './core/system.js';
export {
  MemorySaveStorage,
  createEnvelope,
  loadEnvelope,
  computeChecksum,
  SaveCorruptionError,
} from './core/save.js';
export type { SaveEnvelope, SaveMeta, SavePayload, SaveStorage } from './core/save.js';

// Données de contenu
export { COUNTRIES, getCountry, countriesByContinent } from './data/countries.js';
export type { CountryDef, Continent, ClimateZone, TerrainFeature } from './data/countries.js';
export { CITIES, getCity, citiesOfCountry, awardsHostCities } from './data/cities.js';
export type { CityDef, DistrictKind } from './data/cities.js';
export {
  CLUBS,
  STADIUMS,
  COMPETITIONS,
  getClub,
  getStadium,
  getCompetition,
  clubsOfLeague,
  clubsOfCity,
} from './data/clubs.js';
export type { ClubDef, StadiumDef, CompetitionDef, CompetitionKind } from './data/clubs.js';
export { BRANDS, PRODUCTS, VEHICLES, getBrand, getProduct, getVehicle } from './data/brands.js';
export type { BrandDef, ProductDef, VehicleDef, BrandCategory, ProductCategory } from './data/brands.js';
export { ACTIVITIES, getActivity, activitiesOfCategory } from './data/activities.js';
export type { ActivityDef, ActivityCategory } from './data/activities.js';

// Monde ouvert
export { WorldSystem, WORLD_SERVICE } from './world/world-system.js';
export { WorldGenerator, auditCity } from './world/generator.js';
export { VENUE_TEMPLATES, getVenueTemplate, isOpenAt } from './world/venues.js';
export type { VenueType, VenueTemplate } from './world/venues.js';
export type { CityRuntime, District, Venue, Room, Street, WorldRuntime, CityWeather } from './world/model.js';
export {
  MODE_PROFILES,
  routeWithinCity,
  routeBetweenCities,
  searchVenues,
  nearestVenue,
  bestLocalMode,
} from './world/navigation.js';
export type { TransportMode, LocalRoute, WorldRoute } from './world/navigation.js';

// IA
export { MemoryBank, MemoryFactory } from './ai/memory.js';
export type { Memory, RecalledMemory } from './ai/memory.js';
export { DialogueEngine, DIALOGUE_REGISTERS, DIALOGUE_TONES } from './ai/dialogue.js';
export type { DialogueRegister, DialogueTone, GeneratedLine } from './ai/dialogue.js';
export {
  randomCharacterProfile,
  randomPersonality,
  describePersonality,
  transferWillingness,
  pressureResistance,
} from './ai/personality.js';
export type { Personality, FootballProfile, CharacterProfile, PlayStyle } from './ai/personality.js';
export { NpcSystem, NPC_SERVICE } from './ai/npc.js';
export type { Npc, NpcOccupation, RecognitionReaction } from './ai/npc.js';

// Football
export { MatchEngine } from './football/match-engine.js';
export type { MatchTeam, MatchPlayer, MatchResult, MatchEvent } from './football/match-engine.js';
export { MatchOrchestrator, MATCH_SERVICE } from './football/match-orchestrator.js';
export type { MatchAnalysis } from './football/match-orchestrator.js';
export {
  FORMATIONS,
  getFormation,
  defaultTactics,
  computeCoefficients,
  TacticalMemory,
} from './football/tactics.js';
export type { Tactics, Formation, PlayerRole, PressingStyle } from './football/tactics.js';
export { createReferee, judge, describeReferee } from './football/referee.js';
export type { Referee, RefereeStyle, RefereeDecision } from './football/referee.js';
export { ManagerSystem, MANAGER_SERVICE, pickBestEleven } from './football/manager-system.js';
export type { StaffRole, Scout, ScoutReport, TrainingSession } from './football/manager-system.js';
export { PresidentSystem, PRESIDENT_SERVICE } from './football/president-system.js';
export type { ClubFinances, StadiumUpgradeKind, StadiumBlueprint, BoardDecision } from './football/president-system.js';

// Carrière
export {
  createPlayer,
  overallRating,
  baseRating,
  computeMarketValue,
  careerTotals,
  ageCurve,
} from './career/player.js';
export type { PlayerState, Attributes, Position, Foot, SeasonStats, Injury } from './career/player.js';
export { CareerSystem, CAREER_SERVICE } from './career/career-system.js';
export type { Contract, EquipmentContract, TransferNegotiation, PostRetirementRole } from './career/career-system.js';
export { SeasonSystem, SEASON_SERVICE, recentForm } from './career/season-system.js';
export type { Fixture, TableRow, CompetitionSeason, SeasonHonours } from './career/season-system.js';

// Économie & commerce
export { EconomySystem, ECONOMY_SERVICE, propertyPrice, EMPLOYEE_SALARY_TABLE } from './economy/economy-system.js';
export type {
  Account,
  Transaction,
  Investment,
  Property,
  Employee,
  Collectible,
  OwnedVehicle,
} from './economy/economy-system.js';
export { CommerceSystem, COMMERCE_SERVICE } from './commerce/commerce-system.js';
export type { Order, OrderStatus, DeliveryTarget, VehicleConfiguration } from './commerce/commerce-system.js';

// Vie, voyages, téléphone
export { TravelSystem, TRAVEL_SERVICE } from './transport/travel-system.js';
export type { Journey, JourneyStage, HotelBooking } from './transport/travel-system.js';
export { LifeSystem, LIFE_SERVICE, DAILY_GESTURES } from './life/life-system.js';
export type { Relation, RelationKind, Vacation, CharityProject } from './life/life-system.js';
export { PhoneSystem, PHONE_SERVICE, APPS } from './phone/phone-system.js';
export type { AppId, AppDefinition, SocialPost, Streak, AgendaEntry } from './phone/phone-system.js';

// Physique du gameplay (Tome III)
export {
  createBall,
  strikeBall,
  deflectBall,
  stepBall,
  predictBall,
  timeToGround,
  ballSpeed,
  ballSpeedKmh,
  airDensity,
  restitutionFor,
  rollingFriction,
  PERFECT_SURFACE,
  STILL_AIR,
  BALL_MASS_KG,
  BALL_RADIUS_M,
} from './football/ball.js';
export type { Ball, SurfaceState, AirState, MutableVec3 } from './football/ball.js';
export {
  PITCH_LENGTH,
  PITCH_WIDTH,
  GOAL_WIDTH,
  GOAL_HEIGHT,
  CENTRE,
  goalCentre,
  penaltySpot,
  inPenaltyArea,
  inGoalArea,
  distanceToGoal,
  shootingAngle,
  expectedGoalsFromPosition,
  isGoal,
  hitsWoodwork,
  outByTouchline,
  outByGoalLine,
  restartFor,
  thirdOf,
  channelOf,
  heatmapZone,
  clampToPitch,
} from './football/pitch.js';
export type { Side, PitchThird, PitchChannel } from './football/pitch.js';
export {
  createBody,
  physicalProfile,
  stepBody,
  speedOf,
  availableTopSpeed,
  resolveContact,
  shieldingStrength,
  timeToReach,
} from './football/player-physics.js';
export type { PlayerBody, PhysicalProfile } from './football/player-physics.js';

// Perception & décision (Tomes III, VIII)
export {
  perceive,
  createPerceptionCache,
  awarenessOf,
  visualClarity,
  passingLane,
  spaceAt,
  positionalValue,
  spotMistake,
  offsideLine,
  isOffside,
  scanRate,
} from './football/perception.js';
export type {
  MatchActor,
  WorldState,
  Perception,
  PerceivedActor,
  PerceptionCache,
} from './football/perception.js';
export { decideOnBall, decideOffBall, decideKeeperPositioning, roleOf } from './football/decision.js';
export type { OnBallAction, OffBallAction, DecisionContext, RoleFamily } from './football/decision.js';

// Football de rue
export { StreetFootballSystem, STREET_SERVICE } from './street/street-system.js';
export type {
  StreetPitch,
  StreetLegend,
  StreetClip,
  StreetInvitation,
  StreetScout,
  StreetSessionReport,
} from './street/street-system.js';
export {
  DISCIPLINES,
  STREET_MOVES,
  STREET_TOURNAMENTS,
  STREET_BRANDS,
  getDiscipline,
  crowdReaction,
} from './data/street.js';
export type {
  StreetDiscipline,
  DisciplineDef,
  StreetMove,
  StreetTournamentDef,
  StreetBrandDef,
} from './data/street.js';

// Médias, événements, héritage
export { MediaSystem, MEDIA_SERVICE } from './media/media-system.js';
export type { Article, Outlet, PressConference, AnswerTone } from './media/media-system.js';
export { BoubjackAwardsSystem, AWARDS_SERVICE, AWARD_CATEGORIES } from './events/boubjack-awards.js';
export type { Ceremony, CategoryResult, AwardCategory } from './events/boubjack-awards.js';
export { WorldCalendarSystem, CALENDAR_SERVICE } from './events/world-calendar.js';
export type { WorldEvent, WorldEventKind, FanZone } from './events/world-calendar.js';
export { LegacySystem, LEGACY_SERVICE } from './legacy/legacy-system.js';
export type {
  WorldRecord,
  HallOfFameEntry,
  TimelineEntry,
  ArchiveItem,
  MuseumExhibit,
  Documentary,
} from './legacy/legacy-system.js';

// Présentation
export { AudioSystem, AUDIO_SERVICE } from './audio/audio-system.js';
export type { AudioBus, SpatialEmitter, MusicTrack, Playlist } from './audio/audio-system.js';
export { CommentarySystem, COMMENTATOR_POOL, pickDuo } from './audio/commentary.js';
export type { Commentator, CommentaryDuo, CommentaryLine } from './audio/commentary.js';
export { AnimationSystem, ANIMATION_SERVICE } from './animation/animation-system.js';
export type { AnimationClip, ResolvedAnimation, EmotionalState, CrowdBehaviour } from './animation/animation-system.js';
export { CinematicSystem, CINEMATIC_SERVICE, totalDuration } from './cinematics/cinematic-system.js';
export type { CinematicSequence, Shot, CameraRig, DirectionContext } from './cinematics/cinematic-system.js';
export { UiSystem, UI_SERVICE } from './ui/ui-system.js';
export type { ScreenId, HudElementState, AccessibilitySettings, MapMarker } from './ui/ui-system.js';

// Multijoueur & production
export { MultiplayerSystem, MULTIPLAYER_SERVICE } from './multiplayer/multiplayer-system.js';
export type { OnlinePlayer, SocialHub, OnlineClub, OnlineEvent, CheatSignal } from './multiplayer/multiplayer-system.js';
export { QualitySystem, QUALITY_SERVICE, formatTestReport, qualityGrade } from './devtools/quality-system.js';
export type { TestSuiteResult, QualityScores, BalanceReport, UpdateManifest } from './devtools/quality-system.js';
export { DevConsole, validateContent } from './devtools/dev-console.js';
export type { CommandDefinition, CommandResult, ValidationIssue } from './devtools/dev-console.js';
