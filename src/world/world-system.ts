/**
 * Infinity Football — Monde / Système du monde vivant
 *
 * Tome II, ch. 1.2 : « Le monde fonctionne sans attendre le joueur. »
 * Tome VIII, ch. 8 : « Le monde ne s'arrête jamais. »
 * Tome XX, ch. 7 : les saisons passent, les commerces ouvrent et ferment.
 * Tome XXXII, ch. 4 : de nouveaux bâtiments apparaissent, les quartiers évoluent.
 *
 * Ce système possède le `WorldRuntime` et met à jour en continu :
 *  - la météo et les aléas naturels modérés ;
 *  - le trafic (heures de pointe, jours de match, événements) ;
 *  - l'ouverture/fermeture des lieux et leur fréquentation ;
 *  - le cycle de vie des commerces (ouvertures, fermetures, rénovations) ;
 *  - les événements de rue dynamiques ;
 *  - les découvertes et lieux secrets.
 */

import { clamp, clamp01, fbm1D, lerp } from '../core/math.js';
import type { GameDate, Season } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import { getCountry } from '../data/countries.js';
import { getVenueTemplate, isOpenAt } from './venues.js';
import { WorldGenerator } from './generator.js';
import type { CityRuntime, CityWeather, StreetEvent, Venue, WorldRuntime } from './model.js';

export const WORLD_SERVICE = 'world';

type WeatherCondition = CityWeather['condition'];

interface StreetEventTemplate {
  readonly kind: string;
  readonly label: string;
  readonly districts: readonly string[];
  readonly weight: number;
  readonly durationHours: [number, number];
  readonly draw: number;
  readonly seasons: readonly Season[];
}

const STREET_EVENT_TEMPLATES: readonly StreetEventTemplate[] = [
  { kind: 'wedding', label: 'Un mariage sort de l’hôtel de ville', districts: ['historique', 'centre'], weight: 1, durationHours: [2, 4], draw: 0.4, seasons: ['spring', 'summer'] },
  { kind: 'concert', label: 'Concert en plein air', districts: ['centre', 'plage', 'universitaire'], weight: 1.2, durationHours: [3, 5], draw: 0.8, seasons: ['spring', 'summer', 'autumn'] },
  { kind: 'festival', label: 'Festival de quartier', districts: ['populaire', 'centre'], weight: 0.9, durationHours: [5, 9], draw: 0.85, seasons: ['summer'] },
  { kind: 'market', label: 'Marché de producteurs', districts: ['populaire', 'historique'], weight: 1.6, durationHours: [4, 7], draw: 0.5, seasons: [] },
  { kind: 'kidsFootball', label: 'Des enfants jouent au football', districts: ['populaire', 'residentiel', 'plage'], weight: 2.4, durationHours: [1, 3], draw: 0.25, seasons: [] },
  { kind: 'streetArtist', label: 'Artiste de rue en représentation', districts: ['centre', 'historique', 'nuit'], weight: 1.8, durationHours: [1, 4], draw: 0.35, seasons: [] },
  { kind: 'roadWorks', label: 'Travaux sur la chaussée', districts: ['centre', 'affaires', 'industriel', 'residentiel'], weight: 1.4, durationHours: [8, 72], draw: 0.05, seasons: [] },
  { kind: 'accident', label: 'Accident pris en charge par les secours', districts: ['centre', 'affaires', 'industriel'], weight: 0.5, durationHours: [1, 2], draw: 0.3, seasons: [] },
  { kind: 'filmShoot', label: 'Tournage en extérieur', districts: ['centre', 'luxe', 'historique'], weight: 0.4, durationHours: [4, 8], draw: 0.45, seasons: [] },
  { kind: 'protest', label: 'Rassemblement citoyen encadré', districts: ['centre', 'affaires'], weight: 0.35, durationHours: [2, 4], draw: 0.3, seasons: [] },
];

const SEASONAL_WINDOWS: Record<Season, readonly string[]> = {
  winter: ['collection hiver', 'vitrine des fêtes', 'édition capsule froide'],
  spring: ['collection printemps', 'vitrine florale', 'nouveautés de saison'],
  summer: ['collection été', 'vitrine balnéaire', 'édition tournée estivale'],
  autumn: ['collection automne', 'vitrine rentrée', 'édition anniversaire'],
};

export class WorldSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'world',
    name: 'Monde vivant',
    order: 10,
    tomes: ['II', 'XIX', 'XX', 'XXIX', 'XXX', 'XXXII'],
  };

  private runtime!: WorldRuntime;
  private context!: SimulationContext;
  /** Sauvegarde légère : seules les différences avec le monde généré. */
  private readonly closedVenues = new Set<string>();
  private readonly renovatingVenues = new Map<string, number>();
  private readonly discoveredVenues = new Set<string>();
  private weatherPhase = 0;

  get world(): WorldRuntime {
    return this.runtime;
  }

  city(cityId: string): CityRuntime {
    const city = this.runtime.cities.get(cityId);
    if (!city) throw new Error(`Ville absente du monde généré : "${cityId}"`);
    return city;
  }

  cities(): CityRuntime[] {
    return [...this.runtime.cities.values()];
  }

  init(context: SimulationContext): void {
    this.context = context;
    const generator = new WorldGenerator({
      seed: context.config.seed,
      richWorld: context.config.richWorld,
    });
    this.runtime = generator.generate();
    context.provide(WORLD_SERVICE, this);

    let venueCount = 0;
    for (const city of this.runtime.cities.values()) venueCount += city.venues.size;
    context.logger.info('monde généré', {
      villes: this.runtime.cities.size,
      lieux: venueCount,
      liaisonsAeriennes: this.runtime.airRoutes.size,
    });

    // État initial cohérent : météo et ouvertures calculées pour l'heure de départ.
    const date = context.clock.date;
    for (const city of this.runtime.cities.values()) {
      this.updateWeather(city, date, 1);
      this.updateVenueOpening(city, date);
      this.updateTraffic(city, date);
    }
  }

  /**
   * Niveau de détail de simulation (Tome XV, ch. 7 — performances).
   *
   * La météo, le trafic et les événements de rue sont mis à jour partout, à
   * l'heure : ce sont des calculs par ville, donc bornés. En revanche les
   * mises à jour par lieu (ouvertures, fréquentation) ne concernent que les
   * villes « détaillées » : celle où se trouve le joueur et celles qui
   * accueillent un événement mondial. Les autres sont rafraîchies une fois par
   * jour, ce qui reste exact du point de vue du joueur — il n'y est pas — tout
   * en divisant le coût par plus de cinquante.
   */
  private readonly detailedCityIds = new Set<string>();

  /** Déclare la ville où se trouve le joueur : elle passe en détail complet. */
  setFocusCity(cityId: string): void {
    this.detailedCityIds.clear();
    this.detailedCityIds.add(cityId);
    for (const city of this.runtime.cities.values()) {
      if (city.festivity > 0.3) this.detailedCityIds.add(city.id);
    }
  }

  /** Villes actuellement simulées avec le détail maximal. */
  get focusedCities(): string[] {
    return [...this.detailedCityIds];
  }

  private isDetailed(cityId: string): boolean {
    if (this.detailedCityIds.size === 0) return true;
    return this.detailedCityIds.has(cityId);
  }

  onHour(context: SimulationContext, date: GameDate): void {
    this.weatherPhase += 1;
    for (const city of this.runtime.cities.values()) {
      this.updateWeather(city, date, this.weatherPhase);
      this.updateTraffic(city, date);
      this.expireStreetEvents(city, context);
      if (!this.isDetailed(city.id)) continue;
      this.updateVenueOpening(city, date);
      this.updateOccupancy(city, date);
    }
  }

  onDay(context: SimulationContext, date: GameDate): void {
    for (const city of this.runtime.cities.values()) {
      this.spawnStreetEvents(city, context, date);
      this.tickRenovations(city, context);
      this.rollBusinessLifecycle(city, context, date);
      this.rollNaturalHazard(city, context, date);
      this.updateHotelOccupancy(city);
      // Rattrapage quotidien pour les villes hors du champ du joueur : leurs
      // commerces restent cohérents sans coûter une passe par heure.
      if (!this.isDetailed(city.id)) {
        this.updateVenueOpening(city, date);
        this.updateOccupancy(city, date);
      }
    }
  }

  onSeason(context: SimulationContext, season: Season): void {
    const rng = context.stream('world.season');
    for (const city of this.runtime.cities.values()) {
      for (const venue of city.venues.values()) {
        if (venue.type === 'shop' || venue.type === 'officialStore' || venue.type === 'mall') {
          venue.windowDisplay = rng.pick(SEASONAL_WINDOWS[season]);
        }
      }
      // Les sites de festival n'ouvrent qu'en saison chaude.
      for (const venue of city.venues.values()) {
        if (venue.type === 'festivalGround') {
          venue.status = season === 'summer' || season === 'spring' ? 'open' : 'closed';
        }
        if (venue.type === 'skiResort') {
          venue.status = season === 'winter' ? 'open' : 'closed';
        }
        if (venue.type === 'beach') {
          venue.popularity = season === 'summer' ? 0.95 : season === 'winter' ? 0.2 : 0.55;
        }
      }
    }
    context.logger.info('bascule saisonnière appliquée au monde', { saison: season });
  }

  /** Le joueur découvre un lieu caché (Tome XXXII, ch. 2). */
  discover(cityId: string, venueId: string): boolean {
    const city = this.runtime.cities.get(cityId);
    const venue = city?.venues.get(venueId);
    if (!city || !venue || venue.discovered) return false;
    venue.discovered = true;
    city.discoveredVenueIds.add(venueId);
    this.discoveredVenues.add(`${cityId}/${venueId}`);
    this.context.emit({
      type: 'world.discovery',
      discoveryId: venueId,
      name: venue.name,
      cityId,
    });
    return true;
  }

  /** Lieux cachés encore à trouver dans une ville. */
  undiscoveredSecrets(cityId: string): Venue[] {
    const city = this.runtime.cities.get(cityId);
    if (!city) return [];
    return [...city.venues.values()].filter((v) => v.hidden && !v.discovered);
  }

  /** Applique les décorations d'un grand événement (Tome XIX, ch. 3). */
  decorateForEvent(cityId: string, decorations: readonly string[], festivity: number): void {
    const city = this.runtime.cities.get(cityId);
    if (!city) return;
    city.decorations = [...decorations];
    city.festivity = clamp01(festivity);
    city.priceMultiplier = 1 + festivity * 0.65;
    city.hotelOccupancy = clamp01(city.hotelOccupancy + festivity * 0.4);
  }

  clearEventDecorations(cityId: string): void {
    const city = this.runtime.cities.get(cityId);
    if (!city) return;
    city.decorations = [];
    city.festivity = 0;
    city.priceMultiplier = 1;
  }

  // ── Météo ────────────────────────────────────────────────────────────────

  private updateWeather(city: CityRuntime, date: GameDate, phase: number): void {
    const country = getCountry(city.def.countryId);
    const latitudeFactor = Math.abs(city.geo.lat) / 90;
    // Cycle saisonnier : maximum en juillet dans l'hémisphère nord, inversé au
    // sud. Le léger déphasage traduit l'inertie thermique (les mois les plus
    // chauds arrivent après le solstice).
    const monthAngle = ((date.month - 1) / 12) * Math.PI * 2;
    const seasonal = -Math.cos(monthAngle - Math.PI / 6) * (country.hemisphere === 'south' ? -1 : 1);
    const dayCycle = Math.sin(((date.hour - 4) / 24) * Math.PI * 2);

    // Moyenne annuelle décroissante avec la latitude, amplitude saisonnière
    // croissante : un climat équatorial varie peu, un climat continental beaucoup.
    const baseTemp = 27 - latitudeFactor * 32;
    const seasonalSwing = 3 + latitudeFactor * 17;
    const noise = fbm1D(phase * 0.13 + city.geo.lon * 0.01, 3, city.id.length) * 2 - 1;

    const temperature =
      baseTemp + seasonal * seasonalSwing + dayCycle * (4 + latitudeFactor * 4) + noise * 3.5;

    const humidityBase =
      country.climate === 'tropical' ? 0.78 : country.climate === 'arid' ? 0.22 : 0.55;
    const humidity = clamp01(humidityBase + noise * 0.2);
    const wind = clamp(6 + Math.abs(noise) * 26 + (country.climate === 'oceanic' ? 8 : 0), 0, 95);

    const condition = this.pickCondition(country.climate, temperature, humidity, wind, noise);
    const severity = this.severityOf(condition, wind);

    city.weather = {
      condition,
      temperatureC: Math.round(temperature * 10) / 10,
      windKmh: Math.round(wind),
      humidity: Math.round(humidity * 100) / 100,
      severity,
      pitchQuality: this.pitchQualityFor(condition, city.weather.pitchQuality),
    };

    if (severity > 0.4) {
      this.context.emit({
        type: 'world.weatherChanged',
        cityId: city.id,
        condition,
        temperatureC: city.weather.temperatureC,
        severity,
      });
    }
  }

  private pickCondition(
    climate: string,
    temperature: number,
    humidity: number,
    wind: number,
    noise: number,
  ): WeatherCondition {
    if (temperature <= 1 && humidity > 0.5) return noise > 0.4 ? 'snow' : 'cloudy';
    if (temperature >= 37) return 'heatwave';
    if (humidity > 0.82 && wind > 45) return 'storm';
    if (humidity > 0.78) return 'heavyRain';
    if (humidity > 0.66) return 'rain';
    if (humidity > 0.7 && wind < 8) return 'fog';
    if (climate === 'arid') return humidity > 0.6 ? 'cloudy' : 'clear';
    return humidity > 0.5 ? 'cloudy' : 'clear';
  }

  private severityOf(condition: WeatherCondition, wind: number): number {
    switch (condition) {
      case 'storm':
        return clamp01(0.7 + wind / 200);
      case 'heavyRain':
        return 0.5;
      case 'snow':
        return 0.55;
      case 'heatwave':
        return 0.45;
      case 'fog':
        return 0.4;
      case 'rain':
        return 0.25;
      case 'cloudy':
        return 0.08;
      default:
        return 0;
    }
  }

  /** Une pelouse se dégrade sous la pluie et se régénère au sec (Tome XX, ch. 3). */
  private pitchQualityFor(condition: WeatherCondition, current: number): number {
    const impact =
      condition === 'storm' || condition === 'heavyRain'
        ? -0.06
        : condition === 'rain' || condition === 'snow'
          ? -0.03
          : condition === 'heatwave'
            ? -0.02
            : 0.02;
    return clamp(current + impact, 0.3, 1);
  }

  // ── Lieux ────────────────────────────────────────────────────────────────

  private updateVenueOpening(city: CityRuntime, date: GameDate): void {
    for (const venue of city.venues.values()) {
      if (venue.status === 'permanentlyClosed' || venue.status === 'renovating') {
        if (venue.open) {
          venue.open = false;
          this.context.emit({ type: 'world.venueClosed', venueId: venue.id, cityId: city.id });
        }
        continue;
      }
      const template = getVenueTemplate(venue.type);
      const shouldOpen = venue.status === 'open' && isOpenAt(template, date.hour, date.weekday);
      if (shouldOpen !== venue.open) {
        venue.open = shouldOpen;
        this.context.emit(
          shouldOpen
            ? { type: 'world.venueOpened', venueId: venue.id, cityId: city.id }
            : { type: 'world.venueClosed', venueId: venue.id, cityId: city.id },
        );
      }
    }
  }

  private updateOccupancy(city: CityRuntime, date: GameDate): void {
    const rng = this.context.stream('world.occupancy');
    const isWeekend = date.weekday >= 5;
    for (const venue of city.venues.values()) {
      if (!venue.open) {
        venue.occupancy = 0;
        continue;
      }
      const peak = this.peakFactorFor(venue, date.hour, isWeekend);
      const weatherFactor = this.weatherFactorFor(venue, city);
      const target =
        venue.capacity * venue.popularity * peak * weatherFactor * (0.75 + city.festivity * 0.5);
      venue.occupancy = Math.round(clamp(target * rng.range(0.85, 1.15), 0, venue.capacity));
    }
  }

  private peakFactorFor(venue: Venue, hour: number, isWeekend: boolean): number {
    switch (venue.type) {
      case 'restaurant':
        return hour >= 12 && hour <= 14 ? 0.9 : hour >= 19 && hour <= 22 ? 1 : 0.25;
      case 'cafe':
        return hour >= 7 && hour <= 10 ? 0.95 : hour >= 15 && hour <= 18 ? 0.75 : 0.35;
      case 'nightclub':
        return hour >= 0 && hour <= 4 ? 1 : 0.15;
      case 'mall':
      case 'shop':
      case 'officialStore':
        return isWeekend ? 0.9 : hour >= 12 && hour <= 19 ? 0.7 : 0.4;
      case 'gym':
        return hour >= 6 && hour <= 9 ? 0.8 : hour >= 17 && hour <= 21 ? 1 : 0.3;
      case 'beach':
        return hour >= 11 && hour <= 18 ? 0.9 : 0.15;
      case 'park':
        return isWeekend && hour >= 10 && hour <= 18 ? 0.85 : 0.4;
      case 'airport':
      case 'trainStation':
        return hour >= 6 && hour <= 21 ? 0.75 : 0.25;
      default:
        return 0.5;
    }
  }

  private weatherFactorFor(venue: Venue, city: CityRuntime): number {
    const outdoor =
      venue.type === 'beach' ||
      venue.type === 'park' ||
      venue.type === 'square' ||
      venue.type === 'streetPitch' ||
      venue.type === 'festivalGround' ||
      venue.type === 'market';
    if (!outdoor) return 1 + city.weather.severity * 0.25; // les intérieurs se remplissent
    return clamp(1 - city.weather.severity * 1.1, 0.05, 1.15);
  }

  // ── Trafic ───────────────────────────────────────────────────────────────

  private updateTraffic(city: CityRuntime, date: GameDate): void {
    const isWeekend = date.weekday >= 5;
    const morningPeak = Math.exp(-((date.hour - 8) ** 2) / 3);
    const eveningPeak = Math.exp(-((date.hour - 18) ** 2) / 4);
    const base = isWeekend ? 0.28 : 0.34;
    const sizeFactor = clamp(city.def.population / 8000, 0.25, 1.3);
    const weatherFactor = 1 + city.weather.severity * 0.5;
    const eventFactor = 1 + city.festivity * 0.6;
    const worksFactor =
      1 + city.activeStreetEvents.filter((e) => e.kind === 'roadWorks').length * 0.08;

    city.traffic = clamp(
      (base + morningPeak * 0.55 + eveningPeak * 0.6) * sizeFactor * weatherFactor * eventFactor * worksFactor,
      0.05,
      2.2,
    );

    for (const street of city.streets.values()) {
      const jitter = street.capacity > 800 ? 0.85 : 1.15;
      street.load = clamp(city.traffic * jitter * (street.underWorks ? 1.4 : 1), 0, 3);
    }
  }

  private updateHotelOccupancy(city: CityRuntime): void {
    const rng = this.context.stream('world.hotels');
    const drift = rng.range(-0.05, 0.05);
    const target = clamp01(0.35 + city.def.tourism * 0.35 + city.festivity * 0.45 + drift);
    city.hotelOccupancy = clamp01(lerp(city.hotelOccupancy, target, 0.35));
    for (const venue of city.venues.values()) {
      if (venue.type !== 'hotel') continue;
      venue.occupancy = Math.round(venue.capacity * city.hotelOccupancy);
    }
  }

  // ── Événements de rue ────────────────────────────────────────────────────

  private spawnStreetEvents(city: CityRuntime, context: SimulationContext, date: GameDate): void {
    const rng = context.stream('world.streetEvents');
    const season = this.seasonOf(date, city);
    const budget = city.def.tier === 1 ? 3 : city.def.tier === 2 ? 2 : 1;
    for (let i = 0; i < budget; i++) {
      const candidates = STREET_EVENT_TEMPLATES.filter(
        (t) => t.seasons.length === 0 || t.seasons.includes(season),
      );
      if (candidates.length === 0) return;
      const template = rng.weighted(candidates.map((item) => ({ item, weight: item.weight })));
      const districts = city.districts.filter(
        (d) => template.districts.length === 0 || template.districts.includes(d.kind),
      );
      if (districts.length === 0) continue;
      if (!rng.chance(0.55)) continue;
      const district = rng.pick(districts);
      const durationHours = rng.range(template.durationHours[0], template.durationHours[1]);
      const event: StreetEvent = {
        id: `${city.id}:event:${context.clock.absoluteMinutes}:${i}`,
        kind: template.kind,
        districtId: district.id,
        label: template.label,
        endsAt: context.clock.absoluteMinutes + durationHours * 60,
        draw: template.draw,
      };
      city.activeStreetEvents.push(event);
      district.liveliness = clamp01(district.liveliness + template.draw * 0.15);

      if (template.kind === 'roadWorks') {
        const streetId = district.streetIds[rng.int(0, Math.max(0, district.streetIds.length - 1))];
        const street = streetId ? city.streets.get(streetId) : undefined;
        if (street) street.underWorks = true;
      }

      context.emit({
        type: 'world.streetEvent',
        cityId: city.id,
        districtId: district.id,
        kind: template.kind,
        durationMinutes: Math.round(durationHours * 60),
      });
    }
  }

  private expireStreetEvents(city: CityRuntime, context: SimulationContext): void {
    const now = context.clock.absoluteMinutes;
    for (let i = city.activeStreetEvents.length - 1; i >= 0; i--) {
      const event = city.activeStreetEvents[i] as StreetEvent;
      if (event.endsAt > now) continue;
      city.activeStreetEvents.splice(i, 1);
      if (event.kind === 'roadWorks') {
        for (const street of city.streets.values()) {
          if (street.districtId === event.districtId) street.underWorks = false;
        }
      }
      const district = city.districts.find((d) => d.id === event.districtId);
      if (district) district.liveliness = clamp01(district.liveliness - event.draw * 0.15);
    }
  }

  // ── Cycle de vie des commerces ───────────────────────────────────────────

  private rollBusinessLifecycle(
    city: CityRuntime,
    context: SimulationContext,
    _date: GameDate,
  ): void {
    const rng = context.stream('world.business');
    const volatileVenues = [...city.venues.values()].filter(
      (v) => getVenueTemplate(v.type).volatile && v.status !== 'permanentlyClosed',
    );
    if (volatileVenues.length === 0) return;

    // Fermeture d'un commerce peu populaire.
    const candidate = rng.pick(volatileVenues);
    if (candidate.popularity < 0.22 && rng.chance(0.05)) {
      candidate.status = 'permanentlyClosed';
      candidate.open = false;
      this.closedVenues.add(`${city.id}/${candidate.id}`);
      context.emit({
        type: 'world.businessLifecycle',
        venueId: candidate.id,
        cityId: city.id,
        change: 'closed',
      });
      return;
    }

    // Rénovation temporaire.
    if (candidate.status === 'open' && rng.chance(0.02)) {
      const days = rng.int(5, 30);
      candidate.status = 'renovating';
      candidate.open = false;
      this.renovatingVenues.set(
        `${city.id}/${candidate.id}`,
        context.clock.absoluteMinutes + days * 24 * 60,
      );
      context.emit({
        type: 'world.businessLifecycle',
        venueId: candidate.id,
        cityId: city.id,
        change: 'renovated',
      });
      return;
    }

    // Réouverture d'un local fermé sous une nouvelle enseigne (pop-up store).
    const closed = [...city.venues.values()].filter((v) => v.status === 'permanentlyClosed');
    if (closed.length > 0 && rng.chance(0.08)) {
      const reborn = rng.pick(closed);
      reborn.status = 'open';
      reborn.popularity = rng.range(0.4, 0.75);
      reborn.windowDisplay = 'nouvelle enseigne';
      this.closedVenues.delete(`${city.id}/${reborn.id}`);
      context.emit({
        type: 'world.businessLifecycle',
        venueId: reborn.id,
        cityId: city.id,
        change: 'opened',
      });
    }
  }

  private tickRenovations(city: CityRuntime, context: SimulationContext): void {
    const now = context.clock.absoluteMinutes;
    for (const [key, endsAt] of [...this.renovatingVenues]) {
      const [cityId, venueId] = key.split('/');
      if (cityId !== city.id) continue;
      if (endsAt > now) continue;
      this.renovatingVenues.delete(key);
      const venue = venueId ? city.venues.get(venueId) : undefined;
      if (!venue) continue;
      venue.status = 'open';
      venue.popularity = clamp01(venue.popularity + 0.15);
      context.emit({
        type: 'world.businessLifecycle',
        venueId: venue.id,
        cityId: city.id,
        change: 'opened',
      });
    }
  }

  // ── Aléas naturels modérés (Tome XXX, ch. 6) ─────────────────────────────

  private rollNaturalHazard(city: CityRuntime, context: SimulationContext, date: GameDate): void {
    const rng = context.stream('world.hazards');
    const country = getCountry(city.def.countryId);
    const season = this.seasonOf(date, city);
    let probability = 0.012;
    if (country.climate === 'tropical') probability += 0.02;
    if (country.climate === 'arid' && season === 'summer') probability += 0.02;
    if (season === 'winter' && Math.abs(city.geo.lat) > 45) probability += 0.015;
    if (!rng.chance(probability)) return;

    const options: Array<{ item: 'storm' | 'heatwave' | 'heavyRain' | 'snowstorm' | 'fog'; weight: number }> = [
      { item: 'storm', weight: country.climate === 'tropical' ? 3 : 1.4 },
      { item: 'heavyRain', weight: 2 },
      { item: 'heatwave', weight: season === 'summer' ? 2.5 : 0.3 },
      { item: 'snowstorm', weight: season === 'winter' && Math.abs(city.geo.lat) > 45 ? 2 : 0.05 },
      { item: 'fog', weight: 1 },
    ];
    const hazard = rng.weighted(options);
    const durationHours = rng.int(4, 36);
    const disruption = clamp01(rng.range(0.35, 0.85));

    city.weather = {
      ...city.weather,
      condition:
        hazard === 'snowstorm' ? 'snow' : hazard === 'heatwave' ? 'heatwave' : (hazard as WeatherCondition),
      severity: Math.max(city.weather.severity, disruption),
    };

    context.emit({
      type: 'world.naturalHazard',
      cityId: city.id,
      hazard,
      disruption,
      durationHours,
    });
    context.logger.info('aléa naturel modéré', { ville: city.def.name, hazard, disruption });
  }

  private seasonOf(date: GameDate, city: CityRuntime): Season {
    const northern: Season =
      date.month === 12 || date.month <= 2
        ? 'winter'
        : date.month <= 5
          ? 'spring'
          : date.month <= 8
            ? 'summer'
            : 'autumn';
    if (getCountry(city.def.countryId).hemisphere === 'north') return northern;
    const flip: Record<Season, Season> = {
      winter: 'summer',
      spring: 'autumn',
      summer: 'winter',
      autumn: 'spring',
    };
    return flip[northern];
  }

  // ── Sérialisation ────────────────────────────────────────────────────────

  serialize(): unknown {
    const cityStates: Record<string, unknown> = {};
    for (const city of this.runtime.cities.values()) {
      cityStates[city.id] = {
        weather: city.weather,
        traffic: city.traffic,
        festivity: city.festivity,
        hotelOccupancy: city.hotelOccupancy,
        priceMultiplier: city.priceMultiplier,
        decorations: city.decorations,
        streetEvents: city.activeStreetEvents,
      };
    }
    return {
      closedVenues: [...this.closedVenues],
      renovatingVenues: [...this.renovatingVenues.entries()],
      discoveredVenues: [...this.discoveredVenues],
      weatherPhase: this.weatherPhase,
      cityStates,
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as {
      closedVenues?: string[];
      renovatingVenues?: [string, number][];
      discoveredVenues?: string[];
      weatherPhase?: number;
      cityStates?: Record<string, Record<string, unknown>>;
    };

    this.weatherPhase = state.weatherPhase ?? 0;

    for (const key of state.closedVenues ?? []) {
      this.closedVenues.add(key);
      const [cityId, venueId] = key.split('/');
      const venue = cityId && venueId ? this.runtime.cities.get(cityId)?.venues.get(venueId) : undefined;
      if (venue) {
        venue.status = 'permanentlyClosed';
        venue.open = false;
      }
    }

    for (const [key, endsAt] of state.renovatingVenues ?? []) {
      this.renovatingVenues.set(key, endsAt);
      const [cityId, venueId] = key.split('/');
      const venue = cityId && venueId ? this.runtime.cities.get(cityId)?.venues.get(venueId) : undefined;
      if (venue) {
        venue.status = 'renovating';
        venue.open = false;
      }
    }

    for (const key of state.discoveredVenues ?? []) {
      this.discoveredVenues.add(key);
      const [cityId, venueId] = key.split('/');
      const city = cityId ? this.runtime.cities.get(cityId) : undefined;
      const venue = city && venueId ? city.venues.get(venueId) : undefined;
      if (city && venue && venueId) {
        venue.discovered = true;
        city.discoveredVenueIds.add(venueId);
      }
    }

    for (const [cityId, raw] of Object.entries(state.cityStates ?? {})) {
      const city = this.runtime.cities.get(cityId);
      if (!city) continue;
      if (raw.weather) city.weather = raw.weather as CityWeather;
      if (typeof raw.traffic === 'number') city.traffic = raw.traffic;
      if (typeof raw.festivity === 'number') city.festivity = raw.festivity;
      if (typeof raw.hotelOccupancy === 'number') city.hotelOccupancy = raw.hotelOccupancy;
      if (typeof raw.priceMultiplier === 'number') city.priceMultiplier = raw.priceMultiplier;
      if (Array.isArray(raw.decorations)) city.decorations = raw.decorations as string[];
      if (Array.isArray(raw.streetEvents)) {
        city.activeStreetEvents.length = 0;
        city.activeStreetEvents.push(...(raw.streetEvents as StreetEvent[]));
      }
    }
  }
}
