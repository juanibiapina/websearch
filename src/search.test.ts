import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJSON } from "./search.ts";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function rateLimited(retryAfter?: string): Response {
  const headers: Record<string, string> = {};
  if (retryAfter !== undefined) headers["Retry-After"] = retryAfter;
  return new Response("slow down", { status: 429, statusText: "Too Many Requests", headers });
}

describe("fetchJSON 429 handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("waits the Retry-After delay and retries once on 429", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(rateLimited("2"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const sleeps: number[] = [];

    const data = await fetchJSON("https://example.test/api", {}, async (ms) => {
      sleeps.push(ms);
    });

    expect(data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([2000]);
  });

  it("caps the Retry-After wait at 5 seconds", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(rateLimited("3600"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const sleeps: number[] = [];

    await fetchJSON("https://example.test/api", {}, async (ms) => {
      sleeps.push(ms);
    });

    expect(sleeps).toEqual([5000]);
  });

  it("throws when a 429 persists after the retry", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(rateLimited("1"))
      .mockResolvedValueOnce(rateLimited("1"));

    await expect(fetchJSON("https://example.test/api", {}, async () => {})).rejects.toThrow(/429/);
  });
});
