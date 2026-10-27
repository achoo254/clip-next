# Ghi công tài sản

Tài sản đi kèm repo (font, nhạc, hình vẽ của các mẫu video trong `packages/templates/project/`, biểu tượng app
trong `brand/`) và giấy phép của chúng. Trang `/credits` của app hiển thị cùng nội dung. Các tài sản này **không**
thuộc giấy phép MIT của mã nguồn.

| Tài sản | Tác giả | Giấy phép | Nguồn |
| --- | --- | --- | --- |
| `packages/templates/project/assets/fonts/BeVietnamPro-{ExtraBold,SemiBold}.ttf` (đủ dấu tiếng Việt) | The Be Vietnam Pro Project Authors | SIL Open Font License 1.1 (`fonts/OFL.txt`) | https://github.com/google/fonts/tree/main/ofl/bevietnampro (chép từ `tieu-de-next/assets/fonts`) |
| `packages/templates/project/themes/{sinh-nhat,thay-co,tet,giang-sinh,tinh-yeu,dam-cuoi,tot-nghiep,khai-truong,ke-nhanh,chuyen-di,trich-dan,cam-on}/` (nền, khung ảnh, sticker, ảnh thu nhỏ của 12 mẫu đầu, WebP) | AI-generated with OpenAI gpt-image for the hoandat ecosystem | Owned by hoandat, all rights reserved (not CC0) | Vẽ ngày 26/10/2026 bằng `gpt-image-1.5` (nền 1024×1536, sticker và khung nền trong suốt), chuyển sang WebP bằng `cwebp` |
| `packages/templates/project/themes/{phu-nu-8-3,phu-nu-20-10,thieu-nhi,trung-thu,valentine,vu-lan,ngay-cua-me,halloween,quoc-khanh,tan-gia,day-thang,mung-tho,thang-chuc,ky-niem-cuoi,thu-cung,khuyen-mai,mon-an,ban-hang,tuyen-dung,su-kien,cam-trai,chao-buoi-sang,chuc-ngu-ngon,dong-vien,xin-loi}/` (nền, khung ảnh, sticker, ảnh thu nhỏ của 25 mẫu thêm sau, WebP) | AI-generated with open models (Qwen-Image, Z-Image-Turbo; Apache-2.0) for the hoandat ecosystem | Owned by hoandat, all rights reserved (not CC0) | Vẽ ngày 26/10/2026 trên máy nhà bằng ComfyUI: nền `Qwen-Image-2512` (928×1664, thu về 864×1536), sticker và khung `Z-Image-Turbo` tách nền bằng BiRefNet (MIT), chuyển sang WebP bằng `cwebp` |
| `packages/templates/project/themes/*/bg-{2..6}.webp` (5 nền thay thế cho mỗi mẫu trừ Lá số tử vi, chọn bằng nút "Đổi nền") | AI-generated with open models (Qwen-Image; Apache-2.0) for the hoandat ecosystem | Owned by hoandat, all rights reserved (not CC0) | Vẽ ngày 27/10/2026 trên máy nhà bằng ComfyUI `Qwen-Image-2512` (928×1664, thu về 864×1536), cùng cảnh và bảng màu với `bg.webp` của mẫu, chuyển sang WebP q80 bằng Pillow |
| `packages/templates/project/themes/la-so/` (mẫu Lá số tử vi: `bg.webp`, `thumb.webp`, `medallion.webp`, `animal-*.webp`, `star-*.webp`; `sticker-1..3.webp` là huy hiệu Hóa Lộc, Quyền, Khoa; `cuc-*.webp`) | Nền, huy chương, 12 con giáp, 14 chính tinh: AI-generated with OpenAI gpt-image for the hoandat ecosystem. Tứ hóa và cục: AI-generated with open models (FLUX.2 klein 4B; Apache-2.0) for the hoandat ecosystem | Owned by hoandat, all rights reserved (not CC0) | Dùng lại hình của app Tử Vi (`tu-vi-next/apps/web/src/art`, xem CREDITS.md ở đó), chuyển từ PNG gốc 1024 px sang WebP cỡ video; không vẽ mới |
| `packages/templates/project/assets/music/fetch-dance.m4a`, `bicycle.m4a`, `chillin-poupi.m4a`, `good-fellow.m4a` (mỗi mẫu một bản, xem `music` trong `packages/templates/src/catalog.ts`) | Komiku (Loyalty Freak Music), album "Poupi's Incredible Adventures" | CC0-1.0 (được chép, sửa, phân phối lại kể cả trong repo public, không cần xin phép) | https://opengameart.org/content/poupis-incredible-adventures-full-album (chép từ `tieu-de-next/assets/music`, gốc ở `miu-world-next`) |
| Font giao diện web Inter, JetBrains Mono (gói `@fontsource/*`, có subset tiếng Việt) | Rasmus Andersson; JetBrains | SIL Open Font License 1.1 | https://fontsource.org |
| `brand/app-icon-master-1024.png` và mọi biểu tượng sinh ra từ nó (`brand/icon*.svg`, `brand/generated/`, `apps/web/public/clip-mark-128.webp`) | AI-generated with OpenAI gpt-image for the hoandat ecosystem | Owned by hoandat, all rights reserved (not CC0) | `hoandat-app/docs/brand/apps/clip-icon-master-1024.png` |

## Thư viện render

- `hyperframes`, `@hyperframes/player`, `@hyperframes/core` 0.8.201 (HeyGen) — Apache License 2.0
  (https://github.com/heygen-com/hyperframes). Các gói 0.8.201 trên npm **không kèm tệp NOTICE** (đã kiểm bằng
  `npm pack`); `@hyperframes/player` và `@hyperframes/core` kèm `LICENSE`. Khi nâng phiên bản, kiểm lại: có NOTICE
  thì chép vào repo và trang `/credits`.
