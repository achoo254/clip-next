# Triển khai Clip lên `.65`

Clip chạy trên edge `.65` dùng chung (CentOS Stream 9, 4 CPU, 7,5 GB RAM) sau Cloudflare và nginx. Repo public:
không ghi IP, cổng SSH hay user máy chủ vào đây; dùng placeholder `<SERVER_65_IP>`, `<SSH_PORT>`.

## Thành phần trên máy chủ

| Thứ | Ở đâu |
|---|---|
| Bản phát hành | `/var/www/clip/app` (bản trước: `app.prev`), cài bằng `infra/deploy.sh release` |
| Web tĩnh | `/var/www/clip/app/apps/web/dist`, nginx phục vụ trực tiếp |
| Server API | systemd `clip-server`, Node 22 ở `/opt/node22`, loopback `127.0.0.1:4840` |
| Worker render | systemd `clip-worker`: `MemoryMax=1500M`, `CPUQuota=150%`, `Nice=15`, mỗi lần một job |
| Media | `/var/www/clip/media/{videos,inputs,tmp}` (user `clip`, nhóm `clip`; nginx thuộc nhóm `clip` để đọc video) |
| Xoá file | `clip-media-cleanup.timer` mỗi giờ: video quá 7 ngày, phần thừa của upload/render |
| Database | Postgres đang chạy trên `.65`, database `clip`, role `clip` (không dựng instance mới) |
| Env | `/etc/clip/production.env` (640 `root:clip`), nguồn ở thư mục env iCloud `ENV production/clip/` |
| nginx | `/etc/nginx/conf.d/clip.hoandat.com.conf` (từ `infra/nginx/`), `deploy.sh release` cài khi đổi, `nginx -t` trước khi reload |

## Env (`/etc/clip/production.env`)

Server và worker đọc chung một file; `loadConfig` của server dừng ngay khi thiếu biến bắt buộc ở production.

```
NODE_ENV=production
PORT=4840
PUBLIC_URL=https://clip.hoandat.com
AUTH_ISSUER=https://auth.hoandat.com
AUTH_CLIENT_ID=clip-web
AUTH_CLIENT_SECRET=<bằng CLIP_WEB_CLIENT_SECRET của auth-next, ≥ 32 ký tự>
DATABASE_URL=postgres://clip:<mật khẩu>@127.0.0.1:5432/clip
MEDIA_DIR=/var/www/clip/media
CHROME_PATH=/usr/bin/google-chrome
```

## Lần đầu

1. **IdP:** auth-next bật client `clip-web` bằng `CLIP_WEB_URL=https://clip.hoandat.com` và
   `CLIP_WEB_CLIENT_SECRET` (phase 1 của plan); redirect `https://clip.hoandat.com/auth/callback`.
2. **DNS:** bản ghi `clip.hoandat.com` trên Cloudflare (proxied, SSL "full") trỏ về `.65`.
3. **Database** (trên `.65`, chạy từ `/tmp` để `sudo -u postgres` không kêu quyền thư mục):
   ```bash
   cd /tmp && sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE clip LOGIN PASSWORD '<mật khẩu>'"
   cd /tmp && sudo -u postgres createdb -O clip clip
   ```
   Migration (`packages/db/drizzle`) tự chạy khi `clip-server` mở Postgres; worker không migrate.
4. **Máy chủ:** `SSH_TARGET=<user>@<SERVER_65_IP> SSH_OPTS="-p <SSH_PORT> -i <key>" bash infra/deploy.sh setup`
   (user `clip`, thư mục, unit, timer; không ghi secret).
5. **Env:** ghi `/etc/clip/production.env` như trên (`install -m 640 -o root -g clip`).
6. **Chrome:** `google-chrome` đã có trên `.65` (bản đo ngày 26/10/2026). Kiểm: `sudo -u clip /usr/bin/google-chrome --headless=new --dump-dom about:blank`.
   ffmpeg của máy không có libx264: worker tự dùng `libopenh264` (đã đo được).
7. **Phát hành:** `bash infra/deploy.sh release`.

## Phát hành

`infra/deploy.sh release`: chạy `lint`, `typecheck`, `test`, `build` ở máy dev, gửi bản build (giữ bố cục
workspace vì bundle tìm migration và mẫu qua package, worker chạy CLI `hyperframes` từ `node_modules`), trên máy
chủ `pnpm install --prod` cho `@clip/server` và `@clip/worker`, đổi `app/`, cài unit/nginx đã đổi, restart
`clip-server` (đợi `/healthz`) rồi `clip-worker` (worker làm xong job đang cầm rồi mới dừng, tối đa 10 phút).

**Quay lại bản trước:** `cd /var/www/clip && rm -rf app && mv app.prev app && systemctl restart clip-server clip-worker`.

## Kiểm sau phát hành

- `curl -fsS https://clip.hoandat.com/healthz` → `ok`.
- Đăng nhập, render một mẫu, tải MP4; `ffprobe` cho `h264`, 1080×1920, ≤ 20 giây.
- Trong lúc render: `grep MemAvailable /proc/meminfo` mỗi giây phải còn ≥ 1,5 GB (gate của plan); ghi số liệu vào
  report.
- Lần render thứ 6 trong ngày của cùng tài khoản nhận 429 với lời nhắn rõ ràng.
- Log: `journalctl -u clip-server -u clip-worker`. Log chỉ ghi id job, mã lỗi và đuôi output của công cụ, không ghi
  chữ hay ảnh của người dùng.

## Vận hành

- **Job kẹt:** worker đánh `failed` (`stuck`) mọi job `rendering` quá 10 phút; một render bị giết sau 9 phút
  (`timeout`). Job lỗi không tính vào 5 video/ngày.
- **Tốc độ:** đo ở `.65` khoảng 5,8 giây render cho 1 giây video với composition trống; mẫu thật (ảnh, chữ) chậm
  hơn — trên Mac M4 các mẫu thật mất 5,7–7,1 giây/giây video. Mẫu dài nhất (18 giây) có thể gần 3 phút trên `.65`.
- **Nâng hyperframes:** đổi phiên bản ở `apps/worker/package.json` và `apps/web/package.json` (player, core) cùng
  lúc, chạy `pnpm check:templates` và `pnpm --filter @clip/worker render:samples`, đo lại RAM trên `.65`.
