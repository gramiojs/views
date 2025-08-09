import type { MaybePromise } from "gramio";
import { ViewRender } from "./render.ts";
import type { ResponseView } from "./response.ts";
import type { WithResponseContext } from "./utils.ts";

export class ViewBuilder<Globals extends object> {
	render<Args extends any[]>(
		callback: (
			this: WithResponseContext<Globals>,
			...args: Args
		) => MaybePromise<ResponseView>,
	) {
		return new ViewRender(callback);
	}
}
