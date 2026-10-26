/**
 * The video templates: what each one asks for (text fields, photos), how long it lasts, and the validation of a
 * user's input against it. Browser-safe: the web app builds its form and preview from this, the server validates
 * with it, the worker turns a job into composition variables with it. A template is a layout (the composition, under
 * project/layouts/) dressed in a theme (AI-drawn art and colours, under project/themes/); see project.ts.
 */

export type Locale = 'vi' | 'en';
export type Localized = Readonly<Record<Locale, string>>;

/** One allowed value of a choice field: an id the composition maps to a bundled asset, and its name. */
export interface Choice {
  readonly id: string;
  readonly label: Localized;
}

export interface TextField {
  /** Composition variable id. */
  readonly id: string;
  readonly label: Localized;
  readonly placeholder: Localized;
  readonly maxLength: number;
  readonly required: boolean;
  /**
   * A choice field holds one of these ids (or "" when optional) instead of free text: the composition turns it into
   * the path of one of the theme's own pictures, so only whitelisted ids may ever reach it.
   */
  readonly choices?: readonly Choice[];
}

/**
 * A layout is one composition (`project/layouts/<id>.html` + `project/scripts/<id>.js`): its timing, its text
 * fields and photo slots. Every template is a layout dressed in a theme; the variable contract belongs to the layout.
 */
export const LAYOUT_IDS = ['greeting', 'quick', 'quote', 'chart'] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

interface FieldShape {
  readonly id: string;
  readonly label: Localized;
  readonly maxLength: number;
  readonly required: boolean;
  readonly choices?: readonly Choice[];
}

export interface LayoutSpec {
  readonly id: LayoutId;
  /** Length of the rendered video, in seconds (the composition root's data-duration). */
  readonly durationSeconds: number;
  readonly photos: { readonly min: number; readonly max: number };
  readonly fields: readonly FieldShape[];
}

const line = (n: number): FieldShape => ({ id: `line${n}`, label: { vi: `Dòng ${n}`, en: `Line ${n}` }, maxLength: 60, required: true });
const point = (n: number, required: boolean): FieldShape => ({ id: `point${n}`, label: { vi: `Ý ${n}`, en: `Point ${n}` }, maxLength: 80, required });

/** A choice field: its length limit is that of its longest id. */
function choice(id: string, label: Localized, required: boolean, choices: readonly Choice[]): FieldShape {
  return { id, label, maxLength: Math.max(...choices.map((c) => c.id.length)), required, choices };
}

/** The 12 con giáp (Vietnamese zodiac: Mão is the cat, Sửu the buffalo); ids as in themes/la-so/animal-<id>.webp. */
export const ZODIAC_CHOICES: readonly Choice[] = [
  { id: 'ty', label: { vi: 'Tý (Chuột)', en: 'Tý (Rat)' } },
  { id: 'suu', label: { vi: 'Sửu (Trâu)', en: 'Sửu (Buffalo)' } },
  { id: 'dan', label: { vi: 'Dần (Hổ)', en: 'Dần (Tiger)' } },
  { id: 'mao', label: { vi: 'Mão (Mèo)', en: 'Mão (Cat)' } },
  { id: 'thin', label: { vi: 'Thìn (Rồng)', en: 'Thìn (Dragon)' } },
  { id: 'ti', label: { vi: 'Tỵ (Rắn)', en: 'Tỵ (Snake)' } },
  { id: 'ngo', label: { vi: 'Ngọ (Ngựa)', en: 'Ngọ (Horse)' } },
  { id: 'mui', label: { vi: 'Mùi (Dê)', en: 'Mùi (Goat)' } },
  { id: 'than', label: { vi: 'Thân (Khỉ)', en: 'Thân (Monkey)' } },
  { id: 'dau', label: { vi: 'Dậu (Gà)', en: 'Dậu (Rooster)' } },
  { id: 'tuat', label: { vi: 'Tuất (Chó)', en: 'Tuất (Dog)' } },
  { id: 'hoi', label: { vi: 'Hợi (Lợn)', en: 'Hợi (Pig)' } },
];

const same = (name: string): Localized => ({ vi: name, en: name });

/** The 14 chính tinh (major stars); ids as in themes/la-so/star-<id>.webp. */
export const STAR_CHOICES: readonly Choice[] = [
  { id: 'tu-vi', label: same('Tử Vi') },
  { id: 'thien-co', label: same('Thiên Cơ') },
  { id: 'thai-duong', label: same('Thái Dương') },
  { id: 'vu-khuc', label: same('Vũ Khúc') },
  { id: 'thien-dong', label: same('Thiên Đồng') },
  { id: 'liem-trinh', label: same('Liêm Trinh') },
  { id: 'thien-phu', label: same('Thiên Phủ') },
  { id: 'thai-am', label: same('Thái Âm') },
  { id: 'tham-lang', label: same('Tham Lang') },
  { id: 'cu-mon', label: same('Cự Môn') },
  { id: 'thien-tuong', label: same('Thiên Tướng') },
  { id: 'thien-luong', label: same('Thiên Lương') },
  { id: 'that-sat', label: same('Thất Sát') },
  { id: 'pha-quan', label: same('Phá Quân') },
];

/** The five cục (element classes); ids as in themes/la-so/cuc-<id>.webp. */
export const CUC_CHOICES: readonly Choice[] = [
  { id: 'thuy-nhi', label: same('Thủy Nhị Cục') },
  { id: 'moc-tam', label: same('Mộc Tam Cục') },
  { id: 'kim-tu', label: same('Kim Tứ Cục') },
  { id: 'tho-ngu', label: same('Thổ Ngũ Cục') },
  { id: 'hoa-luc', label: same('Hỏa Lục Cục') },
];

export const LAYOUTS: Readonly<Record<LayoutId, LayoutSpec>> = {
  greeting: { id: 'greeting', durationSeconds: 12, photos: { min: 1, max: 3 }, fields: [line(1), line(2), line(3)] },
  quick: {
    id: 'quick',
    durationSeconds: 18,
    photos: { min: 0, max: 3 },
    fields: [
      { id: 'title', label: { vi: 'Tiêu đề', en: 'Title' }, maxLength: 50, required: true },
      point(1, true),
      point(2, true),
      point(3, true),
      point(4, false),
      point(5, false),
    ],
  },
  quote: {
    id: 'quote',
    durationSeconds: 10,
    photos: { min: 0, max: 0 },
    fields: [
      { id: 'quote', label: { vi: 'Câu trích dẫn', en: 'Quote' }, maxLength: 160, required: true },
      { id: 'author', label: { vi: 'Tác giả', en: 'Author' }, maxLength: 40, required: false },
    ],
  },
  // A birth chart (lá số tử vi) as a card: the zodiac animal, the major star of the Mệnh palace and the cục emblem
  // are pictures chosen by id; the words around them are typed (or filled in by the Tử Vi app's link).
  chart: {
    id: 'chart',
    durationSeconds: 18,
    photos: { min: 0, max: 0 },
    fields: [
      { id: 'name', label: { vi: 'Tên', en: 'Name' }, maxLength: 40, required: false },
      line(1),
      line(2),
      { id: 'reading', label: { vi: 'Lời luận giải', en: 'Reading' }, maxLength: 160, required: true },
      choice('animal', { vi: 'Con giáp', en: 'Zodiac animal' }, true, ZODIAC_CHOICES),
      choice('star', { vi: 'Chính tinh ở Mệnh', en: 'Major star in Mệnh' }, false, STAR_CHOICES),
      choice('cuc', { vi: 'Cục', en: 'Cục (element class)' }, true, CUC_CHOICES),
    ],
  },
};

/** Occasions the template picker filters by. */
export const OCCASIONS = ['celebrate', 'holiday', 'love', 'family', 'share', 'business'] as const;
export type Occasion = (typeof OCCASIONS)[number];
export const OCCASION_NAMES: Readonly<Record<Occasion, Localized>> = {
  celebrate: { vi: 'Chúc mừng', en: 'Celebrate' },
  holiday: { vi: 'Lễ, Tết', en: 'Holidays' },
  love: { vi: 'Yêu thương', en: 'Love' },
  family: { vi: 'Gia đình', en: 'Family' },
  share: { vi: 'Chia sẻ', en: 'Share' },
  business: { vi: 'Kinh doanh', en: 'Business' },
};

/** Music tracks under project/assets/music (CC0, assets/CREDITS.md). */
export type MusicTrack = 'fetch-dance' | 'bicycle' | 'chillin-poupi' | 'good-fellow';

/**
 * Template ids are stored on jobs: never rename one. The first three predate themes (they were the three original
 * templates) and keep their ids.
 */
export const TEMPLATE_IDS = [
  'chuc-mung',
  'thay-co',
  'tet',
  'giang-sinh',
  'tinh-yeu',
  'dam-cuoi',
  'tot-nghiep',
  'khai-truong',
  'ke-nhanh',
  'chuyen-di',
  'trich-dan',
  'cam-on',
  'phu-nu-8-3',
  'phu-nu-20-10',
  'thieu-nhi',
  'trung-thu',
  'valentine',
  'vu-lan',
  'ngay-cua-me',
  'halloween',
  'quoc-khanh',
  'tan-gia',
  'day-thang',
  'mung-tho',
  'thang-chuc',
  'ky-niem-cuoi',
  'thu-cung',
  'khuyen-mai',
  'mon-an',
  'ban-hang',
  'tuyen-dung',
  'su-kien',
  'cam-trai',
  'chao-buoi-sang',
  'chuc-ngu-ngon',
  'dong-vien',
  'xin-loi',
  'la-so',
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface TemplateSpec {
  readonly id: TemplateId;
  readonly layout: LayoutId;
  /** Art pack under project/themes/<theme>/ (AI-drawn background, stickers, frame) and its colours (theme.css). */
  readonly theme: string;
  readonly music: MusicTrack;
  readonly occasions: readonly Occasion[];
  readonly name: Localized;
  readonly description: Localized;
  readonly durationSeconds: number;
  readonly photos: { readonly min: number; readonly max: number };
  readonly fields: readonly TextField[];
}

interface ThemeEntry {
  readonly id: TemplateId;
  readonly layout: LayoutId;
  readonly theme: string;
  readonly music: MusicTrack;
  readonly occasions: readonly Occasion[];
  readonly name: Localized;
  readonly description: Localized;
  /** Sample text per field id, shown as placeholder and in the preview until the person types. */
  readonly samples: Readonly<Record<string, Localized>>;
}

const ENTRIES: readonly ThemeEntry[] = [
  {
    id: 'chuc-mung',
    layout: 'greeting',
    theme: 'sinh-nhat',
    music: 'fetch-dance',
    occasions: ['celebrate'],
    name: { vi: 'Sinh nhật', en: 'Birthday' },
    description: { vi: 'Bóng bay, quà và bánh kem: ba dòng chúc, một đến ba ảnh.', en: 'Balloons, gifts and cake: three lines of wishes, one to three photos.' },
    samples: {
      line1: { vi: 'Chúc mừng sinh nhật!', en: 'Happy birthday!' },
      line2: { vi: 'Tuổi mới thật nhiều niềm vui', en: 'Wishing you a year of joy' },
      line3: { vi: 'Yêu thương thật nhiều!', en: 'With lots of love!' },
    },
  },
  {
    id: 'thay-co',
    layout: 'greeting',
    theme: 'thay-co',
    music: 'good-fellow',
    occasions: ['holiday'],
    name: { vi: 'Tri ân thầy cô 20/11', en: "Teachers' Day" },
    description: { vi: 'Hoa, sách và áo dài cho Ngày Nhà giáo Việt Nam.', en: "Flowers, books and ao dai for Vietnam's Teachers' Day." },
    samples: {
      line1: { vi: 'Kính chúc thầy cô', en: 'Dear teacher' },
      line2: { vi: 'Luôn mạnh khoẻ và hạnh phúc', en: 'Wishing you health and happiness' },
      line3: { vi: 'Con cảm ơn thầy cô!', en: 'Thank you for everything!' },
    },
  },
  {
    id: 'tet',
    layout: 'greeting',
    theme: 'tet',
    music: 'fetch-dance',
    occasions: ['holiday'],
    name: { vi: 'Năm mới, Tết', en: 'Lunar New Year' },
    description: { vi: 'Đỏ vàng, hoa mai, hoa đào và lồng đèn.', en: 'Red and gold, apricot and peach blossoms, lanterns.' },
    samples: {
      line1: { vi: 'Chúc mừng năm mới!', en: 'Happy New Year!' },
      line2: { vi: 'An khang thịnh vượng', en: 'Peace and prosperity' },
      line3: { vi: 'Vạn sự như ý!', en: 'May all your wishes come true!' },
    },
  },
  {
    id: 'giang-sinh',
    layout: 'greeting',
    theme: 'giang-sinh',
    music: 'bicycle',
    occasions: ['holiday'],
    name: { vi: 'Giáng sinh', en: 'Christmas' },
    description: { vi: 'Thông xanh, tuyết và quà Noel.', en: 'Pine trees, snow and Christmas presents.' },
    samples: {
      line1: { vi: 'Giáng sinh an lành!', en: 'Merry Christmas!' },
      line2: { vi: 'Ấm áp bên gia đình', en: 'Warm days with family' },
      line3: { vi: 'Năm mới thật rực rỡ!', en: 'And a bright New Year!' },
    },
  },
  {
    id: 'tinh-yeu',
    layout: 'greeting',
    theme: 'tinh-yeu',
    music: 'chillin-poupi',
    occasions: ['love'],
    name: { vi: 'Tình yêu, kỷ niệm', en: 'Love & anniversary' },
    description: { vi: 'Hoa hồng và trái tim cho người thương.', en: 'Roses and hearts for someone you love.' },
    samples: {
      line1: { vi: 'Gửi người thương', en: 'To my love' },
      line2: { vi: 'Cảm ơn vì đã luôn bên anh', en: 'Thank you for always being there' },
      line3: { vi: 'Yêu em mỗi ngày!', en: 'I love you every day!' },
    },
  },
  {
    id: 'dam-cuoi',
    layout: 'greeting',
    theme: 'dam-cuoi',
    music: 'good-fellow',
    occasions: ['love', 'celebrate'],
    name: { vi: 'Đám cưới', en: 'Wedding' },
    description: { vi: 'Hoa trắng, nhẫn cưới và sắc vàng champagne.', en: 'White flowers, rings and champagne gold.' },
    samples: {
      line1: { vi: 'Chúc mừng hạnh phúc!', en: 'Congratulations!' },
      line2: { vi: 'Trăm năm tình viên mãn', en: 'A lifetime of love' },
      line3: { vi: 'Bạc đầu nghĩa phu thê!', en: 'Together forever!' },
    },
  },
  {
    id: 'tot-nghiep',
    layout: 'greeting',
    theme: 'tot-nghiep',
    music: 'fetch-dance',
    occasions: ['celebrate'],
    name: { vi: 'Tốt nghiệp', en: 'Graduation' },
    description: { vi: 'Mũ cử nhân, bằng và vòng nguyệt quế.', en: 'Caps, diplomas and laurel wreaths.' },
    samples: {
      line1: { vi: 'Chúc mừng tốt nghiệp!', en: 'Congratulations, graduate!' },
      line2: { vi: 'Bao năm cố gắng đã thành quả', en: 'All that hard work paid off' },
      line3: { vi: 'Bay thật cao nhé!', en: 'Now fly high!' },
    },
  },
  {
    id: 'khai-truong',
    layout: 'greeting',
    theme: 'khai-truong',
    music: 'bicycle',
    occasions: ['celebrate'],
    name: { vi: 'Khai trương, thành công', en: 'Grand opening' },
    description: { vi: 'Lẵng hoa, nơ đỏ và kim tuyến vàng.', en: 'Flower stands, red ribbons and gold confetti.' },
    samples: {
      line1: { vi: 'Chúc mừng khai trương!', en: 'Happy grand opening!' },
      line2: { vi: 'Hồng phát, đắt hàng', en: 'Wishing you great business' },
      line3: { vi: 'Thành công rực rỡ!', en: 'Every success!' },
    },
  },
  {
    id: 'ke-nhanh',
    layout: 'quick',
    theme: 'ke-nhanh',
    music: 'bicycle',
    occasions: ['share'],
    name: { vi: 'Kể nhanh', en: 'Quick list' },
    description: { vi: 'Tiêu đề và 3–5 ý, mỗi ý một khung, kiểu video ngắn. Ảnh không bắt buộc.', en: 'A title and 3–5 points, one frame each, short-video style. Photos optional.' },
    samples: {
      title: { vi: '3 mẹo ngủ ngon', en: '3 tips for better sleep' },
      point1: { vi: 'Tắt màn hình trước khi ngủ 30 phút', en: 'Screens off 30 minutes before bed' },
      point2: { vi: 'Giữ phòng mát và tối', en: 'Keep the room cool and dark' },
      point3: { vi: 'Đi ngủ cùng một giờ mỗi tối', en: 'Go to bed at the same time' },
      point4: { vi: 'Ý thứ tư (không bắt buộc)', en: 'A fourth point (optional)' },
      point5: { vi: 'Ý thứ năm (không bắt buộc)', en: 'A fifth point (optional)' },
    },
  },
  {
    id: 'chuyen-di',
    layout: 'quick',
    theme: 'chuyen-di',
    music: 'good-fellow',
    occasions: ['share'],
    name: { vi: 'Chuyến đi', en: 'Trip postcard' },
    description: { vi: 'Kiểu bưu thiếp: tên chuyến đi, 3–5 điều đáng nhớ và ảnh.', en: 'Postcard style: the trip, 3–5 highlights and photos.' },
    samples: {
      title: { vi: 'Hạ Long 3 ngày 2 đêm', en: 'Three days in Ha Long Bay' },
      point1: { vi: 'Ngủ đêm trên du thuyền giữa vịnh', en: 'A night on a boat in the bay' },
      point2: { vi: 'Chèo kayak qua hang Luồn', en: 'Kayaking through Luon cave' },
      point3: { vi: 'Hải sản tươi ở chợ đêm', en: 'Fresh seafood at the night market' },
      point4: { vi: 'Ý thứ tư (không bắt buộc)', en: 'A fourth point (optional)' },
      point5: { vi: 'Ý thứ năm (không bắt buộc)', en: 'A fifth point (optional)' },
    },
  },
  {
    id: 'trich-dan',
    layout: 'quote',
    theme: 'trich-dan',
    music: 'chillin-poupi',
    occasions: ['share'],
    name: { vi: 'Trích dẫn', en: 'Quote' },
    description: { vi: 'Một câu nói lớn trên bầu trời đêm, kèm tên tác giả.', en: 'One big quote on a twilight sky, with its author.' },
    samples: {
      quote: { vi: 'Hãy sống như thể ngày mai bạn sẽ chết, hãy học như thể bạn sẽ sống mãi.', en: 'Live as if you were to die tomorrow. Learn as if you were to live forever.' },
      author: { vi: 'Mahatma Gandhi', en: 'Mahatma Gandhi' },
    },
  },
  {
    id: 'cam-on',
    layout: 'quote',
    theme: 'cam-on',
    music: 'chillin-poupi',
    occasions: ['share', 'love'],
    name: { vi: 'Cảm ơn', en: 'Thank you' },
    description: { vi: 'Lời cảm ơn trên nền hoa màu nước.', en: 'A thank-you note on watercolour flowers.' },
    samples: {
      quote: { vi: 'Cảm ơn bạn vì đã luôn ở bên, những lúc vui cũng như lúc khó khăn.', en: 'Thank you for always being there, in good times and hard ones.' },
      author: { vi: 'Tên của bạn', en: 'Your name' },
    },
  },
  {
    id: 'phu-nu-8-3',
    layout: 'greeting',
    theme: 'phu-nu-8-3',
    music: 'chillin-poupi',
    occasions: ['holiday', 'love'],
    name: { vi: 'Quốc tế Phụ nữ 8/3', en: "Women's Day" },
    description: { vi: 'Tulip hồng, hoa hồng và sắc tím nhạt cho ngày 8/3.', en: 'Pink tulips, roses and soft lilac for March 8th.' },
    samples: {
      line1: { vi: 'Chúc mừng ngày 8/3!', en: "Happy Women's Day!" },
      line2: { vi: 'Luôn xinh đẹp và rạng rỡ', en: 'Stay beautiful and radiant' },
      line3: { vi: 'Mãi là bông hoa đẹp nhất!', en: 'You are the loveliest flower!' },
    },
  },
  {
    id: 'phu-nu-20-10',
    layout: 'greeting',
    theme: 'phu-nu-20-10',
    music: 'good-fellow',
    occasions: ['holiday', 'love'],
    name: { vi: 'Phụ nữ Việt Nam 20/10', en: "Vietnamese Women's Day" },
    description: { vi: 'Hoa hồng, sen hồng và nón lá trên nền hồng đào.', en: 'Roses, pink lotus and a conical hat on peach.' },
    samples: {
      line1: { vi: 'Chúc mừng ngày 20/10!', en: "Happy Vietnamese Women's Day!" },
      line2: { vi: 'Cảm ơn những yêu thương dịu dàng', en: 'Thank you for all your tender love' },
      line3: { vi: 'Luôn vui tươi và hạnh phúc!', en: 'Always be happy!' },
    },
  },
  {
    id: 'thieu-nhi',
    layout: 'greeting',
    theme: 'thieu-nhi',
    music: 'fetch-dance',
    occasions: ['holiday', 'family'],
    name: { vi: 'Quốc tế Thiếu nhi 1/6', en: "Children's Day" },
    description: { vi: 'Bóng bay, diều giấy, cầu vồng và gấu bông.', en: 'Balloons, kites, a rainbow and a teddy bear.' },
    samples: {
      line1: { vi: 'Chúc mừng ngày 1/6!', en: "Happy Children's Day!" },
      line2: { vi: 'Con luôn vui khoẻ, hồn nhiên', en: 'Stay healthy, happy and curious' },
      line3: { vi: 'Bố mẹ yêu con nhiều lắm!', en: 'We love you so much!' },
    },
  },
  {
    id: 'trung-thu',
    layout: 'greeting',
    theme: 'trung-thu',
    music: 'bicycle',
    occasions: ['holiday', 'family'],
    name: { vi: 'Trung thu', en: 'Mid-Autumn Festival' },
    description: { vi: 'Trăng rằm, đèn ông sao, bánh trung thu và chú thỏ ngọc.', en: 'Full moon, star lanterns, mooncakes and the jade rabbit.' },
    samples: {
      line1: { vi: 'Trung thu vui vẻ!', en: 'Happy Mid-Autumn Festival!' },
      line2: { vi: 'Trăng tròn, nhà mình sum vầy', en: 'A full moon and the family together' },
      line3: { vi: 'Rước đèn thật vui nhé!', en: 'Enjoy the lantern parade!' },
    },
  },
  {
    id: 'valentine',
    layout: 'greeting',
    theme: 'valentine',
    music: 'chillin-poupi',
    occasions: ['holiday', 'love'],
    name: { vi: 'Valentine 14/2', en: "Valentine's Day" },
    description: { vi: 'Tim đỏ, sô-cô-la và hoa hồng cho ngày Lễ Tình nhân.', en: "Red hearts, chocolates and roses for Valentine's Day." },
    samples: {
      line1: { vi: 'Valentine vui vẻ!', en: "Happy Valentine's Day!" },
      line2: { vi: 'Có em là đủ ngọt ngào', en: 'You make every day sweet' },
      line3: { vi: 'Mãi bên nhau nhé!', en: 'Forever yours!' },
    },
  },
  {
    id: 'vu-lan',
    layout: 'greeting',
    theme: 'vu-lan',
    music: 'good-fellow',
    occasions: ['holiday', 'family'],
    name: { vi: 'Vu Lan báo hiếu', en: 'Vu Lan, gratitude to parents' },
    description: { vi: 'Sen hồng, đèn hoa đăng và đoá hồng cài áo.', en: 'Pink lotus, floating lanterns and a rose to wear.' },
    samples: {
      line1: { vi: 'Mùa Vu Lan báo hiếu', en: 'Vu Lan, the season of gratitude' },
      line2: { vi: 'Con biết ơn cha mẹ thật nhiều', en: 'I am so grateful to you, Mum and Dad' },
      line3: { vi: 'Mong cha mẹ luôn mạnh khoẻ!', en: 'May you always be well!' },
    },
  },
  {
    id: 'ngay-cua-me',
    layout: 'greeting',
    theme: 'ngay-cua-me',
    music: 'good-fellow',
    occasions: ['family', 'love'],
    name: { vi: 'Ngày của Mẹ', en: "Mother's Day" },
    description: { vi: 'Cẩm chướng hồng, tách trà và lá thư gửi mẹ.', en: 'Pink carnations, a cup of tea and a letter for Mum.' },
    samples: {
      line1: { vi: 'Gửi mẹ yêu', en: 'Dear Mum' },
      line2: { vi: 'Cảm ơn mẹ vì tất cả', en: 'Thank you for everything' },
      line3: { vi: 'Con yêu mẹ nhiều lắm!', en: 'I love you so much!' },
    },
  },
  {
    id: 'halloween',
    layout: 'greeting',
    theme: 'halloween',
    music: 'fetch-dance',
    occasions: ['holiday'],
    name: { vi: 'Halloween', en: 'Halloween' },
    description: { vi: 'Bí ngô, ma nhỏ dễ thương và kẹo, vui chứ không đáng sợ.', en: 'Pumpkins, a friendly ghost and candy: fun, not scary.' },
    samples: {
      line1: { vi: 'Halloween vui vẻ!', en: 'Happy Halloween!' },
      line2: { vi: 'Không cho kẹo là bị ghẹo', en: 'Trick or treat!' },
      line3: { vi: 'Đêm nay quẩy hết mình nhé!', en: 'Have a spooky-fun night!' },
    },
  },
  {
    id: 'quoc-khanh',
    layout: 'greeting',
    theme: 'quoc-khanh',
    music: 'bicycle',
    occasions: ['holiday'],
    name: { vi: 'Quốc khánh 2/9', en: 'National Day' },
    description: { vi: 'Cờ đỏ sao vàng, pháo hoa và hoa sen.', en: 'The red flag with a gold star, fireworks and lotus.' },
    samples: {
      line1: { vi: 'Mừng Quốc khánh 2/9!', en: 'Happy National Day!' },
      line2: { vi: 'Tự hào Việt Nam', en: 'Proud of Vietnam' },
      line3: { vi: 'Kỳ nghỉ lễ thật vui nhé!', en: 'Enjoy the holiday!' },
    },
  },
  {
    id: 'tan-gia',
    layout: 'greeting',
    theme: 'tan-gia',
    music: 'bicycle',
    occasions: ['celebrate', 'family'],
    name: { vi: 'Tân gia', en: 'Housewarming' },
    description: { vi: 'Chìa khoá nhà mới, cây xanh và ánh đèn ấm.', en: 'New house keys, green plants and warm lights.' },
    samples: {
      line1: { vi: 'Mừng tân gia!', en: 'Happy housewarming!' },
      line2: { vi: 'Nhà mới, niềm vui mới', en: 'A new home, new joy' },
      line3: { vi: 'An cư lạc nghiệp nhé!', en: 'May it bring you peace and luck!' },
    },
  },
  {
    id: 'day-thang',
    layout: 'greeting',
    theme: 'day-thang',
    music: 'chillin-poupi',
    occasions: ['celebrate', 'family'],
    name: { vi: 'Đầy tháng, thôi nôi', en: 'Baby milestones' },
    description: { vi: 'Mây, sao và đồ chơi màu pastel cho em bé.', en: 'Pastel clouds, stars and toys for the baby.' },
    samples: {
      line1: { vi: 'Mừng bé tròn một tuổi!', en: 'Happy first birthday, baby!' },
      line2: { vi: 'Bé ăn ngoan, chóng lớn', en: 'Eat well and grow strong' },
      line3: { vi: 'Cả nhà thương bé lắm!', en: 'The whole family loves you!' },
    },
  },
  {
    id: 'mung-tho',
    layout: 'greeting',
    theme: 'mung-tho',
    music: 'good-fellow',
    occasions: ['celebrate', 'family'],
    name: { vi: 'Mừng thọ ông bà', en: "Grandparents' longevity" },
    description: { vi: 'Đào tiên, hạc và cành tùng trên nền đỏ vàng.', en: 'Longevity peaches, cranes and pine on red and gold.' },
    samples: {
      line1: { vi: 'Mừng thọ ông bà', en: 'Happy birthday, Grandma and Grandpa' },
      line2: { vi: 'Phúc như Đông Hải', en: 'Blessings as vast as the sea' },
      line3: { vi: 'Thọ tỷ Nam Sơn!', en: 'And a long, long life!' },
    },
  },
  {
    id: 'thang-chuc',
    layout: 'greeting',
    theme: 'thang-chuc',
    music: 'fetch-dance',
    occasions: ['celebrate'],
    name: { vi: 'Thăng chức, thành công', en: 'Promotion & success' },
    description: { vi: 'Cúp vàng, tên lửa và nguyệt quế trên nền xanh ngọc.', en: 'A gold trophy, a rocket and laurels on emerald.' },
    samples: {
      line1: { vi: 'Chúc mừng thăng chức!', en: 'Congratulations on your promotion!' },
      line2: { vi: 'Xứng đáng với bao nỗ lực', en: 'You earned every bit of it' },
      line3: { vi: 'Ngày càng thành công nhé!', en: 'Onwards and upwards!' },
    },
  },
  {
    id: 'ky-niem-cuoi',
    layout: 'greeting',
    theme: 'ky-niem-cuoi',
    music: 'chillin-poupi',
    occasions: ['love'],
    name: { vi: 'Kỷ niệm ngày cưới', en: 'Wedding anniversary' },
    description: { vi: 'Hồng đỏ thẫm, nhẫn cưới và ly champagne.', en: 'Deep red roses, rings and champagne.' },
    samples: {
      line1: { vi: 'Kỷ niệm ngày cưới', en: 'Happy anniversary' },
      line2: { vi: 'Cảm ơn em đã cùng anh đi qua', en: 'Thank you for every year together' },
      line3: { vi: 'Mãi nắm tay nhau nhé!', en: 'Hand in hand, always!' },
    },
  },
  {
    id: 'thu-cung',
    layout: 'greeting',
    theme: 'thu-cung',
    music: 'fetch-dance',
    occasions: ['share'],
    name: { vi: 'Thú cưng', en: 'Pets' },
    description: { vi: 'Cún, mèo, dấu chân và xương: khoe boss nhà bạn.', en: 'Puppies, kittens, paw prints: show off your pet.' },
    samples: {
      line1: { vi: 'Boss nhà mình đây!', en: 'Meet the boss!' },
      line2: { vi: 'Ăn ngoan, ngủ kỹ, đáng yêu', en: 'Eats well, sleeps well, so cute' },
      line3: { vi: 'Thả tim cho boss nhé!', en: 'Send some love!' },
    },
  },
  {
    id: 'khuyen-mai',
    layout: 'quick',
    theme: 'khuyen-mai',
    music: 'fetch-dance',
    occasions: ['business'],
    name: { vi: 'Khuyến mãi, Black Friday', en: 'Sale & Black Friday' },
    description: { vi: 'Đen và vàng, túi mua sắm, loa: tiêu đề và 3–5 ưu đãi.', en: 'Black and gold, shopping bags: a title and 3–5 deals.' },
    samples: {
      title: { vi: 'Black Friday giảm đến 50%', en: 'Black Friday: up to 50% off' },
      point1: { vi: 'Giảm 50% toàn bộ áo khoác', en: '50% off all jackets' },
      point2: { vi: 'Mua 2 tặng 1 phụ kiện', en: 'Buy 2, get 1 accessory free' },
      point3: { vi: 'Miễn phí giao hàng đơn từ 300k', en: 'Free delivery over 300k' },
      point4: { vi: 'Ý thứ tư (không bắt buộc)', en: 'A fourth point (optional)' },
      point5: { vi: 'Ý thứ năm (không bắt buộc)', en: 'A fifth point (optional)' },
    },
  },
  {
    id: 'mon-an',
    layout: 'quick',
    theme: 'mon-an',
    music: 'bicycle',
    occasions: ['business', 'share'],
    name: { vi: 'Món ngon, giới thiệu quán', en: 'Food & restaurant' },
    description: { vi: 'Phở, bánh mì, cà phê sữa đá trên bàn gỗ.', en: 'Pho, banh mi and iced coffee on a wooden table.' },
    samples: {
      title: { vi: 'Phở bò gia truyền Cô Ba', en: "Co Ba's family beef pho" },
      point1: { vi: 'Nước dùng ninh xương 12 tiếng', en: 'Broth simmered for 12 hours' },
      point2: { vi: 'Bò tái, nạm, gầu tươi mỗi sáng', en: 'Fresh beef cuts every morning' },
      point3: { vi: 'Mở cửa 6h–22h, có chỗ gửi xe', en: 'Open 6am–10pm, parking available' },
      point4: { vi: 'Ý thứ tư (không bắt buộc)', en: 'A fourth point (optional)' },
      point5: { vi: 'Ý thứ năm (không bắt buộc)', en: 'A fifth point (optional)' },
    },
  },
  {
    id: 'ban-hang',
    layout: 'quick',
    theme: 'ban-hang',
    music: 'bicycle',
    occasions: ['business'],
    name: { vi: 'Giới thiệu sản phẩm', en: 'Product showcase' },
    description: { vi: 'Bục trưng bày pastel, hộp giao hàng: 3–5 điểm nổi bật.', en: 'Pastel podiums, delivery boxes: 3–5 highlights.' },
    samples: {
      title: { vi: 'Bình giữ nhiệt 500ml', en: 'Insulated bottle, 500 ml' },
      point1: { vi: 'Giữ lạnh 24 giờ, giữ nóng 12 giờ', en: 'Cold for 24 hours, hot for 12' },
      point2: { vi: 'Inox 304, không mùi', en: 'Food-grade steel, no smell' },
      point3: { vi: 'Đặt hàng hôm nay, giao trong 2 ngày', en: 'Order today, delivered in 2 days' },
      point4: { vi: 'Ý thứ tư (không bắt buộc)', en: 'A fourth point (optional)' },
      point5: { vi: 'Ý thứ năm (không bắt buộc)', en: 'A fifth point (optional)' },
    },
  },
  {
    id: 'tuyen-dung',
    layout: 'quick',
    theme: 'tuyen-dung',
    music: 'good-fellow',
    occasions: ['business'],
    name: { vi: 'Tuyển dụng', en: 'Hiring' },
    description: { vi: 'Xanh dương chuyên nghiệp: vị trí và 3–5 điều cần biết.', en: 'Professional blue: the role and 3–5 key facts.' },
    samples: {
      title: { vi: 'Tuyển nhân viên bán hàng', en: "We're hiring: sales staff" },
      point1: { vi: 'Lương 8–12 triệu và thưởng doanh số', en: 'Salary 8–12M VND plus bonus' },
      point2: { vi: 'Làm ca linh hoạt, được đào tạo', en: 'Flexible shifts, training provided' },
      point3: { vi: 'Gửi CV qua tin nhắn trang', en: 'Send your CV by message' },
      point4: { vi: 'Ý thứ tư (không bắt buộc)', en: 'A fourth point (optional)' },
      point5: { vi: 'Ý thứ năm (không bắt buộc)', en: 'A fifth point (optional)' },
    },
  },
  {
    id: 'su-kien',
    layout: 'quick',
    theme: 'su-kien',
    music: 'fetch-dance',
    occasions: ['business', 'share'],
    name: { vi: 'Thông báo sự kiện', en: 'Event announcement' },
    description: { vi: 'Sân khấu, đèn và pháo giấy: tên sự kiện, thời gian, địa điểm.', en: 'Stage lights and confetti: the event, when and where.' },
    samples: {
      title: { vi: 'Đêm nhạc cuối tuần', en: 'Weekend music night' },
      point1: { vi: '20h thứ Bảy, 15/11', en: '8pm Saturday, 15 November' },
      point2: { vi: 'Tại sân khấu tầng 3', en: 'Third-floor stage' },
      point3: { vi: 'Vào cửa tự do, đến sớm có quà', en: 'Free entry, gifts for early birds' },
      point4: { vi: 'Ý thứ tư (không bắt buộc)', en: 'A fourth point (optional)' },
      point5: { vi: 'Ý thứ năm (không bắt buộc)', en: 'A fifth point (optional)' },
    },
  },
  {
    id: 'cam-trai',
    layout: 'quick',
    theme: 'cam-trai',
    music: 'good-fellow',
    occasions: ['share'],
    name: { vi: 'Leo núi, cắm trại', en: 'Mountains & camping' },
    description: { vi: 'Núi sương, rừng thông, lều và lửa trại.', en: 'Misty mountains, pines, a tent and a campfire.' },
    samples: {
      title: { vi: 'Cắm trại Tà Xùa 2 ngày 1 đêm', en: 'Two days camping at Ta Xua' },
      point1: { vi: 'Săn mây lúc bình minh', en: 'Cloud hunting at sunrise' },
      point2: { vi: 'Nướng thịt bên lửa trại', en: 'A barbecue by the campfire' },
      point3: { vi: 'Ngắm sao giữa rừng thông', en: 'Stargazing among the pines' },
      point4: { vi: 'Ý thứ tư (không bắt buộc)', en: 'A fourth point (optional)' },
      point5: { vi: 'Ý thứ năm (không bắt buộc)', en: 'A fifth point (optional)' },
    },
  },
  {
    id: 'chao-buoi-sang',
    layout: 'quote',
    theme: 'chao-buoi-sang',
    music: 'bicycle',
    occasions: ['share'],
    name: { vi: 'Chào buổi sáng', en: 'Good morning' },
    description: { vi: 'Nắng sớm, hoa hướng dương và tách cà phê.', en: 'Morning sun, sunflowers and a cup of coffee.' },
    samples: {
      quote: { vi: 'Chào buổi sáng! Chúc bạn một ngày mới thật nhiều năng lượng và niềm vui.', en: 'Good morning! Wishing you a day full of energy and joy.' },
      author: { vi: 'Tên của bạn', en: 'Your name' },
    },
  },
  {
    id: 'chuc-ngu-ngon',
    layout: 'quote',
    theme: 'chuc-ngu-ngon',
    music: 'chillin-poupi',
    occasions: ['share', 'love'],
    name: { vi: 'Chúc ngủ ngon', en: 'Good night' },
    description: { vi: 'Trăng khuyết, sao và mây trên bầu trời đêm.', en: 'A crescent moon, stars and clouds at night.' },
    samples: {
      quote: { vi: 'Ngủ ngon nhé! Mong mọi mệt mỏi hôm nay tan đi, mai mình lại bắt đầu thật tươi.', en: "Sleep well! Let today's worries drift away; tomorrow starts fresh." },
      author: { vi: 'Tên của bạn', en: 'Your name' },
    },
  },
  {
    id: 'dong-vien',
    layout: 'quote',
    theme: 'dong-vien',
    music: 'fetch-dance',
    occasions: ['share'],
    name: { vi: 'Cố lên, thi tốt', en: 'Keep going, good luck' },
    description: { vi: 'Nắng cam, huy chương và ngôi sao: lời động viên, chúc thi tốt.', en: 'Orange sunshine, a medal and a star: encouragement and exam luck.' },
    samples: {
      quote: { vi: 'Cố lên! Bạn đã chuẩn bị rất kỹ rồi, cứ bình tĩnh và làm hết sức mình nhé.', en: "You've got this! You prepared well; stay calm and give it your best." },
      author: { vi: 'Tên của bạn', en: 'Your name' },
    },
  },
  {
    id: 'xin-loi',
    layout: 'quote',
    theme: 'xin-loi',
    music: 'chillin-poupi',
    occasions: ['love', 'share'],
    name: { vi: 'Xin lỗi, làm lành', en: "I'm sorry" },
    description: { vi: 'Mây pastel, thỏ trắng và trái tim nhỏ để làm lành.', en: 'Pastel clouds, a bunny and a little heart to make up.' },
    samples: {
      quote: { vi: 'Mình xin lỗi vì đã làm bạn buồn. Mình làm lành nhé?', en: "I'm sorry I upset you. Can we make up?" },
      author: { vi: 'Tên của bạn', en: 'Your name' },
    },
  },
  {
    id: 'la-so',
    layout: 'chart',
    theme: 'la-so',
    music: 'chillin-poupi',
    occasions: ['share'],
    name: { vi: 'Lá số tử vi', en: 'Tử Vi birth chart' },
    description: {
      vi: 'Con giáp, chính tinh ở Mệnh và cục của lá số, kèm một câu luận giải. Mở từ lá số trên tuvi.hoandat.com thì mọi ô được điền sẵn.',
      en: 'Your zodiac animal, the major star of your Mệnh palace and your cục, with one line of reading. Opened from a chart on tuvi.hoandat.com, every field is filled in.',
    },
    samples: {
      name: { vi: '', en: '' },
      line1: { vi: 'Tuổi Mùi · Mệnh Thiên Đồng', en: 'Year of the Goat · Mệnh Thiên Đồng' },
      line2: { vi: 'Mộc Tam Cục', en: 'Mộc Tam Cục' },
      reading: {
        vi: 'Thiên Đồng ở Mệnh mang đến tính cách hiền hòa, dễ mến và một tâm thế lạc quan hiếm có.',
        en: 'Thiên Đồng in Mệnh brings a gentle, likeable nature and a rare optimism.',
      },
      animal: { vi: 'mui', en: 'mui' },
      star: { vi: 'thien-dong', en: 'thien-dong' },
      cuc: { vi: 'moc-tam', en: 'moc-tam' },
    },
  },
];

export const TEMPLATES: readonly TemplateSpec[] = ENTRIES.map((entry) => {
  const layout = LAYOUTS[entry.layout];
  return {
    id: entry.id,
    layout: entry.layout,
    theme: entry.theme,
    music: entry.music,
    occasions: entry.occasions,
    name: entry.name,
    description: entry.description,
    durationSeconds: layout.durationSeconds,
    photos: layout.photos,
    fields: layout.fields.map((f) => ({ ...f, placeholder: entry.samples[f.id] ?? { vi: '', en: '' } })),
  };
});

/** The longest video a template may last: renders on the shared server take about 6 s per second of video. */
export const MAX_DURATION_SECONDS = 20;
/** Photos per video, and their composition variable ids in order. */
export const MAX_PHOTOS = 3;
export const PHOTO_VARIABLES = ['photo1', 'photo2', 'photo3'] as const;

/** Where a template's thumbnail is served (a small copy of its background, under the web app's /tpl/). */
export function thumbnailPath(spec: TemplateSpec): string {
  return `themes/${spec.theme}/thumb.webp`;
}

/**
 * A template's composition: its layout's HTML with the theme and music filled in (`{{theme}}`, `{{music}}`). The
 * worker renders this, `hyperframes check` checks it, the web preview plays it.
 */
export function composeTemplateHtml(layoutHtml: string, spec: TemplateSpec): string {
  return layoutHtml.replaceAll('{{theme}}', spec.theme).replaceAll('{{music}}', spec.music);
}

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === 'string' && (TEMPLATE_IDS as readonly string[]).includes(value);
}

export function templateById(id: TemplateId): TemplateSpec {
  const spec = TEMPLATES.find((t) => t.id === id);
  if (!spec) throw new Error(`unknown template ${id}`);
  return spec;
}

/** Why an input was refused; stable codes the UI translates. */
export type InputError = 'unknown-template' | 'invalid-fields' | 'missing-field' | 'field-too-long' | 'too-few-photos' | 'too-many-photos';

export type InputResult =
  | { readonly ok: true; readonly templateId: TemplateId; readonly fields: Readonly<Record<string, string>> }
  | { readonly ok: false; readonly error: InputError; readonly field?: string };

// Control characters (C0, DEL, C1), tabs and new lines included: a line of a video is one line of text.
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

/**
 * One line of user text as the video shows it: Unicode NFC (macOS and some keyboards send Vietnamese decomposed,
 * which would count double and may render badly), control characters replaced by spaces, spaces collapsed.
 */
export function normalizeText(value: string): string {
  return value.normalize('NFC').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim();
}

/** Whether `value` may fill `field`: any text for a text field, one of its ids for a choice field. */
export function isAllowedChoice(field: TextField, value: string): boolean {
  return field.choices === undefined || field.choices.some((c) => c.id === value);
}

/**
 * Field values a link may fill in (`/tao?t=la-so&animal=mui&line1=…`): for each field of the template, its query
 * parameter when valid — a choice among the field's ids, text within the field's limit after normalizeText, or
 * empty for an optional field. Anything else (unknown parameters, ids, too long text, an empty required field) is
 * left out, so the person starts from the template's samples there.
 * Values stay plain text: the compositions only ever set them as textContent or map ids to bundled pictures.
 */
export function fieldsFromQuery(spec: TemplateSpec, query: { get(name: string): string | null }): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const field of spec.fields) {
    const raw = query.get(field.id);
    if (raw === null) continue;
    const value = normalizeText(raw);
    // An empty optional field is a choice too (no name; no major star in Mệnh), not a missing one.
    if (value === '') {
      if (!field.required) fields[field.id] = '';
      continue;
    }
    if ([...value].length > field.maxLength || !isAllowedChoice(field, value)) continue;
    fields[field.id] = value;
  }
  return fields;
}

/**
 * Checks a job's text fields and photo count against its template. Unknown field ids are refused rather than
 * dropped, so a client out of step with the server notices.
 */
export function validateInput(templateId: unknown, fields: unknown, photoCount: number): InputResult {
  if (!isTemplateId(templateId)) return { ok: false, error: 'unknown-template' };
  const spec = templateById(templateId);
  if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) return { ok: false, error: 'invalid-fields' };
  const known = new Set(spec.fields.map((f) => f.id));
  const entries = Object.entries(fields);
  if (entries.some(([id, value]) => !known.has(id) || typeof value !== 'string')) return { ok: false, error: 'invalid-fields' };
  const given = new Map(entries.map(([id, value]) => [id, normalizeText(String(value))]));
  const clean: Record<string, string> = {};
  for (const field of spec.fields) {
    const value = given.get(field.id) ?? '';
    if (field.required && value === '') return { ok: false, error: 'missing-field', field: field.id };
    if ([...value].length > field.maxLength) return { ok: false, error: 'field-too-long', field: field.id };
    if (value !== '' && !isAllowedChoice(field, value)) return { ok: false, error: 'invalid-fields', field: field.id };
    clean[field.id] = value;
  }
  if (photoCount < spec.photos.min) return { ok: false, error: 'too-few-photos' };
  if (photoCount > spec.photos.max) return { ok: false, error: 'too-many-photos' };
  return { ok: true, templateId, fields: clean };
}

/**
 * The composition variables of one render: every text field, then one variable per photo slot of the template
 * (the photo's URL or path, empty when there is none).
 */
export function compositionVariables(spec: TemplateSpec, fields: Readonly<Record<string, string>>, photos: readonly string[]): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const field of spec.fields) variables[field.id] = fields[field.id] ?? '';
  if (spec.photos.max > 0) {
    PHOTO_VARIABLES.forEach((id, index) => {
      variables[id] = photos[index] ?? '';
    });
  }
  return variables;
}
