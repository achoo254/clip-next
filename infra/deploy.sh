#!/usr/bin/env bash
# Deploys Clip to the shared server (.65). Run from a dev machine at any path inside the repo.
#
#   SSH_TARGET=<user>@<SERVER_65_IP> SSH_OPTS="-p <SSH_PORT> -i <key>" bash infra/deploy.sh setup
#   SSH_TARGET=... SSH_OPTS=... bash infra/deploy.sh release
#
# setup    one-time and idempotent: system user `clip` (nginx joins its group to read videos), /var/www/clip and
#          its media directories, the systemd units and the cleanup timer, /etc/clip. It writes no secret: the env
#          file /etc/clip/production.env comes from the iCloud env folder "ENV production/clip/" (see
#          docs/deployment-guide.md). The database and the nginx site are separate steps of that guide.
# release  gates and build here, upload, `pnpm install --prod` for the server and worker on the server, switch
#          app/ (the previous one kept as app.prev), install changed units and the nginx site (nginx -t first),
#          restart clip-server then clip-worker, check /healthz.
#
# Rollback: ssh in, `cd /var/www/clip && rm -rf app && mv app.prev app && systemctl restart clip-server clip-worker`.
# The database only ever gains migrations that keep the previous release working.
set -euo pipefail

: "${SSH_TARGET:?set SSH_TARGET to the ssh target of the server}"
read -r -a ssh_opts <<<"${SSH_OPTS:-}"
REMOTE=/var/www/clip
PORT=4840
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
	echo "== gates and build"
	$PNPM install --frozen-lockfile
	$PNPM lint
	$PNPM typecheck
	$PNPM test
	$PNPM build

	echo "== upload"
	# The release keeps the workspace layout: the bundles find the migrations and the templates through their
	# packages, and the worker runs the hyperframes CLI from node_modules.
	tar -czf - package.json pnpm-lock.yaml pnpm-workspace.yaml infra packages \
		apps/server/package.json apps/server/dist apps/worker/package.json apps/worker/dist \
		apps/web/package.json apps/web/dist |
		remote "set -euo pipefail; rm -rf $REMOTE/incoming; mkdir -p $REMOTE/incoming; tar xzf - --no-same-owner -C $REMOTE/incoming"

	echo "== install, switch, restart"
	remote "set -euo pipefail
		[ -s /etc/clip/production.env ] || { echo 'no /etc/clip/production.env: run setup and write it first' >&2; exit 1; }
		export PATH=/opt/node22/bin:\$PATH
		cd $REMOTE/incoming
		$PNPM install --prod --frozen-lockfile --filter '@clip/server...' --filter '@clip/worker...' --reporter=silent
		chown -R root:clip $REMOTE/incoming && chmod -R g+rX,o-rwx $REMOTE/incoming
		cd $REMOTE
		rm -rf app.prev
		[ -d app ] && mv app app.prev
		mv incoming app

		changed=0
		for unit in app/infra/systemd/*; do
			name=\$(basename \$unit)
			cmp -s \$unit /etc/systemd/system/\$name || { install -m 644 \$unit /etc/systemd/system/\$name; changed=1; }
		done
		[ \$changed = 1 ] && systemctl daemon-reload

		conf=/etc/nginx/conf.d/clip.hoandat.com.conf
		if ! cmp -s app/infra/nginx/clip.hoandat.com.conf \$conf; then
			[ -f \$conf ] && cp \$conf \$conf.prev
			cp app/infra/nginx/clip.hoandat.com.conf \$conf
			if ! nginx -t; then
				if [ -f \$conf.prev ]; then mv \$conf.prev \$conf; else rm -f \$conf; fi
				echo 'nginx -t failed: config restored, nothing reloaded' >&2
				exit 1
			fi
			systemctl reload nginx
			echo 'nginx config installed and reloaded'
		fi

		systemctl enable clip-server clip-worker >/dev/null
		systemctl restart clip-server
		for i in \$(seq 1 20); do
			if curl -fsS http://127.0.0.1:$PORT/healthz >/dev/null; then echo healthz ok; break; fi
			[ \$i = 20 ] && { journalctl -u clip-server -n 40 --no-pager; exit 1; }
			sleep 1
		done
		# The worker finishes the job in hand before it restarts (TimeoutStopSec).
		systemctl restart clip-worker
		systemctl is-active clip-worker"
}

case "${1:-release}" in
	setup) setup ;;
	release) release ;;
	*) echo "usage: $0 setup|release" >&2; exit 2 ;;
esac
