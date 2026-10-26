# clip-next

**Clip** (`clip.hoandat.com`): chọn một mẫu, gõ vài dòng chữ, thêm tối đa 3 ảnh, xem trước ngay trên trình duyệt
rồi nhận về một video dọc MP4 1080×1920 (≤ 20 giây) để tải xuống hoặc chia sẻ. Đăng nhập bằng tài khoản
hoandat.com; app thuộc tầng giải trí của hệ sinh thái `*-next`.

## Cấu trúc

| Thư mục | Vai trò |
|---|---|
| `apps/web` (`@clip/web`) | React 19 + Vite: trang giới thiệu, tạo video (xem trước bằng `@hyperframes/player`, không tốn server), "Video của tôi", trang pháp lý |
| `apps/server` (`@clip/server`) | Express 5: đăng nhập BFF với auth-next (client `clip-web`, Code + PKCE, `client_secret_basic`, scope `openid`), phiên `__Host-` (token opaque, chỉ lưu hash), nhận ảnh và xếp hàng render, kiểm quyền rồi giao file cho nginx (`X-Accel-Redirect`) |
| `apps/worker` (`@clip/worker`) | Lấy job từ hàng đợi Postgres (`FOR UPDATE SKIP LOCKED`), mỗi lần một job; `src/render.ts` là module duy nhất gọi `hyperframes` (ghim 0.8.201) |
| `packages/templates` (`@clip/templates`) | Ba mẫu video (composition HTML của hyperframes trong `project/`), schema chữ/ảnh của từng mẫu, kiểm tra đầu vào dùng chung cho web, server, worker |
| `packages/db` (`@clip/db`) | Schema Drizzle, migration, truy vấn hàng đợi và giới hạn, bố cục thư mục media |
| `infra/` | nginx, systemd (server, worker, timer xoá file), `deploy.sh` |

Ba mẫu: **Chúc mừng** (3 dòng chúc, 1–3 ảnh, pháo giấy, 12 giây), **Kể nhanh** (tiêu đề + 3–5 ý, ảnh tuỳ chọn,
18 giây), **Trích dẫn** (một câu lớn trên nền chuyển động, 10 giây). Hoạt ảnh viết bằng CSS animation (runtime của
hyperframes tua được), chữ dùng font Be Vietnam Pro tự host, nhạc CC0 (`assets/CREDITS.md`).

## Giới hạn

- Phải đăng nhập mới render; xem trước thì không cần.
- Mỗi tài khoản 5 video mỗi ngày theo giờ Việt Nam (job lỗi không tính), một job đang chờ hoặc đang render tại
  một thời điểm (unique index trong DB). Vượt giới hạn: HTTP 429 `daily-limit` (kèm giờ mở lại) hoặc
  `job-in-progress`, UI hiện lời nhắn.
- Ảnh: tối đa 3, mỗi ảnh ≤ 5 MB, chỉ JPEG/PNG/WebP (kiểm magic bytes); server dùng ffmpeg thu về ≤ 1080 px và bỏ
  toàn bộ metadata (EXIF, GPS) rồi mới lưu; ảnh bị xoá ngay khi render xong.
- Toàn server: tối đa 20 job đang chờ và phải còn ≥ 2 GB trống ở `MEDIA_DIR`, nếu không job mới nhận 503
  `server-busy`; mỗi tài khoản 10 yêu cầu render mỗi 10 phút; ảnh tối đa 24 MP, mỗi lần giải mã 2 ảnh.
- Job (cả chữ), video và ảnh bị xoá đúng 7 ngày sau khi tạo (timer systemd mỗi giờ); phiên hết hạn cũng bị xoá.
  Job đang render quá 10 phút bị đánh `failed`; dừng worker thì job đang render được đưa về hàng đợi.

## Chạy ở máy dev

Cần Node ≥ 22.12, pnpm 11.9 (`packageManager`), ffmpeg/ffprobe, Google Chrome.

```bash
pnpm install
pnpm dev          # server 127.0.0.1:5292 + web http://localhost:5293 (Vite proxy /api, /auth)
```

Không có `DATABASE_URL` thì server dùng PGlite ở `.data/pglite` và chạy worker ngay trong process (PGlite chỉ
cho một process). Đăng nhập cần `AUTH_CLIENT_SECRET` (xem `.env.example`); không có thì vẫn xem trước được.

Render thật một video mỗi mẫu qua đúng đường của worker (DB tạm, thư mục tạm):

```bash
pnpm --filter @clip/worker render:samples [ảnh1 ảnh2 ảnh3]
```

## Cổng kiểm

```bash
pnpm lint             # eslint + check:brand + check:tokens
pnpm typecheck
pnpm test             # vitest (PGlite), --maxWorkers=2
pnpm build            # web (Vite), bundle server và worker (esbuild)
pnpm check:templates  # hyperframes check từng mẫu trong Chrome (lint, lỗi runtime, bố cục, tương phản)
pnpm brand:gen        # sinh icon/manifest từ brand/app-icon-master-1024.png
```

## Triển khai

Xem [`docs/deployment-guide.md`](docs/deployment-guide.md).

## Giấy phép

Mã nguồn: MIT ([`LICENSE`](LICENSE)). Font, nhạc và biểu tượng app có giấy phép riêng:
[`assets/CREDITS.md`](assets/CREDITS.md). Biểu tượng app: AI-generated with OpenAI gpt-image for the hoandat
ecosystem; owned by hoandat, all rights reserved (not CC0).
