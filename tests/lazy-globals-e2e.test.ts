import { describe, expect, it } from "bun:test";
import { Bot } from "gramio";
import { TelegramTestEnvironment } from "@gramio/test";
import { createJsonAdapter } from "../src/adapters/json.ts";
import { initViewsBuilder } from "../src/index.ts";

// biome-ignore lint/suspicious/noExplicitAny: test assertion helper — @gramio/test types call.params as unknown
function p(call: { params: unknown } | undefined): any {
	return call?.params;
}

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 1: middleware mutates onboarding between .derive() and ctx.render()
// ──────────────────────────────────────────────────────────────────────────────

describe("lazy globals e2e — onboarding advances mid-handler", () => {
	type OnboardingSnapshot = { step: string; status: "active" | "done" };

	/**
	 * Mimics the @gramio/onboarding plugin shape:
	 *  - `ctx.onboarding.snapshot` is a getter returning a fresh snapshot
	 *  - `ctx.onboarding.advance()` replaces the stored snapshot (new object)
	 *
	 * When globals are captured statically at .derive() time, the view
	 * sees the pre-advance snapshot. The lazy thunk re-reads per render.
	 */
	function buildBot(useLazy: boolean) {
		type Globals = { onboarding: OnboardingSnapshot };
		const store = new Map<number, OnboardingSnapshot>();
		const defineView = initViewsBuilder<Globals>();
		const statusView = defineView().render(function () {
			return this.response.text(
				`step=${this.onboarding.step} status=${this.onboarding.status}`,
			);
		});

		return new Bot("test")
			.derive(["message", "callback_query"], (ctx) => {
				const uid = ctx.from!.id;
				if (!store.has(uid)) {
					store.set(uid, { step: "intro", status: "active" });
				}
				const onboarding = {
					get snapshot() {
						return store.get(uid)!;
					},
					advance() {
						store.set(uid, { step: "profile", status: "active" });
					},
					finish() {
						store.set(uid, { step: "profile", status: "done" });
					},
				};
				const thunk = () => ({ onboarding: onboarding.snapshot });
				return {
					onboarding,
					render: defineView.buildRender(ctx, useLazy ? thunk : thunk()),
				};
			})
			.on("message", async (ctx) => {
				if (ctx.text === "/advance") ctx.onboarding.advance();
				else if (ctx.text === "/finish") ctx.onboarding.finish();
				await ctx.render(statusView);
			});
	}

	it("lazy thunk: view sees advanced snapshot within the same handler", async () => {
		const bot = buildBot(true);
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();

		await user.sendMessage("/advance");

		expect(p(env.lastApiCall("sendMessage")).text).toBe(
			"step=profile status=active",
		);
	});

	it("static snapshot (regression guard): view renders stale pre-advance state", async () => {
		const bot = buildBot(false);
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();

		await user.sendMessage("/advance");

		expect(p(env.lastApiCall("sendMessage")).text).toBe(
			"step=intro status=active",
		);
	});

	it("lazy thunk: progressive advances across three consecutive messages", async () => {
		const bot = buildBot(true);
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();

		await user.sendMessage("/status");
		expect(p(env.lastApiCall("sendMessage")).text).toBe(
			"step=intro status=active",
		);

		await user.sendMessage("/advance");
		expect(p(env.lastApiCall("sendMessage")).text).toBe(
			"step=profile status=active",
		);

		await user.sendMessage("/finish");
		expect(p(env.lastApiCall("sendMessage")).text).toBe(
			"step=profile status=done",
		);
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 2: /lang <locale> flips the adapter factory between renders
// ──────────────────────────────────────────────────────────────────────────────

describe("lazy globals e2e — i18n locale flip flips the adapter", () => {
	type Globals = { locale: "en" | "ru" };
	type ViewMap = { greet: void };

	function buildBot(useLazy: boolean) {
		const adapters = {
			en: createJsonAdapter<Globals, ViewMap>({
				views: { greet: { text: "Hello!" } },
			}),
			ru: createJsonAdapter<Globals, ViewMap>({
				views: { greet: { text: "Привет!" } },
			}),
		};
		const defineView = initViewsBuilder<Globals>().from(
			(g) => adapters[g.locale],
		);

		const sessionLocale = new Map<number, "en" | "ru">();

		return new Bot("test")
			.derive(["message"], (ctx) => {
				const uid = ctx.from!.id;
				if (!sessionLocale.has(uid)) sessionLocale.set(uid, "en");
				const getGlobals = (): Globals => ({
					locale: sessionLocale.get(uid)!,
				});
				return {
					setLocale(l: "en" | "ru") {
						sessionLocale.set(uid, l);
					},
					render: defineView.buildRender(
						ctx,
						useLazy ? getGlobals : getGlobals(),
					),
				};
			})
			.on("message", async (ctx) => {
				if (ctx.text === "/ru") ctx.setLocale("ru");
				else if (ctx.text === "/en") ctx.setLocale("en");
				await ctx.render("greet");
			});
	}

	it("lazy: same render closure picks the ru adapter after /ru, en after /en", async () => {
		const bot = buildBot(true);
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();

		await user.sendMessage("/hi");
		expect(p(env.lastApiCall("sendMessage")).text).toBe("Hello!");

		await user.sendMessage("/ru");
		expect(p(env.lastApiCall("sendMessage")).text).toBe("Привет!");

		await user.sendMessage("/en");
		expect(p(env.lastApiCall("sendMessage")).text).toBe("Hello!");
	});

	it("static (regression guard): adapter is fixed to the locale at .derive() time", async () => {
		const bot = buildBot(false);
		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser();

		// Setting the locale during the handler has no effect on the current render
		// because the factory already selected an adapter with the pre-handler locale.
		await user.sendMessage("/ru");
		expect(p(env.lastApiCall("sendMessage")).text).toBe("Hello!");

		// Next message: new .derive() fires with the updated locale → ru
		await user.sendMessage("/hi");
		expect(p(env.lastApiCall("sendMessage")).text).toBe("Привет!");
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 3: plain-object globals with a property getter for the live field
// ──────────────────────────────────────────────────────────────────────────────

describe("lazy globals e2e — static + lazy mix via property getters", () => {
	type Globals = { userId: number; counter: number };

	it("getter-based counter increments visibly across renders, static fields are captured once", async () => {
		const defineView = initViewsBuilder<Globals>();
		const counterView = defineView().render(function () {
			return this.response.text(`u${this.userId}: n=${this.counter}`);
		});

		const counters = new Map<number, number>();

		const bot = new Bot("test")
			.derive(["message"], (ctx) => {
				const uid = ctx.from!.id;
				if (!counters.has(uid)) counters.set(uid, 0);
				return {
					inc() {
						counters.set(uid, counters.get(uid)! + 1);
					},
					render: defineView.buildRender(ctx, {
						userId: uid,
						get counter() {
							return counters.get(uid)!;
						},
					}),
				};
			})
			.on("message", async (ctx) => {
				ctx.inc();
				await ctx.render(counterView);
			});

		const env = new TelegramTestEnvironment(bot);
		const user = env.createUser({ id: 42 });

		await user.sendMessage("/tick");
		expect(p(env.lastApiCall("sendMessage")).text).toBe("u42: n=1");

		await user.sendMessage("/tick");
		expect(p(env.lastApiCall("sendMessage")).text).toBe("u42: n=2");

		await user.sendMessage("/tick");
		expect(p(env.lastApiCall("sendMessage")).text).toBe("u42: n=3");
	});
});
