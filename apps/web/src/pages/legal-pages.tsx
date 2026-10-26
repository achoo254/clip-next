import type { ReactNode } from 'react';
import { brand, HOME_URL } from '../brand';
import { useI18n } from '../i18n';

function Page({ title, children }: { readonly title: string; readonly children: ReactNode }): ReactNode {
  return (
    <article className="prose card">
      <h1>{title}</h1>
      {children}
    </article>
  );
}

export function PrivacyPage(): ReactNode {
  const { t, locale } = useI18n();
  const name = brand.appName;
  const account = brand.primaryTenant.domain;
  return (
    <Page title={t('privacy.title')}>
      {locale === 'vi' ? (
        <>
          <p>Trang này nói {name} lưu gì về bạn, vì sao, và bao lâu.</p>
          <h2>Tài khoản</h2>
          <p>
            Bạn đăng nhập bằng tài khoản {account}. {name} chỉ nhận một mã định danh tài khoản (không nhận email, tên hay ảnh đại diện) và
            một cookie phiên đăng nhập. Cookie này chỉ dùng để giữ bạn đăng nhập, hết hạn sau 30 ngày (hoặc sau 7 ngày không dùng); phiên
            hết hạn bị xoá khỏi máy chủ.
          </p>
          <h2>Chữ và ảnh bạn gửi</h2>
          <p>
            Khi bạn bấm tạo video, chữ bạn gõ và ảnh bạn chọn được gửi lên máy chủ. Ảnh được thu nhỏ còn tối đa 1080 điểm ảnh và xoá toàn
            bộ thông tin đi kèm (EXIF, vị trí GPS, loại máy) trước khi lưu, và bị xoá ngay khi video tạo xong. Chữ được lưu cùng video để
            bạn xem lại danh sách của mình, và bị xoá cùng video sau 7 ngày.
          </p>
          <p>Phần xem trước chạy hoàn toàn trên máy bạn: ảnh không rời khỏi máy cho tới khi bạn bấm tạo video.</p>
          <h2>Video</h2>
          <p>Video chỉ bạn tải được (máy chủ kiểm tài khoản trước khi trả tệp) và tự xoá sau 7 ngày, tính từ lúc bạn bấm tạo.</p>
          <h2>Không có</h2>
          <p>Không quảng cáo, không công cụ theo dõi, không bán hay chia sẻ dữ liệu cho bên thứ ba.</p>
        </>
      ) : (
        <>
          <p>This page says what {name} keeps about you, why, and for how long.</p>
          <h2>Account</h2>
          <p>
            You sign in with your {account} account. {name} receives only an account identifier (no email, name or picture) and sets
            one session cookie, used only to keep you signed in; it expires after 30 days (or 7 days unused), and expired sessions are
            deleted from the server.
          </p>
          <h2>Text and photos you send</h2>
          <p>
            When you press create, the text you typed and the photos you chose are sent to the server. Photos are scaled down to at
            most 1080 pixels and stripped of all metadata (EXIF, GPS location, camera details) before they are stored, and deleted as
            soon as the video is made. The text is kept with the video so you can see your list, and deleted with it after 7 days.
          </p>
          <p>The preview runs entirely on your device: photos do not leave it until you press create.</p>
          <h2>Videos</h2>
          <p>Only you can download your videos (the server checks your account first); they are deleted 7 days after you press create.</p>
          <h2>None of this</h2>
          <p>No ads, no trackers, no selling or sharing of data with third parties.</p>
        </>
      )}
    </Page>
  );
}

export function TermsPage(): ReactNode {
  const { t, locale } = useI18n();
  const name = brand.appName;
  return (
    <Page title={t('terms.title')}>
      {locale === 'vi' ? (
        <>
          <p>Dùng {name} nghĩa là bạn đồng ý với các điều sau.</p>
          <h2>Ảnh và chữ của bạn</h2>
          <p>
            Bạn chịu trách nhiệm về ảnh và chữ bạn tải lên: bạn phải có quyền dùng ảnh đó, và được sự đồng ý của người có trong ảnh.
            Không tải lên nội dung vi phạm pháp luật, xúc phạm hay xâm phạm quyền của người khác.
          </p>
          <h2>Lưu giữ</h2>
          <p>Ảnh bị xoá ngay khi video tạo xong; video tự xoá sau 7 ngày. Hãy tải về nếu muốn giữ lâu hơn.</p>
          <h2>Giới hạn</h2>
          <p>
            Mỗi tài khoản tạo được 5 video mỗi ngày (tính theo giờ Việt Nam) và chỉ một video đang chờ tạo cùng lúc. Video dài tối đa 20
            giây. Nhạc trong mẫu là nhạc có giấy phép cho phép dùng lại (xem trang Ghi công).
          </p>
          <h2>Dịch vụ</h2>
          <p>
            {name} là dịch vụ giải trí miễn phí, cung cấp như hiện có, có thể tạm ngừng hoặc thay đổi. Một app của{' '}
            <a href={HOME_URL}>{brand.primaryTenant.domain}</a>.
          </p>
        </>
      ) : (
        <>
          <p>By using {name} you agree to the following.</p>
          <h2>Your photos and text</h2>
          <p>
            You are responsible for the photos and text you upload: you must have the right to use the photos and the consent of the
            people in them. Do not upload anything illegal, offensive or infringing on other people's rights.
          </p>
          <h2>Retention</h2>
          <p>Photos are deleted as soon as the video is made; videos are deleted after 7 days. Download them to keep them longer.</p>
          <h2>Limits</h2>
          <p>
            Each account can make 5 videos a day (Vietnam time) and have one video waiting at a time. Videos last up to 20 seconds.
            The templates' music is licensed for reuse (see Credits).
          </p>
          <h2>The service</h2>
          <p>
            {name} is a free entertainment service, provided as is, and may pause or change. An app by{' '}
            <a href={HOME_URL}>{brand.primaryTenant.domain}</a>.
          </p>
        </>
      )}
    </Page>
  );
}

const CREDITS: readonly { readonly what: string; readonly who: string; readonly licence: string; readonly url: string }[] = [
  { what: 'hyperframes, @hyperframes/player, @hyperframes/core 0.8.201', who: 'HeyGen', licence: 'Apache License 2.0', url: 'https://github.com/heygen-com/hyperframes' },
  { what: 'Be Vietnam Pro', who: 'The Be Vietnam Pro Project Authors', licence: 'SIL Open Font License 1.1', url: 'https://github.com/google/fonts/tree/main/ofl/bevietnampro' },
  { what: 'Inter, JetBrains Mono', who: 'Rasmus Andersson; JetBrains', licence: 'SIL Open Font License 1.1', url: 'https://fontsource.org' },
  {
    what: 'Fetch Dance, Bicycle, Chillin Poupi, Good Fellow',
    who: 'Komiku (Loyalty Freak Music), album "Poupi\'s Incredible Adventures"',
    licence: 'CC0 1.0',
    url: 'https://opengameart.org/content/poupis-incredible-adventures-full-album',
  },
];

export function CreditsPage(): ReactNode {
  const { t, locale } = useI18n();
  return (
    <Page title={t('credits.title')}>
      <p>
        {locale === 'vi'
          ? 'Video được dựng bằng hyperframes (khung hình viết bằng HTML, render qua Chrome và ffmpeg). Gói hyperframes 0.8.201 không kèm tệp NOTICE; giấy phép Apache 2.0 đi kèm mã nguồn của gói.'
          : 'Videos are made with hyperframes (frames written in HTML, rendered through Chrome and ffmpeg). The hyperframes 0.8.201 packages ship no NOTICE file; the Apache 2.0 licence comes with their source.'}
      </p>
      <ul className="credits">
        {CREDITS.map((c) => (
          <li key={c.what}>
            <b>{c.what}</b> — {c.who}. {c.licence}. <a href={c.url}>{c.url}</a>
          </li>
        ))}
      </ul>
      <p>
        {locale === 'vi'
          ? 'Biểu tượng app, cùng hình nền, khung ảnh và hình trang trí của 12 mẫu đầu'
          : "The app icon, and the backgrounds, photo frames and stickers of the first 12 templates"}
        : AI-generated with OpenAI gpt-image for the hoandat ecosystem; owned by hoandat, all rights reserved (not CC0).
      </p>
      <p>
        {locale === 'vi' ? 'Hình vẽ của các mẫu thêm sau' : "The art of the templates added later"}
        : AI-generated with open models (Qwen-Image, Z-Image-Turbo; Apache-2.0) for the hoandat ecosystem; owned by hoandat, all rights reserved (not CC0).{' '}
        {locale === 'vi' ? 'Các hình này không thuộc giấy phép MIT của mã nguồn.' : "None of this art is covered by the code's MIT licence."}
      </p>
    </Page>
  );
}
