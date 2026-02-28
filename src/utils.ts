import type {
	BotLike,
	Context,
	ContextType,
	TelegramInlineKeyboardMarkup,
} from "gramio";
import type { ViewAdapter, ViewMap } from "./adapters/types.ts";
import type { RenderResult, RenderSendResult, ViewRender } from "./render.ts";
import type { ResponseView } from "./response.ts";
import type { ViewBuilder } from "./view.ts";

export type WithResponseContext<T> = T & {
	response: ResponseView;
};

export type ExtractViewArgs<View extends ViewRender<any, any>> =
	View extends ViewRender<any, infer Args> ? Args : never;

export interface InitViewsBuilderReturn<Globals extends object> {
	(): ViewBuilder<Globals>;

	from: <M extends ViewMap>(
		adapter:
			| ViewAdapter<Globals, M>
			| ((globals: Globals) => ViewAdapter<Globals, M>),
	) => InitViewsBuilderWithAdapterReturn<Globals, M>;

	buildRender: (
		context: Context<BotLike>,
		globals: Globals,
	) => {
		<View extends ViewRender<any, any>>(
			view: View,
			...args: ExtractViewArgs<View>
		): Promise<RenderResult>;

		send: <View extends ViewRender<any, any>>(
			view: View,
			...args: ExtractViewArgs<View>
		) => Promise<RenderSendResult | undefined>;

		edit: <View extends ViewRender<any, any>>(
			view: View,
			...args: ExtractViewArgs<View>
		) => Promise<RenderResult>;
	};
}

export interface InitViewsBuilderWithAdapterReturn<
	Globals extends object,
	M extends ViewMap,
> {
	(): ViewBuilder<Globals>;

	adapter:
		| ViewAdapter<Globals, M>
		| ((globals: Globals) => ViewAdapter<Globals, M>);

	buildRender: (
		context: Context<BotLike>,
		globals: Globals,
	) => AdapterRenderFunction<Globals, M>;
}

export type AdapterRenderFunction<Globals extends object, M extends ViewMap> = {
	<View extends ViewRender<any, any>>(
		view: View,
		...args: ExtractViewArgs<View>
	): Promise<RenderResult>;
	<K extends keyof M & string>(
		key: K,
		...args: M[K] extends void ? [] : [M[K]]
	): Promise<RenderResult>;

	send: {
		<View extends ViewRender<any, any>>(
			view: View,
			...args: ExtractViewArgs<View>
		): Promise<RenderSendResult | undefined>;
		<K extends keyof M & string>(
			key: K,
			...args: M[K] extends void ? [] : [M[K]]
		): Promise<RenderSendResult | undefined>;
	};

	edit: {
		<View extends ViewRender<any, any>>(
			view: View,
			...args: ExtractViewArgs<View>
		): Promise<RenderResult>;
		<K extends keyof M & string>(
			key: K,
			...args: M[K] extends void ? [] : [M[K]]
		): Promise<RenderResult>;
	};
};

export function isInlineMarkup(
	markup: unknown,
): markup is TelegramInlineKeyboardMarkup {
	if (!markup || typeof markup !== "object") {
		return false;
	}
	if ("toJSON" in markup && typeof markup.toJSON === "function") {
		const json = markup.toJSON();
		return "inline_keyboard" in json;
	}
	return "inline_keyboard" in markup;
}
