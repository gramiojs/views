import type { BotLike, ContextType, MaybePromise, MessageContext, TelegramInputMedia } from "gramio";
import { ResponseView } from "./response.ts";
import type { NonEditableMedia } from "./response.ts";
import { isInlineMarkup, type WithResponseContext } from "./utils.ts";

const NON_EDITABLE_TYPES = new Set<string>(["sticker", "voice", "video_note"]);

const responseKey = "response";

export type RenderSendResult = MessageContext<BotLike> | MessageContext<BotLike>[];
// Derive edit result from gramio's actual method signature to stay in sync automatically
type EditResult = Awaited<ReturnType<ContextType<BotLike, "callback_query">["editText"]>>;
export type RenderResult = RenderSendResult | EditResult | undefined;

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
	): Promise<RenderResult> {
		const contextData = this.createContext(globals);
		const result = await this.render.apply(contextData, args);
		const response = result[responseKey];

		const canEdit = context.is("callback_query") && !!context.message;
		const strategy: "send" | "edit" =
			strategyRaw === "send" ? "send" : canEdit ? "edit" : "send";

		let renderResult: RenderResult;

		if (
			strategy === "edit" &&
			context.is("callback_query") &&
			context.message
		) {
			renderResult = await this.performEdit(context, response);
		} else {
			renderResult = await this.performSend(context, response);
		}

		if (context.is("callback_query")) {
			await context.answer();
		}

		return renderResult;
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
	): Promise<RenderSendResult | undefined> {
		const { text, keyboard, media } = response;

		if (Array.isArray(media) && media.length > 1) {
			const lastMedia = media.at(-1);
			if (lastMedia && text) {
				lastMedia.caption = text;
			}
			return context.sendMediaGroup(media);
		} else if (media) {
			const singleMedia = Array.isArray(media) ? media[0] : media;
			// @ts-expect-error — dynamic [type] key is valid for sendMedia but not statically verifiable
			return context.sendMedia({
				type: singleMedia.type,
				[singleMedia.type]: singleMedia.media,
				caption: text,
				reply_markup: keyboard,
			});
		} else if (text) {
			return context.send(text, { reply_markup: keyboard });
		}

		return undefined;
	}

	private async performEdit(
		context: ContextType<BotLike, "callback_query">,
		response: ResponseView["response"],
	): Promise<RenderResult> {
		const { text, keyboard, media } = response;

		if (!context.hasMessage()) {
			return undefined;
		}

		if (Array.isArray(media)) {
			const lastMedia = media.at(-1);
			if (lastMedia && text) {
				lastMedia.caption = text;
			}
			const [, result] = await Promise.all([
				context.message.delete(),
				context.sendMediaGroup(media),
			]);
			return result;
		}

		const hasCurrentMedia = context.message.hasAttachment();
		const hasDesiredMedia = !!media;

		if (hasCurrentMedia && !hasDesiredMedia && text) {
			const [, result] = await Promise.all([
				context.message.delete(),
				context.send(text, { reply_markup: keyboard }),
			]);
			return result;
		}

		if (hasDesiredMedia) {
			if (NON_EDITABLE_TYPES.has(media.type)) {
				// sticker/voice/video_note: media file cannot be changed via Telegram API.
				// Update only what Telegram allows: caption (voice only) and inline keyboard.
				const inlineMarkup = isInlineMarkup(keyboard) ? keyboard : undefined;
				if (media.type === "voice" && text) {
					return context.editCaption(text, { reply_markup: inlineMarkup });
				} else if (keyboard) {
					return context.editReplyMarkup(inlineMarkup);
				}
				return undefined;
			}

			const inlineMarkup = isInlineMarkup(keyboard) ? keyboard : undefined;
			// Safe cast: NonEditableMedia types are handled and returned above
			const editableMedia = media as TelegramInputMedia;
			return context.editMedia(
				{
					type: editableMedia.type,
					media: editableMedia.media,
					caption: text,
				},
				{ reply_markup: inlineMarkup },
			);
		}

		if (!hasCurrentMedia && text) {
			const inlineMarkup = isInlineMarkup(keyboard) ? keyboard : undefined;
			return context.editText(text, { reply_markup: inlineMarkup });
		}

		if (keyboard && !text && !media) {
			const inlineMarkup = isInlineMarkup(keyboard) ? keyboard : undefined;
			return context.editReplyMarkup(inlineMarkup);
		}

		return undefined;
	}
}
