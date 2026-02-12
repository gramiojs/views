import { describe, expect, test } from "bun:test";
import { ResponseView } from "../src/response.ts";

describe("ResponseView", () => {
	test("starts with undefined values", () => {
		const res = new ResponseView();
		const internal = (res as any).response;
		expect(internal.text).toBeUndefined();
		expect(internal.keyboard).toBeUndefined();
		expect(internal.media).toBeUndefined();
	});

	test(".text() stores text and returns this", () => {
		const res = new ResponseView();
		const returned = res.text("hello");
		expect(returned).toBe(res);
		expect((res as any).response.text).toBe("hello");
	});

	test(".keyboard() stores keyboard and returns this", () => {
		const res = new ResponseView();
		const kb = { inline_keyboard: [[{ text: "btn", callback_data: "x" }]] };
		const returned = res.keyboard(kb);
		expect(returned).toBe(res);
		expect((res as any).response.keyboard).toBe(kb);
	});

	test(".media() stores single media and returns this", () => {
		const res = new ResponseView();
		const media = { type: "photo" as const, media: "file_id_123" };
		const returned = res.media(media);
		expect(returned).toBe(res);
		expect((res as any).response.media).toBe(media);
	});

	test(".media() stores media group array", () => {
		const res = new ResponseView();
		const group = [
			{ type: "photo" as const, media: "file1" },
			{ type: "photo" as const, media: "file2" },
		];
		res.media(group);
		expect((res as any).response.media).toBe(group);
	});

	test("chaining .text().keyboard().media()", () => {
		const res = new ResponseView();
		const media = { type: "photo" as const, media: "file_id" };
		const kb = { inline_keyboard: [] };
		const result = res.text("hi").keyboard(kb).media(media);

		expect(result).toBe(res);
		const internal = (res as any).response;
		expect(internal.text).toBe("hi");
		expect(internal.keyboard).toBe(kb);
		expect(internal.media).toBe(media);
	});

	test(".text() accepts objects with toString()", () => {
		const res = new ResponseView();
		const textObj = { toString: () => "from toString" };
		res.text(textObj);
		expect((res as any).response.text).toBe(textObj);
	});

	test("overwriting values with subsequent calls", () => {
		const res = new ResponseView();
		res.text("first");
		res.text("second");
		expect((res as any).response.text).toBe("second");
	});
});
