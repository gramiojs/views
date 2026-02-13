import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { JsonViewDefinition } from "../src/adapters/json.ts";
import { loadJsonViews, loadJsonViewsDir } from "../src/adapters/fs.ts";

let testDir: string;

beforeEach(async () => {
	testDir = await mkdtemp(join(tmpdir(), "views-test-"));
});

afterEach(async () => {
	await rm(testDir, { recursive: true, force: true });
});

describe("loadJsonViews", () => {
	test("loads a multi-view JSON file", async () => {
		const views = {
			welcome: { text: "Hello, {{name}}!" },
			goodbye: { text: "Bye!" },
		};
		const filePath = join(testDir, "views.json");
		await writeFile(filePath, JSON.stringify(views));

		const result = await loadJsonViews(filePath);
		expect(result).toEqual(views);
	});

	test("throws on non-existent file", async () => {
		const filePath = join(testDir, "nonexistent.json");
		expect(loadJsonViews(filePath)).rejects.toThrow();
	});

	test("throws on invalid JSON", async () => {
		const filePath = join(testDir, "bad.json");
		await writeFile(filePath, "not json {{{");
		expect(loadJsonViews(filePath)).rejects.toThrow();
	});

	test("loads views with reply_markup and media fields", async () => {
		const views: Record<string, JsonViewDefinition> = {
			full: {
				text: "Hello, {{name}}!",
				reply_markup: {
					inline_keyboard: [
						[
							{ text: "Profile {{name}}", callback_data: "profile_{{id}}" },
							{ text: "Visit", url: "https://example.com/{{id}}" },
						],
					],
				},
				media: { type: "photo", media: "{{photoUrl}}" },
			},
			gallery: {
				text: "Photos",
				media: [
					{ type: "photo", media: "https://example.com/1.jpg" },
					{ type: "photo", media: "https://example.com/2.jpg" },
				],
			},
		};
		const filePath = join(testDir, "views.json");
		await writeFile(filePath, JSON.stringify(views));

		const result = await loadJsonViews(filePath);
		expect(result).toEqual(views);
	});
});

describe("loadJsonViewsDir", () => {
	test("loads all .json files from a directory (multi-view format)", async () => {
		await writeFile(
			join(testDir, "messages.json"),
			JSON.stringify({
				welcome: { text: "Hello!" },
				goodbye: { text: "Bye!" },
			}),
		);

		const result = await loadJsonViewsDir(testDir);
		expect(result).toEqual({
			"messages.welcome": { text: "Hello!" },
			"messages.goodbye": { text: "Bye!" },
		});
	});

	test("ignores non-json files", async () => {
		await writeFile(
			join(testDir, "valid.json"),
			JSON.stringify({ view: { text: "ok" } }),
		);
		await writeFile(join(testDir, "readme.txt"), "not a view");
		await writeFile(join(testDir, "data.jsonl"), '{"line": 1}');

		const result = await loadJsonViewsDir(testDir);
		expect(Object.keys(result)).toEqual(["valid.view"]);
	});

	test("returns empty object for empty directory", async () => {
		const result = await loadJsonViewsDir(testDir);
		expect(result).toEqual({});
	});

	test("throws on non-existent directory", async () => {
		expect(loadJsonViewsDir(join(testDir, "nope"))).rejects.toThrow();
	});

	test("uses filename without extension as part of key", async () => {
		await writeFile(
			join(testDir, "my-views.json"),
			JSON.stringify({ hello: { text: "hi" } }),
		);

		const result = await loadJsonViewsDir(testDir);
		expect(result["my-views.hello"]).toEqual({ text: "hi" });
	});

	test("loads subdirectories with dot-separated keys", async () => {
		await mkdir(join(testDir, "goods", "things"), { recursive: true });
		await writeFile(
			join(testDir, "goods", "things", "events.json"),
			JSON.stringify({ happens: { text: "nested!" } }),
		);
		await writeFile(
			join(testDir, "goods", "products.json"),
			JSON.stringify({ list: { text: "goods list" } }),
		);
		await writeFile(
			join(testDir, "main.json"),
			JSON.stringify({ top: { text: "top level" } }),
		);

		const result = await loadJsonViewsDir(testDir);
		expect(result["goods.things.events.happens"]).toEqual({ text: "nested!" });
		expect(result["goods.products.list"]).toEqual({ text: "goods list" });
		expect(result["main.top"]).toEqual({ text: "top level" });
	});

	test("ignores non-json files in subdirectories", async () => {
		await mkdir(join(testDir, "sub"), { recursive: true });
		await writeFile(
			join(testDir, "sub", "views.json"),
			JSON.stringify({ main: { text: "ok" } }),
		);
		await writeFile(join(testDir, "sub", "notes.txt"), "ignore me");

		const result = await loadJsonViewsDir(testDir);
		expect(Object.keys(result)).toEqual(["sub.views.main"]);
	});

	test("supports multi-view format {key: definition}", async () => {
		await writeFile(
			join(testDir, "messages.json"),
			JSON.stringify({
				welcome: { text: "Hello, {{name}}!" },
				goodbye: { text: "Bye, {{name}}!" },
				help: { text: "Need help?" },
			}),
		);

		const result = await loadJsonViewsDir(testDir);
		expect(result["messages.welcome"]).toEqual({ text: "Hello, {{name}}!" });
		expect(result["messages.goodbye"]).toEqual({ text: "Bye, {{name}}!" });
		expect(result["messages.help"]).toEqual({ text: "Need help?" });
	});

	test("supports multi-view format in nested directories", async () => {
		await mkdir(join(testDir, "goods"), { recursive: true });
		await writeFile(
			join(testDir, "goods", "products.json"),
			JSON.stringify({
				list: { text: "Product list" },
				detail: { text: "Product {{id}}" },
			}),
		);

		const result = await loadJsonViewsDir(testDir);
		expect(result["goods.products.list"]).toEqual({ text: "Product list" });
		expect(result["goods.products.detail"]).toEqual({
			text: "Product {{id}}",
		});
	});

	test("supports complex view definitions", async () => {
		await writeFile(
			join(testDir, "complex.json"),
			JSON.stringify({
				profile: {
					text: "Profile {{name}}",
					reply_markup: {
						inline_keyboard: [
							[{ text: "Edit", callback_data: "edit_{{id}}" }],
						],
					},
					media: { type: "photo", media: "{{avatar}}" },
				},
				gallery: {
					text: "Photos",
					media: [
						{ type: "photo", media: "{{photo1}}" },
						{ type: "photo", media: "{{photo2}}" },
					],
				},
			}),
		);

		const result = await loadJsonViewsDir(testDir);
		expect(result["complex.profile"]).toEqual({
			text: "Profile {{name}}",
			reply_markup: {
				inline_keyboard: [[{ text: "Edit", callback_data: "edit_{{id}}" }]],
			},
			media: { type: "photo", media: "{{avatar}}" },
		});
		expect(result["complex.gallery"]).toEqual({
			text: "Photos",
			media: [
				{ type: "photo", media: "{{photo1}}" },
				{ type: "photo", media: "{{photo2}}" },
			],
		});
	});

	test("allows any key names including text, reply_markup, media", async () => {
		// Now these are just view names, not reserved words
		await writeFile(
			join(testDir, "views.json"),
			JSON.stringify({
				text: { text: "This is a view named 'text'" },
				reply_markup: { text: "This is a view named 'reply_markup'" },
				media: { text: "This is a view named 'media'" },
			}),
		);

		const result = await loadJsonViewsDir(testDir);
		expect(result["views.text"]).toEqual({ text: "This is a view named 'text'" });
		expect(result["views.reply_markup"]).toEqual({
			text: "This is a view named 'reply_markup'",
		});
		expect(result["views.media"]).toEqual({
			text: "This is a view named 'media'",
		});
	});
});
