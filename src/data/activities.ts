/**
 * Infinity Football — Données / Activités, loisirs et vacances
 *
 * Tome XXX, ch. 4 et Tome XXX v2, ch. 4 : la liste complète des activités
 * praticables. Chaque activité déclare ses prérequis (terrain, saison, météo,
 * lieu), son coût, sa fatigue, son plaisir et son impact social.
 */

import type { TerrainFeature } from './countries.js';
import type { Season } from '../core/clock.js';

export type ActivityCategory = 'sport' | 'loisir' | 'aventure' | 'culture' | 'social' | 'detente';

export interface ActivityDef {
  readonly id: string;
  readonly name: string;
  readonly category: ActivityCategory;
  /** Type de lieu requis dans la ville (voir world/venue-types). */
  readonly venueType: string;
  /** Terrains nécessaires ; vide = disponible partout. */
  readonly requiresTerrain: readonly TerrainFeature[];
  /** Saisons possibles ; vide = toute l'année. */
  readonly seasons: readonly Season[];
  /** Météo interdite. */
  readonly blockedByWeather: readonly string[];
  readonly durationMinutes: number;
  readonly costEur: number;
  /** Fatigue générée 0..1 (impacte la forme sportive). */
  readonly fatigue: number;
  /** Plaisir de base 0..1 (impacte le moral). */
  readonly enjoyment: number;
  /** Risque de blessure 0..1 — le staff décourage les plus risquées. */
  readonly injuryRisk: number;
  /** Bonus de relation si pratiquée à plusieurs. */
  readonly socialBonus: number;
  /** Exclusive à certaines destinations de vacances. */
  readonly exclusive: boolean;
}

function activity(
  id: string,
  name: string,
  category: ActivityCategory,
  venueType: string,
  durationMinutes: number,
  costEur: number,
  fatigue: number,
  enjoyment: number,
  extras: Partial<
    Pick<
      ActivityDef,
      'requiresTerrain' | 'seasons' | 'blockedByWeather' | 'injuryRisk' | 'socialBonus' | 'exclusive'
    >
  > = {},
): ActivityDef {
  return {
    id,
    name,
    category,
    venueType,
    durationMinutes,
    costEur,
    fatigue,
    enjoyment,
    requiresTerrain: extras.requiresTerrain ?? [],
    seasons: extras.seasons ?? [],
    blockedByWeather: extras.blockedByWeather ?? [],
    injuryRisk: extras.injuryRisk ?? 0.01,
    socialBonus: extras.socialBonus ?? 0.2,
    exclusive: extras.exclusive ?? false,
  };
}

export const ACTIVITIES: readonly ActivityDef[] = [
  activity('beach-football', 'Football de plage', 'sport', 'beach', 90, 0, 0.35, 0.85, {
    requiresTerrain: ['beaches'],
    blockedByWeather: ['storm', 'heavyRain', 'snow'],
    injuryRisk: 0.04,
    socialBonus: 0.45,
  }),
  activity('basketball', 'Basketball', 'sport', 'sportsCourt', 75, 15, 0.3, 0.7, {
    injuryRisk: 0.035,
    socialBonus: 0.4,
  }),
  activity('tennis', 'Tennis', 'sport', 'tennisClub', 90, 60, 0.32, 0.72, {
    blockedByWeather: ['storm', 'heavyRain'],
    injuryRisk: 0.03,
    socialBonus: 0.35,
  }),
  activity('golf', 'Golf', 'sport', 'golfCourse', 240, 220, 0.15, 0.68, {
    blockedByWeather: ['storm', 'snow'],
    socialBonus: 0.5,
  }),
  activity('karting', 'Karting', 'loisir', 'kartingTrack', 60, 90, 0.18, 0.78, {
    injuryRisk: 0.02,
    socialBonus: 0.45,
  }),
  activity('bowling', 'Bowling', 'loisir', 'bowlingAlley', 90, 35, 0.08, 0.62, { socialBonus: 0.4 }),
  activity('billiards', 'Billard', 'loisir', 'billiardsHall', 75, 25, 0.05, 0.55, { socialBonus: 0.4 }),
  activity('swimming', 'Natation', 'sport', 'pool', 60, 20, 0.28, 0.6, { injuryRisk: 0.005 }),
  activity('surf', 'Surf', 'aventure', 'surfSchool', 120, 80, 0.42, 0.88, {
    requiresTerrain: ['beaches'],
    blockedByWeather: ['storm'],
    injuryRisk: 0.06,
  }),
  activity('jetski', 'Jet-ski', 'aventure', 'marina', 60, 180, 0.25, 0.85, {
    requiresTerrain: ['beaches', 'lakes'],
    blockedByWeather: ['storm', 'heavyRain'],
    injuryRisk: 0.05,
  }),
  activity('diving', 'Plongée', 'aventure', 'divingCentre', 180, 260, 0.3, 0.9, {
    requiresTerrain: ['beaches', 'islands'],
    blockedByWeather: ['storm'],
    injuryRisk: 0.045,
  }),
  activity('hiking', 'Randonnée', 'aventure', 'trailhead', 240, 0, 0.4, 0.75, {
    requiresTerrain: ['mountains', 'forests'],
    blockedByWeather: ['storm', 'snowstorm'],
    injuryRisk: 0.03,
  }),
  activity('ski', 'Ski', 'aventure', 'skiResort', 300, 180, 0.45, 0.9, {
    requiresTerrain: ['mountains'],
    seasons: ['winter'],
    injuryRisk: 0.08,
  }),
  activity('snowboard', 'Snowboard', 'aventure', 'skiResort', 300, 190, 0.48, 0.9, {
    requiresTerrain: ['mountains'],
    seasons: ['winter'],
    injuryRisk: 0.09,
  }),
  activity('skydiving', 'Parachutisme', 'aventure', 'airfield', 180, 420, 0.35, 0.97, {
    blockedByWeather: ['storm', 'heavyRain', 'fog'],
    injuryRisk: 0.07,
  }),
  activity('bungee', 'Saut à l’élastique', 'aventure', 'bungeeSite', 90, 200, 0.25, 0.93, {
    blockedByWeather: ['storm'],
    injuryRisk: 0.06,
  }),
  activity('balloon', 'Montgolfière', 'aventure', 'balloonField', 150, 340, 0.1, 0.88, {
    blockedByWeather: ['storm', 'heavyRain', 'fog'],
    injuryRisk: 0.02,
  }),
  activity('safari', 'Safari', 'aventure', 'natureReserve', 420, 780, 0.25, 0.94, {
    requiresTerrain: ['savanna', 'forests'],
    exclusive: true,
  }),
  activity('themepark', 'Parc d’attractions', 'loisir', 'themePark', 360, 140, 0.3, 0.86, {
    socialBonus: 0.6,
    exclusive: false,
  }),
  activity('museum-visit', 'Visite de musée', 'culture', 'museum', 120, 25, 0.05, 0.6, {
    socialBonus: 0.25,
  }),
  activity('shopping', 'Shopping', 'loisir', 'mall', 150, 0, 0.12, 0.7, { socialBonus: 0.35 }),
  activity('cinema', 'Cinéma', 'loisir', 'cinema', 130, 18, 0.03, 0.62, { socialBonus: 0.45 }),
  activity('concert', 'Concert', 'culture', 'concertHall', 180, 120, 0.2, 0.89, { socialBonus: 0.6 }),
  activity('festival', 'Festival', 'culture', 'festivalGround', 300, 160, 0.35, 0.92, {
    seasons: ['summer'],
    socialBonus: 0.65,
  }),
  activity('restaurant', 'Dîner au restaurant', 'social', 'restaurant', 120, 90, 0.02, 0.7, {
    socialBonus: 0.7,
  }),
  activity('cafe', 'Café entre amis', 'social', 'cafe', 60, 15, 0.01, 0.55, { socialBonus: 0.6 }),
  activity('nightclub', 'Sortie en boîte', 'social', 'nightclub', 240, 250, 0.4, 0.75, {
    socialBonus: 0.55,
  }),
  activity('spa', 'Spa et récupération', 'detente', 'spa', 120, 180, -0.3, 0.7, { socialBonus: 0.2 }),
  activity('beach-day', 'Journée plage', 'detente', 'beach', 240, 20, 0.05, 0.82, {
    requiresTerrain: ['beaches'],
    blockedByWeather: ['storm', 'heavyRain', 'snow'],
    socialBonus: 0.55,
  }),
  activity('yacht-cruise', 'Croisière en yacht', 'detente', 'marina', 480, 4_800, 0.05, 0.95, {
    requiresTerrain: ['beaches', 'islands'],
    blockedByWeather: ['storm'],
    socialBonus: 0.7,
    exclusive: true,
  }),
  activity('gym', 'Séance de musculation', 'sport', 'gym', 90, 0, 0.5, 0.45, { injuryRisk: 0.02 }),
  activity('street-football', 'Match improvisé de quartier', 'social', 'streetPitch', 90, 0, 0.35, 0.9, {
    socialBonus: 0.75,
    injuryRisk: 0.03,
  }),
  activity('fanmeet', 'Rencontre avec les supporters', 'social', 'fanZone', 120, 0, 0.15, 0.8, {
    socialBonus: 0.5,
  }),
  activity('charity-visit', 'Visite caritative', 'social', 'hospital', 150, 0, 0.12, 0.78, {
    socialBonus: 0.4,
  }),
] as const;

const ACTIVITY_INDEX = new Map(ACTIVITIES.map((a) => [a.id, a]));

export function getActivity(id: string): ActivityDef {
  const activityDef = ACTIVITY_INDEX.get(id);
  if (!activityDef) throw new Error(`Activité inconnue : "${id}"`);
  return activityDef;
}

export function activitiesOfCategory(category: ActivityCategory): ActivityDef[] {
  return ACTIVITIES.filter((a) => a.category === category);
}

export function activitiesForVenueType(venueType: string): ActivityDef[] {
  return ACTIVITIES.filter((a) => a.venueType === venueType);
}
