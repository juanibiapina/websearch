import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Clock, RateLimitError, withRateLimit } from "./ratelimit.ts";

function fakeClock(start = 1000): Clock & { sleeps: number[] } {
  let t = start;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
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

  it("runs immediately when nothing is rate limited", async () => {
    const clock = fakeClock(1000);

    const result = await withRateLimit("tavily", async () => "ok", { clock, stateDir });

    expect(result).toBe("ok");
    expect(clock.sleeps.filter((ms) => ms > 0)).toEqual([]);
  });

  it("waits the server's Retry-After delay and retries", async () => {
    const clock = fakeClock(1000);
    let calls = 0;

    const result = await withRateLimit(
      "brave",
      async () => {
        calls++;
        if (calls === 1) throw new RateLimitError(2000);
        return "done";
      },
      { clock, stateDir },
    );

    expect(result).toBe("done");
    expect(calls).toBe(2);
    // The retry waited exactly what the server asked, nothing hard-coded.
    expect(clock.sleeps.filter((ms) => ms > 0)).toEqual([2000]);
  });

  it("persists the deadline so a separate process waits for it", async () => {
    // First caller hits a 429 and records a Retry-After deadline on disk.
    const first = fakeClock(1000);
    let firstCalls = 0;
    await withRateLimit(
      "brave",
      async () => {
        firstCalls++;
        if (firstCalls === 1) throw new RateLimitError(2000);
        return "a";
      },
      { clock: first, stateDir },
    );

    // A second, independent process (fresh clock) reads that deadline and waits.
    const second = fakeClock(2000);
    const result = await withRateLimit("brave", async () => "b", { clock: second, stateDir });

    expect(result).toBe("b");
    // Deadline was 1000 + 2000 = 3000; second process at t=2000 waits 1000.
    expect(second.sleeps.filter((ms) => ms > 0)).toEqual([1000]);
  });

  it("gives up after repeated rate limiting", async () => {
    const clock = fakeClock(1000);
    let calls = 0;

    await expect(
      withRateLimit(
        "brave",
        async () => {
          calls++;
          throw new RateLimitError(10);
        },
        { clock, stateDir },
      ),
    ).rejects.toBeInstanceOf(RateLimitError);
    expect(calls).toBeGreaterThan(1);
  });
});
