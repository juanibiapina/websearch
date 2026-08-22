// Per-provider cross-process rate limiting.
//
// Each `websearch` run is a separate OS process, so an in-memory mutex cannot
// coordinate concurrent invocations. This module serializes throttled providers
// through a file lock and spaces their calls by a per-provider minimum interval,
// persisting the last request time on disk so separate processes observe it.

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import lockfile from "proper-lockfile";

export interface Clock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

interface ProviderLimit {
  minIntervalMs: number;
  // Providers sharing a lockGroup are serialized against the same lock and
  // timestamp file (e.g. SerpAPI engines could share one vendor quota later).
  lockGroup: string;
}

// Only throttled providers appear here. Anything absent runs without a lock,
// preserving full parallelism. Brave's free tier allows 1 request/second; the
// margin over 1000ms absorbs clock skew and the "counted on arrival" window.
const PROVIDER_LIMITS: Record<string, ProviderLimit> = {
  brave: { minIntervalMs: 1100, lockGroup: "brave" },
};

const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function defaultStateDir(): string {
  const base = process.env.XDG_STATE_HOME || tmpdir();
  return join(base, "websearch");
}

interface RateLimitOptions {
  clock?: Clock;
  stateDir?: string;
}

function readLastTimestamp(file: string): number {
  try {
    const raw = readFileSync(file, "utf8").trim();
    const value = Number.parseInt(raw, 10);
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
  const limit = PROVIDER_LIMITS[provider];
  if (!limit) return fn();

  const clock = options.clock ?? realClock;
  const stateDir = options.stateDir ?? defaultStateDir();
  mkdirSync(stateDir, { recursive: true });

  const tsFile = join(stateDir, `${limit.lockGroup}.timestamp`);
  ensureFile(tsFile);

  const release = await lockfile.lock(tsFile, {
    retries: { retries: 30, factor: 1.5, minTimeout: 100, maxTimeout: 2000 },
    stale: 30000,
  });
  try {
    const last = readLastTimestamp(tsFile);
    const wait = last > 0 ? last + limit.minIntervalMs - clock.now() : 0;
    if (wait > 0) await clock.sleep(wait);

    // Stamp the arrival time before the call, then hold the lock across the
    // call so a second process spaces itself from this arrival.
    writeFileSync(tsFile, String(clock.now()));
    return await fn();
  } finally {
    await release();
  }
}
