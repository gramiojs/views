import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
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
	const entries = await readdir(dirPath);
	const result: Record<string, JsonViewDefinition> = {};

	for (const entry of entries) {
		if (!entry.endsWith(".json")) continue;
		const filePath = join(dirPath, entry);
		const content = await readFile(filePath, "utf-8");
		const key = basename(entry, ".json");
		result[key] = JSON.parse(content);
	}

	return result;
}
