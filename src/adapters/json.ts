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

export interface JsonViewDefinition {
	text?: string;
	keyboard?: JsonKeyboardButton[][];
	reply_keyboard?: JsonReplyKeyboardButton[][];
	resize_keyboard?: boolean;
	one_time_keyboard?: boolean;
	is_persistent?: boolean;
	input_field_placeholder?: string;
	selective?: boolean;
	media?: JsonMediaDefinition | JsonMediaDefinition[];
}

function interpolate(
	template: string,
	params: Record<string, unknown>,
): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
		return key in params ? String(params[key]) : `{{${key}}}`;
	});
}

function interpolateButton(
	button: JsonKeyboardButton,
	params: Record<string, unknown>,
): JsonKeyboardButton {
	const result: JsonKeyboardButton = {
		text: interpolate(button.text, params),
	};
	if (button.callback_data !== undefined)
		result.callback_data = interpolate(button.callback_data, params);
	if (button.url !== undefined) result.url = interpolate(button.url, params);
	return result;
}

function interpolateReplyButton(
	button: JsonReplyKeyboardButton,
	params: Record<string, unknown>,
): JsonReplyKeyboardButton {
	const result: JsonReplyKeyboardButton = {
		text: interpolate(button.text, params),
	};
	if (button.request_contact !== undefined)
		result.request_contact = button.request_contact;
	if (button.request_location !== undefined)
		result.request_location = button.request_location;
	return result;
}

function interpolateMedia(
	media: JsonMediaDefinition,
	params: Record<string, unknown>,
): JsonMediaDefinition {
	return { type: media.type, media: interpolate(media.media, params) };
}

export function createJsonAdapter<
	Globals extends object,
	M extends ViewMap,
>(options: {
	views: Record<keyof M & string, JsonViewDefinition>;
}): ViewAdapter<Globals, M> {
	const views = new Map<string, ViewRender<Globals, any>>();

	for (const [key, definition] of Object.entries(options.views) as [
		string,
		JsonViewDefinition,
	][]) {
		if (definition.keyboard && definition.reply_keyboard) {
			throw new Error(
				`View "${key}" cannot have both "keyboard" and "reply_keyboard"`,
			);
		}

		const callback = function (
			this: WithResponseContext<Globals>,
			params?: Record<string, unknown>,
		) {
			const response = this.response;
			if (definition.text) {
				const text = params
					? interpolate(definition.text, params)
					: definition.text;
				response.text(text);
			}
			if (definition.keyboard) {
				const rows = params
					? definition.keyboard.map((row) =>
							row.map((btn) => interpolateButton(btn, params)),
						)
					: definition.keyboard;
				response.keyboard({ inline_keyboard: rows });
			}
			if (definition.reply_keyboard) {
				const rows = params
					? definition.reply_keyboard.map((row) =>
							row.map((btn) => interpolateReplyButton(btn, params)),
						)
					: definition.reply_keyboard;
				response.keyboard({
					keyboard: rows,
					resize_keyboard: definition.resize_keyboard,
					one_time_keyboard: definition.one_time_keyboard,
					is_persistent: definition.is_persistent,
					input_field_placeholder: definition.input_field_placeholder
						? params
							? interpolate(definition.input_field_placeholder, params)
							: definition.input_field_placeholder
						: undefined,
					selective: definition.selective,
				});
			}
			if (definition.media) {
				if (Array.isArray(definition.media)) {
					const group = params
						? definition.media.map((m) => interpolateMedia(m, params))
						: definition.media;
					response.media(group as any);
				} else {
					const media = params
						? interpolateMedia(definition.media, params)
						: definition.media;
					response.media(media as any);
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
