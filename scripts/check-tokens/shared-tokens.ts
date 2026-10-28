/**
 * Clip's design tokens are the shared ones of every hoandat.com app: `@achoo254/app-shell/tokens.css`, which the
 * web app imports first (apps/web/src/main.tsx). The token checks read that file, as the web app installs it.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const WEB_PACKAGE = fileURLToPath(new URL("../../apps/web/package.json", import.meta.url));

export const SHARED_TOKENS_FILE = createRequire(WEB_PACKAGE).resolve("@achoo254/app-shell/tokens.css");
