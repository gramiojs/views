# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@gramio/views` is a view-layer library for [GramIO](https://github.com/gramiojs/gramio) https://gramio.dev Telegram bots. It provides a builder pattern for defining reusable "views" — composable message templates with text, keyboards, and media — that automatically handle send vs. edit strategies based on the Telegram context (message vs. callback_query). @README.md

## Commands

- **Build:** `bunx pkgroll` (also runs via `bun prepublishOnly`)
- **Type-check:** `tsc --noEmit`
- **Lint/Format:** `bunx @biomejs/biome check .` / `bunx @biomejs/biome format .`
- **Run example bot:** `bun test.ts` or `bun example/index.ts` (requires `BOT_TOKEN` in `.env`)

- **Test:** `bun test`

## Architecture

The library has a small, focused design with core modules in `src/`:

- **`index.ts`** — `initViewsBuilder<Globals>()` factory. Returns a callable that creates `ViewBuilder` instances, plus a `.buildRender(context, globals)` method that produces `render`/`render.send`/`render.edit` functions for use inside GramIO's `.derive()`. The `.from()` method accepts either a static `ViewAdapter` or a factory function `(globals) => ViewAdapter` for dynamic adapter selection (e.g. per-locale i18n).
- **`view.ts`** — `ViewBuilder` class. Has a single `.render(callback)` method that takes a `this`-typed callback (accessing globals + `response`) and returns a `ViewRender`.
- **`render.ts`** — `ViewRender` class. Core rendering engine. `renderWithContext()` executes the view callback, then decides whether to send or edit based on the Telegram context type. Handles text-only, single media, and media group messages with proper edit-to-send fallbacks.
- **`response.ts`** — `ResponseView` class. Fluent builder (`.text()`, `.keyboard()`, `.media()`) that collects the response payload.
- **`utils.ts`** — Type utilities (`WithResponseContext`, `ExtractViewArgs`, `InitViewsBuilderReturn`) and the `isInlineMarkup` runtime check.
- **`adapters/`** — Adapter system for external view definitions:
    - **`types.ts`** — `ViewAdapter` / `ViewMap` interfaces.
    - **`define.ts`** — `defineAdapter()` — creates an adapter from programmatic view callbacks.
    - **`json.ts`** — `createJsonAdapter()` — creates an adapter from JSON view definitions with three interpolation sources: `{{key}}` from params, `{{$path}}` from globals (dot-path access), and custom `resolve(key, globals)` callback (e.g. for i18n: `{{t:hello}}`). Supports `text`, `reply_markup` (mirrors Telegram Bot API: `{ inline_keyboard }`, `{ keyboard, resize_keyboard, ... }`, `{ remove_keyboard }`, `{ force_reply }`), and `media` (single or array for media groups). Interpolation works in all string fields.
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

## Testing & Types

**Type safety in tests is critical** — tests serve as both documentation and verification of API contracts. Avoid `any` wherever possible:

✅ **Always type:**
- Globals: `type Globals = { locale: string }` instead of `{}`
- ViewMap: `type ViewMap = { welcome: void; greet: { name: string } }` instead of `any`
- Params: `[{ name: "Alice" }]` instead of `[...] as any`

⚠️ **Acceptable `any` usage (comment required):**
- **Mock contexts** — partial Telegram context implementations for testing
  ```ts
  } as any; // Mock context - only minimal fields needed for testing
  ```
- **Private field access** — unit tests checking internal state
  ```ts
  (res as any).response // Testing private ResponseView.response field
  ```
- **Complex generic scenarios** — where inference would require excessive type annotations, use `as any` with a comment explaining why

## Publishing

Dual-publish to npm and JSR via `.github/workflows/publish.yml` (manual dispatch). The `scripts/prepare-jsr.ts` script syncs the version to `deno.json` before JSR publish.
