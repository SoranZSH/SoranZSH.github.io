/* 金榜 · 数据表。所有数字都是人工设定的估算参数，可以直接在这里改。
 * 校准锚点见 README：麦可思 2025 届本科月收入、前程无忧校招白皮书起薪、国家统计局周均工时。 */
(function (root) {
  'use strict';
  const D = {};

  /* 院校档位：pts 是 0–20 的院校分 */
  D.TIERS = [
    { id: 'c9', name: '清北 / C9', pts: 20 }, { id: '985', name: '985', pts: 17 }, { id: 'qs50', name: '海外 QS 前 50', pts: 16 },
    { id: '211', name: '211 / 双一流', pts: 13 }, { id: 'qs100', name: '海外 QS 51–100', pts: 13 }, { id: 'qs200', name: '海外 QS 101–200', pts: 10 },
    { id: 'strong', name: '强双非 / 行业名校', pts: 10.5 }, { id: 'yiben', name: '双非一本', pts: 8 }, { id: 'abroad', name: '海外其他院校', pts: 6 }, { id: 'erben', name: '二本 / 民办 / 独立学院', pts: 4 }, { id: 'zhuan', name: '专科', pts: 1 }];

  D.MAJORS = [
    { id: 'cs', name: '计算机 / 软件 / 人工智能', heat: 12 }, { id: 'ee', name: '电子 / 通信 / 自动化', heat: 11 }, { id: 'math', name: '数学 / 统计 / 数据科学', heat: 10 },
    { id: 'fin', name: '金融 / 经济 / 会计', heat: 8 }, { id: 'biz', name: '管理 / 市场 / 商科', heat: 7 }, { id: 'mech', name: '机械 / 材料 / 能源 / 土木', heat: 7 },
    { id: 'bio', name: '生物 / 化学 / 医药 / 环境', heat: 5 }, { id: 'law', name: '法学 / 社科', heat: 5 }, { id: 'art', name: '设计 / 艺术', heat: 5 }, { id: 'lang', name: '语言 / 文史哲 / 传媒', heat: 4 }];

  /* 雇主类型：sal / ot 是相对岗位基准的倍数；thr 是进面门槛分的加减；后四项是 0–1 的非金钱属性 */
  D.EMPLOYERS = [
    { id: 'big', name: '大厂', sal: 1.15, ot: 1.1, thr: 6, growth: .9, stable: .35, fame: .95, intl: .45, note: '起薪和成长最快，加班多，稳定性一般' },
    { id: 'foreign', name: '外企', sal: .98, ot: .65, thr: 5, growth: .6, stable: .55, fame: .75, intl: 1, note: '节奏相对从容，英语是门槛，岗位数量少' },
    { id: 'soe', name: '国企 / 央企', sal: .8, ot: .5, thr: 1, growth: .35, stable: .95, fame: .6, intl: .15, note: '稳定、准点，起薪低一截，涨薪慢' },
    { id: 'startup', name: '成长型公司', sal: .9, ot: 1.0, thr: -6, growth: .85, stable: .2, fame: .25, intl: .3, note: '上手机会多，薪资和稳定性波动大' }];

  /* 岗位：base 本科、60 分、全国平均城市、市场中位雇主的税前月薪（千元）；e 薪资对竞争力的弹性；
   * cexp 薪资对城市的敏感度；ot 月加班小时基准；min 进面门槛分；emp 可选雇主类型；fixed 表示雇主类型固定 */
  D.JOBS = [
    { id: 'algo', name: '大模型算法工程师', base: 18, e: 1.8, cexp: .8, ot: 55, min: 76, fit: { cs: 1, math: .8, ee: .7 }, emp: ['big', 'startup', 'foreign'] },
    { id: 'dev', name: '后端开发工程师', base: 14, e: 1.4, cexp: .8, ot: 50, min: 52, fit: { cs: 1, ee: .8, math: .7, mech: .3 }, emp: ['big', 'startup', 'foreign', 'soe'], t: { hz: '电商后端开发工程师', cd: '游戏服务端开发工程师', sz: '云服务后端开发工程师' } },
    { id: 'chip', name: '芯片 / 硬件工程师', base: 13, e: 1.2, cexp: .8, ot: 42, min: 55, fit: { ee: 1, cs: .5, mech: .4, math: .3 }, emp: ['big', 'foreign', 'soe', 'startup'], t: { sz: '消费电子硬件工程师', hf: '存储芯片工艺工程师', sh: '数字芯片设计工程师' } },
    { id: 'data', name: '数据分析师', base: 9.5, e: 1, cexp: .9, ot: 34, min: 50, fit: { math: 1, cs: .8, biz: .8, fin: .8, ee: .5, bio: .3, law: .3 }, emp: ['big', 'foreign', 'soe', 'startup'], t: { hz: '电商数据分析师', sh: '商业分析师', bj: '策略数据分析师' } },
    { id: 'aipm', name: 'AI 产品经理', base: 12, e: 1.3, cexp: .8, ot: 46, min: 62, fit: { cs: .9, biz: .8, math: .8, ee: .7, fin: .6, art: .5, lang: .4, law: .4, mech: .4, bio: .3 }, emp: ['big', 'startup', 'foreign'], t: { sz: 'AI 硬件产品经理', hz: '电商 AI 产品经理', bj: '企业级 AI 产品经理' } },
    { id: 'gtm', name: '出海 GTM 运营', base: 8.5, e: .9, cexp: 1, ot: 46, min: 45, fit: { lang: 1, biz: .9, fin: .6, law: .5, art: .4, math: .4, cs: .3 }, emp: ['big', 'startup'], intl: .3, t: { sz: '拉美 GTM 运营', hz: '东南亚跨境电商运营', gz: '中东跨境电商运营', sh: '欧美市场 GTM 运营' } },
    { id: 'ops', name: '用户 / 内容运营', base: 7, e: .8, cexp: 1, ot: 38, min: 35, fit: { lang: .9, biz: .9, art: .7, law: .6, fin: .5, bio: .4, math: .4, cs: .3, mech: .3, ee: .3 }, emp: ['big', 'startup'], t: { hz: '电商内容运营', cs: '文娱内容运营', bj: '社区用户运营' } },
    { id: 'brand', name: '品牌市场管培生', base: 8.5, e: 1, cexp: 1, ot: 40, min: 58, fit: { biz: 1, lang: .8, art: .7, fin: .6, law: .5 }, emp: ['foreign', 'big', 'startup'], t: { sh: '快消品牌管培生', gz: '美妆品牌市场专员' } },
    { id: 'ib', name: '券商投行 / 行研助理', base: 12, e: 1.6, cexp: .6, ot: 75, min: 72, fit: { fin: 1, math: .8, biz: .6, cs: .5, ee: .4, law: .4 }, fixed: { id: 'soe', name: '头部券商', growth: .8, stable: .5, fame: .85, intl: .4 } },
    { id: 'bank', name: '银行管培 / 金融科技', base: 8.5, e: .6, cexp: .9, ot: 25, min: 45, fit: { fin: 1, biz: .8, math: .8, cs: .8, ee: .6, law: .6, lang: .4, mech: .4, bio: .3, art: .2 }, fixed: { id: 'soe', name: '国有 / 股份制银行', growth: .4, stable: .9, fame: .65, intl: .2 } },
    { id: 'consult', name: '咨询 / 四大', base: 8.5, e: 1.2, cexp: 1, ot: 65, min: 55, fit: { biz: 1, fin: 1, math: .8, cs: .6, ee: .6, law: .6, lang: .5, mech: .5, bio: .5 }, fixed: { id: 'foreign', name: '咨询公司 / 四大', growth: .85, stable: .45, fame: .8, intl: .8 } },
    { id: 'soe', name: '央国企管培 / 职能', base: 7, e: .5, cexp: .9, ot: 12, min: 50, dfit: .7, fit: {}, fixed: { id: 'soe', name: '国企 / 央企', growth: .35, stable: .95, fame: .6, intl: .15 } },
    { id: 'mfg', name: '新能源 / 制造业工程师', base: 8.5, e: .8, cexp: .8, ot: 40, min: 40, fit: { mech: 1, ee: .9, cs: .5, math: .4, bio: .4 }, emp: ['soe', 'big', 'foreign', 'startup'], t: { hf: '新能源汽车工艺工程师', sz: '储能系统工程师', xa: '航空制造工程师', cs: '工程机械研发工程师' } },
    { id: 'bio', name: '生物医药研发 / 注册', base: 7.5, e: .9, cexp: .9, ot: 30, min: 48, fit: { bio: 1 }, emp: ['foreign', 'startup', 'soe'] },
    { id: 'legal', name: '法务 / 合规专员', base: 8, e: 1, cexp: 1, ot: 35, min: 55, fit: { law: 1 }, emp: ['foreign', 'soe', 'big'] },
    { id: 'game', name: '游戏策划 / 美术', base: 10, e: 1.2, cexp: .7, ot: 50, min: 50, fit: { art: 1, cs: .8, lang: .5, biz: .5, math: .5 }, emp: ['big', 'startup'] },
    { id: 'media', name: '新媒体编导 / 短视频运营', base: 6.5, e: .7, cexp: 1, ot: 40, min: 30, fit: { lang: 1, art: 1, biz: .6, law: .4 }, emp: ['startup', 'big', 'soe'] },
    { id: 'sales', name: 'ToB 解决方案 / 销售', base: 7.5, e: .8, cexp: 1, ot: 35, min: 30, dfit: .55, fit: { biz: .8, lang: .7 }, emp: ['big', 'startup', 'foreign'] }];

  /* 城市：coef 薪资系数；rent 单间月租；life 基本生活费；otF 加班系数；compet 竞争加减分；opp 机会密度；
   * intl 国际化；fun 城市生活丰富度；house 买房可行性；avail 各类雇主的岗位充裕度；bg 漫画背景档 */
  D.CITIES = [
    { id: 'bj', name: '北京', prov: '北京', bg: 't1', coef: 1.30, rent: 3600, life: 3000, otF: 1.12, compet: 6, opp: 1, intl: .9, fun: .95, house: .1, avail: { big: 1, foreign: .8, soe: 1, startup: 1 }, vibe: '互联网、AI 和金融总部集中，机会最多，竞争和房租也最高。', strong: ['algo', 'dev', 'aipm', 'data', 'ib', 'consult', 'soe', 'legal', 'media', 'bank', 'ops', 'sales'] },
    { id: 'sh', name: '上海', prov: '上海', bg: 't1', coef: 1.28, rent: 3800, life: 3200, otF: 1.05, compet: 6, opp: 1, intl: 1, fun: 1, house: .08, avail: { big: .9, foreign: 1, soe: .9, startup: .9 }, vibe: '金融、外企、芯片和消费品牌的大本营，岗位种类最全。', strong: ['dev', 'data', 'chip', 'ib', 'consult', 'brand', 'bank', 'bio', 'legal', 'game', 'gtm', 'aipm', 'algo', 'ops', 'sales'] },
    { id: 'sz', name: '深圳', prov: '广东', bg: 't1', coef: 1.29, rent: 3200, life: 3000, otF: 1.15, compet: 4, opp: .95, intl: .85, fun: .85, house: .05, avail: { big: 1, foreign: .7, soe: .7, startup: 1 }, vibe: '硬件、出海和金融科技集中，节奏快，起薪在全国前三。', strong: ['algo', 'dev', 'chip', 'gtm', 'aipm', 'mfg', 'ib', 'bank', 'game', 'data', 'sales'] },
    { id: 'gz', name: '广州', prov: '广东', bg: 't1', coef: 1.12, rent: 2400, life: 2600, otF: .98, compet: 1, opp: .75, intl: .75, fun: .9, house: .3, avail: { big: .7, foreign: .7, soe: .9, startup: .7 }, vibe: '跨境电商、美妆快消和游戏都有底子，生活成本是一线里最低的。', strong: ['gtm', 'brand', 'ops', 'game', 'bank', 'consult', 'mfg', 'media', 'bio', 'data', 'sales', 'soe'] },
    { id: 'hz', name: '杭州', prov: '浙江', bg: 't2', coef: 1.12, rent: 2600, life: 2600, otF: 1.15, compet: 3, opp: .85, intl: .65, fun: .85, house: .25, avail: { big: 1, foreign: .5, soe: .6, startup: .95 }, vibe: '电商和 AI 创业公司密集，运营和产品岗多，加班不比一线少。', strong: ['algo', 'dev', 'aipm', 'ops', 'gtm', 'data', 'media', 'game', 'sales', 'bank'] },
    { id: 'nj', name: '南京', prov: '江苏', bg: 't2', coef: 1.05, rent: 2200, life: 2400, otF: .95, compet: 0, opp: .6, intl: .5, fun: .75, house: .4, avail: { big: .55, foreign: .5, soe: 1, startup: .5 }, vibe: '软件、通信和国企研究所多，节奏稳。', strong: ['dev', 'chip', 'soe', 'bank', 'mfg', 'bio', 'sales', 'data'] },
    { id: 'su', name: '苏州', prov: '江苏', bg: 't2', coef: 1.08, rent: 1900, life: 2300, otF: .95, compet: -1, opp: .55, intl: .55, fun: .7, house: .5, avail: { big: .4, foreign: .7, soe: .8, startup: .5 }, vibe: '制造业和生物医药强，外资工厂多，收入对房租的比值很友好。', strong: ['chip', 'mfg', 'bio', 'dev', 'sales', 'bank', 'soe'] },
    { id: 'cd', name: '成都', prov: '四川', bg: 't2', coef: .98, rent: 1700, life: 2300, otF: .9, compet: 0, opp: .65, intl: .5, fun: .9, house: .6, avail: { big: .6, foreign: .4, soe: 1, startup: .6 }, vibe: '游戏、文创和大厂第二总部，生活舒服，所以想来的人也多。', strong: ['dev', 'game', 'soe', 'ops', 'media', 'bio', 'bank', 'chip', 'sales'] },
    { id: 'wh', name: '武汉', prov: '湖北', bg: 't2', coef: .98, rent: 1500, life: 2100, otF: .92, compet: -2, opp: .55, intl: .4, fun: .75, house: .65, avail: { big: .55, foreign: .3, soe: 1, startup: .5 }, vibe: '光电子和大厂研发分部集中，房租低。', strong: ['dev', 'chip', 'mfg', 'soe', 'bank', 'sales'] },
    { id: 'hf', name: '合肥', prov: '安徽', bg: 't2', coef: .95, rent: 1400, life: 2000, otF: .95, compet: -3, opp: .45, intl: .3, fun: .55, house: .65, avail: { big: .4, foreign: .15, soe: 1, startup: .5 }, vibe: '新能源汽车、存储芯片和语音 AI 是三张牌。', strong: ['chip', 'mfg', 'algo', 'soe', 'sales', 'bank'] },
    { id: 'xa', name: '西安', prov: '陕西', bg: 't2', coef: .93, rent: 1400, life: 2000, otF: .92, compet: -2, opp: .45, intl: .35, fun: .75, house: .65, avail: { big: .4, foreign: .15, soe: 1, startup: .4 }, vibe: '航空航天、半导体和研究所多，偏稳。', strong: ['chip', 'mfg', 'dev', 'soe', 'sales', 'bank'] },
    { id: 'cs', name: '长沙', prov: '湖南', bg: 't2', coef: .92, rent: 1300, life: 2100, otF: .88, compet: -3, opp: .4, intl: .3, fun: .85, house: .85, avail: { big: .3, foreign: .15, soe: 1, startup: .5 }, vibe: '文娱传媒和工程机械之城，房价收入比是全国最友好的一档。', strong: ['media', 'mfg', 'ops', 'soe', 'sales', 'bank'] },
    { id: 'home', name: '家乡小城', prov: null, bg: 'small', coef: .78, rent: 500, life: 1700, otF: .85, compet: -5, opp: .2, intl: .1, fun: .35, house: .95, avail: { big: .05, foreign: .05, soe: 1, startup: .2 }, vibe: '回到家乡的二三线城市：住家里或房租很低，岗位以国企、银行和本地企业为主。', strong: ['soe', 'bank', 'sales', 'media', 'mfg'] }];

  /* 选填：最看重的事（最多选三项） */
  D.VALUES = [
    { id: 'growth', name: '成长速度' }, { id: 'income', name: '收入上限' }, { id: 'stable', name: '稳定不被裁' }, { id: 'wlb', name: '准点下班' }, { id: 'fame', name: '平台名气' },
    { id: 'intl', name: '国际化环境' }, { id: 'home', name: '离家近' }, { id: 'house', name: '能买房安家' }, { id: 'fun', name: '城市生活丰富' }, { id: 'fit', name: '专业对口' }];
  D.BASE_W = { growth: .8, income: 1.1, stable: .4, wlb: .35, fame: .5, intl: .1, home: .25, house: .2, fun: .3, fit: .6 };
  /* 选填：五年后最想成为 */
  D.ASPIRE = [
    { id: '', name: '还没想好', w: {} }, { id: 'expert', name: '行业专家', w: { growth: .8, fit: .8 } }, { id: 'manager', name: '带团队的管理者', w: { growth: .8, fame: .6 } },
    { id: 'founder', name: '自己创业', w: { growth: 1, income: .4 }, emp: { startup: .12, big: .04 } }, { id: 'settled', name: '安稳有生活', w: { stable: .9, wlb: .8, house: .6 } },
    { id: 'free', name: '出国或自由职业', w: { intl: 1, wlb: .5 }, emp: { foreign: .1 } }];
  D.OT_TOL = [{ id: 'low', name: '尽量不加班' }, { id: 'mid', name: '忙一点可以' }, { id: 'high', name: '年轻就该拼' }];

  D.REGIONS = { 华北: ['北京', '天津', '河北', '山西', '内蒙古'], 东北: ['辽宁', '吉林', '黑龙江'], 华东: ['上海', '江苏', '浙江', '安徽', '福建', '江西', '山东'],
    华中: ['河南', '湖北', '湖南'], 华南: ['广东', '广西', '海南'], 西南: ['四川', '重庆', '贵州', '云南', '西藏'], 西北: ['陕西', '甘肃', '青海', '宁夏', '新疆'] };
  D.PROVINCES = Object.values(D.REGIONS).flat();
  D.regionOf = p => Object.keys(D.REGIONS).find(k => D.REGIONS[k].includes(p)) || null;

  D.TIER_LEVELS = [
    { min: 85, name: '一甲', mood: 'up', desc: '头部大厂核心岗、头部券商都有较强竞争力' },
    { min: 70, name: '二甲', mood: 'up', desc: '大厂、外企、头部国企能进面试，有机会拿到 offer' },
    { min: 55, name: '三甲', mood: 'mid', desc: '中厂和大厂非核心岗是主战场' },
    { min: 40, name: '举人', mood: 'mid', desc: '以中小厂为主，需要靠实习或作品补强' },
    { min: 0, name: '秀才', mood: 'low', desc: '建议先补一段实习，放宽城市多投' }];
  D.byId = (arr, id) => arr.find(x => x.id === id);

  root.JBData = D;
  if (typeof module !== 'undefined') module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);
