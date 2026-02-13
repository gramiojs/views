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

		expect(() => (adapter as any).resolve("unknown")).toThrow(
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
		await view.renderWithContext(ctx as any, {}, [{ name: "World" }] as any);

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
		await view.renderWithContext(ctx as any, {}, [{ name: "Bob" }] as any);

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
		await view.renderWithContext(ctx as any, {}, [] as any);

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
		await view.renderWithContext(ctx as any, {}, [] as any);

		// No send methods should be called since there is no text/media
		expect(ctx.send).not.toHaveBeenCalled();
		expect(ctx.sendMedia).not.toHaveBeenCalled();
		expect(ctx.sendMediaGroup).not.toHaveBeenCalled();
	});

	test("renders keyboard as inline_keyboard", async () => {
		const adapter = createJsonAdapter({
			views: {
				menu: {
					text: "Choose:",
					keyboard: [
						[
							{ text: "Option A", callback_data: "a" },
							{ text: "Option B", callback_data: "b" },
						],
					],
				},
			},
		});

		const view = adapter.resolve("menu");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as any, {}, [] as any);

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

	test("interpolates keyboard button text and callback_data", async () => {
		const adapter = createJsonAdapter({
			views: {
				profile: {
					text: "Hi",
					keyboard: [
						[{ text: "Profile {{name}}", callback_data: "profile_{{id}}" }],
					],
				},
			},
		});

		const view = adapter.resolve("profile");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as any, {}, [
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

	test("interpolates keyboard button url", async () => {
		const adapter = createJsonAdapter({
			views: {
				link: {
					text: "Visit",
					keyboard: [
						[{ text: "Go", url: "https://example.com/{{id}}" }],
					],
				},
			},
		});

		const view = adapter.resolve("link");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as any, {}, [{ id: "99" }] as any);

		expect(ctx.send).toHaveBeenCalledWith("Visit", {
			reply_markup: {
				inline_keyboard: [[{ text: "Go", url: "https://example.com/99" }]],
			},
		});
	});

	test("keyboard without params passes through as-is", async () => {
		const adapter = createJsonAdapter({
			views: {
				static: {
					text: "Menu",
					keyboard: [[{ text: "Help", callback_data: "help" }]],
				},
			},
		});

		const view = adapter.resolve("static");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as any, {}, [] as any);

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
		await view.renderWithContext(ctx as any, {}, [] as any);

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
		await view.renderWithContext(ctx as any, {}, [
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
		await view.renderWithContext(ctx as any, {}, [] as any);

		expect(ctx.sendMediaGroup).toHaveBeenCalledWith([
			{ type: "photo", media: "https://example.com/1.jpg" },
			{
				type: "photo",
				media: "https://example.com/2.jpg",
				caption: "My photos",
			},
		]);
	});

	test("combined text + keyboard + media", async () => {
		const adapter = createJsonAdapter({
			views: {
				full: {
					text: "Hello {{name}}",
					keyboard: [[{ text: "Click", callback_data: "click_{{id}}" }]],
					media: { type: "photo", media: "{{url}}" },
				},
			},
		});

		const view = adapter.resolve("full");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as any, {}, [
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

	test("view with only keyboard (no text, no media)", async () => {
		const adapter = createJsonAdapter({
			views: {
				buttons: {
					keyboard: [[{ text: "Go", callback_data: "go" }]],
				},
			},
		});

		const view = adapter.resolve("buttons");
		const ctx = createMessageContext();
		await view.renderWithContext(ctx as any, {}, [] as any);

		// No text and no media means no send/sendMedia/sendMediaGroup
		expect(ctx.send).not.toHaveBeenCalled();
		expect(ctx.sendMedia).not.toHaveBeenCalled();
		expect(ctx.sendMediaGroup).not.toHaveBeenCalled();
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
