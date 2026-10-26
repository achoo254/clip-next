/**
 * `pnpm --filter @clip/worker render:samples [--templates=a,b] [photo ...]`: one real render per template (default:
 * the first template of each layout) through the worker's own
 * path (queue → claim → hyperframes → ffmpeg → ffprobe check), on a throw-away PGlite database and media directory.
 * Photos given on the command line are cleaned the way the server cleans uploads (ffmpeg, ≤1080 px, no metadata);
 * without any, ffmpeg's test pattern stands in. Prints each render's time and the probed output, and keeps the
 * videos in the printed directory for a look.
 *
 * Env: CHROME_PATH, FFMPEG_PATH, FFPROBE_PATH (optional, as the worker's).
 */
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { accounts, createJob, mediaLayout, openPglite, renderJobs } from '@clip/db';
import { eq } from 'drizzle-orm';
import { isTemplateId, LAYOUT_IDS, templateById, TEMPLATES, type TemplateId } from '@clip/templates';
import { RENDER_TIMEOUT_MS } from '../config';
import { probeVideo, renderVideo } from '../render';
import { processNextJob } from '../worker-loop';

/** `--templates=a,b` picks the templates; default one per layout. */
function chosenTemplates(args: readonly string[]): TemplateId[] {
  const flag = args.find((a) => a.startsWith('--templates='));
  if (!flag) return LAYOUT_IDS.map((layout) => TEMPLATES.find((t) => t.layout === layout)?.id).filter(isTemplateId);
  const ids = flag.slice('--templates='.length).split(',');
  const bad = ids.filter((id) => !isTemplateId(id));
  if (bad.length > 0) throw new Error(`unknown template(s): ${bad.join(', ')}`);
  return ids.filter(isTemplateId);
}

/** The template's sample text (its placeholders), as the preview shows it before anything is typed. */
function sampleFields(templateId: TemplateId): Record<string, string> {
  return Object.fromEntries(templateById(templateId).fields.map((f) => [f.id, f.required ? f.placeholder.vi : '']));
}

function ffmpeg(args: readonly string[]): void {
  const out = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { encoding: 'utf8' });
  if (out.status !== 0) throw new Error(`ffmpeg failed: ${out.stderr}`);
}

const dir = await mkdtemp(path.join(os.tmpdir(), 'clip-samples-'));
const media = mediaLayout(dir);
await mkdir(media.tmp, { recursive: true });
const sources = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const templates = chosenTemplates(process.argv.slice(2));
const handle = await openPglite();
const log = { info: (m: string) => console.log(m), warn: (m: string) => console.warn(m) };
try {
  for (const templateId of templates) {
    const spec = templateById(templateId);
    const [account] = await handle.db.insert(accounts).values({ sub: `sample-${templateId}`, createdAt: new Date() }).returning();
    if (!account) throw new Error('no account');
    const id = randomUUID();
    const photos = Math.min(spec.photos.max, Math.max(spec.photos.min, sources.length > 0 ? sources.length : spec.photos.max));
    await mkdir(media.inputDir(id), { recursive: true });
    for (let i = 0; i < photos; i += 1) {
      const source = sources[i % Math.max(1, sources.length)];
      const scale = "scale=w='min(1080,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease,format=yuvj420p";
      const input = source ? ['-i', source] : ['-f', 'lavfi', '-i', `testsrc2=s=${1600 - i * 300}x1200`];
      ffmpeg([...input, '-frames:v', '1', '-vf', scale, '-map_metadata', '-1', '-q:v', '3', '-f', 'image2', media.photo(id, i)]);
    }
    const created = await createJob(handle.db, { id, accountId: account.id, templateId, fields: sampleFields(templateId), photoCount: photos }, new Date());
    if (!created.ok) throw new Error(`queue refused: ${created.reason}`);
    const outcome = await processNextJob({
      db: handle.db,
      media,
      log,
      render: (input, signal) =>
        renderVideo(input, { chromePath: process.env.CHROME_PATH, ffmpegPath: process.env.FFMPEG_PATH, ffprobePath: process.env.FFPROBE_PATH, timeoutMs: RENDER_TIMEOUT_MS, signal }),
    });
    const [row] = await handle.db.select().from(renderJobs).where(eq(renderJobs.id, id));
    const probed = outcome === 'done' ? probeVideo(media.video(id)) : null;
    console.log(
      JSON.stringify({ templateId, outcome, error: row?.error ?? null, renderMs: row?.renderMs ?? null, photos, file: media.video(id), probed }),
    );
  }
} finally {
  await handle.close();
}
console.log(`videos kept in ${media.videos}`);
