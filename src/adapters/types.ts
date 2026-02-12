import type { ViewRender } from "../render.ts";

// biome-ignore lint/suspicious/noConfusingVoidType: void semantically means "no params" in view map
export type ViewMap = Record<string, object | void>;

export interface ViewAdapter<Globals extends object, M extends ViewMap> {
	resolve<K extends keyof M & string>(
		key: K,
	): ViewRender<Globals, M[K] extends void ? [] : [M[K]]>;
	keys?(): (keyof M & string)[];
}
