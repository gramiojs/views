import type { MaybePromise } from "gramio";
import { ViewRender } from "../render.ts";
import type { ResponseView } from "../response.ts";
import type { WithResponseContext } from "../utils.ts";
import type { ViewAdapter, ViewMap } from "./types.ts";

type ViewDefinition<Globals extends object, Params> = (
	this: WithResponseContext<Globals>,
	...args: Params extends void ? [] : [Params]
) => MaybePromise<ResponseView>;

export function defineAdapter<Globals extends object, M extends ViewMap>(
	definitions: { [K in keyof M & string]: ViewDefinition<Globals, M[K]> },
): ViewAdapter<Globals, M> {
	const views = new Map<string, ViewRender<Globals, any>>();

	for (const [key, callback] of Object.entries(definitions)) {
		views.set(key, new ViewRender(callback as any));
	}

	return {
		resolve<K extends keyof M & string>(key: K) {
			const view = views.get(key);
			if (!view) {
				throw new Error(`View "${key}" not found in adapter`);
			}
			return view as ViewRender<Globals, M[K] extends void ? [] : [M[K]]>;
		},
		keys() {
			return [...views.keys()] as (keyof M & string)[];
		},
	};
}
