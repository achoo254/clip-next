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

Mẫu = **bố cục × chủ đề**. Bốn bố cục (`project/layouts/`): chúc mừng (3 dòng, 1–3 ảnh trong khung, 12 giây), kể
nhanh (tiêu đề + 3–5 ý, ảnh tuỳ chọn, 18 giây), trích dẫn (một câu + tác giả, 10 giây), lá số (con giáp, chính
tinh, cục chọn theo id trong bộ hình của chủ đề + 3 dòng chữ và tên tuỳ chọn, 18 giây; mở từ Tử Vi qua
`/tao?t=la-so&animal=…&star=…&cuc=…#name=…&line1=…&line2=…&reading=…`: id trong query, chữ tự do (tên, các dòng) trong
`#fragment` để không bao giờ tới log máy chủ; mọi giá trị được kiểm theo danh sách cho phép và giới hạn ô, sai thì bỏ
qua, rồi query và fragment được xoá khỏi thanh địa chỉ). Mỗi chủ đề
(`project/themes/<chủ-đề>/`) là một bộ ảnh vẽ bằng AI (nền dọc `bg.webp`, khung ảnh, sticker nền trong suốt, ảnh thu
nhỏ; thêm 5 nền thay thế `bg-2..6.webp` cùng dịp, cùng bảng màu để người dùng chọn bằng nút "Đổi nền"),
bảng màu chữ (`theme.css`) và một bản nhạc; danh sách mẫu ở `packages/templates/src/catalog.ts`. Thêm mẫu là thêm
một chủ đề, không thêm bố cục. Không có hình trang trí vẽ bằng CSS; gradient và lớp nền mờ chỉ để chữ dễ đọc.
Video ra ba khổ: dọc 9:16 (1080×1920, khổ bố cục được vẽ), 4:5 (1080×1350) và vuông (1080×1080); hai khổ sau thu
khung 9:16 nguyên vẹn theo chiều cao, đặt giữa, hai bên là nền của mẫu làm mờ (`composeTemplateHtml`), nên không bố
cục nào phải vẽ lại và không mất chữ hay ảnh.
Chuyển động viết bằng CSS animation (runtime của hyperframes tua được), chữ dùng font Be Vietnam Pro tự host, nhạc
CC0.

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

Mã nguồn: MIT ([`LICENSE`](LICENSE)). Font, nhạc, hình vẽ của các mẫu và biểu tượng app **không** thuộc giấy
phép MIT; xem [`assets/CREDITS.md`](assets/CREDITS.md). Biểu tượng app: AI-generated with open models (FLUX.2 klein 4B; Apache-2.0) for the hoandat ecosystem; owned by hoandat, all rights reserved (not CC0).
Hình vẽ của 12 mẫu đầu: AI-generated
with OpenAI gpt-image for the hoandat ecosystem; owned by hoandat, all rights reserved (not CC0). Hình vẽ của các mẫu
thêm sau và các nền biến thể (`bg-2..6.webp`) của mọi mẫu: AI-generated with open models (Qwen-Image, Z-Image-Turbo; Apache-2.0) for the hoandat ecosystem; owned by hoandat, all rights reserved (not CC0).
Mẫu Lá số tử vi (`themes/la-so/`) dùng lại hình của Tử Vi (nền, huy chương, con giáp, chính tinh: OpenAI gpt-image;
huy hiệu tứ hóa và cục: FLUX.2 klein 4B), cùng dòng giấy phép "owned by hoandat, all rights reserved (not CC0)".
