import type { BotLike, ContextType, MaybePromise, TelegramInputMedia } from "gramio";
import { ResponseView } from "./response.ts";
import type { NonEditableMedia } from "./response.ts";
import { isInlineMarkup, type WithResponseContext } from "./utils.ts";

const NON_EDITABLE_TYPES = new Set<string>(["sticker", "voice", "video_note"]);

const responseKey = "response";

export class ViewRender<Globals extends object, Args extends any[]> {
	constructor(
		private readonly render: (
			this: WithResponseContext<Globals>,
			...args: Args
		) => MaybePromise<ResponseView>,
	) {}

	async renderWithContext(
		context: ContextType<BotLike, "message" | "callback_query">,
		globals: Globals,
		args: Args,
		strategyRaw?: "send" | "edit",
	) {
		const contextData = this.createContext(globals);
		const result = await this.render.apply(contextData, args);
		const response = result[responseKey];

		const canEdit = context.is("callback_query") && !!context.message;
		const strategy: "send" | "edit" =
			strategyRaw === "send" ? "send" : canEdit ? "edit" : "send";

		if (
			strategy === "edit" &&
			context.is("callback_query") &&
			context.message
		) {
			await this.performEdit(context, response);
		} else {
			await this.performSend(context, response);
		}

		if (context.is("callback_query")) {
			await context.answer();
		}
	}

	private createContext(globals: Globals): WithResponseContext<Globals> {
		return {
			response: new ResponseView(),
			...globals,
		};
	}

	private async performSend(
		context: ContextType<BotLike, "message" | "callback_query">,
		response: ResponseView["response"],
	) {
		const { text, keyboard, media } = response;

		if (Array.isArray(media) && media.length > 1) {
			const lastMedia = media.at(-1);
			if (lastMedia && text) {
				lastMedia.caption = text;
			}
			await context.sendMediaGroup(media);
		} else if (media) {
			const singleMedia = Array.isArray(media) ? media[0] : media;
			// @ts-expect-error
			await context.sendMedia({
				type: singleMedia.type,
				[singleMedia.type]: singleMedia.media,
				caption: text,
				reply_markup: keyboard,
			});
		} else if (text) {
			await context.send(text, { reply_markup: keyboard });
		}
	}

	private async performEdit(
		context: ContextType<BotLike, "callback_query">,
		response: ResponseView["response"],
	) {
		const { text, keyboard, media } = response;

		if (!context.hasMessage()) {
			return;
		}

		if (Array.isArray(media)) {
			const lastMedia = media.at(-1);
			if (lastMedia && text) {
				lastMedia.caption = text;
			}
			await Promise.all([
				context.message.delete(),
				context.sendMediaGroup(media),
			]);
			return;
		}

		const hasCurrentMedia = context.message.hasAttachment();
		const hasDesiredMedia = !!media;

		if (hasCurrentMedia && !hasDesiredMedia && text) {
			await Promise.all([
				context.message.delete(),
				context.send(text, { reply_markup: keyboard }),
			]);
			return;
		}

		if (hasDesiredMedia) {
			if (NON_EDITABLE_TYPES.has(media.type)) {
				// sticker/voice/video_note: media file cannot be changed via Telegram API.
				// Update only what Telegram allows: caption (voice only) and inline keyboard.
				const inlineMarkup = isInlineMarkup(keyboard) ? keyboard : undefined;
				if (media.type === "voice" && text) {
					await context.editCaption(text, { reply_markup: inlineMarkup });
				} else if (keyboard) {
					await context.editReplyMarkup(inlineMarkup);
				}
				return;
			}

			const inlineMarkup = isInlineMarkup(keyboard) ? keyboard : undefined;
			// Safe cast: NonEditableMedia types are handled and returned above
			const editableMedia = media as TelegramInputMedia;
			await context.editMedia(
				{
					type: editableMedia.type,
					media: editableMedia.media,
					caption: text,
				},
				{ reply_markup: inlineMarkup },
			);
			return;
		}

		if (!hasCurrentMedia && text) {
			const inlineMarkup = isInlineMarkup(keyboard) ? keyboard : undefined;
			await context.editText(text, { reply_markup: inlineMarkup });
			return;
		}

		if (keyboard && !text && !media) {
			const inlineMarkup = isInlineMarkup(keyboard) ? keyboard : undefined;
			await context.editReplyMarkup(inlineMarkup);
			return;
		}
	}
}
