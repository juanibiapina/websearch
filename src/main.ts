// websearch - Multi-provider web search CLI
// Requires Node 18+ (built-in fetch).

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

// === Types ===

interface ProviderConfig {
  env: string;
  name: string;
  url: string;
}

interface SubcommandConfig {
  providers: string[];
  default: string | null;
}

interface Options {
  subcommand: string;
  query: string;
  provider: string;
  numResults: number;
  content: boolean;
  freshness: string | null;
  country: string | null;
  engine: string;
  json: boolean;
}

interface PartialOptions {
  subcommand: string;
  query: string | null;
  provider: string | null;
  numResults: number;
  content: boolean;
  freshness: string | null;
  country: string | null;
  engine: string;
  json: boolean;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string | null;
  age?: string | null;
}

interface ExtractResult {
  title: string | null;
  content: string;
}

// === Configuration ===

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
  serpapi: { env: "SERPAPI_KEY", name: "SerpAPI", url: "https://serpapi.com/manage-api-key" },
};

const SUBCOMMANDS: Record<string, SubcommandConfig> = {
  search: {
    providers: ["tavily", "exa", "websearchapi", "brave", "serpapi"],
    default: "brave",
  },
  extract: { providers: [], default: null },
};

// === Argument Parsing ===

function parseArgs(argv: string[]): Options {
  const args = argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    process.exit(0);
  }

  const subcommand = args[0];
  if (!SUBCOMMANDS[subcommand]) {
    console.error(`Unknown command: ${subcommand}`);
    console.error(`Available: ${Object.keys(SUBCOMMANDS).join(", ")}`);
    process.exit(1);
  }

  const sub = SUBCOMMANDS[subcommand];
  const envProvider = process.env.WEBSEARCH_DEFAULT_PROVIDER;
  const defaultProvider =
    envProvider && sub.providers.includes(envProvider) ? envProvider : sub.default;

  const opts: PartialOptions = {
    subcommand,
    query: null,
    provider: defaultProvider,
    numResults: 5,
    content: false,
    freshness: null,
    country: null,
    engine: "google",
    json: false,
  };

  const rest = args.slice(1);

  if (rest.includes("--help") || rest.includes("-h")) {
    printSubcommandHelp(subcommand);
    process.exit(0);
  }

  const positionals: string[] = [];
  let i = 0;
  while (i < rest.length) {
    const arg = rest[i];
    switch (arg) {
      case "--provider":
      case "-p":
        opts.provider = rest[++i];
        break;
      case "-n":
        opts.numResults = parseInt(rest[++i], 10);
        break;
      case "--content":
        opts.content = true;
        break;
      case "--freshness":
        opts.freshness = rest[++i];
        break;
      case "--country":
        opts.country = rest[++i];
        break;
      case "--engine":
        opts.engine = rest[++i];
        break;
      case "--json":
        opts.json = true;
        break;
      default:
        if (arg.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
        positionals.push(arg);
    }
    i++;
  }

  opts.query = positionals.join(" ");

  if (!opts.query) {
    console.error("Missing required argument: query/URL");
    printSubcommandHelp(subcommand);
    process.exit(1);
  }

  // extract is always local — no provider selection
  if (subcommand !== "extract" && opts.provider && !sub.providers.includes(opts.provider)) {
    console.error(`Provider '${opts.provider}' does not support '${subcommand}'.`);
    console.error(`Available: ${sub.providers.join(", ")}`);
    process.exit(1);
  }

  return opts as Options;
}

// === Help ===

function printHelp(): void {
  console.log(`Usage: websearch <command> <query> [options]

Commands:
  search    Search the web
  extract   Extract content from a URL as markdown

Options:
  --provider, -p <name>   Provider to use (default varies by command)
  -n <num>                Number of results (default: 5)
  --content               Include page content in search results
  --freshness <period>    Filter by time: day, week, month, year
  --country <code>        Two-letter country code
  --engine <name>         Search engine for SerpAPI (default: google)
  --json                  Output raw JSON
  --help, -h              Show help

Environment variables:
  TAVILY_API_KEY          Tavily (https://app.tavily.com)
  EXA_API_KEY             Exa (https://dashboard.exa.ai)
  WEBSEARCHAPI_KEY        WebSearchAPI.ai (https://websearchapi.ai)
  BRAVE_API_KEY           Brave Search (https://api-dashboard.search.brave.com)
  SERPAPI_KEY             SerpAPI (https://serpapi.com/manage-api-key)
  WEBSEARCH_DEFAULT_PROVIDER  Override default provider for search`);
}

function printSubcommandHelp(cmd: string): void {
  const sub = SUBCOMMANDS[cmd];
  const helps: Record<string, string> = {
    search: `Usage: websearch search <query> [options]

Search the web. Returns titles, URLs, and snippets.

  --provider, -p   ${sub.providers.join(", ")} (default: ${sub.default})
  -n <num>         Number of results (default: 5)
  --content        Include extracted page content
  --freshness      Filter: day, week, month, year
  --country        Two-letter country code
  --engine         SerpAPI engine (default: google)

Examples:
  websearch search "javascript async await"
  websearch search "rust error handling" --content -n 3
  websearch search "machine learning" -p brave --freshness week
  websearch search "python tutorial" -p serpapi --engine youtube`,

    extract: `Usage: websearch extract <url>

Extract content from a URL as markdown (local, no API credits).

Examples:
  websearch extract "https://docs.rust-lang.org/book/ch04-01-what-is-ownership.html"
  websearch extract "https://example.com/article"`,
  };

  console.log(helps[cmd]);
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

function truncate(text: string | undefined | null, maxLen = 5000): string {
  if (!text) return "";
  return text.length > maxLen ? `${text.substring(0, maxLen)}...` : text;
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

// === Local Content Extraction (HTML → Markdown) ===

function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  turndown.use(gfm);
  turndown.addRule("removeEmptyLinks", {
    filter: (node: HTMLElement) => node.nodeName === "A" && !node.textContent?.trim(),
    replacement: () => "",
  });
  return turndown
    .turndown(html)
    .replace(/\[\\?\[\s*\\?\]\]\([^)]*\)/g, "")
    .replace(/ +/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

function extractFromHtml(html: string, url: string): ExtractResult {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (article?.content) {
    return { title: article.title || null, content: htmlToMarkdown(article.content) };
  }

  // Fallback: strip noise elements and extract main content
  const fallbackDoc = new JSDOM(html, { url });
  const body = fallbackDoc.window.document;
  for (const el of body.querySelectorAll("script, style, noscript, nav, header, footer, aside")) {
    el.remove();
  }

  const title = body.querySelector("title")?.textContent?.trim() || null;
  const main = body.querySelector("main, article, [role='main'], .content, #content") || body.body;
  const text = main?.innerHTML || "";

  if (text.trim().length > 100) {
    return { title, content: htmlToMarkdown(text) };
  }

  throw new Error("Could not extract readable content from this page.");
}

async function fetchLocalContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return `(HTTP ${response.status})`;

    const html = await response.text();
    return truncate(extractFromHtml(html, url).content);
  } catch (e) {
    return `(Error: ${(e as Error).message})`;
  }
}

async function extractLocal(url: string): Promise<ExtractResult> {
  const response = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  return extractFromHtml(html, url);
}

// === Search Providers ===

// biome-ignore lint/suspicious/noExplicitAny: provider API responses are untyped
type APIResponse = any;

async function searchTavily(query: string, opts: Options): Promise<SearchResult[]> {
  const key = getKey("tavily");
  const body: Record<string, unknown> = {
    query,
    max_results: opts.numResults,
    search_depth: "basic",
  };
  if (opts.content) body.include_raw_content = "markdown";
  if (opts.freshness) body.time_range = opts.freshness;
  if (opts.country) body.country = opts.country;

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

async function searchExa(query: string, opts: Options): Promise<SearchResult[]> {
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

async function searchWebSearchAPI(query: string, opts: Options): Promise<SearchResult[]> {
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

async function searchBrave(query: string, opts: Options): Promise<SearchResult[]> {
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

  if (opts.content && results.length > 0) {
    const contents = await Promise.all(results.map((r) => fetchLocalContent(r.url)));
    results.forEach((r, i) => {
      r.content = contents[i];
    });
  }

  return results;
}

async function searchSerpAPI(query: string, opts: Options): Promise<SearchResult[]> {
  const key = getKey("serpapi");
  const engine = opts.engine || "google";
  // Different engines use different query parameter names
  const queryParamMap: Record<string, string> = {
    youtube: "search_query",
    walmart: "query",
    ebay: "_nkw",
    naver: "query",
  };
  const queryParam = queryParamMap[engine] || "q";
  const params = new URLSearchParams({
    engine,
    [queryParam]: query,
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
  if (opts.country) params.set("gl", opts.country.toLowerCase());

  const data: APIResponse = await fetchJSON(`https://serpapi.com/search.json?${params}`);

  // Different engines return results in different fields
  const raw =
    data.organic_results || data.video_results || data.shopping_results || data.jobs_results || [];
  const results: SearchResult[] = raw.slice(0, opts.numResults).map((r: APIResponse) => ({
    title: r.title || "",
    url: r.link || "",
    snippet: r.snippet || r.description || "",
    age: r.date || r.published_date || null,
    content: null,
  }));

  if (opts.content && results.length > 0) {
    const contents = await Promise.all(results.map((r: SearchResult) => fetchLocalContent(r.url)));
    results.forEach((r, i) => {
      r.content = contents[i];
    });
  }

  return results;
}

// === Output Formatters ===

function printResults(results: SearchResult[]): void {
  if (results.length === 0) {
    console.error("No results found.");
    return;
  }
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(`--- Result ${i + 1} ---`);
    console.log(`Title: ${r.title}`);
    console.log(`Link: ${r.url}`);
    if (r.age) console.log(`Age: ${r.age}`);
    console.log(`Snippet: ${r.snippet}`);
    if (r.content) console.log(`Content:\n${r.content}`);
    console.log("");
  }
}

function printExtract(result: ExtractResult): void {
  if (result.title) console.log(`# ${result.title}\n`);
  console.log(result.content);
}

// === Main ===

type SearchFn = (query: string, opts: Options) => Promise<SearchResult[]>;

const SEARCH_FNS: Record<string, SearchFn> = {
  tavily: searchTavily,
  exa: searchExa,
  websearchapi: searchWebSearchAPI,
  brave: searchBrave,
  serpapi: searchSerpAPI,
};

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  switch (opts.subcommand) {
    case "search": {
      const results = await SEARCH_FNS[opts.provider](opts.query, opts);
      if (opts.json) console.log(JSON.stringify(results, null, 2));
      else printResults(results);
      break;
    }
    case "extract": {
      const result = await extractLocal(opts.query);
      if (opts.json) console.log(JSON.stringify(result, null, 2));
      else printExtract(result);
      break;
    }
  }
}

main().catch((e: Error) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
