import { ViewRender } from "../render.ts";
import type { WithResponseContext } from "../utils.ts";
import type { ViewAdapter, ViewMap } from "./types.ts";

export interface JsonKeyboardButton {
	text: string;
	callback_data?: string;
	url?: string;
}

export interface JsonReplyKeyboardButton {
	text: string;
	request_contact?: boolean;
	request_location?: boolean;
}

export interface JsonMediaDefinition {
	type: "photo" | "video" | "animation" | "audio" | "document";
	media: string;
}

export type JsonReplyMarkup =
	| { inline_keyboard: JsonKeyboardButton[][] }
	| {
			keyboard: JsonReplyKeyboardButton[][];
			resize_keyboard?: boolean;
			one_time_keyboard?: boolean;
			is_persistent?: boolean;
			input_field_placeholder?: string;
			selective?: boolean;
		}
	| { remove_keyboard: true; selective?: boolean }
	| { force_reply: true; input_field_placeholder?: string; selective?: boolean };

export interface JsonViewDefinition {
	text?: string;
	reply_markup?: JsonReplyMarkup;
	media?: JsonMediaDefinition | JsonMediaDefinition[];
}

type Interpolate = (template: string) => string;

function getByPath(obj: object, path: string): unknown {
	let current: any = obj;
	for (const key of path.split(".")) {
		if (current == null) return undefined;
		current = current[key];
	}
	return current;
}

function createInterpolate(
	globals?: object,
	resolve?: (key: string, globals: any) => string | undefined,
	params?: Record<string, unknown>,
): Interpolate {
	return (template) =>
		template.replace(/\{\{([^}]+)\}\}/g, (match, rawKey) => {
			const key = (rawKey as string).trim();
			if (key.startsWith("$") && globals) {
				const value = getByPath(globals, key.slice(1));
				return value !== undefined ? String(value) : match;
			}
			if (resolve && globals) {
				const resolved = resolve(key, globals);
				if (resolved !== undefined) return resolved;
			}
			if (params && key in params) return String(params[key]);
			return match;
		});
}

function interpolateButton(
	button: JsonKeyboardButton,
	interpolate: Interpolate,
): JsonKeyboardButton {
	const result: JsonKeyboardButton = {
		text: interpolate(button.text),
	};
	if (button.callback_data !== undefined)
		result.callback_data = interpolate(button.callback_data);
	if (button.url !== undefined) result.url = interpolate(button.url);
	return result;
}

function interpolateReplyButton(
	button: JsonReplyKeyboardButton,
	interpolate: Interpolate,
): JsonReplyKeyboardButton {
	const result: JsonReplyKeyboardButton = {
		text: interpolate(button.text),
	};
	if (button.request_contact !== undefined)
		result.request_contact = button.request_contact;
	if (button.request_location !== undefined)
		result.request_location = button.request_location;
	return result;
}

function interpolateReplyMarkup(
	markup: JsonReplyMarkup,
	interpolate: Interpolate,
): JsonReplyMarkup {
	if ("inline_keyboard" in markup) {
		return {
			inline_keyboard: markup.inline_keyboard.map((row) =>
				row.map((btn) => interpolateButton(btn, interpolate)),
			),
		};
	}
	if ("keyboard" in markup) {
		return {
			...markup,
			keyboard: markup.keyboard.map((row) =>
				row.map((btn) => interpolateReplyButton(btn, interpolate)),
			),
			input_field_placeholder: markup.input_field_placeholder
				? interpolate(markup.input_field_placeholder)
				: markup.input_field_placeholder,
		};
	}
	if ("force_reply" in markup) {
		return {
			...markup,
			input_field_placeholder: markup.input_field_placeholder
				? interpolate(markup.input_field_placeholder)
				: markup.input_field_placeholder,
		};
	}
	return markup;
}

function interpolateMedia(
	media: JsonMediaDefinition,
	interpolate: Interpolate,
): JsonMediaDefinition {
	return { type: media.type, media: interpolate(media.media) };
}

export function createJsonAdapter<
	Globals extends object,
	M extends ViewMap,
>(options: {
	views: Record<keyof M & string, JsonViewDefinition>;
	resolve?: (key: string, globals: Globals) => string | undefined;
}): ViewAdapter<Globals, M> {
	const views = new Map<string, ViewRender<Globals, any>>();
	const resolveOpt = options.resolve;

	for (const [key, definition] of Object.entries(options.views) as [
		string,
		JsonViewDefinition,
	][]) {
		const callback = function (
			this: WithResponseContext<Globals>,
			params?: Record<string, unknown>,
		) {
			const { response, ...globals } = this as any;
			const interpolate = createInterpolate(globals, resolveOpt, params);

			if (definition.text) {
				response.text(interpolate(definition.text));
			}
			if (definition.reply_markup) {
				response.keyboard(
					interpolateReplyMarkup(definition.reply_markup, interpolate),
				);
			}
			if (definition.media) {
				if (Array.isArray(definition.media)) {
					response.media(
						definition.media.map((m) =>
							interpolateMedia(m, interpolate),
						) as any,
					);
				} else {
					response.media(
						interpolateMedia(definition.media, interpolate) as any,
					);
				}
			}
			return response;
		};
		views.set(key, new ViewRender(callback as any));
	}

	return {
		resolve<K extends keyof M & string>(key: K) {
			const view = views.get(key);
			if (!view) {
				throw new Error(`View "${key}" not found in JSON adapter`);
			}
			return view as ViewRender<Globals, M[K] extends void ? [] : [M[K]]>;
		},
		keys() {
			return [...views.keys()] as (keyof M & string)[];
		},
	};
}
