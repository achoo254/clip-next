# Triển khai Clip lên `.65`

Clip chạy trên edge `.65` dùng chung (CentOS Stream 9, 4 CPU, 7,5 GB RAM) sau Cloudflare và nginx. Repo public:
không ghi IP, cổng SSH hay user máy chủ vào đây; dùng placeholder `<SERVER_65_IP>`, `<SSH_PORT>`.

## Thành phần trên máy chủ

| Thứ | Ở đâu |
|---|---|
| Bản phát hành | `/var/www/clip/app` (bản trước: `app.prev`), cài bằng `infra/deploy.sh release` |
| Web tĩnh | `/var/www/clip/app/apps/web/dist`, nginx phục vụ trực tiếp |
| Server API | systemd `clip-server`, Node 22 ở `/opt/node22`, loopback `127.0.0.1:4840` |
| Worker render | systemd `clip-worker`: `MemoryMax=1500M`, `CPUQuota=150%`, `Nice=15`, mỗi lần một job; chỉ được nối loopback (`IPAddressDeny=any`, `IPAddressAllow=localhost`), `NoNewPrivileges`, `PrivateTmp` |
| Giọng đọc | `/var/www/clip/tts` (user `clip`, 750): `bin/uv`, CPython 3.12 riêng (`python/`), môi trường Python `pyenv/`, model VieNeu-TTS v3 Nano (`models/vieneu-v3-nano/`); khoảng 635 MB, cài bằng `infra/deploy.sh voice`. Không có service riêng: worker chạy một tiến trình Python ngắn trước mỗi render có giọng |
| Media | `/var/www/clip/media/{videos,inputs,tmp}` (user `clip`, nhóm `clip`; nginx thuộc nhóm `clip` để đọc video) |
| Lưu giữ | `clip-media-cleanup.timer` mỗi giờ chạy `apps/worker/dist/cleanup.mjs`: xoá job (cả chữ người dùng) đúng ngày hết hạn cùng video và ảnh của nó, phiên hết hạn hoặc 7 ngày không dùng, video không còn job; rồi dọn phần thừa của upload/render |
| Database | Postgres đang chạy trên `.65`, database `clip`, role `clip` (không dựng instance mới) |
| Env | `/etc/clip/production.env` (640 `root:clip`), nguồn ở thư mục env iCloud `ENV production/clip-next/` |
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
FFMPEG_PATH=/opt/ffmpeg-static/ffmpeg
FFPROBE_PATH=/opt/ffmpeg-static/ffprobe
VOICE_DIR=/var/www/clip/tts
```

`VOICE_DIR` bật giọng đọc: server mới nhận job có giọng (`/api/me` trả `voiceAvailable: true`), worker tìm Python và
model ở đó. Bỏ dòng này rồi restart hai service là tắt giọng đọc; job có giọng đã xếp hàng khi đó sẽ lỗi
`voice-failed` (không tính vào giới hạn ngày).

`FFMPEG_PATH`/`FFPROBE_PATH` trỏ tới một bản ffmpeg tĩnh có libx264 (ví dụ bản amd64 "release" của
johnvansickle.com, giải nén vào `/opt/ffmpeg-static/`, chỉ worker dùng). Có nó, hyperframes ghi thẳng MP4 (chụp
khung JPEG); không có, worker phải đi đường WebM có kênh alpha (chụp PNG), chậm khoảng 5 lần với nền vẽ AI. Đo trên
Mac M4 ngày 26/10/2026: mẫu 18 giây "Chuyến đi" mất 36 giây theo đường MP4 và 182 giây cho riêng bước WebM; trên
`.65` đường WebM sẽ vượt trần 3 phút. ffmpeg của hệ thống vẫn dùng cho việc làm sạch ảnh ở server.

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
7. **Giọng đọc:** `bash infra/deploy.sh voice` (xem mục Giọng đọc), rồi thêm `VOICE_DIR` vào env.
8. **Phát hành:** `bash infra/deploy.sh release`.

## Phát hành

`infra/deploy.sh release`: chạy `lint`, `typecheck`, `test`, `build` ở máy dev, gửi bản build (giữ bố cục
workspace vì bundle tìm migration và mẫu qua package, worker chạy CLI `hyperframes` từ `node_modules`), trên máy
chủ `pnpm install --prod` cho `@clip/server` và `@clip/worker`, đổi `app/`, cài unit/nginx đã đổi, restart
`clip-server` và đợi `/healthz`. Nếu `/healthz` không lên trong 20 giây, script tự đổi về `app.prev`, restart
`clip-server` rồi thoát mã khác 0 (bản lỗi để lại ở `app.failed`; worker chưa bị restart nên vẫn chạy bản cũ).
Khi server đã khoẻ mới restart `clip-worker`.

**Dừng worker giữa chừng** (release, restart): `KillMode=mixed` gửi SIGTERM cho riêng tiến trình worker. Worker
huỷ lần render đang chạy (công cụ nhận SIGTERM, 10 giây sau là SIGKILL), **đưa job về hàng đợi** kèm ảnh, rồi thoát;
mọi thứ còn lại trong cgroup nhận SIGKILL (`TimeoutStopSec=60`). Worker mới render lại job đó từ đầu, nên người dùng
không bị mất video vì một lần deploy.

**Render quá 9 phút:** worker giết cả nhóm tiến trình của hyperframes, đánh job `failed/timeout`, rồi tự thoát mã 1
để systemd dọn sạch cgroup (kể cả Chrome mà hyperframes chạy trong nhóm tiến trình riêng) và khởi động worker mới.

**CSP.** Clip có giao diện riêng với đúng một theme (tối, kiểu phòng chiếu phim; token ở
`apps/web/src/styles/tokens.css`), không có nút đổi sáng/tối nên trang không có script inline nào: `script-src` của
`$clip_csp` chỉ có `'self'` và beacon Cloudflare. `img-src` thêm `https://lh3.googleusercontent.com` và
`https://avatars.githubusercontent.com` cho ảnh đại diện (từ IdP) trong menu tài khoản trên header. Ngôn ngữ vẫn dùng chung cookie `hd_lang` với các app hoandat.com
(`@achoo254/app-shell/preferences`). Release cài site nginx đã đổi ngay sau khi đổi `app/`, nên web và CSP lên cùng
lần. Sau release, mở `https://clip.hoandat.com/`: console không có lỗi CSP. Quay lại bằng tay về bản còn dùng khung
chung (có script theme inline) mà không đổi nginx thì script đó bị CSP chặn: trang vẫn chạy, chỉ theo sáng/tối của
máy; muốn sạch thì cài lại site nginx của bản đó.

**Quay lại bản trước bằng tay:** `cd /var/www/clip && rm -rf app && mv app.prev app && systemctl restart clip-server clip-worker`.

## Kiểm sau phát hành

- `curl -fsS https://clip.hoandat.com/healthz` → `ok`.
- Đăng nhập, render một mẫu, tải MP4; `ffprobe` cho `h264`, 1080×1920, ≤ 20 giây.
- Trong lúc render: `grep MemAvailable /proc/meminfo` mỗi giây phải còn ≥ 1,5 GB (gate của plan); ghi số liệu vào
  report.
- Lần render thứ 6 trong ngày của cùng tài khoản nhận 429 với lời nhắn rõ ràng.
- Log: `journalctl -u clip-server -u clip-worker`. Log chỉ ghi id job, mã lỗi và đuôi output của công cụ, không ghi
  chữ hay ảnh của người dùng.

## Giọng đọc

Người dùng bật "Đọc chữ thành tiếng" và chọn một trong 11 giọng mẫu của VieNeu-TTS v3 Nano (mặc định Trúc Ly; danh
sách và tốc độ đo được ở `packages/templates/src/voice.ts`). Trước khi Chrome khởi động, worker chạy
`apps/worker/tts/synthesize.py` bằng Python của `VOICE_DIR` (ONNX Runtime, 2 thread, `nice 15`, trong cgroup của
`clip-worker`, không mạng): đọc mỗi đoạn chữ thành một WAV 24 kHz rồi thoát. Độ dài từng WAV quyết định lúc mỗi cảnh
hiện (biến `cues` của composition) và độ dài video (dài hơn bố cục khi cần, tối đa 20 giây); bước ffmpeg cuối đặt lời
đọc lên nhạc, nhạc giảm khi có lời (`sidechaincompress`). Chữ được chuẩn hoá trước khi đọc (`speechText`: "20/11"
thành "ngày 20 tháng 11", "8h-17h", "T2-T6", "50k"); video vẫn hiện chữ như người dùng gõ. Không nhận giọng hay audio
từ người dùng (không nhân bản giọng).

**Cài:** `SSH_TARGET=... SSH_OPTS=... bash infra/deploy.sh voice`. Lệnh idempotent, không đụng Python hệ thống hay app
khác: tải `uv` ghim phiên bản (kiểm sha256), CPython 3.12.16 của `uv` vào `tts/python/`, `uv pip sync` đúng
`apps/worker/tts/requirements.txt` vào `tts/pyenv/` (không cài `gradio`, `librosa` mà `vieneu` khai), tải model ở
revision ghim rồi kiểm `apps/worker/tts/vieneu-v3-nano.sha256`, xoá cache tải, đọc thử một câu bằng user `clip`. Lần
đầu mất khoảng 80 giây, lần sau khoảng 10 giây. Cần ≥ 2 GB trống ở `/var/www`.

**Đo trên `.65` ngày 30/10/2026** (Intel Broadwell 4 vCPU, không có VNNI):

| | Kết quả |
|---|---|
| Nạp model | 2,2–3,3 giây |
| Tốc độ đọc | RTF 0,47–0,53 (19 giây lời đọc mất 9,4 giây), 2 thread |
| RAM đỉnh của tiến trình đọc | 550–610 MB (11 giọng, 3 câu mỗi giọng) |
| Mẫu "Thầy cô", Trúc Ly, 3 dòng (6 giây lời đọc) | render 126 giây (không giọng: 114 giây); video 12,2 giây, 3,5 MB |
| Mẫu "Kể nhanh", Đức Trí (giọng chậm nhất), 4 đoạn | render 130 giây; video 18 giây, 3,8 MB |
| Bộ nhớ cgroup đỉnh của cả job | 823 MB có giọng, 777 MB không giọng (trần 1.500 MB) |
| `MemAvailable` thấp nhất của máy trong lúc render | 2.570 MB có giọng, 2.593 MB không giọng (gate ≥ 1,5 GB) |

Script đọc thả file model khỏi page cache trước khi thoát (`posix_fadvise`): không có bước này, cache 280 MB của model
vẫn tính vào cgroup của worker trong lúc Chrome chạy (đỉnh 1.385 MB, sát trần).

**Kiểm:** log của worker ghi mỗi job có giọng `voice <s> s read in <nạp> + <đọc> s, peak <MB> MB` (không ghi chữ).
Lỗi đọc: job `failed` với `voice-failed` (thiếu `VOICE_DIR`, Python lỗi) hoặc `voice-too-long` (lời đọc vượt 20 giây;
server đã chặn trước theo ước tính dè dặt nên hiếm khi xảy ra). Thử tay: `runuser -u clip -- /var/www/clip/tts/pyenv/bin/python -I
/var/www/clip/app/apps/worker/tts/synthesize.py --request <json> --model-dir /var/www/clip/tts/models/vieneu-v3-nano --out-dir <thư mục>`.

**Nâng phiên bản:** đổi `requirements.txt`, `NANO_REVISION` trong `deploy.sh` và `vieneu-v3-nano.sha256` cùng lúc,
chạy lại `deploy.sh voice`, đo lại thời gian và RAM như bảng trên, cập nhật `charsPerSecond` của các giọng nếu tốc độ
đổi.

## Vận hành

- **Job kẹt:** worker đánh `failed` (`stuck`) mọi job `rendering` quá 10 phút; một render bị giết sau 9 phút
  (`timeout`). Job lỗi không tính vào 5 video/ngày.
- **Bảo vệ máy dùng chung:**
  - mỗi tài khoản 10 yêu cầu render mỗi 10 phút (429 `too-many-requests`), và mỗi tài khoản chỉ một yêu cầu được xử lý tại một thời điểm;
  - quá 20 job đang chờ, hoặc ổ của `MEDIA_DIR` còn dưới 2 GB, thì job mới nhận 503 `server-busy`;
  - ảnh trên 24 MP bị từ chối trước khi giải mã; toàn server chỉ giải mã 2 ảnh cùng lúc, mỗi ffmpeg một luồng;
  - đăng nhập giới hạn 100 lượt mỗi 15 phút mỗi IP (`/auth/login`, `/auth/callback`).
- **Mạng của worker:** file server của hyperframes nghe trên mọi interface và không có tuỳ chọn đổi, mà firewall
  của `.65` không chặn cổng cao. `IPAddressDeny=any` của unit là thứ giữ nó chỉ trong loopback; đừng bỏ dòng đó.
  hyperframes, Chrome và ffmpeg chỉ nhận một env tối thiểu (không có `DATABASE_URL`, `AUTH_CLIENT_SECRET`).
- **Tốc độ:** với ffmpeg có libx264 (`FFMPEG_PATH`), trên Mac M4 các mẫu mất khoảng 2 giây render cho 1 giây video
  (Tết 12 giây: 24 giây; Chuyến đi 18 giây: 36 giây; Cảm ơn 10 giây: 19 giây). Không có libx264 thì đường WebM chậm
  khoảng 5 lần (xem mục Env). Đo lại trên `.65` sau khi cài ffmpeg tĩnh.
- **Thêm mẫu:** một thư mục chủ đề mới trong `packages/templates/project/themes/<chủ-đề>/` (`bg.webp` dọc 2:3 hoặc
  9:16, ví dụ 1024×1536 hay 864×1536, và, khi `BACKGROUND_VARIANTS` là 6, 5 nền biến thể `bg-2..6.webp` 864×1536 cùng dịp, cùng bảng màu, chừa cùng
  vùng trống cho chữ và khung ảnh — hoặc `backgrounds: 1` trong catalog nếu chỉ có một; `thumb.webp` 240×360, `sticker-1..3.webp`, `frame.webp` với bố cục chúc mừng, `theme.css` với màu và khoảng hở của khung)
  và một mục trong `ENTRIES` của `packages/templates/src/catalog.ts`; test kiểm đủ tệp, `pnpm check:templates` kiểm
  composition (`pnpm check:templates --all-backgrounds` kiểm cả tương phản chữ trên từng nền). Không đổi id mẫu đã có: job trong DB
  tham chiếu id.
- **Nền biến thể:** người dùng chọn nền bằng nút "Đổi nền" dưới khung xem trước (ảnh chỉ tải khi được chọn; lưới
  chọn mẫu không nặng thêm); job lưu số nền ở cột `render_jobs.background` (migration `0001_job-background`, mặc
  định 1 nên job cũ và bản phát hành cũ vẫn chạy), server từ chối số ngoài khoảng của mẫu (400
  `invalid-background`), worker truyền vào biến `background` của composition.
- **Nâng hyperframes:** đổi phiên bản ở `apps/worker/package.json` và `apps/web/package.json` (player, core) cùng
  lúc, chạy `pnpm check:templates` và `pnpm --filter @clip/worker render:samples`, đo lại RAM trên `.65`.
