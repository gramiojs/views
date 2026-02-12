import { describe, expect, test } from "bun:test";
import { defineAdapter } from "../src/adapters/define.ts";
import { ViewRender } from "../src/render.ts";

describe("defineAdapter", () => {
	test("resolve() returns a ViewRender for a known key", () => {
		const adapter = defineAdapter<{}, { greeting: void }>({
			greeting() {
				return this.response.text("hello");
			},
		});

		const view = adapter.resolve("greeting");
		expect(view).toBeInstanceOf(ViewRender);
	});

	test("resolve() throws for unknown key", () => {
		const adapter = defineAdapter<{}, { greeting: void }>({
			greeting() {
				return this.response.text("hello");
			},
		});

		expect(() => (adapter as any).resolve("nonexistent")).toThrow(
			'View "nonexistent" not found in adapter',
		);
	});

	test("keys() returns all defined view keys", () => {
		const adapter = defineAdapter<
			{},
			{ greeting: void; farewell: void }
		>({
			greeting() {
				return this.response.text("hi");
			},
			farewell() {
				return this.response.text("bye");
			},
		});

		const keys = adapter.keys!();
		expect(keys).toContain("greeting");
		expect(keys).toContain("farewell");
		expect(keys).toHaveLength(2);
	});

	test("multiple resolve() calls return same ViewRender instance", () => {
		const adapter = defineAdapter<{}, { test: void }>({
			test() {
				return this.response.text("test");
			},
		});

		const view1 = adapter.resolve("test");
		const view2 = adapter.resolve("test");
		expect(view1).toBe(view2);
	});
});
