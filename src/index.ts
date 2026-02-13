import type { ViewAdapter, ViewMap } from "./adapters/types.ts";
import type {
	InitViewsBuilderReturn,
	InitViewsBuilderWithAdapterReturn,
} from "./utils.ts";
import { ViewBuilder } from "./view.ts";

export function initViewsBuilder<
	Globals extends object,
>(): InitViewsBuilderReturn<Globals> {
	const returnResult: InitViewsBuilderReturn<Globals> = () => {
		const builder = new ViewBuilder<Globals>();

		return builder;
	};

	returnResult.buildRender = (context, globals) => {
		// @ts-expect-error
		const render: ReturnType<InitViewsBuilderReturn<Globals>["buildRender"]> = (
			viewRender,
			...args
		) => {
			// @ts-expect-error
			return viewRender.renderWithContext(context, globals, args);
		};

		// @ts-expect-error
		render.send = (viewRender, ...args) => {
			// @ts-expect-error
			return viewRender.renderWithContext(context, globals, args, "send");
		};

		// @ts-expect-error
		render.edit = (viewRender, ...args) => {
			// @ts-expect-error
			return viewRender.renderWithContext(context, globals, args, "edit");
		};

		return render;
	};

	returnResult.from = <M extends ViewMap>(
		adapter: ViewAdapter<Globals, M>,
	): InitViewsBuilderWithAdapterReturn<Globals, M> => {
		const result: InitViewsBuilderWithAdapterReturn<Globals, M> = (() => {
			return new ViewBuilder<Globals>();
		}) as InitViewsBuilderWithAdapterReturn<Globals, M>;

		result.adapter = adapter;

		result.buildRender = (context, globals) => {
			const ctx = context as any;

			const render = (viewOrKey: any, ...args: any[]) => {
				if (typeof viewOrKey === "string") {
					const viewRender = adapter.resolve(viewOrKey);
					return viewRender.renderWithContext(ctx, globals, args as any);
				}
				return viewOrKey.renderWithContext(ctx, globals, args);
			};

			render.send = (viewOrKey: any, ...args: any[]) => {
				if (typeof viewOrKey === "string") {
					const viewRender = adapter.resolve(viewOrKey);
					return viewRender.renderWithContext(
						ctx,
						globals,
						args as any,
						"send",
					);
				}
				return viewOrKey.renderWithContext(ctx, globals, args, "send");
			};

			render.edit = (viewOrKey: any, ...args: any[]) => {
				if (typeof viewOrKey === "string") {
					const viewRender = adapter.resolve(viewOrKey);
					return viewRender.renderWithContext(
						ctx,
						globals,
						args as any,
						"edit",
					);
				}
				return viewOrKey.renderWithContext(ctx, globals, args, "edit");
			};

			return render as any;
		};

		return result;
	};

	return returnResult;
}

export type {
	JsonReplyKeyboardButton,
	JsonViewDefinition,
	ViewAdapter,
	ViewMap,
} from "./adapters/index.ts";
export {
	createJsonAdapter,
	defineAdapter,
	loadJsonViews,
	loadJsonViewsDir,
} from "./adapters/index.ts";
