/**
 * The guide pages: what people search for ("làm video sinh nhật từ ảnh", "video dọc cho TikTok", "video chúc Tết
 * 2027"), answered with what the matching templates really do (their schema in @clip/templates: fields, photos,
 * length, backgrounds, formats, voice), each page ending on that template in /tao. Guests prepare the whole video
 * there; making it needs a free account.
 *
 * Vietnamese only, whatever the visitor's language: these pages answer Vietnamese searches, and crawlers that run the
 * script must read the same words as the HTML the build writes (vite-seo.ts renders GuideArticle with this data).
 */
import { MAX_DURATION_SECONDS, MAX_PHOTOS, templateById, type TemplateId } from '@clip/templates';
import { brand } from '../brand';
import { createPath } from './template-pages';

export const GUIDE_PATHS = {
  birthday: '/lam-video-sinh-nhat-tu-anh',
  vertical: '/lam-video-doc-tu-anh',
  tet: '/video-chuc-tet-2027',
} as const;

export type GuideId = keyof typeof GUIDE_PATHS;
export type GuidePath = (typeof GUIDE_PATHS)[GuideId];

export const GUIDE_IDS: readonly GuideId[] = ['birthday', 'vertical', 'tet'];

export interface GuideSection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly list?: readonly string[];
}

export interface GuideStep {
  readonly title: string;
  readonly body: string;
}

export interface GuideQuestion {
  readonly question: string;
  readonly answer: string;
}

export interface Guide {
  readonly id: GuideId;
  readonly path: GuidePath;
  /** The template the call to action opens on /tao. */
  readonly template: TemplateId;
  /** Templates shown as posters, each opening /tao on it; the first is `template`. */
  readonly picks: readonly TemplateId[];
  /** `<title>` and og:title, without the app's name (the page adds it). */
  readonly title: string;
  /** Meta description and og:description (at most about 160 characters). */
  readonly description: string;
  readonly heading: string;
  readonly eyebrow: string;
  readonly lede: string;
  readonly picksHeading: string;
  readonly sections: readonly GuideSection[];
  readonly steps: readonly GuideStep[];
  readonly faq: readonly GuideQuestion[];
  /** Words of the call to action, to `/tao?t=<template>`. */
  readonly cta: string;
  /** How the other guides and the intro page name this one. */
  readonly linkLabel: string;
  /** First published, for the JSON-LD (YYYY-MM-DD). */
  readonly datePublished: string;
}

const PUBLISHED = '2026-11-02';
/** Videos each account may make per day (the server's limit, see README "Giới hạn"). */
const DAILY_LIMIT = 5;
/** Days a video is kept before it is deleted with its photos and text. */
const KEEP_DAYS = 7;

function buildGuides(): Readonly<Record<GuideId, Guide>> {
  const app = brand.appName;
  const domain = brand.primaryTenant.domain;
  const birthday = templateById('chuc-mung');
  const quick = templateById('ke-nhanh');
  const tet = templateById('tet');
  const greetingLine = birthday.fields[0]?.maxLength ?? 60;
  const quickTitle = quick.fields.find((f) => f.id === 'title')?.maxLength ?? 50;
  const quickPoint = quick.fields.find((f) => f.id === 'point1')?.maxLength ?? 80;
  const voice = `Giọng đọc AI tiếng Việt nếu muốn: 11 giọng nam, nữ, Bắc, Nam; video dài theo lời đọc, tối đa ${MAX_DURATION_SECONDS} giây.`;
  const formats = 'Khổ dọc 9:16 (1080×1920) cho TikTok, Reels, Shorts; 4:5 hoặc vuông cho bài đăng Facebook, Instagram.';
  const signUp: GuideStep = {
    title: 'Đăng ký miễn phí và tạo video',
    body: `Bấm tạo video, đăng ký tài khoản ${domain} bằng Google, GitHub hoặc Apple. Quay lại vẫn còn mẫu, nền, khổ và chữ; ảnh thì thêm lại.`,
  };
  const download: GuideStep = {
    title: 'Tải MP4 về và gửi',
    body: 'Vài phút sau video có trong mục Video của tôi. Tải về rồi gửi Zalo, Messenger hay đăng mạng xã hội.',
  };
  const free: GuideQuestion = {
    question: 'Có mất phí không?',
    answer: `Không. Tài khoản và video đều miễn phí; mỗi tài khoản tạo được ${DAILY_LIMIT} video mỗi ngày.`,
  };
  const kept: GuideQuestion = {
    question: 'Video được giữ bao lâu?',
    answer: `${KEEP_DAYS} ngày, sau đó video bị xoá cùng ảnh và chữ. Hãy tải file MP4 về máy sau khi tạo.`,
  };
  return {
    birthday: {
      id: 'birthday',
      path: GUIDE_PATHS.birthday,
      template: birthday.id,
      picks: ['chuc-mung', 'day-thang', 'mung-tho'],
      title: 'Làm video sinh nhật từ ảnh miễn phí, có nhạc và lời chúc',
      description: `Làm video chúc mừng sinh nhật từ 1 đến ${MAX_PHOTOS} ảnh ngay trên điện thoại: gõ ba dòng chúc, đổi nền, thêm giọng đọc, xem trước liền rồi tải MP4. Miễn phí.`,
      heading: 'Làm video sinh nhật từ ảnh',
      eyebrow: 'Video sinh nhật',
      lede: `Muốn chúc mừng sinh nhật bằng một video thay cho dòng tin nhắn quen thuộc? Với ${app}, bạn chọn mẫu Sinh nhật, gõ ba dòng chúc, thêm ảnh của người được chúc và nhận về video MP4 có nhạc để gửi Zalo, Messenger hay đăng story.`,
      picksHeading: 'Mẫu hợp cho sinh nhật',
      sections: [
        {
          heading: 'Video sinh nhật có những gì',
          paragraphs: ['Mẫu Sinh nhật có sẵn hình vẽ và chuyển động, bạn chỉ thêm phần của mình:'],
          list: [
            'Nền vẽ bằng AI với bóng bay, hộp quà và bánh kem; sáu nền khác nhau để đổi bằng nút "Đổi nền".',
            `Ba dòng chữ, mỗi dòng tối đa ${greetingLine} ký tự: lời chúc, tên người nhận, một lời nhắn riêng.`,
            `Từ 1 đến ${MAX_PHOTOS} ảnh trong khung, JPEG, PNG hoặc WebP, mỗi ảnh tối đa 5 MB.`,
            `Video ${birthday.durationSeconds} giây với nhạc nền có sẵn của mẫu (nhạc giấy phép CC0).`,
            voice,
            formats,
          ],
        },
        {
          heading: 'Xem trước ngay, chưa cần tài khoản',
          paragraphs: [
            'Mọi bước ở trên đều làm được trước khi đăng ký: bản xem trước chạy ngay trong trình duyệt, bạn sửa chữ, đổi ảnh, đổi nền tới khi ưng. Ảnh chưa rời khỏi máy cho tới khi bạn bấm tạo video.',
            'Khi tạo video, máy chủ thu nhỏ ảnh, xoá thông tin vị trí chụp rồi mới dựng; ảnh bị xoá ngay khi video xong.',
          ],
        },
        {
          heading: 'Mẹo để video sinh nhật đẹp hơn',
          paragraphs: [],
          list: [
            'Dòng đầu ngắn và có tên, ví dụ "Chúc mừng sinh nhật Lan!".',
            'Chúc mừng em bé đầy tháng, thôi nôi hay ông bà mừng thọ thì dùng mẫu "Đầy tháng, thôi nôi" hoặc "Mừng thọ ông bà", cách làm y hệt.',
          ],
        },
      ],
      steps: [
        { title: 'Chọn mẫu, gõ chữ, thêm ảnh', body: 'Mở mẫu Sinh nhật, gõ ba dòng chúc, thêm ảnh, đổi nền và khổ video. Bước này chưa cần tài khoản.' },
        signUp,
        download,
      ],
      faq: [
        free,
        {
          question: 'Có cần cài app không?',
          answer: `Không. ${app} chạy trên trình duyệt của điện thoại hay máy tính; video tải về là file MP4.`,
        },
        {
          question: `Thêm được nhiều hơn ${MAX_PHOTOS} ảnh không?`,
          answer: `Chưa. Mỗi video dùng từ 1 đến ${MAX_PHOTOS} ảnh. Muốn nhiều ảnh hơn thì tạo thêm video với bộ ảnh khác.`,
        },
        kept,
      ],
      cta: 'Làm video sinh nhật',
      linkLabel: 'Làm video sinh nhật từ ảnh',
      datePublished: PUBLISHED,
    },
    vertical: {
      id: 'vertical',
      path: GUIDE_PATHS.vertical,
      template: quick.id,
      picks: ['ke-nhanh', 'chuyen-di', 'ban-hang', 'mon-an'],
      title: 'Làm video dọc từ ảnh cho TikTok, Reels, Shorts miễn phí',
      description: `Làm video dọc 9:16 từ ảnh và vài dòng chữ cho TikTok, Reels, Shorts: gõ tiêu đề và 3–5 ý, thêm tối đa ${MAX_PHOTOS} ảnh, xem trước rồi tải MP4. Miễn phí.`,
      heading: 'Làm video dọc từ ảnh cho TikTok, Reels',
      eyebrow: 'Video dọc 9:16',
      lede: `Có vài tấm ảnh và vài điều muốn kể nhưng ngại học app dựng phim? ${app} ghép chúng thành video dọc 1080×1920 có chữ chạy, chuyển cảnh và nhạc nền, đúng khổ TikTok, Instagram Reels, YouTube Shorts.`,
      picksHeading: 'Mẫu video dọc kiểu kể nhanh',
      sections: [
        {
          heading: 'Video dọc làm từ những gì',
          paragraphs: [],
          list: [
            `Một tiêu đề (tối đa ${quickTitle} ký tự) và 3 đến 5 ý (mỗi ý tối đa ${quickPoint} ký tự); mỗi ý hiện thành một khung riêng như video ngắn.`,
            `Tối đa ${MAX_PHOTOS} ảnh, không bắt buộc.`,
            'Nền vẽ bằng AI theo chủ đề, mỗi mẫu sáu nền để đổi.',
            `Video ${quick.durationSeconds} giây với nhạc nền có sẵn của mẫu (nhạc giấy phép CC0).`,
            voice,
            formats,
          ],
        },
        {
          heading: 'Chọn mẫu theo việc bạn cần',
          paragraphs: [
            'Kể nhanh hợp với mẹo, danh sách, "5 điều về…". Chuyến đi là bưu thiếp du lịch kèm ảnh. Giới thiệu sản phẩm và Món ngon dành cho người bán hàng, quán ăn cần video để đăng mà không phải quay.',
          ],
        },
        {
          heading: 'Đăng lên TikTok, Reels thế nào',
          paragraphs: [
            `${app} không đăng hộ và không cần quyền vào tài khoản mạng xã hội của bạn. Tải MP4 về máy rồi đăng trong app TikTok, Instagram hay YouTube như video quay bằng điện thoại, thêm hashtag hay nhạc thịnh hành ở đó nếu muốn.`,
            `${app} làm video từ chữ và ảnh: chưa ghép được đoạn phim quay sẵn và chưa cho chọn nhạc riêng.`,
          ],
        },
      ],
      steps: [
        { title: 'Chọn mẫu, gõ chữ, thêm ảnh', body: 'Mở mẫu Kể nhanh hoặc mẫu hợp việc của bạn, gõ tiêu đề và các ý, thêm ảnh. Bước này chưa cần tài khoản.' },
        signUp,
        download,
      ],
      faq: [
        {
          question: 'Video có đúng khổ TikTok không?',
          answer: 'Có. Khổ dọc 9:16 là 1080×1920, file MP4 (H.264). Bài đăng thường trên Facebook, Instagram thì chọn 4:5 hoặc vuông.',
        },
        {
          question: 'Một video dùng được bao nhiêu ảnh?',
          answer: `Tối đa ${MAX_PHOTOS} ảnh, mỗi ảnh tối đa 5 MB. Mẫu kiểu kể nhanh không bắt buộc có ảnh.`,
        },
        free,
        kept,
      ],
      cta: 'Làm video dọc ngay',
      linkLabel: 'Làm video dọc từ ảnh cho TikTok, Reels',
      datePublished: PUBLISHED,
    },
    tet: {
      id: 'tet',
      path: GUIDE_PATHS.tet,
      template: tet.id,
      picks: ['tet', 'mung-tho', 'khuyen-mai'],
      title: 'Video chúc Tết 2027 Đinh Mùi từ ảnh, miễn phí',
      description: 'Làm video chúc Tết Đinh Mùi 2027 từ ảnh gia đình: nền đỏ vàng hoa mai, hoa đào, ba dòng lời chúc, giọng đọc AI. Xem trước miễn phí, tải MP4 gửi Zalo.',
      heading: 'Video chúc Tết 2027',
      eyebrow: 'Xuân Đinh Mùi 2027',
      lede: 'Mùng 1 Tết Đinh Mùi là thứ Bảy, 6/2/2027. Thay vì gửi tấm hình chúc Tết giống hệt mọi người, gửi một video ngắn có ảnh của nhà mình và lời chúc của chính bạn, làm trong vài phút trên điện thoại.',
      picksHeading: 'Mẫu cho dịp Tết',
      sections: [
        {
          heading: 'Video chúc Tết có gì',
          paragraphs: ['Mẫu Năm mới, Tết làm sẵn hình vẽ và chuyển động:'],
          list: [
            'Nền vẽ bằng AI màu đỏ vàng với hoa mai, hoa đào và lồng đèn; sáu nền để đổi.',
            `Ba dòng lời chúc, mỗi dòng tối đa ${greetingLine} ký tự.`,
            `Từ 1 đến ${MAX_PHOTOS} ảnh: ảnh cả nhà, ảnh của bạn hay của cả đội.`,
            `Video ${tet.durationSeconds} giây với nhạc nền có sẵn của mẫu (nhạc giấy phép CC0).`,
            voice,
            formats,
          ],
        },
        {
          heading: 'Lời chúc Tết gợi ý',
          paragraphs: ['Mỗi dòng dưới đây vừa một dòng của video, chọn ba dòng rồi sửa theo ý bạn:'],
          list: [
            'Chúc mừng năm mới Đinh Mùi 2027!',
            'An khang thịnh vượng, vạn sự như ý',
            'Sức khoẻ dồi dào, tiền vào như nước',
            'Năm mới bình an, cả nhà sum vầy',
            'Kính chúc ông bà sống lâu trăm tuổi',
          ],
        },
        {
          heading: 'Làm sớm thì nhớ tải về',
          paragraphs: [
            `Video được giữ ${KEEP_DAYS} ngày rồi tự xoá. Làm từ bây giờ thì tải MP4 về máy ngay để tới Tết gửi; hoặc làm trong tuần trước Tết.`,
            `Một video gửi cho bao nhiêu người cũng được. Muốn mỗi người một lời chúc riêng thì tạo thêm video, mỗi ngày ${DAILY_LIMIT} video. Chúc thọ ông bà dịp Tết có mẫu Mừng thọ ông bà; cửa hàng báo ưu đãi đầu năm có mẫu Khuyến mãi.`,
          ],
        },
      ],
      steps: [
        { title: 'Chọn mẫu, gõ lời chúc, thêm ảnh', body: 'Mở mẫu Năm mới, Tết, gõ ba dòng chúc, thêm ảnh, đổi nền và khổ video. Bước này chưa cần tài khoản.' },
        signUp,
        download,
      ],
      faq: [
        { question: 'Tết 2027 là ngày nào?', answer: 'Mùng 1 Tết Đinh Mùi là thứ Bảy, ngày 6/2/2027 dương lịch; giao thừa là đêm thứ Sáu 5/2/2027.' },
        free,
        {
          question: 'Gửi video chúc Tết qua Zalo được không?',
          answer: 'Được. Tải file MP4 về máy rồi gửi qua Zalo, Messenger như một video bình thường, hoặc đăng lên Facebook, TikTok.',
        },
        kept,
      ],
      cta: 'Làm video chúc Tết',
      linkLabel: 'Video chúc Tết 2027',
      datePublished: PUBLISHED,
    },
  };
}

export const GUIDES: Readonly<Record<GuideId, Guide>> = buildGuides();

/** The guide at `path` (a trailing slash allowed), or null. */
export function guideAt(path: string): Guide | null {
  const normalised = path.length > 1 ? path.replace(/\/+$/, '') : path;
  const id = GUIDE_IDS.find((g) => GUIDE_PATHS[g] === normalised);
  return id ? GUIDES[id] : null;
}

/** Where the guide's call to action leads: the create page on its template. */
export function guideStartPath(guide: Guide): string {
  return createPath(templateById(guide.template));
}
