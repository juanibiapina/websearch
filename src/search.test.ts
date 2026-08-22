import { afterEach, describe, expect, it, vi } from "vitest";
import { RateLimitError } from "./ratelimit.ts";
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

describe("fetchJSON", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws a RateLimitError carrying the Retry-After delay on 429", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(rateLimited("2"));

    await expect(fetchJSON("https://example.test/api")).rejects.toMatchObject({
      name: "RateLimitError",
      retryAfterMs: 2000,
    });
  });

  it("defaults the delay when a 429 omits Retry-After", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(rateLimited());

    await expect(fetchJSON("https://example.test/api")).rejects.toMatchObject({
      name: "RateLimitError",
      retryAfterMs: 1000,
    });
  });

  it("throws a plain error for other failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("boom", { status: 500, statusText: "Server Error" }),
    );

    const err = await fetchJSON("https://example.test/api").catch((e) => e);
    expect(err).not.toBeInstanceOf(RateLimitError);
    expect(String(err)).toMatch(/500/);
  });

  it("returns parsed JSON on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ ok: true }));

    expect(await fetchJSON("https://example.test/api")).toEqual({ ok: true });
  });
});
