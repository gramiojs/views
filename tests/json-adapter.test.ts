import type { Context } from "gramio";
import { describe, expect, mock, test } from "bun:test";
import { createJsonAdapter } from "../src/adapters/json.ts";
import { ViewRender } from "../src/render.ts";

describe("createJsonAdapter", () => {
	test("resolve() returns ViewRender for a known key", () => {
		const adapter = createJsonAdapter({
			views: {
				welcome: { text: "Hello!" },
			},
		});

		const view = adapter.resolve("welcome");
		expect(view).toBeInstanceOf(ViewRender);
	});

	test("resolve() throws for unknown key", () => {
		const adapter = createJsonAdapter({
			views: {
				welcome: { text: "Hello!" },
			},
		});

		expect(() => (adapter as { resolve: (key: string) => void }).resolve("unknown")).toThrow(
			'View "unknown" not found in JSON adapter',
		);
	});

	test("keys() returns all view keys", () => {
		const adapter = createJsonAdapter({
			views: {
				welcome: { text: "Hello!" },
				goodbye: { text: "Bye!" },
			},
		});

		const keys = adapter.keys!();
		expect(keys).toContain("welcome");
		expect(keys).toContain("goodbye");
		expect(keys).toHaveLength(2);
	});

	test("renders text with interpolation", async () => {
		const adapter = createJsonAdapter({
			views: {
				greet: { text: "Hello, {{name}}!" },
			},
		});

		const view = adapter.resolve("greet");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, [{ name: "World" }]);

		expect(ctx.send).toHaveBeenCalledWith("Hello, World!", {
			reply_markup: undefined,
		});
	});

	test("preserves template placeholders when params missing", async () => {
		const adapter = createJsonAdapter({
			views: {
				greet: { text: "Hello, {{name}}! Age: {{age}}" },
			},
		});

		const view = adapter.resolve("greet");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, [{ name: "Bob" }]);

		expect(ctx.send).toHaveBeenCalledWith("Hello, Bob! Age: {{age}}", {
			reply_markup: undefined,
		});
	});

	test("renders without params for void views", async () => {
		const adapter = createJsonAdapter({
			views: {
				static: { text: "Static text" },
			},
		});

		const view = adapter.resolve("static");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, []);

		expect(ctx.send).toHaveBeenCalledWith("Static text", {
			reply_markup: undefined,
		});
	});

	test("handles view with no text", async () => {
		const adapter = createJsonAdapter({
			views: {
				empty: {},
			},
		});

		const view = adapter.resolve("empty");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, []);

		// No send methods should be called since there is no text/media
		expect(ctx.send).not.toHaveBeenCalled();
		expect(ctx.sendMedia).not.toHaveBeenCalled();
		expect(ctx.sendMediaGroup).not.toHaveBeenCalled();
	});

	test("renders inline_keyboard via reply_markup", async () => {
		const adapter = createJsonAdapter({
			views: {
				menu: {
					text: "Choose:",
					reply_markup: {
						inline_keyboard: [
							[
								{ text: "Option A", callback_data: "a" },
								{ text: "Option B", callback_data: "b" },
							],
						],
					},
				},
			},
		});

		const view = adapter.resolve("menu");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, []);

		expect(ctx.send).toHaveBeenCalledWith("Choose:", {
			reply_markup: {
				inline_keyboard: [
					[
						{ text: "Option A", callback_data: "a" },
						{ text: "Option B", callback_data: "b" },
					],
				],
			},
		});
	});

	test("interpolates inline keyboard button text and callback_data", async () => {
		const adapter = createJsonAdapter({
			views: {
				profile: {
					text: "Hi",
					reply_markup: {
						inline_keyboard: [
							[
								{
									text: "Profile {{name}}",
									callback_data: "profile_{{id}}",
								},
							],
						],
					},
				},
			},
		});

		const view = adapter.resolve("profile");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, [
			{ name: "Alice", id: "42" },
		] as any);

		expect(ctx.send).toHaveBeenCalledWith("Hi", {
			reply_markup: {
				inline_keyboard: [
					[{ text: "Profile Alice", callback_data: "profile_42" }],
				],
			},
		});
	});

	test("interpolates inline keyboard button url", async () => {
		const adapter = createJsonAdapter({
			views: {
				link: {
					text: "Visit",
					reply_markup: {
						inline_keyboard: [
							[{ text: "Go", url: "https://example.com/{{id}}" }],
						],
					},
				},
			},
		});

		const view = adapter.resolve("link");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, [{ id: "99" }]);

		expect(ctx.send).toHaveBeenCalledWith("Visit", {
			reply_markup: {
				inline_keyboard: [[{ text: "Go", url: "https://example.com/99" }]],
			},
		});
	});

	test("inline keyboard without params passes through as-is", async () => {
		const adapter = createJsonAdapter({
			views: {
				static: {
					text: "Menu",
					reply_markup: {
						inline_keyboard: [[{ text: "Help", callback_data: "help" }]],
					},
				},
			},
		});

		const view = adapter.resolve("static");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, []);

		expect(ctx.send).toHaveBeenCalledWith("Menu", {
			reply_markup: {
				inline_keyboard: [[{ text: "Help", callback_data: "help" }]],
			},
		});
	});

	test("renders single media", async () => {
		const adapter = createJsonAdapter({
			views: {
				photo: {
					text: "A photo",
					media: { type: "photo", media: "https://example.com/img.jpg" },
				},
			},
		});

		const view = adapter.resolve("photo");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, []);

		expect(ctx.sendMedia).toHaveBeenCalledWith({
			type: "photo",
			photo: "https://example.com/img.jpg",
			caption: "A photo",
			reply_markup: undefined,
		});
	});

	test("interpolates single media url", async () => {
		const adapter = createJsonAdapter({
			views: {
				photo: {
					media: { type: "photo", media: "{{photoUrl}}" },
				},
			},
		});

		const view = adapter.resolve("photo");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, [
			{ photoUrl: "https://example.com/cat.jpg" },
		] as any);

		expect(ctx.sendMedia).toHaveBeenCalledWith({
			type: "photo",
			photo: "https://example.com/cat.jpg",
			caption: undefined,
			reply_markup: undefined,
		});
	});

	test("renders media group", async () => {
		const adapter = createJsonAdapter({
			views: {
				gallery: {
					text: "My photos",
					media: [
						{ type: "photo", media: "https://example.com/1.jpg" },
						{ type: "photo", media: "https://example.com/2.jpg" },
					],
				},
			},
		});

		const view = adapter.resolve("gallery");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, []);

		expect(ctx.sendMediaGroup).toHaveBeenCalledWith([
			{ type: "photo", media: "https://example.com/1.jpg" },
			{
				type: "photo",
				media: "https://example.com/2.jpg",
				caption: "My photos",
			},
		]);
	});

	test("combined text + inline keyboard + media", async () => {
		const adapter = createJsonAdapter({
			views: {
				full: {
					text: "Hello {{name}}",
					reply_markup: {
						inline_keyboard: [
							[{ text: "Click", callback_data: "click_{{id}}" }],
						],
					},
					media: { type: "photo", media: "{{url}}" },
				},
			},
		});

		const view = adapter.resolve("full");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, [
			{ name: "Bob", id: "7", url: "https://example.com/bob.jpg" },
		] as any);

		expect(ctx.sendMedia).toHaveBeenCalledWith({
			type: "photo",
			photo: "https://example.com/bob.jpg",
			caption: "Hello Bob",
			reply_markup: {
				inline_keyboard: [[{ text: "Click", callback_data: "click_7" }]],
			},
		});
	});

	test("view with only reply_markup (no text, no media)", async () => {
		const adapter = createJsonAdapter({
			views: {
				buttons: {
					reply_markup: {
						inline_keyboard: [[{ text: "Go", callback_data: "go" }]],
					},
				},
			},
		});

		const view = adapter.resolve("buttons");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, []);

		// No text and no media means no send/sendMedia/sendMediaGroup
		expect(ctx.send).not.toHaveBeenCalled();
		expect(ctx.sendMedia).not.toHaveBeenCalled();
		expect(ctx.sendMediaGroup).not.toHaveBeenCalled();
	});

	test("renders reply keyboard via reply_markup", async () => {
		const adapter = createJsonAdapter({
			views: {
				menu: {
					text: "Pick one:",
					reply_markup: {
						keyboard: [[{ text: "Option A" }, { text: "Option B" }]],
					},
				},
			},
		});

		const view = adapter.resolve("menu");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, []);

		expect(ctx.send).toHaveBeenCalledWith("Pick one:", {
			reply_markup: {
				keyboard: [[{ text: "Option A" }, { text: "Option B" }]],
			},
		});
	});

	test("renders reply keyboard with all options", async () => {
		const adapter = createJsonAdapter({
			views: {
				menu: {
					text: "Pick:",
					reply_markup: {
						keyboard: [[{ text: "Go" }]],
						resize_keyboard: true,
						one_time_keyboard: true,
						is_persistent: true,
						input_field_placeholder: "Choose...",
						selective: true,
					},
				},
			},
		});

		const view = adapter.resolve("menu");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, []);

		expect(ctx.send).toHaveBeenCalledWith("Pick:", {
			reply_markup: {
				keyboard: [[{ text: "Go" }]],
				resize_keyboard: true,
				one_time_keyboard: true,
				is_persistent: true,
				input_field_placeholder: "Choose...",
				selective: true,
			},
		});
	});

	test("interpolates reply keyboard button text", async () => {
		const adapter = createJsonAdapter({
			views: {
				greet: {
					text: "Hi",
					reply_markup: {
						keyboard: [[{ text: "Hello {{name}}" }]],
					},
				},
			},
		});

		const view = adapter.resolve("greet");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, [{ name: "Alice" }]);

		expect(ctx.send).toHaveBeenCalledWith("Hi", {
			reply_markup: {
				keyboard: [[{ text: "Hello Alice" }]],
			},
		});
	});

	test("interpolates input_field_placeholder", async () => {
		const adapter = createJsonAdapter({
			views: {
				search: {
					text: "Search",
					reply_markup: {
						keyboard: [[{ text: "Go" }]],
						input_field_placeholder: "Search for {{thing}}...",
					},
				},
			},
		});

		const view = adapter.resolve("search");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, [
			{ thing: "products" },
		] as any);

		expect(ctx.send).toHaveBeenCalledWith("Search", {
			reply_markup: {
				keyboard: [[{ text: "Go" }]],
				input_field_placeholder: "Search for products...",
			},
		});
	});

	test("passes through request_contact and request_location", async () => {
		const adapter = createJsonAdapter({
			views: {
				contact: {
					text: "Share info",
					reply_markup: {
						keyboard: [
							[
								{ text: "Share Contact", request_contact: true },
								{ text: "Share Location", request_location: true },
							],
						],
					},
				},
			},
		});

		const view = adapter.resolve("contact");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, []);

		expect(ctx.send).toHaveBeenCalledWith("Share info", {
			reply_markup: {
				keyboard: [
					[
						{ text: "Share Contact", request_contact: true },
						{ text: "Share Location", request_location: true },
					],
				],
			},
		});
	});

	test("reply keyboard without params passes through as-is", async () => {
		const adapter = createJsonAdapter({
			views: {
				static: {
					text: "Menu",
					reply_markup: {
						keyboard: [[{ text: "Help" }, { text: "Settings" }]],
					},
				},
			},
		});

		const view = adapter.resolve("static");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, []);

		expect(ctx.send).toHaveBeenCalledWith("Menu", {
			reply_markup: {
				keyboard: [[{ text: "Help" }, { text: "Settings" }]],
			},
		});
	});

	test("renders remove_keyboard via reply_markup", async () => {
		const adapter = createJsonAdapter({
			views: {
				clear: {
					text: "Keyboard removed",
					reply_markup: { remove_keyboard: true },
				},
			},
		});

		const view = adapter.resolve("clear");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, []);

		expect(ctx.send).toHaveBeenCalledWith("Keyboard removed", {
			reply_markup: { remove_keyboard: true },
		});
	});

	test("renders force_reply via reply_markup", async () => {
		const adapter = createJsonAdapter({
			views: {
				ask: {
					text: "What is your name?",
					reply_markup: {
						force_reply: true,
						input_field_placeholder: "Enter name...",
					},
				},
			},
		});

		const view = adapter.resolve("ask");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, []);

		expect(ctx.send).toHaveBeenCalledWith("What is your name?", {
			reply_markup: {
				force_reply: true,
				input_field_placeholder: "Enter name...",
			},
		});
	});

	test("interpolates force_reply input_field_placeholder", async () => {
		const adapter = createJsonAdapter({
			views: {
				ask: {
					text: "Answer:",
					reply_markup: {
						force_reply: true,
						input_field_placeholder: "Type {{what}}...",
					},
				},
			},
		});

		const view = adapter.resolve("ask");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, [
			{ what: "your age" },
		] as any);

		expect(ctx.send).toHaveBeenCalledWith("Answer:", {
			reply_markup: {
				force_reply: true,
				input_field_placeholder: "Type your age...",
			},
		});
	});
});

describe("globals access via $", () => {
	test("{{$key}} resolves from globals", async () => {
		const adapter = createJsonAdapter<{ appName: string }, { about: void }>({
			views: {
				about: { text: "Welcome to {{$appName}}!" },
			},
		});

		const view = adapter.resolve("about");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, { appName: "MyBot" }, []);

		expect(ctx.send).toHaveBeenCalledWith("Welcome to MyBot!", {
			reply_markup: undefined,
		});
	});

	test("{{$nested.path}} resolves deep globals", async () => {
		const adapter = createJsonAdapter<
			{ user: { name: string; age: number } },
			any
		>({
			views: {
				profile: { text: "{{$user.name}} is {{$user.age}} years old" },
			},
		});

		const view = adapter.resolve("profile");
		const ctx = createMessageContext();
		await view.renderWithContext(
			ctx as unknown as Context,
			{ user: { name: "Alice", age: 25 } },
			[],
		);

		expect(ctx.send).toHaveBeenCalledWith("Alice is 25 years old", {
			reply_markup: undefined,
		});
	});

	test("{{$unknown}} preserved as-is", async () => {
		const adapter = createJsonAdapter({
			views: {
				test: { text: "Value: {{$missing}}" },
			},
		});

		const view = adapter.resolve("test");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, []);

		expect(ctx.send).toHaveBeenCalledWith("Value: {{$missing}}", {
			reply_markup: undefined,
		});
	});

	test("$ and params combined in same template", async () => {
		const adapter = createJsonAdapter<{ botName: string }, { greet: { name: string } }>({
			views: {
				greet: { text: "{{$botName}} says hello to {{name}}!" },
			},
		});

		const view = adapter.resolve("greet");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, { botName: "Bot" }, [
			{ name: "Bob" },
		] as any);

		expect(ctx.send).toHaveBeenCalledWith("Bot says hello to Bob!", {
			reply_markup: undefined,
		});
	});

	test("$ works in inline keyboard buttons", async () => {
		const adapter = createJsonAdapter<{ prefix: string }, { menu: { label: string } }>({
			views: {
				menu: {
					text: "Menu",
					reply_markup: {
						inline_keyboard: [
							[{ text: "{{$prefix}}: {{label}}", callback_data: "go" }],
						],
					},
				},
			},
		});

		const view = adapter.resolve("menu");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, { prefix: "CMD" }, [
			{ label: "Start" },
		] as any);

		expect(ctx.send).toHaveBeenCalledWith("Menu", {
			reply_markup: {
				inline_keyboard: [
					[{ text: "CMD: Start", callback_data: "go" }],
				],
			},
		});
	});

	test("$ works in media url", async () => {
		const adapter = createJsonAdapter<{ cdnUrl: string }, { photo: { file: string } }>({
			views: {
				photo: {
					media: { type: "photo", media: "{{$cdnUrl}}/{{file}}" },
				},
			},
		});

		const view = adapter.resolve("photo");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, { cdnUrl: "https://cdn.example.com" }, [
			{ file: "cat.jpg" },
		] as any);

		expect(ctx.sendMedia).toHaveBeenCalledWith({
			type: "photo",
			photo: "https://cdn.example.com/cat.jpg",
			caption: undefined,
			reply_markup: undefined,
		});
	});

	test("$ works for void views (no params)", async () => {
		const adapter = createJsonAdapter<{ version: string }, { info: void }>({
			views: {
				info: { text: "Version: {{$version}}" },
			},
		});

		const view = adapter.resolve("info");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, { version: "1.2.3" }, []);

		expect(ctx.send).toHaveBeenCalledWith("Version: 1.2.3", {
			reply_markup: undefined,
		});
	});
});

describe("resolve callback", () => {
	test("resolve handles custom keys", async () => {
		const translations: Record<string, string> = {
			welcome: "Добро пожаловать",
			goodbye: "До свидания",
		};

		const adapter = createJsonAdapter<object, { [key: string]: void | object }>({
			views: {
				greet: { text: "{{t:welcome}}, {{name}}!" },
			},
			resolve: (key) => {
				if (key.startsWith("t:")) return translations[key.slice(2)];
			},
		});

		const view = adapter.resolve("greet");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, [{ name: "Alice" }]);

		expect(ctx.send).toHaveBeenCalledWith("Добро пожаловать, Alice!", {
			reply_markup: undefined,
		});
	});

	test("resolve returning undefined falls through to params", async () => {
		const adapter = createJsonAdapter<object, { [key: string]: void | object }>({
			views: {
				test: { text: "{{custom}} and {{name}}" },
			},
			resolve: (key) => {
				if (key === "custom") return "RESOLVED";
			},
		});

		const view = adapter.resolve("test");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, [{ name: "Bob" }]);

		expect(ctx.send).toHaveBeenCalledWith("RESOLVED and Bob", {
			reply_markup: undefined,
		});
	});

	test("resolve receives globals", async () => {
		const adapter = createJsonAdapter<
			{ t: (key: string) => string },
			any
		>({
			views: {
				greet: { text: "{{t:hello}}" },
			},
			resolve: (key, globals) => {
				if (key.startsWith("t:")) return globals.t(key.slice(2));
			},
		});

		const view = adapter.resolve("greet");
		const ctx = createMessageContext();
		const t = (key: string) =>
			({ hello: "Привет", bye: "Пока" })[key] ?? key;
		await view.renderWithContext(ctx as unknown as Context, { t }, []);

		expect(ctx.send).toHaveBeenCalledWith("Привет", {
			reply_markup: undefined,
		});
	});

	test("combined $, resolve, and params", async () => {
		const adapter = createJsonAdapter<{ brand: string }, { full: { subtitle: string } }>({
			views: {
				full: { text: "{{$brand}}: {{t:title}} — {{subtitle}}" },
			},
			resolve: (key) => {
				if (key === "t:title") return "Главная";
			},
		});

		const view = adapter.resolve("full");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, { brand: "GramIO" }, [
			{ subtitle: "страница" },
		] as any);

		expect(ctx.send).toHaveBeenCalledWith("GramIO: Главная — страница", {
			reply_markup: undefined,
		});
	});

	test("resolve works in keyboard buttons", async () => {
		const adapter = createJsonAdapter<object, { [key: string]: void | object }>({
			views: {
				menu: {
					text: "Menu",
					reply_markup: {
						inline_keyboard: [
							[{ text: "{{t:btn_help}}", callback_data: "help" }],
						],
					},
				},
			},
			resolve: (key) => {
				if (key === "t:btn_help") return "Помощь";
			},
		});

		const view = adapter.resolve("menu");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, []);

		expect(ctx.send).toHaveBeenCalledWith("Menu", {
			reply_markup: {
				inline_keyboard: [[{ text: "Помощь", callback_data: "help" }]],
			},
		});
	});

	test("unresolved keys preserved as-is", async () => {
		const adapter = createJsonAdapter<object, { [key: string]: void | object }>({
			views: {
				test: { text: "{{t:missing}} and {{also_missing}}" },
			},
			resolve: () => undefined,
		});

		const view = adapter.resolve("test");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as unknown as Context, {}, []);

		expect(ctx.send).toHaveBeenCalledWith(
			"{{t:missing}} and {{also_missing}}",
			{ reply_markup: undefined },
		);
	});
});

function createMessageContext() {
	return {
		is: (type: string) => type === "message",
		send: mock(() => Promise.resolve()),
		sendMedia: mock(() => Promise.resolve()),
		sendMediaGroup: mock(() => Promise.resolve()),
	};
}
