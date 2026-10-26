/**
 * `pnpm --filter @clip/worker render:samples [photo ...]`: one real render per template through the worker's own
 * path (queue → claim → hyperframes → ffmpeg → ffprobe check), on a throw-away PGlite database and media directory.
 * Photos given on the command line are cleaned the way the server cleans uploads (ffmpeg, ≤1080 px, no metadata);
 * without any, ffmpeg's test pattern stands in. Prints each render's time and the probed output, and keeps the
 * videos in the printed directory for a look.
 *
 * Env: CHROME_PATH (optional, as the worker's).
 */
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { accounts, createJob, mediaLayout, openPglite, renderJobs } from '@clip/db';
import { eq } from 'drizzle-orm';
import { templateById, TEMPLATE_IDS, type TemplateId } from '@clip/templates';
import { RENDER_TIMEOUT_MS } from '../config';
import { probeVideo, renderVideo } from '../render';
import { processNextJob } from '../worker-loop';

const SAMPLE_FIELDS: Readonly<Record<TemplateId, Record<string, string>>> = {
  'chuc-mung': { line1: 'Chúc mừng sinh nhật Miu!', line2: 'Tuổi mới học giỏi, ngoan hiền', line3: 'Cả nhà yêu con nhiều lắm!' },
  'ke-nhanh': {
    title: '4 mẹo ngủ ngon hơn mỗi tối',
    point1: 'Tắt điện thoại trước khi ngủ 30 phút',
    point2: 'Giữ phòng mát, tối và yên tĩnh',
    point3: 'Đi ngủ cùng một giờ, kể cả cuối tuần',
    point4: 'Không uống cà phê sau 2 giờ chiều',
    point5: '',
  },
  'trich-dan': { quote: 'Không có việc gì khó, chỉ sợ lòng không bền. Đào núi và lấp biển, quyết chí ắt làm nên.', author: 'Hồ Chí Minh' },
};

function ffmpeg(args: readonly string[]): void {
  const out = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { encoding: 'utf8' });
  if (out.status !== 0) throw new Error(`ffmpeg failed: ${out.stderr}`);
}

const dir = await mkdtemp(path.join(os.tmpdir(), 'clip-samples-'));
const media = mediaLayout(dir);
await mkdir(media.tmp, { recursive: true });
const sources = process.argv.slice(2);
const handle = await openPglite();
const log = { info: (m: string) => console.log(m), warn: (m: string) => console.warn(m) };
try {
  for (const templateId of TEMPLATE_IDS) {
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
    const created = await createJob(handle.db, { id, accountId: account.id, templateId, fields: SAMPLE_FIELDS[templateId], photoCount: photos }, new Date());
    if (!created.ok) throw new Error(`queue refused: ${created.reason}`);
    const outcome = await processNextJob({
      db: handle.db,
      media,
      log,
      render: (input) => renderVideo(input, { chromePath: process.env.CHROME_PATH, timeoutMs: RENDER_TIMEOUT_MS }),
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
