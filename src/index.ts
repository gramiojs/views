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

		render.edit = (viewRender, ...args) => {
			// @ts-expect-error
			return viewRender.renderWithContext(context, globals, args, "edit");
		};

		return render;
	};

	returnResult.from = <M extends ViewMap>(
		adapterOrFactory:
			| ViewAdapter<Globals, M>
			| ((globals: Globals) => ViewAdapter<Globals, M>),
	): InitViewsBuilderWithAdapterReturn<Globals, M> => {
		const result: InitViewsBuilderWithAdapterReturn<Globals, M> = (() => {
			return new ViewBuilder<Globals>();
		}) as InitViewsBuilderWithAdapterReturn<Globals, M>;

		result.adapter = adapterOrFactory;

		result.buildRender = (context, globals) => {
			const ctx = context as any;

			const resolveGlobals = (): Globals =>
				typeof globals === "function" ? (globals as () => Globals)() : globals;

			const resolveAdapter = (resolved: Globals) =>
				typeof adapterOrFactory === "function"
					? adapterOrFactory(resolved)
					: adapterOrFactory;

			const dispatch = (
				viewOrKey: any,
				args: any[],
				strategy?: "send" | "edit",
			) => {
				const resolved = resolveGlobals();
				if (typeof viewOrKey === "string") {
					const adapter = resolveAdapter(resolved);
					const viewRender = adapter.resolve(viewOrKey);
					return viewRender.renderWithContext(
						ctx,
						resolved,
						args as any,
						strategy,
					);
				}
				return viewOrKey.renderWithContext(ctx, resolved, args, strategy);
			};

			const render = (viewOrKey: any, ...args: any[]) =>
				dispatch(viewOrKey, args);
			render.send = (viewOrKey: any, ...args: any[]) =>
				dispatch(viewOrKey, args, "send");
			render.edit = (viewOrKey: any, ...args: any[]) =>
				dispatch(viewOrKey, args, "edit");

			return render as any;
		};

		return result;
	};

	return returnResult;
}

export type { ViewAdapter, ViewMap } from "./adapters/types.ts";
