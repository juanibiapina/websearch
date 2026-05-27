---
name: web-search
description: Web search and content extraction. Use when searching the web for documentation, facts or research. Triggers on "search", "look up", "find information", "search the web", "research", or any web lookup task.
---

# Web Search

Multi-provider web search and content extraction via the `websearch` CLI.

## Commands

### search — Find web pages

```bash
websearch search "query"                       # Search (default: Brave)
websearch search "query" -p brave              # Specific provider
websearch search "query" -n 10                 # More results (default: 5)
websearch search "query" --content             # Include page content
websearch search "query" --freshness week      # Filter: day, week, month, year
websearch search "query" --country DE          # Country-specific results
websearch search "query" -p scholar            # Academic papers
websearch search "query" -p youtube            # Video search
websearch search "query" -p amazon             # Product search
```

### extract — Get page content as markdown

```bash
websearch extract "https://example.com/article"
websearch extract "https://docs.rust-lang.org/book/ch04-01-what-is-ownership.html"
```

Extraction is always local (fetches HTML, parses with Readability, converts to markdown). No API credits used.



All commands support `--json` for raw JSON output.

## Provider Guide

| Provider | Best for | Free tier |
|---|---|---|
| tavily | General AI-optimized search | 1,000/month |
| exa | Semantic search | 1,000/month |
| websearchapi | Google-powered search, generous quota | 2,000/month |
| brave | Independent index, privacy-focused | ~1,000/month |
| google | Web search via Google | 250/month* |
| scholar | Academic papers | 250/month* |
| youtube | Video search | 250/month* |
| amazon | Product search | 250/month* |

*google, scholar, youtube, and amazon share a single SerpAPI quota (250/month).

**Defaults:** search→brave, extract→local

### Provider characteristics

- **brave** (default): Independent index (not Google/Bing). Reliably surfaces official docs first. Good general-purpose choice.
- **tavily**: Returns the longest snippets by far — 3-5x more text per result than other providers. Tends to surface blogs and community content (Medium, dev.to) over official docs. Good when you want rich context without using `--content`.
- **exa**: Semantic/neural search — understands meaning beyond keywords. Great for technical queries and "what's the latest on X".
- **websearchapi**: Google-powered results. Good default when other quotas run low.
- **google**: Google results via SerpAPI. Similar results to websearchapi. Shares a tighter free tier (250/month) — prefer brave or websearchapi for general searches.
- **scholar**: Academic papers and citations from Google Scholar.
- **youtube**: Video search results from YouTube.
- **amazon**: Product search with prices and ratings from Amazon.

## Setup

Each provider needs an API key as an environment variable. Only configure the ones you use:

```
TAVILY_API_KEY      # https://app.tavily.com
EXA_API_KEY         # https://dashboard.exa.ai
WEBSEARCHAPI_KEY    # https://websearchapi.ai
BRAVE_API_KEY       # https://api-dashboard.search.brave.com
SERPAPI_KEY          # google, scholar, youtube, amazon (https://serpapi.com/manage-api-key)
```

## Tips

- Use `--content` to include page text in search results (avoids a separate extract call)
- Use `extract` to read long documentation pages (free, no API credits)
- Use `-p scholar` for academic papers, `-p youtube` for video tutorials, `-p amazon` for products
- google, scholar, youtube, and amazon share a single SerpAPI quota — use sparingly
- When a provider's quota runs low, switch with `-p`
