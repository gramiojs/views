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

## JSON Adapter

Define views as JSON — useful for CMS-driven or user-editable templates.

```ts
import { initViewsBuilder, createJsonAdapter } from "@gramio/views";

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
import { loadJsonViews, createJsonAdapter } from "@gramio/views";

const views = await loadJsonViews("./views.json");
const adapter = createJsonAdapter({ views });
```

**Directory** — each `.json` file is one view, subdirectories become dot-separated keys:

```
views/
  welcome.json          → "welcome"
  goods/
    list.json           → "goods.list"
    items/
      detail.json       → "goods.items.detail"
```

```ts
import { loadJsonViewsDir, createJsonAdapter } from "@gramio/views";

const views = await loadJsonViewsDir("./views");
const adapter = createJsonAdapter({ views });
// render("goods.items.detail", params)
```
