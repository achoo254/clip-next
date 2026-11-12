#!/bin/bash
# Activates a Clip release uploaded to /var/www/clip/ci-incoming/<release-id> (by CI as `clip-deploy`, or by
# infra/deploy.sh release). Installed as root at /usr/local/sbin/clip-activate-incoming; `clip-deploy` may run only
# this command through sudo (infra/setup-deploy-user.sh).
#   clip-activate-incoming <release-id>
# One activation at a time (flock). The upload moves to a root-owned directory, is rejected if it holds links or
# special files or misses a bundle, gets `pnpm install --prod` for the server and worker, then replaces app/ (the
# previous one kept as app.prev). Changed units and the nginx site are installed (nginx -t first), clip-server
# restarts and must answer /healthz within 20 s, otherwise app.prev comes back and the script exits 1 (the worker
# keeps running the previous code). Then clip-worker restarts.
set -euo pipefail
ROOT=/var/www/clip
PORT=4840
PNPM="npx --yes pnpm@11.9.0"
ID="${1:?usage: clip-activate-incoming <release-id>}"
[[ "$ID" =~ ^[0-9]{8}-[0-9]{6}-[0-9a-f]{12}$ ]] || { echo "bad release id" >&2; exit 2; }
[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

# One activation at a time: a CI deploy and a manual release from a dev machine may meet.
exec 9>/run/clip-activate.lock
flock -w 600 9 || { echo "another activation still holds /run/clip-activate.lock" >&2; exit 1; }

[ -s /etc/clip/production.env ] || { echo "no /etc/clip/production.env: run setup and write it first" >&2; exit 1; }
SRC="$ROOT/ci-incoming/$ID"
NEW="$ROOT/incoming"
[ -d "$SRC" ] && [ ! -L "$SRC" ] || { echo "incoming release $ID missing" >&2; exit 2; }

rm -rf "$NEW"
mv "$SRC" "$NEW"
chown -R root:root "$NEW"
reject() {
	rm -rf "$NEW"
	echo "incoming release $ID $1" >&2
	exit 2
}
[ -z "$(find "$NEW" ! -type f ! -type d -print -quit)" ] || reject "has links or special files"
for f in pnpm-lock.yaml apps/server/dist/server.mjs apps/worker/dist/main.mjs apps/worker/dist/cleanup.mjs apps/web/dist/index.html; do
	[ -f "$NEW/$f" ] || reject "has no $f"
done
printf '%s\n' "$ID" >"$NEW/apps/web/dist/RELEASE"

export PATH=/opt/node22/bin:$PATH
(cd "$NEW" && $PNPM install --prod --frozen-lockfile --filter '@clip/server...' --filter '@clip/worker...' --reporter=silent)
chown -R root:clip "$NEW" && chmod -R g+rX,o-rwx "$NEW"
cd "$ROOT"
rm -rf app.prev
if [ -d app ]; then mv app app.prev; fi
mv incoming app

changed=0
for unit in app/infra/systemd/*; do
	name="$(basename "$unit")"
	cmp -s "$unit" "/etc/systemd/system/$name" || { install -m 644 "$unit" "/etc/systemd/system/$name"; changed=1; }
done
if [ "$changed" = 1 ]; then systemctl daemon-reload; fi

conf=/etc/nginx/conf.d/clip.hoandat.com.conf
if ! cmp -s app/infra/nginx/clip.hoandat.com.conf "$conf"; then
	if [ -f "$conf" ]; then cp "$conf" "$conf.prev"; fi
	cp app/infra/nginx/clip.hoandat.com.conf "$conf"
	if ! nginx -t; then
		if [ -f "$conf.prev" ]; then mv "$conf.prev" "$conf"; else rm -f "$conf"; fi
		echo "nginx -t failed: config restored, nothing reloaded" >&2
		exit 1
	fi
	systemctl reload nginx
	echo "nginx config installed and reloaded"
fi

healthy() {
	for _ in $(seq 1 20); do
		curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null && return 0
		sleep 1
	done
	return 1
}
systemctl enable clip-server clip-worker >/dev/null
systemctl restart clip-server
if ! healthy; then
	journalctl -u clip-server -n 40 --no-pager || true
	if [ -d app.prev ]; then
		echo "healthz failed: switching back to the previous release" >&2
		rm -rf app.failed && mv app app.failed && mv app.prev app
		systemctl restart clip-server
		if healthy; then echo "previous release is back and healthy" >&2; else echo "previous release is not healthy either" >&2; fi
	fi
	# The worker was not restarted: it still runs the previous code.
	exit 1
fi
# The worker puts the job in hand back in the queue and restarts (KillMode=mixed, TimeoutStopSec).
systemctl restart clip-worker
systemctl is-active clip-worker >/dev/null
echo "healthz ok: clip.hoandat.com now serves $ID"
