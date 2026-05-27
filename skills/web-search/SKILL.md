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
websearch search "query" -p amazon --country US  # Product search
```

`--content` and `--country` work with all providers. `--freshness` works with all except youtube and amazon.

### extract — Get page content as markdown

```bash
websearch extract "https://example.com/article"
websearch extract "https://docs.rust-lang.org/book/ch04-01-what-is-ownership.html"
```

All commands support `--json` for raw JSON output.

## Providers

Default provider is **brave**. Override with `-p <name>`.

| Provider | Source |
|---|---|
| brave | Brave independent index |
| tavily | Tavily AI search |
| exa | Exa neural/semantic index |
| websearchapi | Google (via WebSearchAPI.ai) |
| google | Google (via SerpAPI) |
| scholar | Google Scholar (via SerpAPI) |
| youtube | YouTube (via SerpAPI) |
| amazon | Amazon product search (via SerpAPI) |
### Provider details

- **brave**: Returns short snippets (~200-300 chars).
- **tavily**: Returns long snippets (~800-1100 chars).
- **exa**: Semantic search, matches by meaning not just keywords. Returns snippets (~200 chars).
- **websearchapi**: Google-powered. Returns short snippets (~150 chars).
- **google**: Google-powered. Returns short snippets (~150 chars).
- **scholar**: Returns academic papers with citation snippets.
- **youtube**: Returns video titles, links, and descriptions.
- **amazon**: Returns product titles, prices, and ratings. `--country` maps to regional Amazon domains (e.g. `de` → amazon.de). Defaults to amazon.com.

## Setup

Each provider needs an API key as an environment variable:

```
TAVILY_API_KEY      # https://app.tavily.com
EXA_API_KEY         # https://dashboard.exa.ai
WEBSEARCHAPI_KEY    # https://websearchapi.ai
BRAVE_API_KEY       # https://api-dashboard.search.brave.com
SERPAPI_KEY         # google, scholar, youtube, amazon (https://serpapi.com/manage-api-key)
```
