/**
 * Clip's design tokens: its own single theme in apps/web/src/styles/tokens.css, imported first by the web app
 * (apps/web/src/main.tsx). The literal scan skips this one file; the contrast check reads it.
 */
import { fileURLToPath } from "node:url";

export const TOKENS_FILE = fileURLToPath(new URL("../../apps/web/src/styles/tokens.css", import.meta.url));
