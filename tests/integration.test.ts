import { describe, expect, mock, test } from "bun:test";
import { createJsonAdapter } from "../src/adapters/json.ts";
import { initViewsBuilder } from "../src/index.ts";
import { ViewBuilder } from "../src/view.ts";

function createMessageContext() {
	return {
		is: (type: string) => type === "message",
		send: mock(() => Promise.resolve()),
		sendMedia: mock(() => Promise.resolve()),
		sendMediaGroup: mock(() => Promise.resolve()),
	} as any; // Mock context - only minimal fields needed for testing
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
	} as any; // Mock context - only minimal fields needed for testing
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
	type ViewMap = { welcome: void };

	test("returns builder with adapter attached", () => {
		const defineView = initViewsBuilder<{}>();
		const adapter = createJsonAdapter<{}, ViewMap>({
			views: { welcome: { text: "Hello!" } },
		});
		const result = defineView.from(adapter);

		expect(result.adapter).toBe(adapter);
		expect(typeof result.buildRender).toBe("function");
	});

	test("calling from() result returns ViewBuilder", () => {
		const defineView = initViewsBuilder<{}>();
		const adapter = createJsonAdapter<{}, ViewMap>({
			views: { welcome: { text: "Hello!" } },
		});
		const withAdapter = defineView.from(adapter);
		const builder = withAdapter();
		expect(builder).toBeInstanceOf(ViewBuilder);
	});

	test("buildRender dispatches string keys to adapter", async () => {
		const defineView = initViewsBuilder<{}>();
		const adapter = createJsonAdapter<{}, ViewMap>({
			views: { welcome: { text: "Hello from adapter!" } },
		});
		const withAdapter = defineView.from(adapter);
		const ctx = createMessageContext();
		const render = withAdapter.buildRender(ctx, {});

		await render("welcome");
		expect(ctx.send).toHaveBeenCalledWith("Hello from adapter!", {
			reply_markup: undefined,
		});
	});

	test("buildRender dispatches ViewRender objects directly", async () => {
		const defineView = initViewsBuilder<{}>();
		const adapter = createJsonAdapter<{}, ViewMap>({
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
		type ViewMap = { msg: void };
		const defineView = initViewsBuilder<{}>();
		const adapter = createJsonAdapter<{}, ViewMap>({
			views: { msg: { text: "adapter send" } },
		});
		const withAdapter = defineView.from(adapter);
		const ctx = createCallbackQueryContext();
		const render = withAdapter.buildRender(ctx, {});

		await render.send("msg");
		expect(ctx.send).toHaveBeenCalledWith("adapter send", {
			reply_markup: undefined,
		});
	});

	test("render.edit with string key forces edit", async () => {
		type ViewMap = { msg: void };
		const defineView = initViewsBuilder<{}>();
		const adapter = createJsonAdapter<{}, ViewMap>({
			views: { msg: { text: "adapter edit" } },
		});
		const withAdapter = defineView.from(adapter);
		const ctx = createCallbackQueryContext();
		const render = withAdapter.buildRender(ctx, {});

		await render.edit("msg");
		expect(ctx.editText).toHaveBeenCalledWith("adapter edit", {
			reply_markup: undefined,
		});
	});

	test("render.send with ViewRender forces send", async () => {
		const defineView = initViewsBuilder<{}>();
		const adapter = createJsonAdapter<{}, {}>({ views: {} });
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
		const adapter = createJsonAdapter<{}, {}>({ views: {} });
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

describe("initViewsBuilder.from() with adapter factory", () => {
	test("accepts a factory function", () => {
		type Globals = { locale: string };
		type ViewMap = { welcome: void };
		const defineView = initViewsBuilder<Globals>();
		const adapter = createJsonAdapter<Globals, ViewMap>({
			views: { welcome: { text: "Hello!" } },
		});
		const factory = (_globals: Globals) => adapter;
		const result = defineView.from(factory);

		expect(result.adapter).toBe(factory);
		expect(typeof result.buildRender).toBe("function");
	});

	test("factory selects adapter based on globals", async () => {
		type Globals = { locale: string };
		type ViewMap = { greet: void };
		const defineView = initViewsBuilder<Globals>();

		const adapters: Record<
			string,
			ReturnType<typeof createJsonAdapter<Globals, ViewMap>>
		> = {
			en: createJsonAdapter<Globals, ViewMap>({
				views: { greet: { text: "Hello!" } },
			}),
			ru: createJsonAdapter<Globals, ViewMap>({
				views: { greet: { text: "Привет!" } },
			}),
		};
		const withAdapter = defineView.from(
			(globals: Globals) => adapters[globals.locale],
		);

		const ctxEn = createMessageContext();
		const renderEn = withAdapter.buildRender(ctxEn, { locale: "en" });
		await renderEn("greet");
		expect(ctxEn.send).toHaveBeenCalledWith("Hello!", {
			reply_markup: undefined,
		});

		const ctxRu = createMessageContext();
		const renderRu = withAdapter.buildRender(ctxRu, { locale: "ru" });
		await renderRu("greet");
		expect(ctxRu.send).toHaveBeenCalledWith("Привет!", {
			reply_markup: undefined,
		});
	});

	test("factory works with render.send and render.edit", async () => {
		type Globals = { locale: string };
		type ViewMap = { msg: void };
		const defineView = initViewsBuilder<Globals>();

		const adapters: Record<
			string,
			ReturnType<typeof createJsonAdapter<Globals, ViewMap>>
		> = {
			en: createJsonAdapter<Globals, ViewMap>({
				views: { msg: { text: "English" } },
			}),
			ru: createJsonAdapter<Globals, ViewMap>({
				views: { msg: { text: "Русский" } },
			}),
		};
		const withAdapter = defineView.from(
			(globals: Globals) => adapters[globals.locale],
		);

		const ctxSend = createCallbackQueryContext();
		const renderSend = withAdapter.buildRender(ctxSend, {
			locale: "ru",
		});
		await renderSend.send("msg");
		expect(ctxSend.send).toHaveBeenCalledWith("Русский", {
			reply_markup: undefined,
		});

		const ctxEdit = createCallbackQueryContext();
		const renderEdit = withAdapter.buildRender(ctxEdit, {
			locale: "en",
		});
		await renderEdit.edit("msg");
		expect(ctxEdit.editText).toHaveBeenCalledWith("English", {
			reply_markup: undefined,
		});
	});

	test("factory still allows ViewRender objects alongside string keys", async () => {
		type Globals = { locale: string };
		type ViewMap = { json: void };
		const defineView = initViewsBuilder<Globals>();

		const adapter = createJsonAdapter<Globals, ViewMap>({
			views: { json: { text: "from adapter" } },
		});
		const withAdapter = defineView.from((_globals: Globals) => adapter);

		const customView = withAdapter().render(function () {
			return this.response.text("from code");
		});

		const ctx = createMessageContext();
		const render = withAdapter.buildRender(ctx, { locale: "en" });

		await render(customView);
		expect(ctx.send).toHaveBeenCalledWith("from code", {
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
		const render = defineView.buildRender(ctx, { locale: "en" });

		await render(view);
		expect(ctx.send).toHaveBeenCalledWith("Locale: en", {
			reply_markup: undefined,
		});
	});
});

describe("lazy globals (thunk form)", () => {
	test("thunk is called per render, not per buildRender", async () => {
		type Globals = { counter: number };
		const defineView = initViewsBuilder<Globals>();
		const view = defineView().render(function () {
			return this.response.text(`n=${this.counter}`);
		});

		let counter = 0;
		const thunk = mock(() => ({ counter: ++counter }));

		const ctx = createMessageContext();
		const render = defineView.buildRender(ctx, thunk);

		expect(thunk).not.toHaveBeenCalled();

		await render(view);
		await render(view);
		await render(view);

		expect(thunk).toHaveBeenCalledTimes(3);
		expect(ctx.send).toHaveBeenNthCalledWith(1, "n=1", {
			reply_markup: undefined,
		});
		expect(ctx.send).toHaveBeenNthCalledWith(2, "n=2", {
			reply_markup: undefined,
		});
		expect(ctx.send).toHaveBeenNthCalledWith(3, "n=3", {
			reply_markup: undefined,
		});
	});

	test("thunk picks up state mutated between renders", async () => {
		type Globals = { locale: string };
		const defineView = initViewsBuilder<Globals>();
		const view = defineView().render(function () {
			return this.response.text(`lang=${this.locale}`);
		});

		const state = { locale: "en" };
		const ctx = createMessageContext();
		const render = defineView.buildRender(ctx, () => ({
			locale: state.locale,
		}));

		await render(view);
		state.locale = "ru";
		await render(view);

		expect(ctx.send).toHaveBeenNthCalledWith(1, "lang=en", {
			reply_markup: undefined,
		});
		expect(ctx.send).toHaveBeenNthCalledWith(2, "lang=ru", {
			reply_markup: undefined,
		});
	});

	test("render.send and render.edit resolve thunk", async () => {
		type Globals = { v: string };
		const defineView = initViewsBuilder<Globals>();
		const view = defineView().render(function () {
			return this.response.text(this.v);
		});

		const state = { v: "first" };
		const ctx = createCallbackQueryContext();
		const render = defineView.buildRender(ctx, () => ({ v: state.v }));

		await render.send(view);
		state.v = "second";
		await render.edit(view);

		expect(ctx.send).toHaveBeenCalledWith("first", {
			reply_markup: undefined,
		});
		expect(ctx.editText).toHaveBeenCalledWith("second", {
			reply_markup: undefined,
		});
	});

	test("adapter factory receives freshly resolved globals per render", async () => {
		type Globals = { locale: string };
		type ViewMap = { greet: void };
		const defineView = initViewsBuilder<Globals>();

		const adapters: Record<
			string,
			ReturnType<typeof createJsonAdapter<Globals, ViewMap>>
		> = {
			en: createJsonAdapter<Globals, ViewMap>({
				views: { greet: { text: "Hello!" } },
			}),
			ru: createJsonAdapter<Globals, ViewMap>({
				views: { greet: { text: "Привет!" } },
			}),
		};

		const factory = mock((globals: Globals) => adapters[globals.locale]);
		const withAdapter = defineView.from(factory);

		const state = { locale: "en" };
		const ctx = createMessageContext();
		const render = withAdapter.buildRender(ctx, () => ({
			locale: state.locale,
		}));

		await render("greet");
		state.locale = "ru";
		await render("greet");

		expect(factory).toHaveBeenCalledTimes(2);
		expect(ctx.send).toHaveBeenNthCalledWith(1, "Hello!", {
			reply_markup: undefined,
		});
		expect(ctx.send).toHaveBeenNthCalledWith(2, "Привет!", {
			reply_markup: undefined,
		});
	});

	test("adapter string-key + ViewRender paths both resolve thunk", async () => {
		type Globals = { prefix: string };
		type ViewMap = { j: void };
		const defineView = initViewsBuilder<Globals>();

		const adapter = createJsonAdapter<Globals, ViewMap>({
			views: { j: { text: "{{$prefix}}-json" } },
		});
		const withAdapter = defineView.from(adapter);
		const codeView = withAdapter().render(function () {
			return this.response.text(`${this.prefix}-code`);
		});

		const state = { prefix: "A" };
		const ctx = createMessageContext();
		const render = withAdapter.buildRender(ctx, () => ({
			prefix: state.prefix,
		}));

		await render("j");
		state.prefix = "B";
		await render(codeView);

		expect(ctx.send).toHaveBeenNthCalledWith(1, "A-json", {
			reply_markup: undefined,
		});
		expect(ctx.send).toHaveBeenNthCalledWith(2, "B-code", {
			reply_markup: undefined,
		});
	});

	test("static object form still works (back-compat)", async () => {
		type Globals = { v: string };
		const defineView = initViewsBuilder<Globals>();
		const view = defineView().render(function () {
			return this.response.text(this.v);
		});
		const ctx = createMessageContext();
		const render = defineView.buildRender(ctx, { v: "static" });

		await render(view);
		expect(ctx.send).toHaveBeenCalledWith("static", {
			reply_markup: undefined,
		});
	});

	test("mix static + lazy via property getters on a plain object", async () => {
		// createContext uses object spread, which evaluates getters and
		// copies their return values onto contextData — per render.
		// So mixing static props with getter-based lazy props works out of the box.
		type Globals = { userId: number; onboarding: string };
		const defineView = initViewsBuilder<Globals>();
		const view = defineView().render(function () {
			return this.response.text(`${this.userId}:${this.onboarding}`);
		});

		const fakeCtx = { onboarding: { step: "intro" } };
		const ctx = createMessageContext();
		const render = defineView.buildRender(ctx, {
			userId: 42,
			get onboarding() {
				return fakeCtx.onboarding.step;
			},
		});

		await render(view);
		fakeCtx.onboarding.step = "done";
		await render(view);

		expect(ctx.send).toHaveBeenNthCalledWith(1, "42:intro", {
			reply_markup: undefined,
		});
		expect(ctx.send).toHaveBeenNthCalledWith(2, "42:done", {
			reply_markup: undefined,
		});
	});

	test("realistic .derive() pattern: session mutation mid-handler", async () => {
		// Simulates the real production flow:
		//   bot.derive(["message", "callback_query"], (ctx) => ({
		//     render: defineView.buildRender(ctx, () => ({
		//       user: ctx.from,
		//       session: ctx.session,
		//       onboarding: ctx.onboarding?.welcome.snapshot,
		//     })),
		//   }))
		// Middleware between two renders mutates ctx.session / ctx.onboarding —
		// the second render must see the new state, not the one captured at derive().
		type User = { id: number; name: string };
		type Session = { locale: string; visits: number };
		type OnboardingSnapshot = { step: string; status: "active" | "done" };
		type Globals = {
			user: User;
			session: Session;
			onboarding: OnboardingSnapshot;
		};

		// Simulated per-update context object (what GramIO would pass to .derive())
		const fakeCtx = {
			from: { id: 1, name: "Alice" } as User,
			session: { locale: "en", visits: 1 } as Session,
			onboarding: { step: "intro", status: "active" } as OnboardingSnapshot,
			advanceOnboarding() {
				this.onboarding = { step: "profile", status: "active" };
			},
			finishOnboarding() {
				this.onboarding = { step: "profile", status: "done" };
			},
		};

		const defineView = initViewsBuilder<Globals>();
		const greetView = defineView().render(function () {
			return this.response.text(
				`[${this.session.locale}] ${this.user.name} step=${this.onboarding.step}/${this.onboarding.status} visits=${this.session.visits}`,
			);
		});

		const telegramCtx = createMessageContext();

		// Exactly what a user would write inside bot.derive():
		const deriveResult = {
			render: defineView.buildRender(telegramCtx, () => ({
				user: fakeCtx.from,
				session: fakeCtx.session,
				onboarding: fakeCtx.onboarding,
			})),
		};

		// 1st render: initial state
		await deriveResult.render(greetView);

		// Middleware advances onboarding and bumps visits
		fakeCtx.advanceOnboarding();
		fakeCtx.session.visits = 2;

		// 2nd render: must reflect advanced state
		await deriveResult.render(greetView);

		// Another step: locale switch mid-handler + onboarding finish
		fakeCtx.session.locale = "ru";
		fakeCtx.finishOnboarding();

		// 3rd render: must reflect locale + completion
		await deriveResult.render(greetView);

		expect(telegramCtx.send).toHaveBeenNthCalledWith(
			1,
			"[en] Alice step=intro/active visits=1",
			{ reply_markup: undefined },
		);
		expect(telegramCtx.send).toHaveBeenNthCalledWith(
			2,
			"[en] Alice step=profile/active visits=2",
			{ reply_markup: undefined },
		);
		expect(telegramCtx.send).toHaveBeenNthCalledWith(
			3,
			"[ru] Alice step=profile/done visits=2",
			{ reply_markup: undefined },
		);
	});

	test("realistic .derive() pattern: i18n locale flip flips adapter", async () => {
		// Real-world: user issues /lang ru mid-session. Middleware updates
		// ctx.session.locale. Subsequent views must render in Russian without
		// rebuilding the render function.
		type Globals = { locale: string; name: string };
		type ViewMap = { greet: void };
		const defineView = initViewsBuilder<Globals>();

		const adapters: Record<
			string,
			ReturnType<typeof createJsonAdapter<Globals, ViewMap>>
		> = {
			en: createJsonAdapter<Globals, ViewMap>({
				views: { greet: { text: "Hello, {{$name}}!" } },
			}),
			ru: createJsonAdapter<Globals, ViewMap>({
				views: { greet: { text: "Привет, {{$name}}!" } },
			}),
		};
		const withAdapter = defineView.from(
			(globals: Globals) => adapters[globals.locale],
		);

		const fakeCtx = {
			from: { name: "Alice" },
			session: { locale: "en" },
		};
		const telegramCtx = createMessageContext();

		const { render } = {
			render: withAdapter.buildRender(telegramCtx, () => ({
				locale: fakeCtx.session.locale,
				name: fakeCtx.from.name,
			})),
		};

		await render("greet");
		fakeCtx.session.locale = "ru"; // /lang ru middleware
		await render("greet");
		fakeCtx.session.locale = "en"; // /lang en middleware
		await render("greet");

		expect(telegramCtx.send).toHaveBeenNthCalledWith(1, "Hello, Alice!", {
			reply_markup: undefined,
		});
		expect(telegramCtx.send).toHaveBeenNthCalledWith(2, "Привет, Alice!", {
			reply_markup: undefined,
		});
		expect(telegramCtx.send).toHaveBeenNthCalledWith(3, "Hello, Alice!", {
			reply_markup: undefined,
		});
	});
});
