import { fetchLocalContent } from "./extract.ts";
import type { SearchResult } from "./types.ts";
import { truncate } from "./types.ts";

// === Provider Configuration ===

interface ProviderConfig {
  env: string;
  name: string;
  url: string;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  tavily: { env: "TAVILY_API_KEY", name: "Tavily", url: "https://app.tavily.com" },
  exa: { env: "EXA_API_KEY", name: "Exa", url: "https://dashboard.exa.ai" },
  websearchapi: {
    env: "WEBSEARCHAPI_KEY",
    name: "WebSearchAPI.ai",
    url: "https://websearchapi.ai",
  },
  brave: {
    env: "BRAVE_API_KEY",
    name: "Brave Search",
    url: "https://api-dashboard.search.brave.com",
  },
  google: {
    env: "SERPAPI_KEY",
    name: "Google (SerpAPI)",
    url: "https://serpapi.com/manage-api-key",
  },
  scholar: {
    env: "SERPAPI_KEY",
    name: "Google Scholar (SerpAPI)",
    url: "https://serpapi.com/manage-api-key",
  },
  youtube: {
    env: "SERPAPI_KEY",
    name: "YouTube (SerpAPI)",
    url: "https://serpapi.com/manage-api-key",
  },
  amazon: {
    env: "SERPAPI_KEY",
    name: "Amazon (SerpAPI)",
    url: "https://serpapi.com/manage-api-key",
  },
};

export const PROVIDER_NAMES = Object.keys(PROVIDERS);

export interface SearchOptions {
  provider: string;
  numResults: number;
  content: boolean;
  freshness: string | null;
  country: string | null;
}

// === Utilities ===

function getKey(provider: string): string {
  const p = PROVIDERS[provider];
  const key = process.env[p.env];
  if (!key) {
    console.error(`Error: ${p.env} is not set.`);
    console.error(`Get your API key at: ${p.url}`);
    process.exit(1);
  }
  return key;
}

async function fetchJSON(url: string, options: RequestInit = {}): Promise<Record<string, unknown>> {
  if (!options.signal) options.signal = AbortSignal.timeout(30000);
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${response.statusText}\n${text}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

function freshnessDate(period: string): string | null {
  const days: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };
  if (!days[period]) return null;
  const d = new Date();
  d.setDate(d.getDate() - days[period]);
  return d.toISOString();
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
function countryName(code: string): string {
  return (regionNames.of(code.toUpperCase()) || code).toLowerCase();
}

// === Search Providers ===

// biome-ignore lint/suspicious/noExplicitAny: provider API responses are untyped
type APIResponse = any;

async function searchTavily(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const key = getKey("tavily");
  const body: Record<string, unknown> = {
    query,
    max_results: opts.numResults,
    search_depth: "basic",
  };
  if (opts.content) body.include_raw_content = "markdown";
  if (opts.freshness) body.time_range = opts.freshness;
  if (opts.country) body.country = countryName(opts.country);

  const data: APIResponse = await fetchJSON("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });

  return (data.results || []).map((r: APIResponse) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.content || "",
    content: opts.content ? truncate(r.raw_content) : null,
  }));
}

async function searchExa(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const key = getKey("exa");
  const contents: Record<string, unknown> = { highlights: { maxCharacters: 300 } };
  if (opts.content) contents.text = true;

  const body: Record<string, unknown> = {
    query,
    numResults: opts.numResults,
    type: "auto",
    contents,
  };
  if (opts.freshness) {
    const d = freshnessDate(opts.freshness);
    if (d) body.startPublishedDate = d;
  }

  const data: APIResponse = await fetchJSON("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify(body),
  });

  return (data.results || []).map((r: APIResponse) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.highlights?.[0] || "",
    content: opts.content ? truncate(r.text) : null,
    age: r.publishedDate || null,
  }));
}

async function searchWebSearchAPI(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const key = getKey("websearchapi");
  const body: Record<string, unknown> = { query, maxResults: opts.numResults };
  if (opts.content) body.includeContent = true;
  if (opts.freshness) body.timeframe = opts.freshness;
  if (opts.country) body.country = opts.country;

  const data: APIResponse = await fetchJSON("https://api.websearchapi.ai/ai-search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });

  return (data.organic || []).map((r: APIResponse) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.description || "",
    content: opts.content ? truncate(r.content) : null,
  }));
}

async function searchBrave(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const key = getKey("brave");
  const params = new URLSearchParams({
    q: query,
    count: Math.min(opts.numResults, 20).toString(),
  });
  if (opts.country) params.set("country", opts.country.toUpperCase());
  if (opts.freshness) {
    const map: Record<string, string> = { day: "pd", week: "pw", month: "pm", year: "py" };
    params.set("freshness", map[opts.freshness] || opts.freshness);
  }

  const data: APIResponse = await fetchJSON(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": key,
      },
    },
  );

  const results: SearchResult[] = (data.web?.results || [])
    .slice(0, opts.numResults)
    .map((r: APIResponse) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.description || "",
      age: r.age || r.page_age || null,
      content: null,
    }));

  return results;
}

// === SerpAPI Engine Configuration ===

interface SerpAPIEngineConfig {
  engine: string;
  queryParam: string;
  resultFields: string[];
  countryParam?: (code: string) => [string, string];
}

const SERPAPI_ENGINES: Record<string, SerpAPIEngineConfig> = {
  google: { engine: "google", queryParam: "q", resultFields: ["organic_results"] },
  scholar: {
    engine: "google_scholar",
    queryParam: "q",
    resultFields: ["organic_results"],
  },
  youtube: {
    engine: "youtube",
    queryParam: "search_query",
    resultFields: ["video_results"],
  },
  amazon: {
    engine: "amazon",
    queryParam: "k",
    resultFields: ["organic_results", "shopping_results"],
    countryParam: (code) => {
      const domains: Record<string, string> = {
        us: "amazon.com",
        uk: "amazon.co.uk",
        gb: "amazon.co.uk",
        de: "amazon.de",
        fr: "amazon.fr",
        es: "amazon.es",
        it: "amazon.it",
        ca: "amazon.ca",
        jp: "amazon.co.jp",
        au: "amazon.com.au",
        br: "amazon.com.br",
        mx: "amazon.com.mx",
        in: "amazon.in",
      };
      return ["amazon_domain", domains[code.toLowerCase()] || "amazon.com"];
    },
  },
};

function makeSerpAPISearch(config: SerpAPIEngineConfig): SearchFn {
  return async (query: string, opts: SearchOptions): Promise<SearchResult[]> => {
    const key = getKey(opts.provider);
    const params = new URLSearchParams({
      engine: config.engine,
      [config.queryParam]: query,
      api_key: key,
      num: opts.numResults.toString(),
    });
    if (opts.freshness) {
      const map: Record<string, string> = {
        day: "qdr:d",
        week: "qdr:w",
        month: "qdr:m",
        year: "qdr:y",
      };
      if (map[opts.freshness]) params.set("tbs", map[opts.freshness]);
    }
    if (opts.country) {
      if (config.countryParam) {
        const [key, value] = config.countryParam(opts.country);
        params.set(key, value);
      } else {
        params.set("gl", opts.country.toLowerCase());
      }
    }

    const data: APIResponse = await fetchJSON(`https://serpapi.com/search.json?${params}`);

    const raw =
      config.resultFields.reduce(
        (found, field) => found || data[field],
        undefined as APIResponse,
      ) || [];
    return raw.slice(0, opts.numResults).map((r: APIResponse) => ({
      title: r.title || "",
      url: r.link || "",
      snippet:
        r.snippet ||
        r.description ||
        [r.price, r.rating && `${r.rating}★`].filter(Boolean).join(" · ") ||
        "",
      age: r.date || r.published_date || null,
      content: null,
    }));
  };
}

// === Search Orchestration ===

type SearchFn = (query: string, opts: SearchOptions) => Promise<SearchResult[]>;

const SEARCH_FNS: Record<string, SearchFn> = {
  tavily: searchTavily,
  exa: searchExa,
  websearchapi: searchWebSearchAPI,
  brave: searchBrave,
  google: makeSerpAPISearch(SERPAPI_ENGINES.google),
  scholar: makeSerpAPISearch(SERPAPI_ENGINES.scholar),
  youtube: makeSerpAPISearch(SERPAPI_ENGINES.youtube),
  amazon: makeSerpAPISearch(SERPAPI_ENGINES.amazon),
};

export async function search(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const results = await SEARCH_FNS[opts.provider](query, opts);
  if (opts.content) {
    const fetches = results.map((r) =>
      r.content == null
        ? fetchLocalContent(r.url).then((c) => {
            r.content = c;
          })
        : Promise.resolve(),
    );
    await Promise.all(fetches);
  }
  return results;
}
