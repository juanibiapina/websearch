# websearch

Multi-provider web search and content extraction CLI.

## Install

```bash
npm install -g @juanibiapina/websearch
```

## Usage

```bash
websearch search "query"                       # Search (default: Tavily)
websearch search "query" -p brave              # Specific provider
websearch search "query" -n 10                 # More results (default: 5)
websearch search "query" --content             # Include page content
websearch search "query" --freshness week      # Filter: day, week, month, year
websearch extract "https://example.com"        # Extract page content as markdown
websearch answer "What is Node.js?"            # Direct answer with citations
websearch similar "https://example.com"        # Find similar pages (Exa)
websearch code "React hooks"                   # Find code examples (Exa)
```

All commands support `--json` for raw JSON output.

## Providers

| Provider | Best for | Free tier |
|---|---|---|
| tavily | General AI-optimized search, answers | 1,000/month |
| exa | Semantic search, similar pages, code context | 1,000/month |
| websearchapi | Google-powered search, generous quota | 2,000/month |
| brave | Independent index, privacy-focused | ~1,000/month |
| serpapi | YouTube, Scholar, Amazon (40+ engines) | 100/month |

## Environment Variables

```
TAVILY_API_KEY      # https://app.tavily.com
EXA_API_KEY         # https://dashboard.exa.ai
WEBSEARCHAPI_KEY    # https://websearchapi.ai
BRAVE_API_KEY       # https://api-dashboard.search.brave.com
SERPAPI_KEY          # https://serpapi.com/manage-api-key
```

## License

MIT
