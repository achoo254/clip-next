import type { Locale } from '@clip/templates';
import type { ReactNode } from 'react';
import { ACCOUNT_DELETE_URL, brand, HOME_URL } from '../brand';
import { useI18n } from '../i18n';

function Page({ title, children }: { readonly title: string; readonly children: ReactNode }): ReactNode {
  return (
    <article className="prose card">
      <h1>{title}</h1>
      {children}
    </article>
  );
}

interface LegalText {
  readonly name: string;
  readonly account: string;
}

/** The privacy page's text in each language. */
const PRIVACY: Readonly<Record<Locale, (text: LegalText) => ReactNode>> = {
  vi: ({ name, account }) => (
    <>
      <p>Trang này nói {name} lưu gì về bạn, vì sao, và bao lâu.</p>
      <h2>Tài khoản</h2>
      <p>
        Bạn đăng nhập bằng tài khoản {account}. Mỗi lần bạn đăng nhập, {name} nhận từ {account} mã định danh tài khoản, tên hiển thị,
        địa chỉ ảnh đại diện và email của bạn, rồi lưu cùng tài khoản trên máy chủ của {name}. Tên, ảnh và email chỉ dùng để hiện
        trong menu tài khoản ở đầu trang, chỉ bạn thấy; {name} không gửi thư tới email đó và không chia sẻ cho ai. Lần đăng nhập
        sau, chúng được thay bằng thông tin mới nhất từ {account} (đổi tên hay ảnh ở đó thì ở đây cũng đổi theo).
      </p>
      <p>
        {name} chỉ lưu địa chỉ của ảnh đại diện, không lưu chính tấm ảnh: trình duyệt của bạn tải ảnh thẳng từ Google hoặc GitHub
        (nơi bạn dùng để đăng nhập) và không gửi kèm địa chỉ trang bạn đang xem. Đăng nhập bằng Apple thì không có ảnh
        đại diện, vì Apple không chia sẻ ảnh.
      </p>
      <p>
        {name} đặt một cookie phiên đăng nhập, chỉ dùng để giữ bạn đăng nhập. Cookie hết hạn sau 30 ngày (hoặc sau 7 ngày không
        dùng); phiên hết hạn bị xoá khỏi máy chủ.
      </p>
      <h2>Chữ và ảnh bạn gửi</h2>
      <p>
        Khi bạn bấm tạo video, chữ bạn gõ và ảnh bạn chọn được gửi lên máy chủ. Ảnh được thu nhỏ còn tối đa 1080 điểm ảnh và xoá toàn
        bộ thông tin đi kèm (EXIF, vị trí GPS, loại máy) trước khi lưu, và bị xoá ngay khi video tạo xong. Chữ được lưu cùng video để
        bạn xem lại danh sách của mình, và bị xoá cùng video sau 7 ngày.
      </p>
      <p>Phần xem trước chạy hoàn toàn trên máy bạn: ảnh không rời khỏi máy cho tới khi bạn bấm tạo video.</p>
      <p>
        Nếu bạn bật giọng đọc, chữ được đọc thành tiếng bằng AI ngay trên máy chủ của {name}, không gửi cho dịch vụ nào khác; tệp
        tiếng đọc bị xoá khi video tạo xong.
      </p>
      <h2>Video</h2>
      <p>Video chỉ bạn tải được (máy chủ kiểm tài khoản trước khi trả tệp) và tự xoá sau 7 ngày, tính từ lúc bạn bấm tạo.</p>
      <h2>Xoá tài khoản</h2>
      <p>
        Tài khoản chỉ xoá được ở <a href={ACCOUNT_DELETE_URL}>trang tài khoản {account}</a>. Khi bạn xoá ở đó, {name} xoá ngay mọi thứ
        đã lưu về bạn: tài khoản (tên, ảnh, email), phiên đăng nhập, chữ, ảnh và video.
      </p>
      <h2>Không có</h2>
      <p>Không quảng cáo, không công cụ theo dõi, không bán hay chia sẻ dữ liệu cho bên thứ ba.</p>
    </>
  ),
  en: ({ name, account }) => (
    <>
      <p>This page says what {name} keeps about you, why, and for how long.</p>
      <h2>Account</h2>
      <p>
        You sign in with your {account} account. Each time you sign in, {name} receives your account identifier, display name,
        picture address and email from {account} and stores them with your account on the {name} server. The name, picture and
        email are used only to show the account menu at the top of the page, to you alone; {name} sends no mail to that address
        and shares them with no one. At your next sign-in they are replaced with the latest details from {account} (change your
        name or picture there and it changes here too).
      </p>
      <p>
        {name} stores only the address of your picture, not the picture itself: your browser loads it straight from Google or
        GitHub (whichever you sign in with) without sending the address of the page you are on. Signing in with Apple gives no
        picture, because Apple does not share one.
      </p>
      <p>
        {name} sets one session cookie, used only to keep you signed in. It expires after 30 days (or 7 days unused), and expired
        sessions are deleted from the server.
      </p>
      <h2>Text and photos you send</h2>
      <p>
        When you press create, the text you typed and the photos you chose are sent to the server. Photos are scaled down to at
        most 1080 pixels and stripped of all metadata (EXIF, GPS location, camera details) before they are stored, and deleted as
        soon as the video is made. The text is kept with the video so you can see your list, and deleted with it after 7 days.
      </p>
      <p>The preview runs entirely on your device: photos do not leave it until you press create.</p>
      <p>
        If you turn the voice on, your text is read aloud by an AI voice on the {name} server itself and sent to no other service;
        the voice recordings are deleted as soon as the video is made.
      </p>
      <h2>Videos</h2>
      <p>Only you can download your videos (the server checks your account first); they are deleted 7 days after you press create.</p>
      <h2>Deleting your account</h2>
      <p>
        An account is deleted only on the <a href={ACCOUNT_DELETE_URL}>{account} account page</a>. When you delete it there, {name}
        deletes everything it stored about you at once: the account (name, picture, email), sessions, text, photos and videos.
      </p>
      <h2>None of this</h2>
      <p>No ads, no trackers, no selling or sharing of data with third parties.</p>
    </>
  ),
  'zh-CN': ({ name, account }) => (
    <>
      <p>本页说明 {name} 保存你的哪些信息、为什么保存、保存多久。</p>
      <h2>账号</h2>
      <p>
        你使用 {account} 账号登录。每次登录时，{name} 从 {account} 收到你的账号标识、显示名称、头像地址和邮箱，并随账号保存在 {name}{' '}
        的服务器上。名称、头像和邮箱仅用于在页面顶部的账号菜单中显示，只有你能看到；{name} 不会给该邮箱发邮件，也不与任何人共享。下次登录时，
        它们会被替换为 {account} 上的最新信息（你在那里改名或换头像，这里也会跟着变）。
      </p>
      <p>
        {name} 只保存头像的地址，不保存头像本身：你的浏览器直接从 Google 或 GitHub（取决于你的登录方式）加载头像，不附带你正在浏览的页面地址。
        使用 Apple 登录则没有头像，因为 Apple 不共享头像。
      </p>
      <p>{name} 设置一个会话 Cookie，仅用于保持你的登录状态。它在 30 天后（或 7 天未使用后）过期，过期的会话会从服务器上删除。</p>
      <h2>你发送的文字和照片</h2>
      <p>
        点击制作视频时，你输入的文字和选择的照片会发送到服务器。照片在保存前会被缩小到最多 1080 像素，并删除所有附带信息（EXIF、GPS
        位置、相机型号），视频制作完成后立即删除。文字随视频保存，方便你查看自己的列表，7 天后随视频一起删除。
      </p>
      <p>预览完全在你的设备上运行：在你点击制作视频之前，照片不会离开你的设备。</p>
      <p>如果你开启配音，文字由 {name} 服务器上的 AI 直接朗读，不会发送给其他任何服务；配音文件在视频制作完成后删除。</p>
      <h2>视频</h2>
      <p>只有你能下载你的视频（服务器会先核对账号再提供文件），视频从你点击制作起 7 天后自动删除。</p>
      <h2>删除账号</h2>
      <p>
        账号只能在 <a href={ACCOUNT_DELETE_URL}>{account} 账号页面</a>删除。你在那里删除后，{name} 会立即删除保存的关于你的一切：账号（名称、头像、邮箱）、
        登录会话、文字、照片和视频。
      </p>
      <h2>没有这些</h2>
      <p>没有广告，没有跟踪工具，不出售也不向第三方共享数据。</p>
    </>
  ),
};

export function PrivacyPage(): ReactNode {
  const { t, locale } = useI18n();
  return <Page title={t('privacy.title')}>{PRIVACY[locale]({ name: brand.appName, account: brand.primaryTenant.domain })}</Page>;
}

/** The terms page's text in each language. */
const TERMS: Readonly<Record<Locale, (text: LegalText) => ReactNode>> = {
  vi: ({ name, account }) => (
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
        {name} là dịch vụ giải trí miễn phí, cung cấp như hiện có, có thể tạm ngừng hoặc thay đổi. Một app của <a href={HOME_URL}>{account}</a>.
      </p>
    </>
  ),
  en: ({ name, account }) => (
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
        {name} is a free entertainment service, provided as is, and may pause or change. An app by <a href={HOME_URL}>{account}</a>.
      </p>
    </>
  ),
  'zh-CN': ({ name, account }) => (
    <>
      <p>使用 {name} 即表示你同意以下条款。</p>
      <h2>你的照片和文字</h2>
      <p>
        你对上传的照片和文字负责：你必须有权使用这些照片，并征得照片中人物的同意。不得上传违法、冒犯他人或侵犯他人权利的内容。
      </p>
      <h2>保存</h2>
      <p>照片在视频制作完成后立即删除；视频 7 天后自动删除。如需长期保存，请下载。</p>
      <h2>限制</h2>
      <p>
        每个账号每天可制作 5 个视频（按越南时间计算），同一时间只能有一个视频在等待制作。视频最长 20 秒。模板中的音乐均已获得可再使用的许可（见致谢页）。
      </p>
      <h2>服务</h2>
      <p>
        {name} 是免费的娱乐服务，按现状提供，可能暂停或变更。<a href={HOME_URL}>{account}</a> 旗下应用。
      </p>
    </>
  ),
};

export function TermsPage(): ReactNode {
  const { t, locale } = useI18n();
  return <Page title={t('terms.title')}>{TERMS[locale]({ name: brand.appName, account: brand.primaryTenant.domain })}</Page>;
}

const CREDITS: readonly { readonly what: string; readonly who: string; readonly licence: string; readonly url: string }[] = [
  { what: 'hyperframes, @hyperframes/player, @hyperframes/core 0.8.201', who: 'HeyGen', licence: 'Apache License 2.0', url: 'https://github.com/heygen-com/hyperframes' },
  { what: 'Be Vietnam Pro', who: 'The Be Vietnam Pro Project Authors', licence: 'SIL Open Font License 1.1', url: 'https://github.com/google/fonts/tree/main/ofl/bevietnampro' },
  { what: 'Oswald', who: 'The Oswald Project Authors', licence: 'SIL Open Font License 1.1', url: 'https://github.com/google/fonts/tree/main/ofl/oswald' },
  {
    what: 'Fetch Dance, Bicycle, Chillin Poupi, Good Fellow',
    who: 'Komiku (Loyalty Freak Music), album "Poupi\'s Incredible Adventures"',
    licence: 'CC0 1.0',
    url: 'https://opengameart.org/content/poupis-incredible-adventures-full-album',
  },
  {
    what: 'VieNeu-TTS v3 Nano (AI voice, 11 preset voices; revision aba295e)',
    who: 'pnnbao97 / pnnbao-ump (VieNeu-TTS)',
    licence: 'Apache License 2.0',
    url: 'https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Nano',
  },
];

/**
 * The credits page's own sentences in each language. The licence statements after them ("AI-generated with …; owned
 * by hoandat") stay in English in every language, as written by the rights holder.
 */
const CREDIT_TEXT: Readonly<Record<Locale, Readonly<Record<'tools' | 'icon' | 'firstArt' | 'laterArt' | 'chartArt' | 'emblems' | 'notMit', string>>>> = {
  vi: {
    tools:
      'Video được dựng bằng hyperframes (khung hình viết bằng HTML, render qua Chrome và ffmpeg). Gói hyperframes 0.8.201 không kèm tệp NOTICE; giấy phép Apache 2.0 đi kèm mã nguồn của gói.',
    icon: 'Biểu tượng app',
    firstArt: 'Hình nền, khung ảnh và hình trang trí của 12 mẫu đầu',
    laterArt: 'Hình vẽ của các mẫu thêm sau, và các nền thay thế (nút "Đổi nền") của mọi mẫu',
    chartArt: 'Mẫu Lá số tử vi dùng lại hình của app Tử Vi: nền trời sao, huy chương, 12 con giáp và 14 chính tinh',
    emblems: 'Huy hiệu tứ hóa và ngũ hành cục',
    notMit: 'Các hình này không thuộc giấy phép MIT của mã nguồn.',
  },
  en: {
    tools:
      'Videos are made with hyperframes (frames written in HTML, rendered through Chrome and ffmpeg). The hyperframes 0.8.201 packages ship no NOTICE file; the Apache 2.0 licence comes with their source.',
    icon: 'The app icon',
    firstArt: 'The backgrounds, photo frames and stickers of the first 12 templates',
    laterArt: 'The art of the templates added later, and the alternative backgrounds ("Change background") of every template',
    chartArt: 'The birth chart template reuses art of the Tử Vi app: the starry sky, the medallion, the 12 zodiac animals and the 14 major stars',
    emblems: 'The tứ hóa and cục emblems',
    notMit: "None of this art is covered by the code's MIT licence.",
  },
  'zh-CN': {
    tools:
      '视频使用 hyperframes 制作（用 HTML 编写画面，通过 Chrome 和 ffmpeg 渲染）。hyperframes 0.8.201 软件包不附带 NOTICE 文件；Apache 2.0 许可随其源代码提供。',
    icon: '应用图标',
    firstArt: '前 12 个模板的背景、相框和装饰图',
    laterArt: '后来新增模板的插图，以及所有模板的备选背景（“更换背景”按钮）',
    chartArt: '紫微命盘模板沿用了 Tử Vi 应用的插图：星空背景、徽章、12 生肖和 14 主星',
    emblems: '四化和五行局徽章',
    notMit: '这些插图不在源代码的 MIT 许可范围内。',
  },
};

export function CreditsPage(): ReactNode {
  const { t, locale } = useI18n();
  const text = CREDIT_TEXT[locale];
  return (
    <Page title={t('credits.title')}>
      <p>{text.tools}</p>
      <ul className="credits">
        {CREDITS.map((c) => (
          <li key={c.what}>
            <b>{c.what}</b> — {c.who}. {c.licence}. <a href={c.url}>{c.url}</a>
          </li>
        ))}
      </ul>
      <p>
        {text.icon}
        : AI-generated with open models (FLUX.2 klein 4B; Apache-2.0) for the hoandat ecosystem; owned by hoandat, all rights reserved (not CC0).
      </p>
      <p>
        {text.firstArt}
        : AI-generated with OpenAI gpt-image for the hoandat ecosystem; owned by hoandat, all rights reserved (not CC0).
      </p>
      <p>
        {text.laterArt}
        : AI-generated with open models (Qwen-Image, Z-Image-Turbo; Apache-2.0) for the hoandat ecosystem; owned by hoandat, all rights reserved (not CC0).
      </p>
      <p>
        {text.chartArt}
        : AI-generated with OpenAI gpt-image for the hoandat ecosystem; owned by hoandat, all rights reserved (not CC0).{' '}
        {text.emblems}: AI-generated with open models (FLUX.2 klein 4B; Apache-2.0) for
        the hoandat ecosystem; owned by hoandat, all rights reserved (not CC0).{' '}
        {text.notMit}
      </p>
    </Page>
  );
}
