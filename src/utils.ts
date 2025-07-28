import type { BotLike, Context, TelegramInlineKeyboardMarkup } from "gramio";
import type { ViewRender } from "./render.ts";
import type { ResponseView } from "./response.ts";
import type { ViewBuilder } from "./view.ts";

export type WithResponseContext<T> = T & {
	response: ResponseView;
};

export type ExtractViewArgs<View extends ViewRender<any, any>> =
	View extends ViewRender<any, infer Args> ? Args : never;

export type RenderFunction = <
	View extends ViewRender<any, any>,
	Args extends any[] = ExtractViewArgs<View>,
>(
	view: View,
	...args: Args
) => void;

export interface InitViewsBuilderReturn<Globals extends object> {
	(): ViewBuilder<Globals>;

	buildRender: (
		context: Context<BotLike>,
		globals: Globals,
	) => <View extends ViewRender<any, any>>(
		view: View,
		...args: ExtractViewArgs<View>
	) => void;
}

export function isInlineMarkup(
	markup: any,
): markup is TelegramInlineKeyboardMarkup {
	if (!markup || typeof markup !== "object") {
		return false;
	}
	if (typeof markup.toJSON === "function") {
		const json = markup.toJSON();
		return "inline_keyboard" in json;
	}
	return "inline_keyboard" in markup;
}
