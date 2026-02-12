import { ViewRender } from "../render.ts";
import type { WithResponseContext } from "../utils.ts";
import type { ViewAdapter, ViewMap } from "./types.ts";

export interface JsonViewDefinition {
	text?: string;
}

function interpolate(
	template: string,
	params: Record<string, unknown>,
): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
		return key in params ? String(params[key]) : `{{${key}}}`;
	});
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
