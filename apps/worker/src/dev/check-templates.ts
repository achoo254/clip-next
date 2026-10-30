/**
 * `pnpm check:templates`: `hyperframes check` (lint, runtime errors, layout, motion, contrast, in headless Chrome)
 * on every template, laid out exactly as the worker renders it. Exits 1 when any check reports an error. Needs
 * Chrome (CHROME_PATH, or the one hyperframes finds). `--all-backgrounds` also checks each template over every one of
 * its backgrounds (the text colours of a theme must read on all of them), not only the first.
 */
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isTemplateId, TEMPLATE_IDS, templateById } from '@clip/templates';
import { prepareProject } from '@clip/templates/project';
import { hyperframesBin, hyperframesEnv } from '../render';

// `--templates=a,b` checks only those.
const flag = process.argv.find((a) => a.startsWith('--templates='));
const chosen = flag ? flag.slice('--templates='.length).split(',').filter(isTemplateId) : [...TEMPLATE_IDS];
const allBackgrounds = process.argv.includes('--all-backgrounds');

/** `hyperframes check` plays a composition with its declared defaults: make background `n` the default one. */
async function defaultBackground(dir: string, n: number): Promise<void> {
  const file = path.join(dir, 'index.html');
  const html = await readFile(file, 'utf8');
  const declared = '{"id":"background","type":"string","label":"Nền","default":"1"}';
  if (!html.includes(declared)) throw new Error('the layout does not declare the background variable as expected');
  await writeFile(file, html.replace(declared, declared.replace('"default":"1"', `"default":"${n}"`)));
}

let failed = 0;
const runs = chosen.flatMap((templateId) =>
  Array.from({ length: allBackgrounds ? templateById(templateId).backgrounds : 1 }, (_, i) => ({ templateId, background: i + 1 })),
);
for (const { templateId, background } of runs) {
  const dir = await mkdtemp(path.join(os.tmpdir(), `clip-check-${templateId}-`));
  try {
    await prepareProject(templateId, dir, '9:16', { background });
    if (background > 1) await defaultBackground(dir, background);
    console.log(`== ${templateId}${background > 1 ? ` (background ${background})` : ''}`);
    const result = spawnSync(process.execPath, [hyperframesBin(), 'check', dir], { env: hyperframesEnv(process.env.CHROME_PATH), encoding: 'utf8' });
    // The report, without the per-sample progress lines.
    const report = `${result.stdout}${result.stderr}`.split('\n').filter((line) => !line.startsWith('[hyperframes] check:'));
    console.log(report.join('\n'));
    if (result.status !== 0) failed += 1;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
if (failed > 0) {
  console.error(`${failed} template(s) failed hyperframes check`);
  process.exitCode = 1;
}
