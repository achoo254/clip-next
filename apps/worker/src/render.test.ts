import { describe, expect, it } from 'vitest';
import { hyperframesEnv, hyperframesRenderArgs, RenderError, runTool } from './render';

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

async function childPid(promise: Promise<void>): Promise<{ error: unknown }> {
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
