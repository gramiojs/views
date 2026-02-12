import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

	test("loads subdirectories with dot-separated keys", async () => {
		await mkdir(join(testDir, "goods", "things"), { recursive: true });
		await writeFile(
			join(testDir, "goods", "things", "happens.json"),
			JSON.stringify({ text: "nested!" }),
		);
		await writeFile(
			join(testDir, "goods", "list.json"),
			JSON.stringify({ text: "goods list" }),
		);
		await writeFile(
			join(testDir, "top.json"),
			JSON.stringify({ text: "top level" }),
		);

		const result = await loadJsonViewsDir(testDir);
		expect(result["goods.things.happens"]).toEqual({ text: "nested!" });
		expect(result["goods.list"]).toEqual({ text: "goods list" });
		expect(result["top"]).toEqual({ text: "top level" });
	});

	test("ignores non-json files in subdirectories", async () => {
		await mkdir(join(testDir, "sub"), { recursive: true });
		await writeFile(
			join(testDir, "sub", "view.json"),
			JSON.stringify({ text: "ok" }),
		);
		await writeFile(join(testDir, "sub", "notes.txt"), "ignore me");

		const result = await loadJsonViewsDir(testDir);
		expect(Object.keys(result)).toEqual(["sub.view"]);
	});
});
