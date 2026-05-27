# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
