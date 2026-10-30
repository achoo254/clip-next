import { chmod, mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { voiceById } from '@clip/templates/voice';
import { hyperframesEnv, hyperframesRenderArgs, renderVideo, RenderError, runTool, type RenderInput } from './render';
import { voicePaths } from './voice';
import { silentWav } from './wav-fixture';

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** A tool that starts a long-running child (as hyperframes starts ffmpeg) and prints the child's pid. */
const SPAWNS_CHILD = ['-c', 'sleep 60 & echo $!; wait'];

async function childPid(promise: Promise<unknown>): Promise<{ error: unknown }> {
  return promise.then(
    () => ({ error: null }),
    (error: unknown) => ({ error }),
  );
}

describe('runTool', () => {
  it('kills the whole process group at the deadline, children included', async () => {
    const started = Date.now();
    const { error } = await childPid(runTool('sh', SPAWNS_CHILD, { env: process.env, deadline: started + 300, code: 'render-failed', graceMs: 200 }));
    expect(error).toBeInstanceOf(RenderError);
    expect((error as RenderError).code).toBe('timeout');
    const pid = Number((error as RenderError).detail.trim().split('\n')[0]);
    expect(pid).toBeGreaterThan(0);
    // The group got SIGTERM; give the kernel a moment to reap.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(alive(pid)).toBe(false);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('stops the tool when the worker aborts, with code `aborted`', async () => {
    const abort = new AbortController();
    const run = childPid(runTool('sh', SPAWNS_CHILD, { env: process.env, deadline: Date.now() + 60_000, code: 'render-failed', signal: abort.signal, graceMs: 200 }));
    setTimeout(() => abort.abort(), 200);
    const { error } = await run;
    expect((error as RenderError).code).toBe('aborted');
    const pid = Number((error as RenderError).detail.trim().split('\n')[0]);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(alive(pid)).toBe(false);
  });

  it('reports a failing tool with its code', async () => {
    const { error } = await childPid(runTool('sh', ['-c', 'echo boom >&2; exit 3'], { env: process.env, deadline: Date.now() + 5_000, code: 'encode-failed' }));
    expect(error).toMatchObject({ code: 'encode-failed' });
    expect((error as RenderError).detail).toContain('exit 3');
  });
});

describe('hyperframesEnv', () => {
  it('passes no secret of the worker to the tools', () => {
    const saved = { ...process.env };
    process.env.DATABASE_URL = 'postgres://clip:secret@127.0.0.1/clip';
    process.env.AUTH_CLIENT_SECRET = 'x'.repeat(40);
    try {
      const env = hyperframesEnv('/usr/bin/google-chrome');
      expect(env.DATABASE_URL).toBeUndefined();
      expect(env.AUTH_CLIENT_SECRET).toBeUndefined();
      expect(env.PATH).toBe(process.env.PATH);
      expect(env.HYPERFRAMES_BROWSER_PATH).toBe('/usr/bin/google-chrome');
      expect(env.HYPERFRAMES_NO_TELEMETRY).toBe('1');
    } finally {
      process.env = saved;
    }
  });
});

describe('hyperframesRenderArgs', () => {
  it('fails the render on missing or unready media, for both output paths', () => {
    for (const direct of [true, false]) {
      const args = hyperframesRenderArgs('/w', '/w/variables.json', '/w/out', direct);
      expect(args).toContain('--no-best-effort');
      expect(args).toContain('--strict-variables');
      expect(args).not.toContain('--best-effort');
      expect(args.slice(args.indexOf('--format'), args.indexOf('--format') + 2)).toEqual(['--format', direct ? 'mp4' : 'webm']);
    }
  });
});

describe('renderVideo with a voice', () => {
  async function voicedInput(dir: string): Promise<RenderInput> {
    const voice = voiceById('truc-ly');
    if (!voice) throw new Error('no voice');
    return {
      templateId: 'chuc-mung',
      format: '9:16',
      background: 1,
      music: 'fetch-dance',
      variables: {},
      photos: [],
      voice: { voice, segments: ['Một', 'Hai', 'Ba'] },
      workDir: path.join(dir, 'work'),
      output: path.join(dir, 'out.mp4'),
    };
  }

  /** A stand-in for the voice's Python: copies a recording of `seconds` for each of the three lines. */
  async function fakePython(dir: string, seconds: number): Promise<string> {
    const voiceDir = path.join(dir, 'voice');
    const { python } = voicePaths(voiceDir);
    await mkdir(path.dirname(python), { recursive: true });
    const recording = path.join(dir, 'recording.wav');
    await writeFile(recording, silentWav(seconds));
    await writeFile(
      python,
      `#!/bin/sh
out=""; prev=""
for a in "$@"; do [ "$prev" = "--out-dir" ] && out="$a"; prev="$a"; done
for i in 1 2 3; do cp "${recording}" "$out/line-$i.wav"; done
echo '{"ok": true, "lines": 3, "sampleRate": 24000, "audioSeconds": ${seconds * 3}, "loadSeconds": 1, "synthSeconds": 1, "peakRssMb": 500}'
`,
    );
    await chmod(python, 0o755);
    return voiceDir;
  }

  it('fails with voice-failed when the server has no voice installed, and cleans up', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'clip-render-'));
    try {
      const input = await voicedInput(dir);
      await expect(renderVideo(input, { timeoutMs: 10_000 })).rejects.toMatchObject({ code: 'voice-failed' });
      await expect(stat(input.workDir)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('fails with voice-too-long when the recordings take longer than a video may last, before any render', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'clip-render-'));
    try {
      const voiceDir = await fakePython(dir, 8);
      await expect(renderVideo(await voicedInput(dir), { timeoutMs: 10_000, voiceDir })).rejects.toMatchObject({ code: 'voice-too-long' });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('fails with voice-failed when the synthesis exits with an error', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'clip-render-'));
    try {
      const voiceDir = path.join(dir, 'voice');
      const { python } = voicePaths(voiceDir);
      await mkdir(path.dirname(python), { recursive: true });
      await writeFile(python, '#!/bin/sh\necho \'{"ok": false, "error": "load-failed"}\'\nexit 1\n');
      await chmod(python, 0o755);
      await expect(renderVideo(await voicedInput(dir), { timeoutMs: 10_000, voiceDir })).rejects.toMatchObject({ code: 'voice-failed' });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
