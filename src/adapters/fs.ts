import { readFile, readdir } from "node:fs/promises";
import { join, sep } from "node:path";
import type { JsonViewDefinition } from "./json.ts";

export async function loadJsonViews(
	filePath: string,
): Promise<Record<string, JsonViewDefinition>> {
	const content = await readFile(filePath, "utf-8");
	return JSON.parse(content);
}

export async function loadJsonViewsDir(
	dirPath: string,
): Promise<Record<string, JsonViewDefinition>> {
	const entries = await readdir(dirPath, { recursive: true });
	const result: Record<string, JsonViewDefinition> = {};

	for (const entry of entries) {
		if (!entry.endsWith(".json")) continue;
		const filePath = join(dirPath, entry);
		const content = await readFile(filePath, "utf-8");
		const parsed = JSON.parse(content);

		if (typeof parsed !== "object" || parsed === null) {
			throw new Error(
				`Invalid JSON in ${entry}: expected object with view definitions`,
			);
		}

		// Get the base key from the file path (e.g., "goods/items.json" → "goods.items")
		const baseKey = entry.slice(0, -".json".length).split(sep).join(".");

		// Each file must use multi-view format: { "key": { text: ... }, ... }
		for (const [subKey, viewDef] of Object.entries(parsed)) {
			result[`${baseKey}.${subKey}`] = viewDef as JsonViewDefinition;
		}
	}

	return result;
}
