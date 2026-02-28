import { describe, expect, it } from "bun:test";
import { Bot, InlineKeyboard } from "gramio";
import { TelegramTestEnvironment } from "@gramio/test";

/**
 * @gramio/test types call.params as `unknown` — cast to any for assertions.
 */
// biome-ignore lint/suspicious/noExplicitAny: test assertion helper
function p(call: { params: unknown } | undefined): any {
	return call?.params;
}

/**
 * @gramio/test stores params before gramio serializes them, so InlineKeyboard
 * instances are stored as-is (with .toJSON()). Serialize before asserting.
 */
function kb(markup: unknown) {
	if (markup && typeof (markup as any).toJSON === "function") {
		return (markup as any).toJSON() as { inline_keyboard: { text: string; callback_data?: string }[][] };
	}
	return markup as { inline_keyboard: { text: string; callback_data?: string }[][] };
}

/** Minimal mock for sendMediaGroup — gramio expects an array response */
const MEDIA_GROUP_MOCK = [
	{ message_id: 1, date: 0, chat: { id: 0, type: "private" } },
	{ message_id: 2, date: 0, chat: { id: 0, type: "private" } },
];
import { createJsonAdapter } from "../src/adapters/json.ts";
import { initViewsBuilder } from "../src/index.ts";

// ─── Shared views ──────────────────────────────────────────────────────────────

type Globals = { appName: string };

const defineView = initViewsBuilder<Globals>();

const textView = defineView().render(function (name: string) {
	return this.response.text(`Hello, ${name}! App: ${this.appName}`);
});

const textWithKeyboardView = defineView().render(function () {
	return this.response
		.text("Pick one")
		.keyboard(new InlineKeyboard().text("Option A", "a").text("Option B", "b"));
});

const photoView = defineView().render(function () {
	return this.response
		.media({ type: "photo", media: "photo_file_id" })
		.text("Here's a photo")
		.keyboard(new InlineKeyboard().text("Like", "like"));
});

const stickerWithKeyboardView = defineView().render(function () {
	return this.response
		.media({ type: "sticker", media: "sticker_file_id" })
		.keyboard(new InlineKeyboard().text("Cool!", "cool"));
});

const voiceWithCaptionView = defineView().render(function () {
	return this.response
		.media({ type: "voice", media: "voice_file_id" })
		.text("Transcript here")
		.keyboard(new InlineKeyboard().text("Play", "play"));
});

const mediaGroupView = defineView().render(function () {
	return this.response
		.media([
			{ type: "photo" as const, media: "photo_1" },
			{ type: "photo" as const, media: "photo_2" },
		])
		.text("Your album");
});

// ─── Bot factory ───────────────────────────────────────────────────────────────

function createTestBot() {
	const globals: Globals = { appName: "TestApp" };

	const bot = new Bot("test")
		.derive(["message", "callback_query"], (ctx) => ({
			render: defineView.buildRender(ctx, globals),
		}));

	return bot;
}

// ──────────────────────────────────────────────────────────────────────────────
// Text views
// ──────────────────────────────────────────────────────────────────────────────

describe("text view", () => {
	it("sends text message on message context", async () => {
		const bot = createTestBot().on("message", (ctx) => ctx.render(textView, "Alice"));
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();

		await user.sendMessage("hi");

		const call = env.lastApiCall("sendMessage");
		expect(p(call).text).toBe("Hello, Alice! App: TestApp");
	});

	it("edits text on callback_query context", async () => {
		const bot = createTestBot().on("callback_query", (ctx) => ctx.render(textView, "Bob"));
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();
		const msg = await user.sendMessage("trigger");

		await user.click("any", msg);

		const call = env.lastApiCall("editMessageText");
		expect(p(call).text).toBe("Hello, Bob! App: TestApp");
	});

	it("sends with inline keyboard", async () => {
		const bot = createTestBot().on("message", (ctx) => ctx.render(textWithKeyboardView));
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();

		await user.sendMessage("hi");

		const call = env.lastApiCall("sendMessage");
		expect(p(call).text).toBe("Pick one");
		expect(kb(p(call).reply_markup).inline_keyboard[0][0].text).toBe("Option A");
		expect(kb(p(call).reply_markup).inline_keyboard[0][1].text).toBe("Option B");
	});

	it("render.send() forces send even in callback_query", async () => {
		const bot = createTestBot().on("callback_query", (ctx) => ctx.render.send(textView, "Charlie"));
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();
		const msg = await user.sendMessage("trigger");

		await user.click("any", msg);

		expect(p(env.lastApiCall("sendMessage")).text).toBe("Hello, Charlie! App: TestApp");
		expect(env.lastApiCall("editMessageText")).toBeUndefined();
	});

	it("render.edit() forces edit in callback_query", async () => {
		const bot = createTestBot().on("callback_query", (ctx) => ctx.render.edit(textView, "Dana"));
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();
		const msg = await user.sendMessage("trigger");

		await user.click("any", msg);

		expect(p(env.lastApiCall("editMessageText")).text).toBe("Hello, Dana! App: TestApp");
	});

	it("answers callback_query after render", async () => {
		const bot = createTestBot().on("callback_query", (ctx) => ctx.render(textView, "Eve"));
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();
		const msg = await user.sendMessage("trigger");

		await user.click("any", msg);

		expect(env.lastApiCall("answerCallbackQuery")).toBeDefined();
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// Media views (photo / video / etc — editable via editMessageMedia)
// ──────────────────────────────────────────────────────────────────────────────

describe("media view (photo)", () => {
	it("sends photo on message context", async () => {
		const bot = createTestBot().on("message", (ctx) => ctx.render(photoView));
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();

		await user.sendMessage("hi");

		const call = env.lastApiCall("sendPhoto");
		expect(p(call).photo).toBe("photo_file_id");
		expect(p(call).caption).toBe("Here's a photo");
	});

	it("edits media on callback_query context", async () => {
		const bot = createTestBot().on("callback_query", (ctx) => ctx.render(photoView));
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();
		const msg = await user.sendMessage("trigger");

		await user.click("any", msg);

		const call = env.lastApiCall("editMessageMedia");
		expect(p(call).media.type).toBe("photo");
		expect(p(call).media.media).toBe("photo_file_id");
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// Non-editable media: sticker
// ──────────────────────────────────────────────────────────────────────────────

describe("sticker view", () => {
	it("sends sticker on message context", async () => {
		const bot = createTestBot().on("message", (ctx) => ctx.render(stickerWithKeyboardView));
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();

		await user.sendMessage("hi");

		const call = env.lastApiCall("sendSticker");
		expect(p(call).sticker).toBe("sticker_file_id");
	});

	it("edits only reply markup on callback_query (editMessageReplyMarkup)", async () => {
		const bot = createTestBot().on("callback_query", (ctx) => ctx.render(stickerWithKeyboardView));
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();
		const msg = await user.sendMessage("trigger");

		await user.click("any", msg);

		expect(env.lastApiCall("editMessageReplyMarkup")).toBeDefined();
		expect(env.lastApiCall("editMessageMedia")).toBeUndefined();
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// Non-editable media: voice (supports caption editing)
// ──────────────────────────────────────────────────────────────────────────────

describe("voice view", () => {
	it("sends voice with caption on message context", async () => {
		const bot = createTestBot().on("message", (ctx) => ctx.render(voiceWithCaptionView));
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();

		await user.sendMessage("hi");

		const call = env.lastApiCall("sendVoice");
		expect(p(call).voice).toBe("voice_file_id");
		expect(p(call).caption).toBe("Transcript here");
	});

	it("edits caption on callback_query (editMessageCaption)", async () => {
		const bot = createTestBot().on("callback_query", (ctx) => ctx.render(voiceWithCaptionView));
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();
		const msg = await user.sendMessage("trigger");

		await user.click("any", msg);

		const call = env.lastApiCall("editMessageCaption");
		expect(p(call).caption).toBe("Transcript here");
		expect(env.lastApiCall("editMessageMedia")).toBeUndefined();
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// Media group
// ──────────────────────────────────────────────────────────────────────────────

describe("media group view", () => {
	it("sends media group on message context", async () => {
		const bot = createTestBot().on("message", (ctx) => ctx.render(mediaGroupView));
		const env = new TelegramTestEnvironment(bot);
		// sendMediaGroup Telegram API returns Message[] — mock it so gramio doesn't throw
		env.onApi("sendMediaGroup", MEDIA_GROUP_MOCK as any);
		const user = env.createUser();

		await user.sendMessage("hi");

		const call = env.lastApiCall("sendMediaGroup");
		expect(p(call).media).toHaveLength(2);
		expect(p(call).media[1].caption).toBe("Your album");
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// JSON adapter
// ──────────────────────────────────────────────────────────────────────────────

describe("JSON adapter", () => {
	type JsonViewMap = {
		welcome: { name: string };
		goodbye: void;
	};

	const adapter = createJsonAdapter<Globals, JsonViewMap>({
		views: {
			welcome: { text: "Welcome, {{name}}! Powered by {{$appName}}." },
			goodbye: { text: "Goodbye!" },
		},
	});

	const defineWithAdapter = initViewsBuilder<Globals>().from(adapter);

	it("renders string-keyed view with params and globals interpolation", async () => {
		const bot = new Bot("test")
			.derive(["message"], (ctx) => ({
				render: defineWithAdapter.buildRender(ctx, { appName: "TestApp" }),
			}))
			.on("message", (ctx) => ctx.render("welcome", { name: "Alice" }));

		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();

		await user.sendMessage("hi");

		const call = env.lastApiCall("sendMessage");
		expect(p(call).text).toBe("Welcome, Alice! Powered by TestApp.");
	});

	it("renders view with no params", async () => {
		const bot = new Bot("test")
			.derive(["message"], (ctx) => ({
				render: defineWithAdapter.buildRender(ctx, { appName: "TestApp" }),
			}))
			.on("message", (ctx) => ctx.render("goodbye"));

		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();

		await user.sendMessage("hi");

		expect(p(env.lastApiCall("sendMessage")).text).toBe("Goodbye!");
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// Adapter factory (i18n)
// ──────────────────────────────────────────────────────────────────────────────

describe("adapter factory (i18n)", () => {
	type I18nGlobals = { locale: "en" | "ru" };
	type I18nViewMap = { greet: { name: string } };

	const adapters = {
		en: createJsonAdapter<I18nGlobals, I18nViewMap>({
			views: { greet: { text: "Hello, {{name}}!" } },
		}),
		ru: createJsonAdapter<I18nGlobals, I18nViewMap>({
			views: { greet: { text: "Привет, {{name}}!" } },
		}),
	};

	const defineI18n = initViewsBuilder<I18nGlobals>().from(
		(globals) => adapters[globals.locale],
	);

	it("selects correct adapter based on locale", async () => {
		const bot = new Bot("test")
			.derive(["message"], (ctx) => ({
				render: defineI18n.buildRender(ctx, { locale: "ru" }),
			}))
			.on("message", (ctx) => ctx.render("greet", { name: "Алиса" }));

		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();

		await user.sendMessage("hi");

		expect(p(env.lastApiCall("sendMessage")).text).toBe("Привет, Алиса!");
	});
});
