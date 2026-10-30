/**
 * The spoken voice of a render: reads the lines aloud with VieNeu-TTS v3 Nano (apps/worker/tts/synthesize.py, in its
 * own Python environment under VOICE_DIR), one WAV per line, before the render starts and never at the same time as
 * one; then the lengths of the recordings time the scenes (voiceTimeline), and the final ffmpeg step lays the lines
 * over the music, which ducks under them.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSpeakable, type Voice } from '@clip/templates/voice';

/** The synthesis script, next to the bundle (dist/../tts) and to the sources (src/../tts). */
export const VOICE_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'tts', 'synthesize.py');

/** Where the voice's Python environment and model live under VOICE_DIR (infra/deploy.sh voice installs them). */
export function voicePaths(voiceDir: string): { python: string; modelDir: string } {
  return { python: path.join(voiceDir, 'pyenv', 'bin', 'python'), modelDir: path.join(voiceDir, 'models', 'vieneu-v3-nano') };
}

/** ONNX Runtime threads: two of the server's four CPUs (the worker's quota is 150 %). */
const VOICE_THREADS = 2;

/** Length in seconds of a PCM WAV file, from its header: the data chunk's size over the byte rate. */
export function wavSeconds(wav: Buffer): number {
  if (wav.length < 12 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  let byteRate = 0;
  for (let at = 12; at + 8 <= wav.length; ) {
    const id = wav.toString('ascii', at, at + 4);
    const size = wav.readUInt32LE(at + 4);
    if (id === 'fmt ' && at + 20 <= wav.length) byteRate = wav.readUInt32LE(at + 16);
    if (id === 'data') {
      if (byteRate <= 0) throw new Error('WAV data before its format');
      return Math.min(size, wav.length - at - 8) / byteRate;
    }
    at += 8 + size + (size % 2);
  }
  throw new Error('WAV without data');
}

export interface VoiceStats {
  readonly audioSeconds: number;
  readonly loadSeconds: number;
  readonly synthSeconds: number;
  readonly peakRssMb: number;
}

export interface Recording {
  /** One per segment: the WAV file, or null for a segment with nothing to read. */
  readonly files: readonly (string | null)[];
  /** One per segment: the recording's length (0 when there is none). */
  readonly seconds: readonly number[];
  readonly stats: VoiceStats | null;
}

/** The synthesis script's report (its last JSON line), or null. */
export function parseVoiceReport(output: string): VoiceStats | null {
  const line = output
    .split('\n')
    .reverse()
    .find((l) => l.startsWith('{"ok": true'));
  if (!line) return null;
  try {
    const report = JSON.parse(line) as Partial<Record<keyof VoiceStats, unknown>>;
    const { audioSeconds, loadSeconds, synthSeconds, peakRssMb } = report;
    if (typeof audioSeconds !== 'number' || typeof loadSeconds !== 'number' || typeof synthSeconds !== 'number' || typeof peakRssMb !== 'number') return null;
    return { audioSeconds, loadSeconds, synthSeconds, peakRssMb };
  } catch {
    return null;
  }
}

/** What of the worker's environment the synthesis may see (nothing secret), and no network or cache outside. */
function voiceEnv(): NodeJS.ProcessEnv {
  const passed = Object.fromEntries(['PATH', 'HOME', 'LANG', 'TZ'].flatMap((key) => (process.env[key] === undefined ? [] : [[key, process.env[key]]])));
  return { ...passed, HF_HUB_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1', PYTHONDONTWRITEBYTECODE: '1', OMP_NUM_THREADS: String(VOICE_THREADS) };
}

/**
 * Runs the synthesis to completion and resolves with the tail of its output: render.ts's runTool (own process group,
 * deadline, abort, `nice`), or a stand-in in tests.
 */
export type ToolRunner = (command: string, args: readonly string[], env: NodeJS.ProcessEnv) => Promise<string>;

/**
 * Records the segments of a video in `voice` (texts already through speechText), in `dir`: one process for all of
 * them (the model loads once), then the length of each file. Segments with nothing to read are skipped.
 */
export async function recordVoice(segments: readonly string[], voice: Voice, dir: string, voiceDir: string, run: ToolRunner): Promise<Recording> {
  const spoken = segments.flatMap((text, index) => (isSpeakable(text) ? [{ text, index }] : []));
  if (spoken.length === 0) return { files: segments.map(() => null), seconds: segments.map(() => 0), stats: null };
  await mkdir(dir, { recursive: true });
  const request = path.join(dir, 'request.json');
  await writeFile(request, JSON.stringify({ voice: voice.preset, lines: spoken.map((s) => s.text) }));
  const { python, modelDir } = voicePaths(voiceDir);
  const output = await run(python, ['-I', VOICE_SCRIPT, '--request', request, '--model-dir', modelDir, '--out-dir', dir, '--threads', String(VOICE_THREADS)], voiceEnv());
  const files: (string | null)[] = segments.map(() => null);
  const seconds = segments.map(() => 0);
  for (const [n, { index }] of spoken.entries()) {
    const file = path.join(dir, `line-${n + 1}.wav`);
    files[index] = file;
    seconds[index] = wavSeconds(await readFile(file));
  }
  return { files, seconds, stats: parseVoiceReport(output) };
}

/**
 * The audio of the final ffmpeg step for a voiced video, inputs after the rendered video (input 0): each line delayed
 * to its start and mixed into one voice track; the video's music compressed whenever the voice speaks (about −12 dB),
 * then voice and music together, limited so nothing clips. The mix lasts as long as the video.
 */
export function voiceMixArgs(files: readonly string[], startsSeconds: readonly number[]): { inputs: string[]; filter: string } {
  if (files.length === 0 || files.length !== startsSeconds.length) throw new Error('one start per voice file');
  const lines = files.map((_, i) => {
    const ms = Math.round((startsSeconds[i] ?? 0) * 1000);
    return `[${i + 1}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${ms}:all=1[v${i}]`;
  });
  const voice = files.length === 1 ? '[v0]anull[voice]' : `${files.map((_, i) => `[v${i}]`).join('')}amix=inputs=${files.length}:normalize=0[voice]`;
  return {
    inputs: files.flatMap((file) => ['-i', file]),
    filter: [
      ...lines,
      voice,
      '[voice]asplit=2[say][key]',
      '[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[music]',
      '[music][key]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=450[ducked]',
      '[ducked][say]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[mix]',
    ].join(';'),
  };
}
