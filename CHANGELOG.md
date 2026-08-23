# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Rate-limit waiting is now driven entirely by the server's `Retry-After` response instead of a hard-coded per-provider interval; concurrent searches share the resulting deadline so they back off together

## [2.2.0] - 2026-08-22

### Added

- Automatically wait on provider rate limits: concurrent searches for a throttled provider (e.g. Brave, 1 request/second) are spaced apart instead of failing with HTTP 429, and a 429 response honors `Retry-After` with one retry

## [2.1.0] - 2026-05-27

### Added

- Include `skills/` directory in the npm package so consumers can copy the skill file from the installed package

## [2.0.0] - 2026-05-27

### Changed

- Default search provider switched from Tavily to Brave
- Rewrite skill as a reference for the CLI (no prescribed workflows)
- Replaced `serpapi` provider and `--engine` flag with individual `google`, `scholar`, `youtube`, `amazon` providers

### Fixed

- `extract` command crashing with "document is not defined" in Node.js
- fixed `--country` flag for all providers

### Removed

- `answer` command (direct answers with citations)
- `similar` command (find related pages via Exa)
- `code` command (find code examples via Exa)

## [1.0.0] - 2026-03-04

Initial release.
