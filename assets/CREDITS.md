# Ghi công tài sản

Tài sản đi kèm repo (font, nhạc của các mẫu video trong `packages/templates/project/assets/`, biểu tượng app trong
`brand/`) và giấy phép của chúng. Trang `/credits` của app hiển thị cùng nội dung.

| Tài sản | Tác giả | Giấy phép | Nguồn |
| --- | --- | --- | --- |
| `packages/templates/project/assets/fonts/BeVietnamPro-{ExtraBold,SemiBold}.ttf` (đủ dấu tiếng Việt) | The Be Vietnam Pro Project Authors | SIL Open Font License 1.1 (`fonts/OFL.txt`) | https://github.com/google/fonts/tree/main/ofl/bevietnampro (chép từ `tieu-de-next/assets/fonts`) |
| `packages/templates/project/assets/music/fetch-dance.m4a` (mẫu Chúc mừng), `bicycle.m4a` (Kể nhanh), `chillin-poupi.m4a` (Trích dẫn) | Komiku (Loyalty Freak Music), album "Poupi's Incredible Adventures" | CC0-1.0 (được chép, sửa, phân phối lại kể cả trong repo public, không cần xin phép) | https://opengameart.org/content/poupis-incredible-adventures-full-album (chép từ `tieu-de-next/assets/music`, gốc ở `miu-world-next`) |
| Font giao diện web Inter, JetBrains Mono (gói `@fontsource/*`, có subset tiếng Việt) | Rasmus Andersson; JetBrains | SIL Open Font License 1.1 | https://fontsource.org |
| `brand/app-icon-master-1024.png` và mọi biểu tượng sinh ra từ nó (`brand/icon*.svg`, `brand/generated/`, `apps/web/public/clip-mark-128.webp`) | AI-generated with OpenAI gpt-image for the hoandat ecosystem | Owned by hoandat, all rights reserved (not CC0) | `hoandat-app/docs/brand/apps/clip-icon-master-1024.png` |

## Thư viện render

- `hyperframes`, `@hyperframes/player`, `@hyperframes/core` 0.8.201 (HeyGen) — Apache License 2.0
  (https://github.com/heygen-com/hyperframes). Các gói 0.8.201 trên npm **không kèm tệp NOTICE** (đã kiểm bằng
  `npm pack`); `@hyperframes/player` và `@hyperframes/core` kèm `LICENSE`. Khi nâng phiên bản, kiểm lại: có NOTICE
  thì chép vào repo và trang `/credits`.
