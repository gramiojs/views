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

### Keyboards and media

JSON views support inline keyboards (with `{{key}}` interpolation in button text, callback_data, and url) and media (single or group):

```json
{
    "welcome": {
        "text": "Hello, {{name}}!",
        "keyboard": [
            [
                { "text": "Profile {{name}}", "callback_data": "profile_{{id}}" },
                { "text": "Help", "callback_data": "help" }
            ],
            [
                { "text": "Visit", "url": "https://example.com/{{id}}" }
            ]
        ],
        "media": {
            "type": "photo",
            "media": "{{photoUrl}}"
        }
    }
}
```

Media groups use an array:

```json
{
    "gallery": {
        "text": "My photos",
        "media": [
            { "type": "photo", "media": "{{photo1}}" },
            { "type": "photo", "media": "{{photo2}}" }
        ]
    }
}
```

The `keyboard` field maps to `{ inline_keyboard: [...] }` automatically. Supported media types: `photo`, `video`, `animation`, `audio`, `document`.

### Reply keyboards

JSON views also support reply keyboards via the `reply_keyboard` field:

```json
{
    "menu": {
        "text": "Choose an option:",
        "reply_keyboard": [
            [{ "text": "Help" }, { "text": "Settings" }],
            [{ "text": "Share Contact", "request_contact": true }]
        ],
        "resize_keyboard": true,
        "one_time_keyboard": true
    }
}
```

Available options:

| Field                       | Type      | Description                              |
| --------------------------- | --------- | ---------------------------------------- |
| `reply_keyboard`            | `array[]` | Rows of reply keyboard buttons           |
| `resize_keyboard`           | `boolean` | Shrink keyboard to fit buttons           |
| `one_time_keyboard`         | `boolean` | Hide keyboard after a button is pressed  |
| `is_persistent`             | `boolean` | Keep keyboard visible at all times       |
| `input_field_placeholder`   | `string`  | Placeholder text (supports `{{key}}`)    |
| `selective`                 | `boolean` | Show keyboard to specific users only     |

Each button supports `text` (with `{{key}}` interpolation), `request_contact`, and `request_location`.

> **Note:** A view cannot have both `keyboard` (inline) and `reply_keyboard` at the same time — an error is thrown if both are set. Reply keyboards are silently ignored when editing messages (Telegram API limitation).

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
