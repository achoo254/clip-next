/**
 * The compositions on disk (Node only). A template is a layout — `project/layouts/<layout>.html` and
 * `project/scripts/<layout>.js`, sharing `project/scripts/common.js` — dressed in a theme: `project/themes/<theme>/`
 * (AI-drawn background, its optional moving version `bg.mp4`, stickers, photo frame, `theme.css`), plus fonts and the
 * video's music track from `project/assets/`.
 * `prepareProject` lays one template out as a stand-alone hyperframes project (its composition as index.html): what
 * the worker renders and what `pnpm check:templates` checks.
 */
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { composeTemplateHtml, previewTrack, templateById, usesVideoBackground, VIDEO_BACKGROUND_FILE, type CompositionChoice, type TemplateId, type VideoFormat } from './catalog';

/**
 * packages/templates/project: layouts, scripts, themes and shared assets. Found through the package's own name, so
 * the path stays right when this file is bundled into the worker (it then resolves from the bundle's node_modules).
 */
export const PROJECT_DIR = path.join(path.dirname(createRequire(import.meta.url).resolve('@clip/templates/package.json')), 'project');

/**
 * Writes the hyperframes project of `templateId`, in `format`, with the chosen background and track (see
 * CompositionChoice), into `dir` (created if needed).
 */
export async function prepareProject(templateId: TemplateId, dir: string, format: VideoFormat = '9:16', choice: CompositionChoice = {}): Promise<void> {
  const spec = templateById(templateId);
  const music = choice.music ?? previewTrack(spec);
  const layoutHtml = await readFile(path.join(PROJECT_DIR, 'layouts', `${spec.layout}.html`), 'utf8');
  await mkdir(path.join(dir, 'scripts'), { recursive: true });
  await writeFile(path.join(dir, 'index.html'), composeTemplateHtml(layoutHtml, spec, format, { ...choice, music }));
  for (const script of ['common.js', `${spec.layout}.js`]) {
    await cp(path.join(PROJECT_DIR, 'scripts', script), path.join(dir, 'scripts', script));
  }
  const usesVideo = usesVideoBackground(spec, choice.background);
  // Only this template's theme and track: the render's file server has less to serve and nothing else to leak.
  await cp(path.join(PROJECT_DIR, 'themes', spec.theme), path.join(dir, 'themes', spec.theme), {
    recursive: true,
    filter: (source) => path.basename(source) !== 'thumb.webp' && (path.basename(source) !== VIDEO_BACKGROUND_FILE || usesVideo),
  });
  await cp(path.join(PROJECT_DIR, 'assets', 'fonts'), path.join(dir, 'assets', 'fonts'), { recursive: true });
  await mkdir(path.join(dir, 'assets', 'music'), { recursive: true });
  await cp(path.join(PROJECT_DIR, 'assets', 'music', `${music}.m4a`), path.join(dir, 'assets', 'music', `${music}.m4a`));
}
