import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Clock, withRateLimit } from "./ratelimit.ts";

function fakeClock(start = 1000): Clock & { sleeps: number[]; current: () => number } {
  let t = start;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
    current: () => t,
  };
}

describe("withRateLimit", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), "websearch-rl-"));
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("spaces throttled provider calls by the provider interval", async () => {
    const clock = fakeClock(1000);
    const order: number[] = [];

    // Each call reads the on-disk timestamp fresh, mimicking a separate process.
    await withRateLimit("brave", async () => order.push(1), { clock, stateDir });
    await withRateLimit("brave", async () => order.push(2), { clock, stateDir });

    expect(order).toEqual([1, 2]);
    // First call does not wait; second waits the full brave interval (1100ms).
    expect(clock.sleeps.filter((ms) => ms > 0)).toEqual([1100]);
  });

  it("does not throttle or lock unknown providers", async () => {
    const clock = fakeClock(1000);

    const result = await withRateLimit("tavily", async () => "ok", { clock, stateDir });

    expect(result).toBe("ok");
    expect(clock.sleeps.filter((ms) => ms > 0)).toEqual([]);
    // No lock or timestamp files created for an unthrottled provider.
    expect(readdirSync(stateDir)).toEqual([]);
  });

  it("returns the wrapped function result for throttled providers", async () => {
    const clock = fakeClock(1000);

    const result = await withRateLimit("brave", async () => 42, { clock, stateDir });

    expect(result).toBe(42);
  });
});
