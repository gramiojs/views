# @gramio/views

[![npm](https://img.shields.io/npm/v/@gramio/views?logo=npm&style=flat&labelColor=000&color=3b82f6)](https://www.npmjs.org/package/@gramio/views)
[![npm downloads](https://img.shields.io/npm/dw/@gramio/views?logo=npm&style=flat&labelColor=000&color=3b82f6)](https://www.npmjs.org/package/@gramio/views)
[![JSR](https://jsr.io/badges/@gramio/views)](https://jsr.io/@gramio/views)
[![JSR Score](https://jsr.io/badges/@gramio/views/score)](https://jsr.io/@gramio/views)

> This package is a work in progress.
> So it easily can be changed.

# Usage

```ts
import { Bot, InlineKeyboard } from "gramio";
import { initViewsBuilder } from "@gramio/views";

interface Data {
    user: {
        id: number;
        name: string;
        age: number;
    };
    t: (test: "a" | "b", age: number) => string;
}

const defineView = initViewsBuilder<Data>();

const userView = defineView().render(function (test: "a" | "b") {
    return this.response
        .text(this.t(test, this.user.age))
        .keyboard(new InlineKeyboard().text("test", test));
});

const bot = new Bot(process.env.BOT_TOKEN!)
    .derive(["message", "callback_query"], async (context) => {
        const user = {
            id: context.from.id,
            name: context.from.firstName,
            age: 18,
        };

        const t = (test: "a" | "b", age: number) => test + age;

        return {
            render: defineView.buildRender(context, {
                user,
                t,
            }),
        };
    })
    .on("message", async (context) => {
        return context.render(userView, "a");
    })
    .on("callback_query", async (context) => {
        return context.render(userView, context.data === "a" ? "b" : "a");
    });

bot.start();
```

## Media

The `.media()` method on `ResponseView` lets you attach media to a view — either a single item or a group.

```ts
import { InlineKeyboard } from "gramio";
import { initViewsBuilder } from "@gramio/views";

const defineView = initViewsBuilder<{ fileId: string }>();

// Single photo with caption and keyboard
const photoView = defineView().render(function () {
    return this.response
        .media({ type: "photo", media: this.fileId })
        .text("Here is your photo!")
        .keyboard(new InlineKeyboard().text("Like", "like"));
});

// Media group (album)
const albumView = defineView().render(function (ids: string[]) {
    return this.response
        .media(ids.map((id) => ({ type: "photo" as const, media: id })))
        .text("Your album"); // caption goes on the last item
});
```

### Supported media types

| Type | `.media({ type })` | Notes |
|---|---|---|
| `photo` | ✅ | |
| `video` | ✅ | |
| `audio` | ✅ | |
| `document` | ✅ | |
| `animation` | ✅ | GIF |
| `sticker` | ✅ | No caption; on edit: `editReplyMarkup` only |
| `voice` | ✅ | Has caption; on edit: `editCaption` + keyboard |
| `video_note` | ✅ | No caption; on edit: `editReplyMarkup` only |

The `media` field accepts a **`file_id`** string (recommended for already-uploaded files), a **public URL**, or a **`Blob`** for direct file uploads.

### `.text()` becomes `caption` with media

When `.media()` is set, `.text()` is used as the `caption` (up to 1024 characters). Without media, `.text()` sends a regular text message (up to 4096 characters).

### Keyboards with media

- **Single media + send** — both `InlineKeyboard` and `ReplyKeyboard` work.
- **Single media + edit** (`callback_query`) — only `InlineKeyboard` is supported by Telegram. `ReplyKeyboard` is silently ignored.
- **Media group** — keyboards are not supported by Telegram for media groups.

### Edit behavior

When the view is rendered from a `callback_query` (edit strategy):

| Current message | View has | Result |
|---|---|---|
| text | single media | `editMedia` replaces it |
| media | single media | `editMedia` replaces it |
| media | text only | deletes message, sends new text |
| text | text only | `editText` in-place |
| media group | media group | deletes, sends new media group |
| sticker | sticker + keyboard | `editReplyMarkup` (media file unchanged) |
| voice | voice + text | `editCaption` (media file unchanged) |
| voice | voice + keyboard | `editReplyMarkup` (media file unchanged) |
| video_note | video_note + keyboard | `editReplyMarkup` (media file unchanged) |

## Imports

The library uses modular imports to avoid bundling unnecessary dependencies:

```ts
// Main entry - core functionality
import { initViewsBuilder } from "@gramio/views";

// Import adapters separately
import { createJsonAdapter } from "@gramio/views/json";
import { loadJsonViews, loadJsonViewsDir } from "@gramio/views/fs";
import { defineAdapter } from "@gramio/views/define";
```

**Why separate imports?**
- `@gramio/views/fs` includes Node.js filesystem APIs — don't import it in browser/edge environments
- Better tree-shaking and smaller bundles
- Clear separation of concerns

## JSON Adapter

Define views as JSON — useful for CMS-driven or user-editable templates.

```ts
import { initViewsBuilder } from "@gramio/views";
import { createJsonAdapter } from "@gramio/views/json";

const adapter = createJsonAdapter({
    views: {
        welcome: { text: "Hello, {{name}}!" },
        goodbye: { text: "See you later!" },
    },
});

const defineView = initViewsBuilder<Data>().from(adapter);

// Then in a handler:
context.render("welcome", { name: "Alice" });
```

### `reply_markup`, keyboards and media

The `reply_markup` field mirrors the [Telegram Bot API](https://core.telegram.org/bots/api#replykeyboardmarkup) directly. All `{{key}}` interpolation works in button text, callback_data, url, and input_field_placeholder.

**Inline keyboard:**

```json
{
    "welcome": {
        "text": "Hello, {{name}}!",
        "reply_markup": {
            "inline_keyboard": [
                [
                    { "text": "Profile {{name}}", "callback_data": "profile_{{id}}" },
                    { "text": "Help", "callback_data": "help" }
                ],
                [
                    { "text": "Visit", "url": "https://example.com/{{id}}" }
                ]
            ]
        }
    }
}
```

**Reply keyboard:**

```json
{
    "menu": {
        "text": "Choose an option:",
        "reply_markup": {
            "keyboard": [
                [{ "text": "Help" }, { "text": "Settings" }],
                [{ "text": "Share Contact", "request_contact": true }]
            ],
            "resize_keyboard": true,
            "one_time_keyboard": true
        }
    }
}
```

**Remove keyboard / Force reply:**

```json
{ "reply_markup": { "remove_keyboard": true } }
{ "reply_markup": { "force_reply": true, "input_field_placeholder": "Type {{what}}..." } }
```

**Media** (single or group):

```json
{
    "photo_view": {
        "text": "A caption",
        "media": { "type": "photo", "media": "{{photoUrl}}" }
    },
    "gallery": {
        "text": "My photos",
        "media": [
            { "type": "photo", "media": "{{photo1}}" },
            { "type": "photo", "media": "{{photo2}}" }
        ]
    }
}
```

Supported media types: `photo`, `video`, `animation`, `audio`, `document`.

### Globals access with `$`

Use `{{$path}}` to reference globals (the values passed to `buildRender`) directly from JSON templates:

```json
{
    "welcome": { "text": "Welcome to {{$appName}}!" },
    "profile": { "text": "{{$user.name}} (age {{$user.age}})" }
}
```

```ts
// globals passed in .derive():
{ appName: "MyBot", user: { name: "Alice", age: 25 } }
```

Mix `$` globals with regular `{{params}}` freely: `"{{$botName}} says hi to {{name}}"`.

### Custom `resolve` callback

For i18n or any custom interpolation logic, pass a `resolve` function to `createJsonAdapter`. It is called for every `{{key}}` (except `$`-prefixed) before falling back to params:

```ts
const adapter = createJsonAdapter<{ t: (key: string) => string }, ViewMap>({
    views: {
        greet: { text: "{{t:hello}}, {{name}}!" },
    },
    resolve: (key, globals) => {
        if (key.startsWith("t:")) return globals.t(key.slice(2));
    },
});
```

If `resolve` returns `undefined`, the key falls through to params. Unresolved keys are preserved as `{{key}}`.

All three sources work everywhere — text, keyboard buttons, media URLs, placeholders:

```json
{ "text": "{{$brand}}: {{t:title}} — {{subtitle}}" }
```

### i18n with adapter factory

For i18n, write entire JSON templates in each language and pass a **factory function** to `from()`. The factory receives globals and returns the correct adapter per locale:

```
views/
  en/
    welcome.json    → { "text": "Hello, {{name}}!" }
  ru/
    welcome.json    → { "text": "Привет, {{name}}!" }
```

```ts
import { initViewsBuilder } from "@gramio/views";
import { createJsonAdapter } from "@gramio/views/json";
import { loadJsonViewsDir } from "@gramio/views/fs";

const adapters = {
    en: createJsonAdapter({ views: await loadJsonViewsDir("./views/en") }),
    ru: createJsonAdapter({ views: await loadJsonViewsDir("./views/ru") }),
};

const defineView = initViewsBuilder<Data>().from(
    (globals) => adapters[globals.locale]
);

// In .derive(), locale comes from the user context:
.derive(["message", "callback_query"], (context) => ({
    render: defineView.buildRender(context, {
        locale: context.from.languageCode ?? "en",
        ...
    }),
}))

// render stays the same — adapter is selected automatically:
context.render("welcome", { name: "Alice" });
// → "Привет, Alice!" for Russian users
```

### Loading JSON views from the filesystem

**Single file** — one JSON file with multiple views:

```json
// views.json
{
    "welcome": { "text": "Hello, {{name}}!" },
    "goodbye": { "text": "Bye!" }
}
```

```ts
import { createJsonAdapter } from "@gramio/views/json";
import { loadJsonViews } from "@gramio/views/fs";

const views = await loadJsonViews("./views.json");
const adapter = createJsonAdapter({ views });
```

**Directory** — each `.json` file contains multiple named views:

```
views/
  messages.json         → "messages.welcome", "messages.goodbye", "messages.help"
  goods/
    products.json       → "goods.products.list", "goods.products.detail"
```

```json
// messages.json
{
    "welcome": { "text": "Hello, {{name}}!" },
    "goodbye": { "text": "Bye, {{name}}!" },
    "help": { "text": "Need help?" }
}
```

```json
// goods/products.json
{
    "list": { "text": "Product list" },
    "detail": {
        "text": "Product {{name}}",
        "media": { "type": "photo", "media": "{{photo}}" }
    }
}
```

**How it works:**

Each `.json` file must contain an object where:
- **Keys** are view names
- **Values** are view definitions (`{ text?, reply_markup?, media? }`)

The final view key is the file path (dot-separated) + the view name:

```
views/
  main.json             ← { "home": {...}, "about": {...} }
  user/
    profile.json        ← { "view": {...}, "edit": {...} }
```

```ts
import { createJsonAdapter } from "@gramio/views/json";
import { loadJsonViewsDir } from "@gramio/views/fs";

const views = await loadJsonViewsDir("./views");
const adapter = createJsonAdapter({ views });

// Available keys:
// - "main.home"
// - "main.about"
// - "user.profile.view"
// - "user.profile.edit"
```

You can now use **any** key names, including `text`, `reply_markup`, or `media` — they're just view names, not reserved words:

```json
// meta.json
{
    "text": { "text": "A view about text" },
    "media": { "text": "A view about media" }
}
```
