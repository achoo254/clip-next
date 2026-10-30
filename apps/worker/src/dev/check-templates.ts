/**
 * `pnpm check:templates`: `hyperframes check` (lint, runtime errors, layout, motion, contrast, in headless Chrome)
 * on every template, laid out exactly as the worker renders it. Exits 1 when any check reports an error. Needs
 * Chrome (CHROME_PATH, or the one hyperframes finds). `--all-backgrounds` also checks each template over every one of
 * its backgrounds (the text colours of a theme must read on all of them), not only the first. The first template of
 * each layout is also checked as a voiced video (its scenes moved by `cues`, the video longer), as the worker lays it
 * out once the lines are recorded.
 */
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isTemplateId, LAYOUT_IDS, TEMPLATE_IDS, TEMPLATES, templateById, type TemplateId } from '@clip/templates';
import { prepareProject } from '@clip/templates/project';
import { formatCues, voiceSegments, voiceTimeline, type VoiceTimeline } from '@clip/templates/voice';
import { hyperframesBin, hyperframesEnv } from '../render';

// `--templates=a,b` checks only those.
const flag = process.argv.find((a) => a.startsWith('--templates='));
const chosen = flag ? flag.slice('--templates='.length).split(',').filter(isTemplateId) : [...TEMPLATE_IDS];
const allBackgrounds = process.argv.includes('--all-backgrounds');

/** `hyperframes check` plays a composition with its declared defaults: make `value` the default of variable `id`. */
async function setDefault(dir: string, id: string, from: string, value: string): Promise<void> {
  const file = path.join(dir, 'index.html');
  const html = await readFile(file, 'utf8');
  const declared = `"id":"${id}","type":"string","label":"${from}","default":""`;
  const exact = id === 'background' ? declared.replace('"default":""', '"default":"1"') : declared;
  if (!html.includes(exact)) throw new Error(`the layout does not declare the ${id} variable as expected`);
  await writeFile(file, html.replace(exact, exact.replace(/"default":"[^"]*"$/, `"default":"${value}"`)));
}

/**
 * A voiced timeline for a template's sample text (required fields only, as the preview starts), as if each line
 * took 3 s to read: longer than most of the layouts' scenes.
 */
function sampleTimeline(templateId: TemplateId): VoiceTimeline {
  const spec = templateById(templateId);
  const fields = Object.fromEntries(spec.fields.map((f) => [f.id, f.required || f.choices ? f.placeholder.vi : '']));
  const timeline = voiceTimeline(spec, voiceSegments(spec, fields).map(() => 3));
  if (!timeline) throw new Error(`${templateId}: the sample timeline does not fit`);
  return timeline;
}

let failed = 0;
const voicedChecks = LAYOUT_IDS.map((layout) => TEMPLATES.find((t) => t.layout === layout && chosen.includes(t.id))?.id).filter(isTemplateId);
const runs = [
  ...chosen.flatMap((templateId) =>
    Array.from({ length: allBackgrounds ? templateById(templateId).backgrounds : 1 }, (_, i) => ({ templateId, background: i + 1, voiced: null })),
  ),
  ...voicedChecks.map((templateId) => ({ templateId, background: 1, voiced: sampleTimeline(templateId) })),
];
for (const { templateId, background, voiced } of runs) {
  const dir = await mkdtemp(path.join(os.tmpdir(), `clip-check-${templateId}-`));
  try {
    await prepareProject(templateId, dir, '9:16', { background, ...(voiced ? { durationSeconds: voiced.durationSeconds } : {}) });
    if (background > 1) await setDefault(dir, 'background', 'Nền', String(background));
    if (voiced) await setDefault(dir, 'cues', 'Nhịp lời đọc', formatCues(voiced));
    console.log(`== ${templateId}${background > 1 ? ` (background ${background})` : ''}${voiced ? ` (voiced: ${formatCues(voiced)}, ${voiced.durationSeconds} s)` : ''}`);
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
