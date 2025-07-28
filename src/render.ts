import type { BotLike, Context, TelegramInputMedia } from "gramio";
import { ResponseView } from "./response.ts";
import { isInlineMarkup, type WithResponseContext } from "./utils.ts";

const responseKey = "response";

export class ViewRender<Globals extends object, Args extends any[]> {
	constructor(
		private readonly render: (
			this: WithResponseContext<Globals>,
			...args: Args
		) => ResponseView,
	) {}

	async renderWithContext(
		context: Context<BotLike>,
		globals: Globals,
		args: Args,
	) {
		const contextData = this.createContext(globals);
		const result = this.render.apply(contextData, args);
		const response = result[responseKey];
		const { text, keyboard, media: desiredMedia } = response;

		if (
			context.is("message") ||
			(context.is("callback_query") && !context.message)
		) {
			if (desiredMedia) {
				// @ts-expect-error
				await context.sendMedia({
					type: desiredMedia.type,
					[desiredMedia.type]: desiredMedia.media,
					caption: text,
					reply_markup: keyboard,
				});
			} else if (text) {
				await context.send(text, { reply_markup: keyboard });
			}
			if (context.is("callback_query")) {
				await context.answer();
			}
			return;
		}

		if (context.is("callback_query") && context.message) {
			const isCurrentMedia = context.message.hasAttachment();
			const isDesiredMedia = !!desiredMedia;

			if (isCurrentMedia && !isDesiredMedia && text) {
				await context.message.delete();
				await context.send(text, { reply_markup: keyboard });
				return;
			}

			if (isDesiredMedia) {
				const media: TelegramInputMedia = {
					type: desiredMedia.type,
					media: desiredMedia.media,
					caption: text,
				};
				const inlineMarkup = isInlineMarkup(keyboard) ? keyboard : undefined;
				await context.editMedia(media, { reply_markup: inlineMarkup });
				return;
			}

			if (!isCurrentMedia && text) {
				const inlineMarkup = isInlineMarkup(keyboard) ? keyboard : undefined;
				await context.editText(text, { reply_markup: inlineMarkup });
				return;
			}

			if (keyboard && !text && !desiredMedia) {
				const inlineMarkup = isInlineMarkup(keyboard) ? keyboard : undefined;
				await context.editReplyMarkup(inlineMarkup);
				return;
			}
		}
	}

	private createContext(globals: Globals): WithResponseContext<Globals> {
		return {
			response: new ResponseView(),
			...globals,
		};
	}
}
