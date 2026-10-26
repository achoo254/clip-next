/**
 * `pnpm check:templates`: `hyperframes check` (lint, runtime errors, layout, motion, contrast, in headless Chrome)
 * on every template, laid out exactly as the worker renders it. Exits 1 when any check reports an error. Needs
 * Chrome (CHROME_PATH, or the one hyperframes finds).
 */
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isTemplateId, TEMPLATE_IDS } from '@clip/templates';
import { prepareProject } from '@clip/templates/project';
import { hyperframesBin, hyperframesEnv } from '../render';

// `--templates=a,b` checks only those.
const flag = process.argv.find((a) => a.startsWith('--templates='));
const chosen = flag ? flag.slice('--templates='.length).split(',').filter(isTemplateId) : [...TEMPLATE_IDS];

let failed = 0;
for (const templateId of chosen) {
  const dir = await mkdtemp(path.join(os.tmpdir(), `clip-check-${templateId}-`));
  try {
    await prepareProject(templateId, dir);
    console.log(`== ${templateId}`);
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
