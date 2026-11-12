#!/usr/bin/env bash
# Deploys Clip to the shared server (.65). Run from a dev machine at any path inside the repo.
#
#   SSH_TARGET=<user>@<SERVER_65_IP> SSH_OPTS="-p <SSH_PORT> -i <key>" bash infra/deploy.sh setup
#   SSH_TARGET=... SSH_OPTS=... bash infra/deploy.sh release
#   SSH_TARGET=... SSH_OPTS=... bash infra/deploy.sh voice
#
# setup    one-time and idempotent: system user `clip` (nginx joins its group to read videos), /var/www/clip and
#          its media directories, the systemd units and the cleanup timer, /etc/clip. It writes no secret: the env
#          file /etc/clip/production.env comes from the iCloud env folder "ENV production/clip-next/" (see
#          docs/deployment-guide.md). The database and the nginx site are separate steps of that guide.
# release  break-glass only: a push to main deploys through .github/workflows/deploy.yml. Refuses a dirty tree or a
#          commit not on origin/main, runs the gates and the build here, packs (infra/pack-release.sh), uploads to
#          ci-incoming/<id> and runs the same activation as CI (infra/activate-incoming.sh: pnpm install --prod,
#          switch app/, keep app.prev, units, nginx, /healthz, rollback, worker restart).
# voice    idempotent: the spoken voice (VieNeu-TTS v3 Nano, CPU) under /var/www/clip/tts, owned by `clip`: a pinned
#          uv, its own CPython 3.12 (python/), the Python environment of apps/worker/tts/requirements.txt (pyenv/) and
#          the model at a pinned revision, checked against apps/worker/tts/vieneu-v3-nano.sha256 (models/). Touches
#          neither the system Python nor any other app. Ends with a one-line synthesis as `clip` and prints its time
#          and memory. Then set VOICE_DIR=/var/www/clip/tts in /etc/clip/production.env and restart (or release).
#
# Rollback: ssh in, `cd /var/www/clip && rm -rf app && mv app.prev app && systemctl restart clip-server clip-worker`.
# The database only ever gains migrations that keep the previous release working.
set -euo pipefail

: "${SSH_TARGET:?set SSH_TARGET to the ssh target of the server}"
read -r -a ssh_opts <<<"${SSH_OPTS:-}"
REMOTE=/var/www/clip
PNPM="npx --yes pnpm@11.9.0"
export COPYFILE_DISABLE=1

cd "$(git rev-parse --show-toplevel)"

remote() { ssh "${ssh_opts[@]}" "$SSH_TARGET" "$@"; }

setup() {
	tar -czf - infra | remote "set -euo pipefail
		rm -rf /tmp/clip-setup && mkdir -p /tmp/clip-setup && tar xzf - --no-same-owner -C /tmp/clip-setup
		id clip >/dev/null 2>&1 || useradd --system --home-dir $REMOTE --shell /sbin/nologin clip
		usermod -aG clip nginx
		mkdir -p $REMOTE/media/videos $REMOTE/media/inputs $REMOTE/media/tmp /etc/clip
		chown -R clip:clip $REMOTE/media && chmod 750 $REMOTE/media $REMOTE/media/videos
		chmod 750 /etc/clip && chown root:clip /etc/clip
		install -m 644 /tmp/clip-setup/infra/systemd/* /etc/systemd/system/
		systemctl daemon-reload
		systemctl enable --now clip-media-cleanup.timer
		[ -s /etc/clip/production.env ] || echo 'next: write /etc/clip/production.env (docs/deployment-guide.md), then release'
		echo setup done"
}

release() {
	echo "== guards"
	# The release must be exactly a commit that is already on origin/main.
	if [ -n "$(git status --porcelain)" ]; then
		echo "working tree is not clean: commit or stash first (git status)" >&2
		exit 1
	fi
	git fetch --quiet origin main
	if ! git merge-base --is-ancestor HEAD origin/main; then
		echo "HEAD $(git rev-parse --short HEAD) is not on origin/main: push it first" >&2
		exit 1
	fi

	echo "== gates and build"
	$PNPM install --frozen-lockfile
	$PNPM lint
	$PNPM typecheck
	$PNPM test
	$PNPM build

	local id work
	id="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short=12 HEAD)"
	work="$(mktemp -d)"
	# Expanded now on purpose: $work is local to release().
	# shellcheck disable=SC2064
	trap "rm -rf '$work'" EXIT
	bash infra/pack-release.sh "$work/release"

	echo "== upload $id"
	tar -czf - -C "$work/release" . |
		remote "set -euo pipefail; mkdir -p $REMOTE/ci-incoming/$id; tar xzf - --no-same-owner -C $REMOTE/ci-incoming/$id
			install -m 755 -o root -g root $REMOTE/ci-incoming/$id/infra/activate-incoming.sh /usr/local/sbin/clip-activate-incoming"

	echo "== activate (the same step CI runs; it waits for any other activation)"
	remote "/usr/local/sbin/clip-activate-incoming $id" </dev/null
}

# The voice's pinned tools: uv (its release archive's sha256) and the model's revision on Hugging Face.
UV_VERSION=0.13.6
UV_SHA256=f29c3e94ffabd7e6f3ba521dba169a9b7ec12100bf3257087f0f24f6123f3645
PYTHON_VERSION=3.12.16
NANO_REPO=pnnbao-ump/VieNeu-TTS-v3-Nano
NANO_REVISION=aba295eb96a6fa6003ebe417cc1f2802a7adc1dc
VOICE_DIR=$REMOTE/tts

voice() {
	tar -czf - apps/worker/tts | remote "set -euo pipefail
		T=$VOICE_DIR
		rm -rf /tmp/clip-voice && mkdir -p /tmp/clip-voice && tar xzf - --no-same-owner -C /tmp/clip-voice
		src=/tmp/clip-voice/apps/worker/tts
		chmod -R a+rX /tmp/clip-voice
		free=\$(df --output=avail -m /var/www | tail -1)
		[ \$free -gt 2048 ] || { echo \"only \$free MB free under /var/www: the voice needs about 1 GB while installing\" >&2; exit 1; }
		id clip >/dev/null 2>&1 || { echo 'no user clip: run setup first' >&2; exit 1; }
		install -d -o clip -g clip -m 750 \$T \$T/bin \$T/models

		if ! \$T/bin/uv --version 2>/dev/null | grep -q ' $UV_VERSION'; then
			cd /tmp && curl -fsSLo clip-uv.tgz https://github.com/astral-sh/uv/releases/download/$UV_VERSION/uv-x86_64-unknown-linux-gnu.tar.gz
			echo '$UV_SHA256  clip-uv.tgz' | sha256sum -c --quiet
			tar xzf clip-uv.tgz && install -o clip -g clip -m 755 uv-x86_64-unknown-linux-gnu/uv \$T/bin/uv
			rm -rf clip-uv.tgz uv-x86_64-unknown-linux-gnu
		fi
		as_clip() { runuser -u clip -- env HOME=\$T UV_CACHE_DIR=\$T/.uv-cache UV_PYTHON_INSTALL_DIR=\$T/python HF_HOME=\$T/.hf-cache HF_HUB_DISABLE_TELEMETRY=1 \"\$@\"; }
		cd \$T
		as_clip bin/uv python install --no-bin $PYTHON_VERSION
		[ -x pyenv/bin/python ] || as_clip bin/uv venv --quiet --python $PYTHON_VERSION --managed-python pyenv
		as_clip bin/uv pip sync --quiet --python pyenv/bin/python \$src/requirements.txt

		as_clip pyenv/bin/python -I -c '
import sys
from huggingface_hub import hf_hub_download
for name in [line.split()[1] for line in open(sys.argv[1])]:
    hf_hub_download(\"$NANO_REPO\", name, revision=\"$NANO_REVISION\", local_dir=\"models/vieneu-v3-nano\")
' \$src/vieneu-v3-nano.sha256
		(cd models/vieneu-v3-nano && sha256sum -c --quiet \$src/vieneu-v3-nano.sha256)
		as_clip bin/uv cache clean --quiet
		rm -rf .uv-cache .hf-cache .cache models/vieneu-v3-nano/.cache

		echo '{\"voice\": \"Trúc Ly\", \"lines\": [\"Clip xin chào, giọng đọc đã sẵn sàng.\"]}' > /tmp/clip-voice/request.json
		install -d -o clip -g clip /tmp/clip-voice/out
		runuser -u clip -- env HOME=/tmp/clip-voice/out HF_HUB_OFFLINE=1 nice -n 15 pyenv/bin/python -I \$src/synthesize.py \\
			--request /tmp/clip-voice/request.json --model-dir models/vieneu-v3-nano --out-dir /tmp/clip-voice/out --threads 2 | tail -1
		rm -rf /tmp/clip-voice
		du -sh python pyenv models
		grep -q '^VOICE_DIR=' /etc/clip/production.env 2>/dev/null || echo 'next: add VOICE_DIR=$VOICE_DIR to /etc/clip/production.env, then restart clip-server and clip-worker'
		echo voice done"
}

case "${1:-release}" in
	setup) setup ;;
	release) release ;;
	voice) voice ;;
	*) echo "usage: $0 setup|release|voice" >&2; exit 2 ;;
esac
