# websearch

Multi-provider web search and content extraction CLI.

## Install

```bash
npm install -g @juanibiapina/websearch
```

## Usage

```bash
websearch search "query"                       # Search (default: Brave)
websearch search "query" -p brave              # Specific provider
websearch search "query" -n 10                 # More results (default: 5)
websearch search "query" --content             # Include page content
websearch search "query" --freshness week      # Filter: day, week, month, year
websearch extract "https://example.com"        # Extract page content as markdown
```

All commands support `--json` for raw JSON output.

## Providers

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

## Rate limiting

Some providers cap request rate (Brave's free tier allows 1 request per second).
Because each `websearch` run is a separate process, the CLI coordinates through a
per-provider file lock so concurrent invocations wait automatically instead of
failing with HTTP 429:

- Throttled providers are serialized and spaced by a minimum interval (Brave:
  ~1s). Other providers run in parallel with no lock overhead.
- The lock and last-request timestamp live under `$XDG_STATE_HOME/websearch`
  (or the system temp dir). A stale lock from a crashed process is reclaimed
  automatically.
- On a 429 the CLI honors the `Retry-After` header and retries once, capped at
  5 seconds.

## Environment Variables

```
TAVILY_API_KEY      # https://app.tavily.com
EXA_API_KEY         # https://dashboard.exa.ai
WEBSEARCHAPI_KEY    # https://websearchapi.ai
BRAVE_API_KEY       # https://api-dashboard.search.brave.com
SERPAPI_KEY         # google, scholar, youtube, amazon (https://serpapi.com/manage-api-key)
```

## AI Agent Skill

This repo includes a skill file that teaches AI coding agents how to use websearch. Install it with:

```bash
npx skills add juanibiapina/websearch
```

## License

MIT
