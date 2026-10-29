/**
 * Catalogue of text/background pairs of Clip's one theme. Pairs mirror how app.css combines the tokens: every
 * text colour on every background it is put on, solid buttons, tinted alerts and badges, and the UI borders.
 */

/** A colour reference: a token, or a token mixed into another (srgb). */
export type ColorRef =
	| string
	| { mix: string; percent: number; into: string; label: string };

export interface ContrastPair {
	fg: ColorRef;
	bg: ColorRef;
	kind: "text" | "ui";
}

/** Background tint of alerts and badges: `color-mix(in srgb, X 14%, surface)`. */
function tint(token: string, percent = 14): ColorRef {
	return {
		mix: token,
		percent,
		into: "--c-surface",
		label: `${token}@${percent}%`,
	};
}

/** Every background text sits on: the room, cards, raised cards (tickets), inputs, the film strip. */
const BACKGROUNDS = [
	"--c-bg",
	"--c-bg-deep",
	"--c-surface",
	"--c-surface-raised",
	"--c-surface-subtle",
];

/** Text colours allowed on any of them. */
const TEXT_ON_ANY_BACKGROUND = [
	"--c-text",
	"--c-text-muted",
	"--c-red-text",
	"--c-amber",
	"--c-success",
	"--c-error",
];

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
	...TEXT_ON_ANY_BACKGROUND.flatMap((fg): ContrastPair[] =>
		BACKGROUNDS.map((bg): ContrastPair => ({ fg, bg, kind: "text" })),
	),
	{ fg: "--c-on-red", bg: "--c-red-solid", kind: "text" },
	{ fg: "--c-on-red", bg: "--c-red-solid-hover", kind: "text" },
	{ fg: "--c-on-amber", bg: "--c-amber", kind: "text" },
	{ fg: "--c-on-amber", bg: "--c-amber-hover", kind: "text" },
	// Alert body text sits on a tone tint; badge labels in the tone's own colour.
	{ fg: "--c-text", bg: tint("--c-error"), kind: "text" },
	{ fg: "--c-text", bg: tint("--c-warning"), kind: "text" },
	{ fg: "--c-text", bg: tint("--c-success"), kind: "text" },
	{ fg: "--c-error", bg: tint("--c-error"), kind: "text" },
	{ fg: "--c-amber", bg: tint("--c-amber"), kind: "text" },
	{ fg: "--c-success", bg: tint("--c-success"), kind: "text" },
	{ fg: "--c-text-muted", bg: tint("--c-red", 10), kind: "text" },
	// Field borders, the focus ring and the selected template ring.
	{ fg: "--c-border-strong", bg: "--c-surface", kind: "ui" },
	{ fg: "--c-border-strong", bg: "--c-surface-subtle", kind: "ui" },
	{ fg: "--c-focus", bg: "--c-bg", kind: "ui" },
	{ fg: "--c-focus", bg: "--c-surface-raised", kind: "ui" },
	{ fg: "--c-red", bg: "--c-surface", kind: "ui" },
];
