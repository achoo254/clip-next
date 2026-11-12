#!/usr/bin/env bash
# Copies what a Clip release needs from a built checkout into <out-dir>. The release keeps the workspace layout: the
# bundles find the migrations and the templates through their packages, and the worker runs the hyperframes CLI from
# node_modules, which the server installs (node_modules is never shipped). Used by .github/workflows/deploy.yml and
# by infra/deploy.sh release.
#   bash infra/pack-release.sh <out-dir>
set -euo pipefail
out="${1:?usage: infra/pack-release.sh <out-dir>}"
cd "$(dirname "$0")/.."
mkdir -p "$out"
COPYFILE_DISABLE=1 tar -cf - --exclude node_modules --exclude '._*' --exclude .DS_Store \
	package.json pnpm-lock.yaml pnpm-workspace.yaml infra packages \
	apps/server/package.json apps/server/dist apps/worker/package.json apps/worker/dist apps/worker/tts \
	apps/web/package.json apps/web/dist |
	tar -xf - -C "$out"
