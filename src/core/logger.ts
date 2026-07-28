/**
 * Infinity Football — Core / Journalisation
 *
 * Système de logs structuré exigé par le Tome XXII (outils développeurs) :
 * niveaux, canaux par système, tampon circulaire consultable depuis la console
 * de développement et export pour les rapports de bug.
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
};

export interface LogEntry {
  readonly level: LogLevel;
  readonly channel: string;
  readonly message: string;
  readonly data?: Record<string, unknown>;
  /** Horodatage temps réel (ms depuis le démarrage du process). */
  readonly timestamp: number;
}

export interface LoggerOptions {
  readonly minLevel?: LogLevel;
  readonly bufferSize?: number;
  readonly mirrorToConsole?: boolean;
}

export class Logger {
  private readonly buffer: LogEntry[] = [];
  private readonly bufferSize: number;
  private minLevel: LogLevel;
  private mirrorToConsole: boolean;
  private readonly mutedChannels = new Set<string>();
  private readonly counters: Record<LogLevel, number> = {
    trace: 0,
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
  };

  constructor(options: LoggerOptions = {}) {
    this.minLevel = options.minLevel ?? 'info';
    this.bufferSize = options.bufferSize ?? 1000;
    this.mirrorToConsole = options.mirrorToConsole ?? false;
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  setConsoleMirroring(enabled: boolean): void {
    this.mirrorToConsole = enabled;
  }

  mute(channel: string): void {
    this.mutedChannels.add(channel);
  }

  unmute(channel: string): void {
    this.mutedChannels.delete(channel);
  }

  /** Crée un logger lié à un canal (un système = un canal). */
  channel(name: string): ChannelLogger {
    return new ChannelLogger(this, name);
  }

  log(level: LogLevel, channel: string, message: string, data?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    if (this.mutedChannels.has(channel)) return;
    const entry: LogEntry = {
      level,
      channel,
      message,
      timestamp: Date.now(),
      ...(data ? { data } : {}),
    };
    this.counters[level]++;
    this.buffer.push(entry);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.splice(0, this.buffer.length - this.bufferSize);
    }
    if (this.mirrorToConsole) {
      const prefix = `[${level.toUpperCase()}][${channel}]`;
      const payload = data ? [prefix, message, data] : [prefix, message];
      if (level === 'error') console.error(...payload);
      else if (level === 'warn') console.warn(...payload);
      else console.log(...payload);
    }
  }

  /** Dernières entrées, filtrables par canal et par niveau minimum. */
  entries(filter: { channel?: string; minLevel?: LogLevel; limit?: number } = {}): LogEntry[] {
    const min = LEVEL_ORDER[filter.minLevel ?? 'trace'];
    const result = this.buffer.filter(
      (entry) =>
        LEVEL_ORDER[entry.level] >= min &&
        (filter.channel === undefined || entry.channel === filter.channel),
    );
    const limit = filter.limit ?? result.length;
    return result.slice(Math.max(0, result.length - limit));
  }

  counts(): Readonly<Record<LogLevel, number>> {
    return { ...this.counters };
  }

  /** Export texte pour les rapports de bug (Tome XV — contrôle qualité). */
  export(): string {
    return this.buffer
      .map((entry) => {
        const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
        return `${entry.timestamp} ${entry.level.toUpperCase().padEnd(5)} ${entry.channel} :: ${entry.message}${data}`;
      })
      .join('\n');
  }

  clear(): void {
    this.buffer.length = 0;
  }
}

export class ChannelLogger {
  constructor(
    private readonly logger: Logger,
    private readonly name: string,
  ) {}

  trace(message: string, data?: Record<string, unknown>): void {
    this.logger.log('trace', this.name, message, data);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.log('debug', this.name, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.logger.log('info', this.name, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.logger.log('warn', this.name, message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.logger.log('error', this.name, message, data);
  }
}
