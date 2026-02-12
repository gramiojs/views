import { describe, expect, test } from "bun:test";
import { isInlineMarkup } from "../src/utils.ts";

describe("isInlineMarkup", () => {
	test("returns false for null", () => {
		expect(isInlineMarkup(null)).toBe(false);
	});

	test("returns false for undefined", () => {
		expect(isInlineMarkup(undefined)).toBe(false);
	});

	test("returns false for non-objects", () => {
		expect(isInlineMarkup("string")).toBe(false);
		expect(isInlineMarkup(42)).toBe(false);
		expect(isInlineMarkup(true)).toBe(false);
	});

	test("returns false for plain object without inline_keyboard", () => {
		expect(isInlineMarkup({ keyboard: [] })).toBe(false);
	});

	test("returns true for object with inline_keyboard", () => {
		expect(isInlineMarkup({ inline_keyboard: [] })).toBe(true);
	});

	test("returns true when toJSON() returns object with inline_keyboard", () => {
		const markup = {
			toJSON: () => ({ inline_keyboard: [[]] }),
		};
		expect(isInlineMarkup(markup)).toBe(true);
	});

	test("returns false when toJSON() returns object without inline_keyboard", () => {
		const markup = {
			toJSON: () => ({ keyboard: [] }),
		};
		expect(isInlineMarkup(markup)).toBe(false);
	});

	test("falls through to direct check when toJSON is not a function", () => {
		const markup = { toJSON: "not a function", inline_keyboard: [] };
		expect(isInlineMarkup(markup)).toBe(true);
	});
});
