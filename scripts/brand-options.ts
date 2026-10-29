import type { BrandConfigWith, GenerateManifestsOptions } from '@achoo254/brand/build';
import { loadBrandConfig, svgManifestIcons } from '@achoo254/brand/build';

/** Repository root: the directory of brand.config.json and its icon paths. */
export const BRAND_ROOT = new URL('../', import.meta.url);
/** Where `pnpm brand:gen` writes the web manifest and icons/. */
export const BRAND_GENERATED_DIR = new URL('brand/generated/', BRAND_ROOT);

const REQUIRE = ['webInstall', 'colors.primary', 'colors.backgroundDark'] as const;
export type ClipBrand = BrandConfigWith<(typeof REQUIRE)[number]>;

export function loadClipBrand(): ClipBrand {
  return loadBrandConfig(BRAND_ROOT, { require: REQUIRE });
}

/** The web manifest (no Capacitor: Clip is a web app and PWA only). */
export const MANIFEST_OPTIONS: GenerateManifestsOptions = {
  web: {
    id: '/',
    lang: 'vi',
    dir: 'ltr',
    themeColor: 'background',
    categories: ['entertainment', 'photo'],
    preferRelatedApplications: false,
    icons: svgManifestIcons(),
  },
};

/** The link preview (1200 × 630), drawn by `pnpm brand:gen` into apps/web/public/ and named in the head tags. */
export const OG_IMAGE = { path: 'og-image.png', width: 1200, height: 630 } as const;
