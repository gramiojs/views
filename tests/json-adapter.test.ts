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
});

function createMessageContext() {
	return {
		is: (type: string) => type === "message",
		send: mock(() => Promise.resolve()),
		sendMedia: mock(() => Promise.resolve()),
		sendMediaGroup: mock(() => Promise.resolve()),
	};
}
