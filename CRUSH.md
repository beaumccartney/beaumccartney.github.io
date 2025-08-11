Repository quickstart for agents

Commands
- Install deps: bun install
- Build site: ./generate.ts
- Clean build: rm -rf build
- Typecheck: bun x tsc -p tsconfig.json --noEmit
- Lint: no JS/TS linter configured in this repo
- Tests: no test framework configured; if added, prefer Bun test
  - Run all: bun test
  - Run a single file: bun test path/to/test.ts
  - Run a single test name: bun test -t "test name"

Conventions
- Runtime/tooling: Bun + TypeScript (strict). ESM only ("type": "module").
- Imports: use node: specifiers for built-ins (e.g. import fs from "node:fs/promises"); third-party next; then local. Keep verbatim import syntax (tsconfig verbatimModuleSyntax=true).
- Formatting: 2-space indent, semicolons, double quotes, trailing commas where valid, wrap long template strings as needed.
- Types: enable inference but annotate function signatures and public types; prefer const; avoid any; use explicit narrow types for frontmatter.
- Naming: follow existing code style (snake_case for functions/consts like process_markdown_content, time_element_template, etc.; type aliases and interfaces in PascalCase).
- Error handling: fail fast; throw Error with clear messages when input is invalid; avoid console logging in build; let process exit non-zero on failures.
- FS/paths: use path.join for portability; prefer URL-safe paths for generated links.
- Shelling out: use Bun.$ template literals for commands; avoid child_process.
- HTML generation: prefer template literals + cheerio transforms; avoid unsafe HTML unless explicitly allowed by micromark with allowDangerousHtml.
- Modules used: micromark (+math, gfm-strikethrough), gray-matter, cheerio, highlight.js. Keep versions consistent with package.json.

Notes
- No Cursor or Copilot rules found in this repo.
- Artifacts output to build/ and are deployed via GitHub Pages workflow.
