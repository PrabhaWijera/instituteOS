import logger from './logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Human-readable name (used in logs & metrics) */
  name: string;
  /** How many consecutive failures before opening (default: 5) */
  failureThreshold?: number;
  /** How many consecutive successes in HALF_OPEN before closing again (default: 2) */
  successThreshold?: number;
  /** How long (ms) the circuit stays OPEN before a recovery probe (default: 60_000) */
  timeoutMs?: number;
  /** Per-call timeout in ms — counts as a failure if exceeded (default: 15_000) */
  callTimeoutMs?: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private nextAttemptAt = 0;

  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeoutMs: number;
  private readonly callTimeoutMs: number;

  constructor(opts: CircuitBreakerOptions) {
    this.name = opts.name;
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.successThreshold = opts.successThreshold ?? 2;
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    this.callTimeoutMs = opts.callTimeoutMs ?? 15_000;
  }

  getState(): CircuitState {
    return this.state;
  }

  getName(): string {
    return this.name;
  }

  isAvailable(): boolean {
    if (this.state === 'CLOSED' || this.state === 'HALF_OPEN') return true;
    return Date.now() >= this.nextAttemptAt;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptAt) {
        const waitSecs = Math.round((this.nextAttemptAt - Date.now()) / 1000);
        throw new Error(
          `Circuit [${this.name}] is OPEN — service unavailable. Retry after ~${waitSecs}s`,
        );
      }
      this.transition('HALF_OPEN');
    }

    try {
      const result = await this.withCallTimeout(fn());
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err as Error);
      throw err;
    }
  }

  private withCallTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(`Circuit [${this.name}] call timed out after ${this.callTimeoutMs}ms`),
        );
      }, this.callTimeoutMs);

      promise.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }

  private onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.transition('CLOSED');
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure(err: Error) {
    this.successes = 0;

    if (this.state === 'HALF_OPEN') {
      this.transition('OPEN');
      return;
    }

    this.failures++;
    logger.warn(`Circuit [${this.name}] failure ${this.failures}/${this.failureThreshold}`, {
      error: err.message,
    });

    if (this.failures >= this.failureThreshold) {
      this.transition('OPEN');
    }
  }

  private transition(to: CircuitState) {
    const from = this.state;
    this.state = to;

    if (to === 'OPEN') {
      this.nextAttemptAt = Date.now() + this.timeoutMs;
      this.failures = 0;
      logger.error(
        `Circuit [${this.name}] OPENED — too many failures. Will probe in ${this.timeoutMs / 1000}s`,
      );
    } else if (to === 'HALF_OPEN') {
      this.successes = 0;
      logger.info(`Circuit [${this.name}] HALF_OPEN — probing recovery`);
    } else {
      this.failures = 0;
      this.successes = 0;
      logger.info(`Circuit [${this.name}] CLOSED — service recovered`);
    }

    if (from !== to) {
      logger.info(`Circuit [${this.name}] state: ${from} → ${to}`);
    }
  }
}

/** Global registry so health endpoint can enumerate all breakers */
export const circuitRegistry = new Map<string, CircuitBreaker>();

export function registerCircuit(cb: CircuitBreaker): CircuitBreaker {
  circuitRegistry.set(cb.getName(), cb);
  return cb;
}
