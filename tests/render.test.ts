import type { Context } from "gramio";
import { describe, expect, mock, test } from "bun:test";
import { ViewRender } from "../src/render.ts";
import type { ResponseView } from "../src/response.ts";
import type { WithResponseContext } from "../src/utils.ts";

function createMessageContext() {
	return {
		is: (type: string) => type === "message",
		send: mock(() => Promise.resolve()),
		sendMedia: mock(() => Promise.resolve()),
		sendMediaGroup: mock(() => Promise.resolve()),
	} as any; // Mock context - only minimal fields needed for testing
}

function createCallbackQueryContext(overrides?: Record<string, unknown>) {
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
		editCaption: mock(() => Promise.resolve()),
		editMedia: mock(() => Promise.resolve()),
		editReplyMarkup: mock(() => Promise.resolve()),
		sendMedia: mock(() => Promise.resolve()),
		sendMediaGroup: mock(() => Promise.resolve()),
		...overrides,
	} as any; // Mock context - only minimal fields needed for testing
}

describe("ViewRender", () => {
	describe("send strategy (message context)", () => {
		test("sends text message", async () => {
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.text("hello");
			});
			const ctx = createMessageContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.send).toHaveBeenCalledWith("hello", {
				reply_markup: undefined,
			});
		});

		test("sends text with keyboard", async () => {
			const kb = { inline_keyboard: [[{ text: "btn", callback_data: "x" }]] };
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.text("hello").keyboard(kb);
			});
			const ctx = createMessageContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.send).toHaveBeenCalledWith("hello", { reply_markup: kb });
		});

		test("sends single media", async () => {
			const media = { type: "photo" as const, media: "file_id" };
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.media(media);
			});
			const ctx = createMessageContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.sendMedia).toHaveBeenCalled();
		});

		test("sends single media with caption", async () => {
			const media = { type: "photo" as const, media: "file_id" };
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.text("caption").media(media);
			});
			const ctx = createMessageContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.sendMedia).toHaveBeenCalledWith({
				type: "photo",
				photo: "file_id",
				caption: "caption",
				reply_markup: undefined,
			});
		});

		test("sends media group", async () => {
			const group = [
				{ type: "photo" as const, media: "f1" },
				{ type: "photo" as const, media: "f2" },
			];
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.media(group);
			});
			const ctx = createMessageContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.sendMediaGroup).toHaveBeenCalled();
		});

		test("sends media group with caption on last item", async () => {
			const group: any[] = [
				{ type: "photo", media: "f1" },
				{ type: "photo", media: "f2" },
			];
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.text("group caption").media(group);
			});
			const ctx = createMessageContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.sendMediaGroup).toHaveBeenCalled();
			// Caption should be set on last media item
			expect(group[1].caption).toBe("group caption");
		});

		test("sends sticker", async () => {
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.media({ type: "sticker", media: "sticker_file_id" });
			});
			const ctx = createMessageContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.sendMedia).toHaveBeenCalledWith({
				type: "sticker",
				sticker: "sticker_file_id",
				caption: undefined,
				reply_markup: undefined,
			});
		});

		test("sends voice with caption", async () => {
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.text("transcription").media({ type: "voice", media: "voice_file_id" });
			});
			const ctx = createMessageContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.sendMedia).toHaveBeenCalledWith({
				type: "voice",
				voice: "voice_file_id",
				caption: "transcription",
				reply_markup: undefined,
			});
		});

		test("sends video_note", async () => {
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.media({ type: "video_note", media: "vnote_file_id" });
			});
			const ctx = createMessageContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.sendMedia).toHaveBeenCalledWith({
				type: "video_note",
				video_note: "vnote_file_id",
				caption: undefined,
				reply_markup: undefined,
			});
		});

		test("does nothing when response is empty", async () => {
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response;
			});
			const ctx = createMessageContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.send).not.toHaveBeenCalled();
			expect(ctx.sendMedia).not.toHaveBeenCalled();
			expect(ctx.sendMediaGroup).not.toHaveBeenCalled();
		});
	});

	describe("edit strategy (callback_query context)", () => {
		test("edits text message", async () => {
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.text("edited");
			});
			const ctx = createCallbackQueryContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.editText).toHaveBeenCalledWith("edited", {
				reply_markup: undefined,
			});
			expect(ctx.answer).toHaveBeenCalled();
		});

		test("edits text with inline keyboard", async () => {
			const kb = { inline_keyboard: [[{ text: "btn", callback_data: "x" }]] };
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.text("edited").keyboard(kb);
			});
			const ctx = createCallbackQueryContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.editText).toHaveBeenCalledWith("edited", {
				reply_markup: kb,
			});
		});

		test("edits media", async () => {
			const media = { type: "photo" as const, media: "file_id" };
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.media(media);
			});
			const ctx = createCallbackQueryContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.editMedia).toHaveBeenCalled();
		});

		test("edits reply markup only", async () => {
			const kb = { inline_keyboard: [[{ text: "btn", callback_data: "x" }]] };
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.keyboard(kb);
			});
			const ctx = createCallbackQueryContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.editReplyMarkup).toHaveBeenCalledWith(kb);
		});

		test("edits sticker reply markup via editReplyMarkup", async () => {
			const kb = { inline_keyboard: [[{ text: "like", callback_data: "like" }]] };
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.media({ type: "sticker", media: "sticker_file_id" }).keyboard(kb);
			});
			const ctx = createCallbackQueryContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.editReplyMarkup).toHaveBeenCalledWith(kb);
			expect(ctx.editMedia).not.toHaveBeenCalled();
			expect(ctx.message.delete).not.toHaveBeenCalled();
		});

		test("edits voice caption via editCaption", async () => {
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.text("new caption").media({ type: "voice", media: "voice_file_id" });
			});
			const ctx = createCallbackQueryContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.editCaption).toHaveBeenCalledWith("new caption", {
				reply_markup: undefined,
			});
			expect(ctx.editMedia).not.toHaveBeenCalled();
			expect(ctx.message.delete).not.toHaveBeenCalled();
		});

		test("edits voice caption and keyboard together", async () => {
			const kb = { inline_keyboard: [[{ text: "play", callback_data: "play" }]] };
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response
					.text("transcript")
					.media({ type: "voice", media: "voice_file_id" })
					.keyboard(kb);
			});
			const ctx = createCallbackQueryContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.editCaption).toHaveBeenCalledWith("transcript", { reply_markup: kb });
			expect(ctx.editMedia).not.toHaveBeenCalled();
		});

		test("edits video_note reply markup via editReplyMarkup", async () => {
			const kb = { inline_keyboard: [[{ text: "ok", callback_data: "ok" }]] };
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.media({ type: "video_note", media: "vnote_file_id" }).keyboard(kb);
			});
			const ctx = createCallbackQueryContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.editReplyMarkup).toHaveBeenCalledWith(kb);
			expect(ctx.editMedia).not.toHaveBeenCalled();
			expect(ctx.message.delete).not.toHaveBeenCalled();
		});

		test("deletes and re-sends for media group edit", async () => {
			const group = [
				{ type: "photo" as const, media: "f1" },
				{ type: "photo" as const, media: "f2" },
			];
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.media(group);
			});
			const ctx = createCallbackQueryContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.message.delete).toHaveBeenCalled();
			expect(ctx.sendMediaGroup).toHaveBeenCalled();
		});

		test("deletes and re-sends text when current message has media", async () => {
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.text("plain text");
			});
			const ctx = createCallbackQueryContext({
				message: {
					delete: mock(() => Promise.resolve()),
					hasAttachment: () => true,
				},
			});
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.message.delete).toHaveBeenCalled();
			expect(ctx.send).toHaveBeenCalledWith("plain text", {
				reply_markup: undefined,
			});
		});

		test("calls answer() on callback_query context", async () => {
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.text("hi");
			});
			const ctx = createCallbackQueryContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.answer).toHaveBeenCalled();
		});

		test("does nothing when hasMessage() returns false", async () => {
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.text("hi");
			});
			const ctx = createCallbackQueryContext({
				hasMessage: () => false,
				message: undefined,
			});
			// Override is() to also say callback_query but with message present for strategy
			ctx.is = (type: string) => type === "callback_query";
			await view.renderWithContext(ctx, {}, []);

			// Should have called answer but not edit/send
			expect(ctx.answer).toHaveBeenCalled();
		});
	});

	describe("forced strategy", () => {
		test("force send on callback_query context", async () => {
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.text("forced send");
			});
			const ctx = createCallbackQueryContext();
			await view.renderWithContext(ctx, {}, [], "send");

			expect(ctx.send).toHaveBeenCalledWith("forced send", {
				reply_markup: undefined,
			});
			expect(ctx.editText).not.toHaveBeenCalled();
			expect(ctx.answer).toHaveBeenCalled();
		});

		test("force edit falls back to send on message context", async () => {
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.text("edit attempt");
			});
			const ctx = createMessageContext();
			await view.renderWithContext(ctx, {}, [], "edit");

			// message context can't edit, so it sends
			expect(ctx.send).toHaveBeenCalledWith("edit attempt", {
				reply_markup: undefined,
			});
		});
	});

	describe("globals injection", () => {
		test("globals are available via this in render callback", async () => {
			type Globals = { greeting: string };
			const view = new ViewRender<Globals, []>(function (
				this: WithResponseContext<Globals>,
			) {
				return this.response.text(this.greeting);
			});
			const ctx = createMessageContext();
			await view.renderWithContext(ctx, { greeting: "Hola" }, []);

			expect(ctx.send).toHaveBeenCalledWith("Hola", {
				reply_markup: undefined,
			});
		});
	});

	describe("arguments passing", () => {
		test("render callback receives args", async () => {
			const view = new ViewRender<{}, [string, number]>(function (
				this: WithResponseContext<{}>,
				name: string,
				count: number,
			) {
				return this.response.text(`${name}: ${count}`);
			});
			const ctx = createMessageContext();
			await view.renderWithContext(ctx, {}, ["Alice", 42]);

			expect(ctx.send).toHaveBeenCalledWith("Alice: 42", {
				reply_markup: undefined,
			});
		});
	});

	describe("async render callback", () => {
		test("supports async render functions", async () => {
			const view = new ViewRender<{}, []>(async function (
				this: WithResponseContext<{}>,
			) {
				await Promise.resolve();
				return this.response.text("async result");
			});
			const ctx = createMessageContext();
			await view.renderWithContext(ctx, {}, []);

			expect(ctx.send).toHaveBeenCalledWith("async result", {
				reply_markup: undefined,
			});
		});
	});

	describe("return values", () => {
		test("returns MessageContext from send()", async () => {
			const mockMessage = { message_id: 42, chat: { id: 1 } };
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.text("hello");
			});
			const ctx = createMessageContext();
			ctx.send = mock(() => Promise.resolve(mockMessage as any)); // partial mock

			const result = await view.renderWithContext(ctx, {}, []);

			expect(result).toBe(mockMessage as any);
		});

		test("returns MessageContext from sendMedia()", async () => {
			const mockMessage = { message_id: 7, chat: { id: 1 } };
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.media({ type: "photo", media: "file_id" });
			});
			const ctx = createMessageContext();
			ctx.sendMedia = mock(() => Promise.resolve(mockMessage as any)); // partial mock

			const result = await view.renderWithContext(ctx, {}, []);

			expect(result).toBe(mockMessage as any);
		});

		test("returns MessageContext[] from sendMediaGroup()", async () => {
			const mockMessages = [{ message_id: 1 }, { message_id: 2 }];
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.media([
					{ type: "photo" as const, media: "f1" },
					{ type: "photo" as const, media: "f2" },
				]);
			});
			const ctx = createMessageContext();
			ctx.sendMediaGroup = mock(() => Promise.resolve(mockMessages as any)); // partial mock

			const result = await view.renderWithContext(ctx, {}, []);

			expect(result).toBe(mockMessages as any);
		});

		test("returns result from editText()", async () => {
			const mockResult = { message_id: 99 };
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.text("edited");
			});
			const ctx = createCallbackQueryContext();
			ctx.editText = mock(() => Promise.resolve(mockResult as any)); // partial mock

			const result = await view.renderWithContext(ctx, {}, []);

			expect(result).toBe(mockResult as any);
		});

		test("returns result from editMedia()", async () => {
			const mockResult = { message_id: 55 };
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response.media({ type: "photo", media: "file_id" });
			});
			const ctx = createCallbackQueryContext();
			ctx.editMedia = mock(() => Promise.resolve(mockResult as any)); // partial mock

			const result = await view.renderWithContext(ctx, {}, []);

			expect(result).toBe(mockResult as any);
		});

		test("returns undefined when response is empty", async () => {
			const view = new ViewRender<{}, []>(function (this: WithResponseContext<{}>) {
				return this.response;
			});
			const ctx = createMessageContext();

			const result = await view.renderWithContext(ctx, {}, []);

			expect(result).toBeUndefined();
		});
	});
});
