/**
 * The compositions on disk (Node only). Each template is `project/<id>.html` plus `project/scripts/<id>.js`; they
 * share `project/scripts/common.js` and `project/assets/` (fonts, music). `prepareProject` lays one template out as
 * a stand-alone hyperframes project (its composition as index.html), which is what the worker renders and what
 * `pnpm check:templates` checks.
 */
import { cp, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { TemplateId } from './catalog';

/**
 * packages/templates/project: the compositions, their scripts and shared assets. Found through the package's own
 * name, so the path stays right when this file is bundled into the worker (it then resolves from the bundle's
 * node_modules).
 */
export const PROJECT_DIR = path.join(path.dirname(createRequire(import.meta.url).resolve('@clip/templates/package.json')), 'project');

/** Writes the hyperframes project of `templateId` into `dir` (created if needed). */
export async function prepareProject(templateId: TemplateId, dir: string): Promise<void> {
  await mkdir(path.join(dir, 'scripts'), { recursive: true });
  await cp(path.join(PROJECT_DIR, `${templateId}.html`), path.join(dir, 'index.html'));
  for (const script of ['common.js', `${templateId}.js`]) {
    await cp(path.join(PROJECT_DIR, 'scripts', script), path.join(dir, 'scripts', script));
  }
  await cp(path.join(PROJECT_DIR, 'assets'), path.join(dir, 'assets'), { recursive: true });
}
