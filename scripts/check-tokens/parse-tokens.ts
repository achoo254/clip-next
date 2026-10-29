/**
 * Minimal parser for `apps/web/src/styles/tokens.css`. It only needs to
 * understand custom-property declarations grouped by their (possibly nested)
 * selector context, which is all the token file contains.
 */

export type TokenMap = Map<string, string>;

export interface TokenBlock {
	/** Selector/at-rule chain, outermost first, whitespace-normalised. */
	context: string[];
	tokens: TokenMap;
}

const ROOT = ":root";

function normalise(prelude: string): string {
	const collapsed = prelude
		.replace(/\s+/g, " ")
		.replace(/\(\s*/g, "(")
		.replace(/\s*\)/g, ")")
		.replace(/'/g, '"')
		.trim();
	// Media features are written either `(a:b)` or `(a: b)`; selectors such as
	// `:root:not(...)` must keep their colons untouched.
	return collapsed.startsWith("@")
		? collapsed.replace(/\s*:\s*/g, ": ")
		: collapsed;
}

function parseDeclarations(body: string): TokenMap {
	const tokens: TokenMap = new Map();
	for (const raw of body.split(";")) {
		const colon = raw.indexOf(":");
		if (colon === -1) continue;
		const name = raw.slice(0, colon).trim();
		if (!name.startsWith("--")) continue;
		tokens.set(name, raw.slice(colon + 1).trim());
	}
	return tokens;
}

/** Splits the stylesheet into blocks of custom properties with their context. */
export function parseTokenBlocks(css: string): TokenBlock[] {
	const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
	const blocks: TokenBlock[] = [];
	const stack: string[] = [];
	const bodies: string[] = [];
	let buffer = "";

	for (const char of source) {
		if (char === "{") {
			stack.push(normalise(buffer));
			bodies.push("");
			buffer = "";
		} else if (char === "}") {
			const body = (bodies.pop() ?? "") + buffer;
			const tokens = parseDeclarations(body);
			if (tokens.size > 0) blocks.push({ context: [...stack], tokens });
			stack.pop();
			buffer = "";
		} else if (char === ";" && stack.length > 0) {
			bodies[bodies.length - 1] += `${buffer};`;
			buffer = "";
		} else {
			buffer += char;
		}
	}
	if (stack.length > 0) {
		throw new Error("tokens.css has an unclosed block");
	}
	return blocks;
}

function contextIs(block: TokenBlock, expected: string[]): boolean {
	return (
		block.context.length === expected.length &&
		block.context.every((part, index) => part === expected[index])
	);
}

/**
 * The tokens the browser computes: every top-level `:root` block, later ones
 * winning. Clip has one theme, so there are no dark or media-scoped blocks to
 * layer; a token file that adds one fails here, where the contrast check
 * would otherwise miss it.
 */
export function resolveRootTokens(css: string): TokenMap {
	const tokens: TokenMap = new Map();
	for (const block of parseTokenBlocks(css)) {
		if (!contextIs(block, [ROOT])) {
			throw new Error(
				`tokens.css has tokens outside :root (${block.context.join(" ")}); Clip has one theme`,
			);
		}
		for (const [name, value] of block.tokens) tokens.set(name, value);
	}
	if (tokens.size === 0) throw new Error("tokens.css has no :root block");
	return tokens;
}
