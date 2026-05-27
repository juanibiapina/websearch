// websearch - Multi-provider web search CLI
// Requires Node 18+ (built-in fetch).

import { Command, Option } from "commander";
import { extractLocal } from "./extract.ts";
import { PROVIDER_NAMES, search } from "./search.ts";
import type { ExtractResult, SearchResult } from "./types.ts";

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

// === CLI ===

const program = new Command();

program
  .name("websearch")
  .description("Multi-provider web search CLI")
  .addHelpText(
    "after",
    `
Environment variables:
  TAVILY_API_KEY              Tavily (https://app.tavily.com)
  EXA_API_KEY                 Exa (https://dashboard.exa.ai)
  WEBSEARCHAPI_KEY            WebSearchAPI.ai (https://websearchapi.ai)
  BRAVE_API_KEY               Brave Search (https://api-dashboard.search.brave.com)
  SERPAPI_KEY                 Google, Scholar, YouTube, Amazon (https://serpapi.com/manage-api-key)
  WEBSEARCH_DEFAULT_PROVIDER  Override default provider for search`,
  );

program
  .command("search")
  .description("Search the web")
  .argument("<query...>", "Search query")
  .addOption(
    new Option("-p, --provider <name>", "Provider to use")
      .choices(PROVIDER_NAMES)
      .default("brave")
      .env("WEBSEARCH_DEFAULT_PROVIDER"),
  )
  .option("-n <num>", "Number of results", "5")
  .option("--content", "Include page content")
  .option("--freshness <period>", "Filter: day, week, month, year")
  .option("--country <code>", "Two-letter country code")
  .option("--json", "Output raw JSON")
  .action(async (queryParts: string[], opts) => {
    const query = queryParts.join(" ");
    const results = await search(query, {
      provider: opts.provider,
      numResults: parseInt(opts.n, 10),
      content: opts.content ?? false,
      freshness: opts.freshness ?? null,
      country: opts.country ?? null,
    });
    if (opts.json) console.log(JSON.stringify(results, null, 2));
    else printResults(results);
  });

program
  .command("extract")
  .description("Extract content from a URL as markdown (local, no API credits)")
  .argument("<url>", "URL to extract")
  .option("--json", "Output raw JSON")
  .action(async (url: string, opts) => {
    const result = await extractLocal(url);
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else printExtract(result);
  });

program.parseAsync().catch((e: Error) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
