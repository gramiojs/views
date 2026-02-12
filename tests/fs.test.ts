import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
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
});

describe("loadJsonViewsDir", () => {
	test("loads all .json files from a directory", async () => {
		await writeFile(
			join(testDir, "welcome.json"),
			JSON.stringify({ text: "Hello!" }),
		);
		await writeFile(
			join(testDir, "goodbye.json"),
			JSON.stringify({ text: "Bye!" }),
		);

		const result = await loadJsonViewsDir(testDir);
		expect(result).toEqual({
			welcome: { text: "Hello!" },
			goodbye: { text: "Bye!" },
		});
	});

	test("ignores non-json files", async () => {
		await writeFile(
			join(testDir, "valid.json"),
			JSON.stringify({ text: "ok" }),
		);
		await writeFile(join(testDir, "readme.txt"), "not a view");
		await writeFile(join(testDir, "data.jsonl"), '{"line": 1}');

		const result = await loadJsonViewsDir(testDir);
		expect(Object.keys(result)).toEqual(["valid"]);
	});

	test("returns empty object for empty directory", async () => {
		const result = await loadJsonViewsDir(testDir);
		expect(result).toEqual({});
	});

	test("throws on non-existent directory", async () => {
		expect(loadJsonViewsDir(join(testDir, "nope"))).rejects.toThrow();
	});

	test("uses filename without extension as key", async () => {
		await writeFile(
			join(testDir, "my-view.json"),
			JSON.stringify({ text: "hi" }),
		);

		const result = await loadJsonViewsDir(testDir);
		expect(result["my-view"]).toEqual({ text: "hi" });
	});
});
