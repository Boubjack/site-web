/**
 * Infinity Football — Core / Catalogue d'événements
 *
 * Contrat unique partagé par tous les systèmes. Tout fait notable du monde
 * transite par ce catalogue, ce qui permet :
 *  - à la mémoire des IA de s'en souvenir (Tome VIII, ch. 2) ;
 *  - aux médias de le commenter (Tome XXVII) ;
 *  - aux archives et records de l'enregistrer (Tome XXVIII) ;
 *  - au Legacy d'en faire l'histoire du monde (Tome XVII).
 *
 * `at` est l'horodatage absolu en minutes de jeu depuis l'époque du monde.
 */

export interface BaseEvent {
  readonly type: string;
  /** Minutes de jeu absolues (voir GameClock.absoluteMinutes). */
  readonly at: number;
}

/** Importance narrative d'un fait : pilote les titres de presse et le HUD. */
export type Significance = 'routine' | 'notable' | 'major' | 'historic';

export interface WorldTickEvent extends BaseEvent {
  readonly type: 'world.tick';
  readonly deltaMinutes: number;
}

export interface DayStartedEvent extends BaseEvent {
  readonly type: 'world.dayStarted';
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly weekday: number;
}

export interface SeasonChangedEvent extends BaseEvent {
  readonly type: 'world.seasonChanged';
  readonly season: 'winter' | 'spring' | 'summer' | 'autumn';
  readonly hemisphere: 'north' | 'south';
}

export interface WeatherChangedEvent extends BaseEvent {
  readonly type: 'world.weatherChanged';
  readonly cityId: string;
  readonly condition: string;
  readonly temperatureC: number;
  readonly severity: number;
}

export interface NaturalHazardEvent extends BaseEvent {
  readonly type: 'world.naturalHazard';
  readonly cityId: string;
  readonly hazard: 'storm' | 'heatwave' | 'heavyRain' | 'snowstorm' | 'fog';
  readonly disruption: number;
  readonly durationHours: number;
}

export interface VenueOpenedEvent extends BaseEvent {
  readonly type: 'world.venueOpened';
  readonly venueId: string;
  readonly cityId: string;
}

export interface VenueClosedEvent extends BaseEvent {
  readonly type: 'world.venueClosed';
  readonly venueId: string;
  readonly cityId: string;
}

export interface BusinessLifecycleEvent extends BaseEvent {
  readonly type: 'world.businessLifecycle';
  readonly venueId: string;
  readonly cityId: string;
  readonly change: 'opened' | 'closed' | 'renovated' | 'popupOpened' | 'popupClosed';
}

export interface StreetEventSpawnedEvent extends BaseEvent {
  readonly type: 'world.streetEvent';
  readonly cityId: string;
  readonly districtId: string;
  readonly kind: string;
  readonly durationMinutes: number;
}

export interface PlayerMovedEvent extends BaseEvent {
  readonly type: 'player.moved';
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly cityId: string;
}

export interface PlayerEnteredInteriorEvent extends BaseEvent {
  readonly type: 'player.enteredInterior';
  readonly venueId: string;
  readonly roomId: string;
}

export interface PlayerInteractionEvent extends BaseEvent {
  readonly type: 'player.interaction';
  readonly interaction: string;
  readonly targetId: string;
  readonly satisfaction: number;
}

export interface TravelBookedEvent extends BaseEvent {
  readonly type: 'travel.booked';
  readonly journeyId: string;
  readonly mode: string;
  readonly fromCityId: string;
  readonly toCityId: string;
  readonly cost: number;
}

export interface TravelStageEvent extends BaseEvent {
  readonly type: 'travel.stage';
  readonly journeyId: string;
  readonly stage: string;
}

export interface TravelCompletedEvent extends BaseEvent {
  readonly type: 'travel.completed';
  readonly journeyId: string;
  readonly toCityId: string;
  readonly fatigue: number;
}

export interface TransactionEvent extends BaseEvent {
  readonly type: 'economy.transaction';
  readonly accountId: string;
  readonly amount: number;
  readonly category: string;
  readonly label: string;
  readonly balanceAfter: number;
}

export interface InvestmentEvent extends BaseEvent {
  readonly type: 'economy.investment';
  readonly investmentId: string;
  readonly action: 'opened' | 'yield' | 'loss' | 'sold';
  readonly amount: number;
}

export interface PropertyEvent extends BaseEvent {
  readonly type: 'economy.property';
  readonly propertyId: string;
  readonly action: 'bought' | 'sold' | 'renovated' | 'rented' | 'decorated' | 'expanded';
  readonly amount: number;
}

export interface EmployeeEvent extends BaseEvent {
  readonly type: 'economy.employee';
  readonly employeeId: string;
  readonly action: 'hired' | 'fired' | 'paid';
  readonly role: string;
  readonly amount: number;
}

export interface OrderPlacedEvent extends BaseEvent {
  readonly type: 'commerce.orderPlaced';
  readonly orderId: string;
  readonly total: number;
  readonly deliveryTarget: string;
}

export interface OrderDeliveredEvent extends BaseEvent {
  readonly type: 'commerce.orderDelivered';
  readonly orderId: string;
  readonly courierName: string;
  readonly deliveryTarget: string;
}

export interface BrandContractEvent extends BaseEvent {
  readonly type: 'commerce.brandContract';
  readonly brandId: string;
  readonly action: 'signed' | 'expired' | 'breached' | 'obligationMet';
  readonly annualValue: number;
}

export interface MatchStartedEvent extends BaseEvent {
  readonly type: 'match.started';
  readonly matchId: string;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly competitionId: string;
  readonly stadiumId: string;
}

export interface MatchGoalEvent extends BaseEvent {
  readonly type: 'match.goal';
  readonly matchId: string;
  readonly clubId: string;
  readonly scorerId: string;
  readonly assistId: string | null;
  readonly minute: number;
  readonly quality: number;
}

export interface MatchCardEvent extends BaseEvent {
  readonly type: 'match.card';
  readonly matchId: string;
  readonly playerId: string;
  readonly card: 'yellow' | 'red';
  readonly minute: number;
}

export interface MatchEndedEvent extends BaseEvent {
  readonly type: 'match.ended';
  readonly matchId: string;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly competitionId: string;
  readonly playerRating: number | null;
}

export interface InjuryEvent extends BaseEvent {
  readonly type: 'career.injury';
  readonly playerId: string;
  readonly severity: 'light' | 'moderate' | 'serious';
  readonly daysOut: number;
}

export interface TransferEvent extends BaseEvent {
  readonly type: 'career.transfer';
  readonly playerId: string;
  readonly fromClubId: string | null;
  readonly toClubId: string;
  readonly fee: number;
  readonly stage: 'interest' | 'negotiation' | 'agreed' | 'medical' | 'signed' | 'presented';
}

export interface ContractSignedEvent extends BaseEvent {
  readonly type: 'career.contractSigned';
  readonly playerId: string;
  readonly clubId: string;
  readonly weeklyWage: number;
  readonly years: number;
}

export interface ReputationChangedEvent extends BaseEvent {
  readonly type: 'career.reputationChanged';
  readonly playerId: string;
  readonly delta: number;
  readonly reason: string;
  readonly value: number;
}

export interface TrophyWonEvent extends BaseEvent {
  readonly type: 'career.trophyWon';
  readonly playerId: string;
  readonly trophyId: string;
  readonly trophyName: string;
  readonly competitionId: string;
  readonly season: number;
}

export interface AwardWonEvent extends BaseEvent {
  readonly type: 'awards.won';
  readonly ceremonyId: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly winnerId: string;
  readonly winnerName: string;
  readonly season: number;
  readonly hostCityId: string;
}

export interface CeremonyStageEvent extends BaseEvent {
  readonly type: 'awards.stage';
  readonly ceremonyId: string;
  readonly stage: string;
  readonly detail: string;
}

export interface RetirementEvent extends BaseEvent {
  readonly type: 'career.retired';
  readonly playerId: string;
  readonly age: number;
  readonly seasonsPlayed: number;
}

export interface HallOfFameEvent extends BaseEvent {
  readonly type: 'legacy.hallOfFame';
  readonly personId: string;
  readonly personName: string;
  readonly category: 'player' | 'manager' | 'president' | 'referee';
}

export interface RecordBrokenEvent extends BaseEvent {
  readonly type: 'legacy.recordBroken';
  readonly recordId: string;
  readonly recordName: string;
  readonly holderId: string;
  readonly value: number;
  readonly scope: string;
}

export interface MonumentEvent extends BaseEvent {
  readonly type: 'legacy.monument';
  readonly kind: 'statue' | 'street' | 'mural' | 'exhibition' | 'commemorationDay' | 'stand';
  readonly personId: string;
  readonly cityId: string;
}

export interface NewsPublishedEvent extends BaseEvent {
  readonly type: 'media.newsPublished';
  readonly articleId: string;
  readonly headline: string;
  readonly outletId: string;
  readonly significance: Significance;
  readonly subjectIds: readonly string[];
}

export interface BroadcastEvent extends BaseEvent {
  readonly type: 'media.broadcast';
  readonly channelId: string;
  readonly showId: string;
  readonly title: string;
}

export interface PressConferenceEvent extends BaseEvent {
  readonly type: 'media.pressConference';
  readonly conferenceId: string;
  readonly questionId: string;
  readonly answerTone: string;
  readonly reputationDelta: number;
}

export interface SocialPostEvent extends BaseEvent {
  readonly type: 'social.post';
  readonly postId: string;
  readonly authorId: string;
  readonly kind: string;
  readonly reach: number;
  readonly sentiment: number;
}

export interface SnapstreakEvent extends BaseEvent {
  readonly type: 'social.snapstreak';
  readonly contactId: string;
  readonly streak: number;
  readonly action: 'kept' | 'started' | 'lost';
}

export interface RelationshipChangedEvent extends BaseEvent {
  readonly type: 'life.relationshipChanged';
  readonly personId: string;
  readonly delta: number;
  readonly value: number;
  readonly reason: string;
}

export interface LifeMilestoneEvent extends BaseEvent {
  readonly type: 'life.milestone';
  readonly milestone: string;
  readonly detail: string;
}

export interface VacationEvent extends BaseEvent {
  readonly type: 'life.vacation';
  readonly destinationCityId: string;
  readonly companions: readonly string[];
  readonly days: number;
}

export interface ActivityCompletedEvent extends BaseEvent {
  readonly type: 'life.activity';
  readonly activityId: string;
  readonly cityId: string;
  readonly enjoyment: number;
  readonly fatigue: number;
}

export interface CharityEvent extends BaseEvent {
  readonly type: 'life.charity';
  readonly projectId: string;
  readonly action: 'founded' | 'funded' | 'expanded' | 'milestone';
  readonly amount: number;
}

export interface CinematicEvent extends BaseEvent {
  readonly type: 'cinematic.played';
  readonly cinematicId: string;
  readonly category: string;
  readonly durationSeconds: number;
  readonly skipped: boolean;
}

export interface AudioCueEvent extends BaseEvent {
  readonly type: 'audio.cue';
  readonly cueId: string;
  readonly bus: string;
  readonly intensity: number;
}

export interface CommentaryLineEvent extends BaseEvent {
  readonly type: 'audio.commentary';
  readonly line: string;
  readonly commentatorId: string;
  readonly tension: number;
}

export interface AnimationPlayedEvent extends BaseEvent {
  readonly type: 'animation.played';
  readonly clipId: string;
  readonly actorId: string;
  readonly context: string;
}

export interface NpcLifeEvent extends BaseEvent {
  readonly type: 'npc.lifeEvent';
  readonly npcId: string;
  readonly change: 'jobChanged' | 'moved' | 'married' | 'child' | 'retired' | 'travelled';
}

export interface NpcRecognitionEvent extends BaseEvent {
  readonly type: 'npc.recognition';
  readonly npcId: string;
  readonly reaction: string;
  readonly fameLevel: number;
}

export interface SecretaryReminderEvent extends BaseEvent {
  readonly type: 'assistant.reminder';
  readonly subject: string;
  readonly detail: string;
  readonly dueAt: number;
}

export interface MultiplayerEvent extends BaseEvent {
  readonly type: 'multiplayer.event';
  readonly action: string;
  readonly actorId: string;
  readonly detail: string;
}

export interface SaveEvent extends BaseEvent {
  readonly type: 'system.save';
  readonly slot: string;
  readonly kind: 'manual' | 'auto' | 'cloud';
  readonly version: number;
}

export interface DiscoveryEvent extends BaseEvent {
  readonly type: 'world.discovery';
  readonly discoveryId: string;
  readonly name: string;
  readonly cityId: string;
}

export interface RareEncounterEvent extends BaseEvent {
  readonly type: 'world.rareEncounter';
  readonly encounterId: string;
  readonly description: string;
  readonly cityId: string;
}

export interface StadiumWorksEvent extends BaseEvent {
  readonly type: 'club.stadiumWorks';
  readonly stadiumId: string;
  readonly upgradeId: string;
  readonly stage: 'started' | 'progress' | 'completed';
  readonly progress: number;
}

export interface ClubBoardEvent extends BaseEvent {
  readonly type: 'club.board';
  readonly clubId: string;
  readonly decision: string;
  readonly approved: boolean;
  readonly satisfaction: number;
}

export interface TrainingEvent extends BaseEvent {
  readonly type: 'club.training';
  readonly sessionId: string;
  readonly focus: string;
  readonly intensity: number;
  readonly injuryRisk: number;
}

export interface ScoutingEvent extends BaseEvent {
  readonly type: 'club.scouting';
  readonly scoutId: string;
  readonly targetId: string;
  readonly accuracy: number;
  readonly potential: number;
}

/** Table de correspondance type → charge utile. */
export interface GameEventMap {
  'world.tick': WorldTickEvent;
  'world.dayStarted': DayStartedEvent;
  'world.seasonChanged': SeasonChangedEvent;
  'world.weatherChanged': WeatherChangedEvent;
  'world.naturalHazard': NaturalHazardEvent;
  'world.venueOpened': VenueOpenedEvent;
  'world.venueClosed': VenueClosedEvent;
  'world.businessLifecycle': BusinessLifecycleEvent;
  'world.streetEvent': StreetEventSpawnedEvent;
  'world.discovery': DiscoveryEvent;
  'world.rareEncounter': RareEncounterEvent;
  'player.moved': PlayerMovedEvent;
  'player.enteredInterior': PlayerEnteredInteriorEvent;
  'player.interaction': PlayerInteractionEvent;
  'travel.booked': TravelBookedEvent;
  'travel.stage': TravelStageEvent;
  'travel.completed': TravelCompletedEvent;
  'economy.transaction': TransactionEvent;
  'economy.investment': InvestmentEvent;
  'economy.property': PropertyEvent;
  'economy.employee': EmployeeEvent;
  'commerce.orderPlaced': OrderPlacedEvent;
  'commerce.orderDelivered': OrderDeliveredEvent;
  'commerce.brandContract': BrandContractEvent;
  'match.started': MatchStartedEvent;
  'match.goal': MatchGoalEvent;
  'match.card': MatchCardEvent;
  'match.ended': MatchEndedEvent;
  'career.injury': InjuryEvent;
  'career.transfer': TransferEvent;
  'career.contractSigned': ContractSignedEvent;
  'career.reputationChanged': ReputationChangedEvent;
  'career.trophyWon': TrophyWonEvent;
  'career.retired': RetirementEvent;
  'awards.won': AwardWonEvent;
  'awards.stage': CeremonyStageEvent;
  'legacy.hallOfFame': HallOfFameEvent;
  'legacy.recordBroken': RecordBrokenEvent;
  'legacy.monument': MonumentEvent;
  'media.newsPublished': NewsPublishedEvent;
  'media.broadcast': BroadcastEvent;
  'media.pressConference': PressConferenceEvent;
  'social.post': SocialPostEvent;
  'social.snapstreak': SnapstreakEvent;
  'life.relationshipChanged': RelationshipChangedEvent;
  'life.milestone': LifeMilestoneEvent;
  'life.vacation': VacationEvent;
  'life.activity': ActivityCompletedEvent;
  'life.charity': CharityEvent;
  'cinematic.played': CinematicEvent;
  'audio.cue': AudioCueEvent;
  'audio.commentary': CommentaryLineEvent;
  'animation.played': AnimationPlayedEvent;
  'npc.lifeEvent': NpcLifeEvent;
  'npc.recognition': NpcRecognitionEvent;
  'assistant.reminder': SecretaryReminderEvent;
  'multiplayer.event': MultiplayerEvent;
  'system.save': SaveEvent;
  'club.stadiumWorks': StadiumWorksEvent;
  'club.board': ClubBoardEvent;
  'club.training': TrainingEvent;
  'club.scouting': ScoutingEvent;
}

export type GameEventType = keyof GameEventMap;
export type GameEvent = GameEventMap[GameEventType];
