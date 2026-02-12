import { describe, expect, mock, test } from "bun:test";
import { createJsonAdapter } from "../src/adapters/json.ts";
import { initViewsBuilder } from "../src/index.ts";
import { ViewRender } from "../src/render.ts";
import { ViewBuilder } from "../src/view.ts";

function createMessageContext() {
	return {
		is: (type: string) => type === "message",
		send: mock(() => Promise.resolve()),
		sendMedia: mock(() => Promise.resolve()),
		sendMediaGroup: mock(() => Promise.resolve()),
	} as any;
}

function createCallbackQueryContext() {
	return {
		is: (type: string) => type === "callback_query",
		message: {
			delete: mock(() => Promise.resolve()),
			hasAttachment: () => false,
		},
		hasMessage: () => true,
		answer: mock(() => Promise.resolve()),
		send: mock(() => Promise.resolve()),
		editText: mock(() => Promise.resolve()),
		editMedia: mock(() => Promise.resolve()),
		editReplyMarkup: mock(() => Promise.resolve()),
		sendMedia: mock(() => Promise.resolve()),
		sendMediaGroup: mock(() => Promise.resolve()),
	} as any;
}

describe("initViewsBuilder", () => {
	test("calling the builder returns a ViewBuilder", () => {
		const defineView = initViewsBuilder<{}>();
		const builder = defineView();
		expect(builder).toBeInstanceOf(ViewBuilder);
	});

	test("buildRender returns render function", () => {
		const defineView = initViewsBuilder<{}>();
		const ctx = createMessageContext();
		const render = defineView.buildRender(ctx, {});

		expect(typeof render).toBe("function");
		expect(typeof render.send).toBe("function");
		expect(typeof render.edit).toBe("function");
	});

	test("render() dispatches to ViewRender", async () => {
		const defineView = initViewsBuilder<{}>();
		const view = defineView().render(function () {
			return this.response.text("hello world");
		});
		const ctx = createMessageContext();
		const render = defineView.buildRender(ctx, {});

		await render(view);
		expect(ctx.send).toHaveBeenCalledWith("hello world", {
			reply_markup: undefined,
		});
	});

	test("render.send() forces send strategy", async () => {
		const defineView = initViewsBuilder<{}>();
		const view = defineView().render(function () {
			return this.response.text("forced send");
		});
		const ctx = createCallbackQueryContext();
		const render = defineView.buildRender(ctx, {});

		await render.send(view);
		expect(ctx.send).toHaveBeenCalledWith("forced send", {
			reply_markup: undefined,
		});
		expect(ctx.editText).not.toHaveBeenCalled();
	});

	test("render.edit() forces edit strategy on callback_query", async () => {
		const defineView = initViewsBuilder<{}>();
		const view = defineView().render(function () {
			return this.response.text("forced edit");
		});
		const ctx = createCallbackQueryContext();
		const render = defineView.buildRender(ctx, {});

		await render.edit(view);
		expect(ctx.editText).toHaveBeenCalledWith("forced edit", {
			reply_markup: undefined,
		});
	});

	test("render passes args to view callback", async () => {
		const defineView = initViewsBuilder<{}>();
		const view = defineView().render(function (name: string) {
			return this.response.text(`Hi, ${name}!`);
		});
		const ctx = createMessageContext();
		const render = defineView.buildRender(ctx, {});

		await render(view, "Alice");
		expect(ctx.send).toHaveBeenCalledWith("Hi, Alice!", {
			reply_markup: undefined,
		});
	});
});

describe("initViewsBuilder.from() with adapter", () => {
	test("returns builder with adapter attached", () => {
		const defineView = initViewsBuilder<{}>();
		const adapter = createJsonAdapter({
			views: { welcome: { text: "Hello!" } },
		});
		const result = defineView.from(adapter);

		expect(result.adapter).toBe(adapter);
		expect(typeof result.buildRender).toBe("function");
	});

	test("calling from() result returns ViewBuilder", () => {
		const defineView = initViewsBuilder<{}>();
		const adapter = createJsonAdapter({
			views: { welcome: { text: "Hello!" } },
		});
		const withAdapter = defineView.from(adapter);
		const builder = withAdapter();
		expect(builder).toBeInstanceOf(ViewBuilder);
	});

	test("buildRender dispatches string keys to adapter", async () => {
		const defineView = initViewsBuilder<{}>();
		const adapter = createJsonAdapter({
			views: { welcome: { text: "Hello from adapter!" } },
		});
		const withAdapter = defineView.from(adapter);
		const ctx = createMessageContext();
		const render = withAdapter.buildRender(ctx, {});

		await render("welcome" as any);
		expect(ctx.send).toHaveBeenCalledWith("Hello from adapter!", {
			reply_markup: undefined,
		});
	});

	test("buildRender dispatches ViewRender objects directly", async () => {
		const defineView = initViewsBuilder<{}>();
		const adapter = createJsonAdapter({
			views: { welcome: { text: "Hello!" } },
		});
		const withAdapter = defineView.from(adapter);
		const ctx = createMessageContext();
		const render = withAdapter.buildRender(ctx, {});

		const customView = withAdapter().render(function () {
			return this.response.text("Custom view");
		});
		await render(customView);
		expect(ctx.send).toHaveBeenCalledWith("Custom view", {
			reply_markup: undefined,
		});
	});

	test("render.send with string key forces send", async () => {
		const defineView = initViewsBuilder<{}>();
		const adapter = createJsonAdapter({
			views: { msg: { text: "adapter send" } },
		});
		const withAdapter = defineView.from(adapter);
		const ctx = createCallbackQueryContext();
		const render = withAdapter.buildRender(ctx, {});

		await render.send("msg" as any);
		expect(ctx.send).toHaveBeenCalledWith("adapter send", {
			reply_markup: undefined,
		});
	});

	test("render.edit with string key forces edit", async () => {
		const defineView = initViewsBuilder<{}>();
		const adapter = createJsonAdapter({
			views: { msg: { text: "adapter edit" } },
		});
		const withAdapter = defineView.from(adapter);
		const ctx = createCallbackQueryContext();
		const render = withAdapter.buildRender(ctx, {});

		await render.edit("msg" as any);
		expect(ctx.editText).toHaveBeenCalledWith("adapter edit", {
			reply_markup: undefined,
		});
	});

	test("render.send with ViewRender forces send", async () => {
		const defineView = initViewsBuilder<{}>();
		const adapter = createJsonAdapter({ views: {} });
		const withAdapter = defineView.from(adapter);
		const view = withAdapter().render(function () {
			return this.response.text("view send");
		});
		const ctx = createCallbackQueryContext();
		const render = withAdapter.buildRender(ctx, {});

		await render.send(view);
		expect(ctx.send).toHaveBeenCalledWith("view send", {
			reply_markup: undefined,
		});
	});

	test("render.edit with ViewRender forces edit", async () => {
		const defineView = initViewsBuilder<{}>();
		const adapter = createJsonAdapter({ views: {} });
		const withAdapter = defineView.from(adapter);
		const view = withAdapter().render(function () {
			return this.response.text("view edit");
		});
		const ctx = createCallbackQueryContext();
		const render = withAdapter.buildRender(ctx, {});

		await render.edit(view);
		expect(ctx.editText).toHaveBeenCalledWith("view edit", {
			reply_markup: undefined,
		});
	});
});

describe("globals flow", () => {
	test("globals are passed through to view render callback", async () => {
		type Globals = { locale: string };
		const defineView = initViewsBuilder<Globals>();
		const view = defineView().render(function () {
			return this.response.text(`Locale: ${this.locale}`);
		});
		const ctx = createMessageContext();
		const render = defineView.buildRender(ctx, { locale: "en" } as any);

		await render(view);
		expect(ctx.send).toHaveBeenCalledWith("Locale: en", {
			reply_markup: undefined,
		});
	});
});
