import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { voiceById } from '@clip/templates/voice';
import { finalEncodeArgs } from './render';
import { silentWav as wav } from './wav-fixture';
import { parseVoiceReport, recordVoice, VOICE_SCRIPT, voiceMixArgs, voicePaths, wavSeconds, type ToolRunner } from './voice';

const REPORT = '{"ok": true, "lines": 2, "sampleRate": 24000, "audioSeconds": 5.5, "loadSeconds": 2.4, "synthSeconds": 3.1, "peakRssMb": 590}';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'clip-voice-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Stands in for the synthesis script: records what it was asked and writes one WAV per line of the given lengths. */
function fakeSynthesis(lengths: readonly number[], seen: { command: string; args: readonly string[]; env: NodeJS.ProcessEnv; request: unknown }[]): ToolRunner {
  return async (command, args, env) => {
    const at = (flag: string): string => args[args.indexOf(flag) + 1] ?? '';
    const request: unknown = JSON.parse(await readFile(at('--request'), 'utf8'));
    seen.push({ command, args, env, request });
    for (const [i, seconds] of lengths.entries()) await writeFile(path.join(at('--out-dir'), `line-${i + 1}.wav`), wav(seconds));
    return `[W:onnxruntime] some warning\n${REPORT}\n`;
  };
}

describe('wavSeconds', () => {
  it('reads the length from the header, past extra chunks', () => {
    expect(wavSeconds(wav(2.5))).toBeCloseTo(2.5, 5);
    expect(wavSeconds(wav(1, 48_000))).toBeCloseTo(1, 5);
  });

  it('refuses what is not a WAV', () => {
    expect(() => wavSeconds(Buffer.from('not a wav at all'))).toThrow();
    expect(() => wavSeconds(wav(1).subarray(0, 40))).toThrow();
  });
});

describe('recordVoice', () => {
  it('reads only the segments with words, in one run, and gives every segment its length', async () => {
    const seen: Parameters<typeof fakeSynthesis>[1] = [];
    const voice = voiceById('truc-ly');
    if (!voice) throw new Error('no voice');
    const recording = await recordVoice(['Chúc mừng', '🎉', 'Vui vẻ'], voice, dir, '/opt/voice', fakeSynthesis([2, 3.5], seen));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.request).toEqual({ voice: 'Trúc Ly', lines: ['Chúc mừng', 'Vui vẻ'] });
    expect(seen[0]?.command).toBe(voicePaths('/opt/voice').python);
    expect(seen[0]?.args).toEqual(expect.arrayContaining(['-I', VOICE_SCRIPT, '--model-dir', voicePaths('/opt/voice').modelDir, '--threads', '2']));
    expect(recording.seconds[0]).toBeCloseTo(2, 5);
    expect(recording.seconds[1]).toBe(0);
    expect(recording.seconds[2]).toBeCloseTo(3.5, 5);
    expect(recording.files).toEqual([path.join(dir, 'line-1.wav'), null, path.join(dir, 'line-2.wav')]);
    expect(recording.stats).toEqual({ audioSeconds: 5.5, loadSeconds: 2.4, synthSeconds: 3.1, peakRssMb: 590 });
  });

  it('gives the synthesis no secret of the worker, and no network', async () => {
    const seen: Parameters<typeof fakeSynthesis>[1] = [];
    const saved = { ...process.env };
    process.env.DATABASE_URL = 'postgres://clip:secret@127.0.0.1/clip';
    process.env.AUTH_CLIENT_SECRET = 'x'.repeat(40);
    try {
      const voice = voiceById('adam');
      if (!voice) throw new Error('no voice');
      await recordVoice(['Xin chào'], voice, dir, '/opt/voice', fakeSynthesis([1], seen));
    } finally {
      process.env = saved;
    }
    const env = seen[0]?.env ?? {};
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.AUTH_CLIENT_SECRET).toBeUndefined();
    expect(env.HF_HUB_OFFLINE).toBe('1');
  });

  it('runs nothing when there is nothing to read', async () => {
    const seen: Parameters<typeof fakeSynthesis>[1] = [];
    const voice = voiceById('adam');
    if (!voice) throw new Error('no voice');
    const recording = await recordVoice(['🎉', ''], voice, dir, '/opt/voice', fakeSynthesis([], seen));
    expect(seen).toHaveLength(0);
    expect(recording).toEqual({ files: [null, null], seconds: [0, 0], stats: null });
  });

  it('fails when a line’s recording is missing', async () => {
    const voice = voiceById('adam');
    if (!voice) throw new Error('no voice');
    await expect(recordVoice(['Một', 'Hai'], voice, dir, '/opt/voice', fakeSynthesis([1], []))).rejects.toThrow();
  });
});

describe('parseVoiceReport', () => {
  it('takes the last report line, and nothing from anything else', () => {
    expect(parseVoiceReport(`noise\n${REPORT}\n`)?.peakRssMb).toBe(590);
    expect(parseVoiceReport('{"ok": false, "error": "load-failed"}')).toBeNull();
    expect(parseVoiceReport('{"ok": true, broken')).toBeNull();
  });
});

describe('the final mix', () => {
  it('delays each line to its start, ducks the music under the voice, and keeps the video’s length', () => {
    const { inputs, filter } = voiceMixArgs(['/w/line-1.wav', '/w/line-2.wav'], [0.5, 4.75]);
    expect(inputs).toEqual(['-i', '/w/line-1.wav', '-i', '/w/line-2.wav']);
    expect(filter).toContain('[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=500:all=1[v0]');
    expect(filter).toContain('adelay=4750:all=1[v1]');
    expect(filter).toContain('[v0][v1]amix=inputs=2:normalize=0[voice]');
    expect(filter).toContain('sidechaincompress');
    expect(filter).toContain('amix=inputs=2:duration=first');
    expect(() => voiceMixArgs([], [])).toThrow();
    expect(() => voiceMixArgs(['/a.wav'], [])).toThrow();
  });

  it('copies the MP4 path’s video and maps the mixed audio; without a voice the audio is copied as before', () => {
    const mix = voiceMixArgs(['/w/line-1.wav'], [0.5]);
    const voiced = finalEncodeArgs('/w/render.mp4', true, mix, '/w/video.mp4');
    expect(voiced).toEqual(expect.arrayContaining(['-c:v', 'copy', '-filter_complex', mix.filter, '-map', '0:v:0', '-map', '[mix]', '-c:a', 'aac']));
    expect(voiced.indexOf('/w/line-1.wav')).toBeGreaterThan(voiced.indexOf('/w/render.mp4'));
    expect(finalEncodeArgs('/w/render.mp4', true, null, '/w/video.mp4')).toEqual(['-v', 'error', '-y', '-i', '/w/render.mp4', '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', '/w/video.mp4']);
    expect(finalEncodeArgs('/w/render.webm', false, null, '/w/video.mp4')).toEqual(expect.arrayContaining(['-c:v', 'libopenh264', '-c:a', 'aac']));
  });
});
