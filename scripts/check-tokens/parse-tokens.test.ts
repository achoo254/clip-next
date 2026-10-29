// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTokenBlocks, resolveRootTokens } from "./parse-tokens.js";
import { TOKENS_FILE } from "./tokens-file.js";

const SAMPLE = `
/* header with { braces } inside a comment */
:root { --c-bg: #fff; --c-text: #111; --radius-md: 12px; }
:root { --c-text: #222 }
`;

describe("parseTokenBlocks", () => {
	it("records custom properties with their selector context", () => {
		const blocks = parseTokenBlocks(
			`${SAMPLE}@media (min-width:768px) { :root { --gutter: 24px } }`,
		);
		expect(blocks.map((b) => b.context)).toEqual([
			[":root"],
			[":root"],
			["@media (min-width: 768px)", ":root"],
		]);
		expect(blocks[0]?.tokens.get("--radius-md")).toBe("12px");
	});

	it("rejects unbalanced input", () => {
		expect(() => parseTokenBlocks(":root { --a: 1;")).toThrow(/unclosed/);
	});
});

describe("resolveRootTokens", () => {
	it("merges the :root blocks, later ones winning", () => {
		const tokens = resolveRootTokens(SAMPLE);
		expect(tokens.get("--c-bg")).toBe("#fff");
		expect(tokens.get("--c-text")).toBe("#222");
	});

	it("refuses a second theme or media-scoped tokens", () => {
		expect(() =>
			resolveRootTokens(`${SAMPLE}:root[data-theme="light"] { --c-bg: #fff }`),
		).toThrow(/one theme/);
		expect(() =>
			resolveRootTokens(`${SAMPLE}@media (prefers-color-scheme: light) { :root { --c-bg: #fff } }`),
		).toThrow(/one theme/);
	});

	it("reads the app's tokens.css", () => {
		const tokens = resolveRootTokens(readFileSync(TOKENS_FILE, "utf8"));
		expect(tokens.get("--c-red-solid")).toMatch(/^#[0-9a-f]{6}$/);
		expect(tokens.get("--font-display")).toContain("Oswald");
	});
});
