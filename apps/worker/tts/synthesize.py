"""Reads the lines of one Clip video aloud with VieNeu-TTS v3 Nano (ONNX, CPU), one WAV file per line.

Run by the render worker (apps/worker/src/voice.ts) before the render, never at the same time as one:

    python -I synthesize.py --request FILE --model-dir DIR --out-dir DIR [--threads 2] [--steps 16]

The request is a JSON file: {"voice": "<preset name>", "lines": ["<text>", ...]}. The text is already normalised
by the worker (dates, times, money). Only the preset voices of the model may be used: there is no voice cloning
here, so no audio of a person ever enters. Writes line-1.wav, line-2.wav, ... (24 kHz mono PCM 16) into --out-dir
and prints one JSON line on stdout with timings and the peak memory of this process. The model is read from
--model-dir only; nothing is downloaded (the worker's sandbox has no network anyway).
"""

from __future__ import annotations

import argparse
import json
import os
import resource
import sys
import time

# Before any Hugging Face import: never reach the network, never write a cache outside the work directory.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")

MAX_LINES = 8
MAX_LINE_CHARS = 400
# The same seed for every line: the same text and voice always sound the same, so a job rendered again after a
# worker restart gets the same voice track.
SEED = 7


def fail(code: str, detail: str) -> None:
    print(json.dumps({"ok": False, "error": code, "detail": detail[-500:]}), flush=True)
    sys.exit(1)


def read_request(path: str) -> tuple[str, list[str]]:
    try:
        with open(path, encoding="utf-8") as file:
            request = json.load(file)
    except (OSError, ValueError) as error:
        fail("bad-request", f"cannot read the request: {error}")
    if not isinstance(request, dict):
        fail("bad-request", "request is not an object")
    voice = request.get("voice")
    lines = request.get("lines")
    if not isinstance(voice, str) or not voice:
        fail("bad-request", "voice must be a non-empty string")
    if not isinstance(lines, list) or not 1 <= len(lines) <= MAX_LINES:
        fail("bad-request", f"lines must be a list of 1 to {MAX_LINES} strings")
    for line in lines:
        if not isinstance(line, str) or not line.strip() or len(line) > MAX_LINE_CHARS:
            fail("bad-request", f"every line must be non-empty text of at most {MAX_LINE_CHARS} characters")
    return voice, lines


def release_page_cache(model_dir: str) -> None:
    """Drops the model files from the page cache: it is charged to the worker's memory limit, and Chrome comes next."""
    if not hasattr(os, "posix_fadvise"):
        return
    for name in os.listdir(model_dir):
        path = os.path.join(model_dir, name)
        if not os.path.isfile(path):
            continue
        try:
            fd = os.open(path, os.O_RDONLY)
            try:
                os.posix_fadvise(fd, 0, 0, os.POSIX_FADV_DONTNEED)
            finally:
                os.close(fd)
        except OSError:
            pass  # Only an optimisation: the kernel reclaims the cache anyway when it needs to.


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", required=True)
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--threads", type=int, default=2)
    parser.add_argument("--steps", type=int, default=16)
    args = parser.parse_args()
    voice, lines = read_request(args.request)

    started = time.monotonic()
    try:
        import onnxruntime

        # ONNX Runtime may send usage events; nothing of a render leaves the server.
        onnxruntime.disable_telemetry_events()
        from vieneu import Vieneu
        import numpy as np
        import soundfile as sf

        tts = Vieneu(mode="v3nano", onnx_dir=args.model_dir, threads=args.threads, steps=args.steps)
    except Exception as error:  # noqa: BLE001 - any load failure is reported as one code
        fail("load-failed", repr(error))
    loaded = time.monotonic()

    known = {name for _, name in tts.list_preset_voices()}
    if voice not in known:
        fail("unknown-voice", f"{voice!r} is not one of {sorted(known)}")

    audio_seconds = 0.0
    for index, text in enumerate(lines, start=1):
        try:
            wav = tts.infer(text, voice=voice, seed=SEED)
        except Exception as error:  # noqa: BLE001
            fail("synthesis-failed", f"line {index}: {error!r}")
        samples = np.asarray(wav, dtype=np.float32).reshape(-1)
        if samples.size == 0:
            fail("synthesis-failed", f"line {index}: no audio")
        audio_seconds += samples.size / tts.sample_rate
        sf.write(os.path.join(args.out_dir, f"line-{index}.wav"), samples, tts.sample_rate, subtype="PCM_16")

    done = time.monotonic()
    release_page_cache(args.model_dir)
    print(
        json.dumps(
            {
                "ok": True,
                "lines": len(lines),
                "sampleRate": tts.sample_rate,
                "audioSeconds": round(audio_seconds, 2),
                "loadSeconds": round(loaded - started, 2),
                "synthSeconds": round(done - loaded, 2),
                # ru_maxrss is in KiB on Linux.
                "peakRssMb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024),
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
