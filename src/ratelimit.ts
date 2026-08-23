// Per-provider cross-process rate limiting, driven entirely by the server's
// Retry-After response. No provider rate is hard-coded.
//
// Each `websearch` run is a separate OS process, so an in-memory mutex cannot
// coordinate concurrent invocations. Every provider call is serialized through a
// per-provider file lock. When a call is rate limited, the server's Retry-After
// deadline is persisted on disk; the next lock holder (any process) waits for
// that shared deadline before trying again, so concurrent invocations back off
// together instead of each burning their own 429.

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import lockfile from "proper-lockfile";

export interface Clock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

// Thrown by the HTTP layer on a 429 so the limiter can honor Retry-After.
export class RateLimitError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(`rate limited; retry after ${retryAfterMs}ms`);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

// Safety bound on how many times one call re-tries a rate-limited request. This
// is not a rate value; it only stops an endlessly-429ing server from looping
// forever. The wait between attempts always comes from Retry-After.
const MAX_ATTEMPTS = 5;

const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function defaultStateDir(): string {
  return join(process.env.XDG_STATE_HOME || tmpdir(), "websearch");
}

interface RateLimitOptions {
  clock?: Clock;
  stateDir?: string;
}

function readDeadline(file: string): number {
  try {
    const value = Number.parseInt(readFileSync(file, "utf8").trim(), 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

// proper-lockfile calls realpath on the target by default, so the file must
// exist before locking. Create it (empty) if absent.
function ensureFile(file: string): void {
  if (!existsSync(file)) {
    closeSync(openSync(file, "a"));
  }
}

export async function withRateLimit<T>(
  provider: string,
  fn: () => Promise<T>,
  options: RateLimitOptions = {},
): Promise<T> {
  const clock = options.clock ?? realClock;
  const stateDir = options.stateDir ?? defaultStateDir();
  mkdirSync(stateDir, { recursive: true });

  const file = join(stateDir, `${provider}.deadline`);
  ensureFile(file);

  const release = await lockfile.lock(file, {
    retries: { retries: 30, factor: 1.5, minTimeout: 100, maxTimeout: 2000 },
    stale: 30000,
  });
  try {
    let lastError: RateLimitError | undefined;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Wait for any deadline a prior call (in this or another process) recorded.
      const wait = readDeadline(file) - clock.now();
      if (wait > 0) await clock.sleep(wait);

      try {
        return await fn();
      } catch (error) {
        if (!(error instanceof RateLimitError)) throw error;
        lastError = error;
        // Persist the server-driven deadline so concurrent processes back off too.
        writeFileSync(file, String(clock.now() + error.retryAfterMs));
      }
    }
    throw lastError ?? new RateLimitError(0);
  } finally {
    await release();
  }
}
