# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@gramio/views` is a view-layer library for [GramIO](https://github.com/gramiojs/gramio) Telegram bots. It provides a builder pattern for defining reusable "views" — composable message templates with text, keyboards, and media — that automatically handle send vs. edit strategies based on the Telegram context (message vs. callback_query). @README.md

## Commands

- **Build:** `bunx pkgroll` (also runs via `bun prepublishOnly`)
- **Type-check:** `tsc --noEmit`
- **Lint/Format:** `bunx @biomejs/biome check .` / `bunx @biomejs/biome format .`
- **Run example bot:** `bun test.ts` or `bun example/index.ts` (requires `BOT_TOKEN` in `.env`)

- **Test:** `bun test`

## Architecture

The library has a small, focused design with core modules in `src/`:

- **`index.ts`** — `initViewsBuilder<Globals>()` factory. Returns a callable that creates `ViewBuilder` instances, plus a `.buildRender(context, globals)` method that produces `render`/`render.send`/`render.edit` functions for use inside GramIO's `.derive()`.
- **`view.ts`** — `ViewBuilder` class. Has a single `.render(callback)` method that takes a `this`-typed callback (accessing globals + `response`) and returns a `ViewRender`.
- **`render.ts`** — `ViewRender` class. Core rendering engine. `renderWithContext()` executes the view callback, then decides whether to send or edit based on the Telegram context type. Handles text-only, single media, and media group messages with proper edit-to-send fallbacks.
- **`response.ts`** — `ResponseView` class. Fluent builder (`.text()`, `.keyboard()`, `.media()`) that collects the response payload.
- **`utils.ts`** — Type utilities (`WithResponseContext`, `ExtractViewArgs`, `InitViewsBuilderReturn`) and the `isInlineMarkup` runtime check.
- **`adapters/`** — Adapter system for external view definitions:
    - **`types.ts`** — `ViewAdapter` / `ViewMap` interfaces.
    - **`define.ts`** — `defineAdapter()` — creates an adapter from programmatic view callbacks.
    - **`json.ts`** — `createJsonAdapter()` — creates an adapter from JSON view definitions with `{{key}}` interpolation. Supports `text`, `keyboard` (inline keyboard rows with button text/callback_data/url interpolation), and `media` (single or array for media groups, with media URL interpolation).
    - **`fs.ts`** — FS loading helpers:
        - `loadJsonViews(filePath)` — reads a single JSON file containing multiple named view definitions.
        - `loadJsonViewsDir(dirPath)` — recursively reads `.json` files from a directory; subdirectory paths become dot-separated keys (e.g. `goods/things/happens.json` → `"goods.things.happens"`).
    - **`index.ts`** — Re-exports all adapter utilities.

### Key Pattern

Views use `this`-binding to inject globals and the response builder into the render callback:

```ts
const view = defineView().render(function (arg: string) {
    return this.response.text(this.someGlobal + arg);
});
```

The `this` context is typed as `Globals & { response: ResponseView }`.

## Code Style

- Biome with tabs, double quotes
- ESM (`"type": "module"`) with `.ts` extensions in imports
- Strict TypeScript, `verbatimModuleSyntax` enabled
- Published to both npm (via pkgroll) and JSR (via deno.json)
- Please update README.md with new changes

## Publishing

Dual-publish to npm and JSR via `.github/workflows/publish.yml` (manual dispatch). The `scripts/prepare-jsr.ts` script syncs the version to `deno.json` before JSR publish.
