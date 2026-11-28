/**
 * Template names and descriptions in Simplified Chinese, for the picker and the template pages. Only the UI is
 * translated: a template's sample lines go into the video, so they stay Vietnamese and English (see SampleText in
 * catalog.ts). Keyed by template id, so a template without its Chinese text fails the typecheck.
 */
import type { TemplateId } from './catalog';

interface TemplateText {
  readonly name: string;
  readonly description: string;
}

export const TEMPLATE_TEXT_ZH_CN: Readonly<Record<TemplateId, TemplateText>> = {
  'chuc-mung': { name: '生日', description: '气球、礼物和蛋糕：三行祝福，一到三张照片。' },
  'thay-co': { name: '越南教师节 11/20', description: '为越南教师节准备的鲜花、书本和奥黛。' },
  tet: { name: '新年、春节', description: '红金配色、梅花、桃花和灯笼。' },
  'giang-sinh': { name: '圣诞节', description: '青松、白雪和圣诞礼物。' },
  'tinh-yeu': { name: '爱情、纪念日', description: '送给心爱之人的玫瑰和爱心。' },
  'dam-cuoi': { name: '婚礼', description: '白色鲜花、婚戒和香槟金。' },
  'tot-nghiep': { name: '毕业', description: '学士帽、毕业证书和月桂花环。' },
  'khai-truong': { name: '开业、成功', description: '花篮、红绸带和金色彩纸。' },
  'ke-nhanh': { name: '快速清单', description: '一个标题和 3–5 个要点，每个要点一帧，短视频风格。照片可选。' },
  'chuyen-di': { name: '旅行明信片', description: '明信片风格：旅程名称、3–5 个难忘瞬间和照片。' },
  'trich-dan': { name: '名言', description: '夜空下的一句大字名言，附作者姓名。' },
  'cam-on': { name: '感谢', description: '水彩花卉背景上的一段感谢。' },
  'phu-nu-8-3': { name: '国际妇女节 3/8', description: '为 3 月 8 日准备的粉色郁金香、玫瑰和淡紫色调。' },
  'phu-nu-20-10': { name: '越南妇女节 10/20', description: '桃粉色背景上的玫瑰、粉莲和斗笠。' },
  'thieu-nhi': { name: '国际儿童节 6/1', description: '气球、纸风筝、彩虹和泰迪熊。' },
  'trung-thu': { name: '中秋节', description: '满月、星星灯笼、月饼和玉兔。' },
  valentine: { name: '情人节 2/14', description: '为情人节准备的红心、巧克力和玫瑰。' },
  'vu-lan': { name: '盂兰节、孝亲', description: '粉莲、河灯和别在胸前的玫瑰。' },
  'ngay-cua-me': { name: '母亲节', description: '粉色康乃馨、一杯茶和写给妈妈的信。' },
  halloween: { name: '万圣节', description: '南瓜、可爱的小幽灵和糖果：有趣而不吓人。' },
  'quoc-khanh': { name: '越南国庆节 9/2', description: '金星红旗、烟花和莲花。' },
  'tan-gia': { name: '乔迁', description: '新家钥匙、绿植和温暖的灯光。' },
  'day-thang': { name: '满月、周岁', description: '为宝宝准备的粉彩云朵、星星和玩具。' },
  'mung-tho': { name: '为祖父母祝寿', description: '红金背景上的寿桃、仙鹤和松枝。' },
  'thang-chuc': { name: '升职、成功', description: '翡翠绿背景上的金杯、火箭和月桂。' },
  'ky-niem-cuoi': { name: '结婚纪念日', description: '深红玫瑰、婚戒和香槟杯。' },
  'thu-cung': { name: '宠物', description: '小狗、小猫、爪印和骨头：晒晒你家的主子。' },
  'khuyen-mai': { name: '促销、黑色星期五', description: '黑金配色、购物袋和喇叭：一个标题和 3–5 个优惠。' },
  'mon-an': { name: '美食、店铺介绍', description: '木桌上的河粉、法棍面包和越南冰咖啡。' },
  'ban-hang': { name: '产品介绍', description: '粉彩展台和快递盒：3–5 个亮点。' },
  'tuyen-dung': { name: '招聘', description: '专业的蓝色调：职位和 3–5 项须知。' },
  'su-kien': { name: '活动预告', description: '舞台、灯光和彩纸：活动名称、时间和地点。' },
  'cam-trai': { name: '登山、露营', description: '雾中山峦、松林、帐篷和篝火。' },
  'chao-buoi-sang': { name: '早安', description: '晨光、向日葵和一杯咖啡。' },
  'chuc-ngu-ngon': { name: '晚安', description: '夜空中的弯月、星星和云朵。' },
  'dong-vien': { name: '加油、考试顺利', description: '橙色阳光、奖牌和星星：鼓励的话和考试祝福。' },
  'xin-loi': { name: '道歉、和好', description: '粉彩云朵、小白兔和一颗小小的心，用来和好。' },
  'la-so': {
    name: '紫微命盘',
    description: '命盘的生肖、命宫主星和五行局，附一句解读。从 tuvi.hoandat.com 的命盘打开时，所有栏目都会自动填好。',
  },
};
