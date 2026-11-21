/* 金榜 · 自我介绍解析：从一段口语化文字里抽出学历、成绩、实习，以及钱以外的偏好。本地规则，不联网。 */
(function (root) {
  'use strict';
  const D = root.JBData || require('./data.js'), SCH = root.JBSchools || require('./schools.js');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const BIG = [['字节', '抖音', 'TikTok'], ['腾讯', '微信'], ['阿里', '淘天', '蚂蚁', '菜鸟'], ['美团'], ['百度'], ['京东'], ['华为'], ['网易'], ['拼多多', 'Temu'], ['小红书'], ['快手'], ['滴滴'], ['米哈游'], ['小米'], ['哔哩哔哩', 'B站', 'b站'], ['携程'], ['微软'], ['谷歌', 'Google'], ['亚马逊'], ['苹果公司', 'Apple'], ['英伟达'], ['特斯拉'], ['比亚迪'], ['大疆'], ['宁德时代'], ['宝洁'], ['联合利华'], ['欧莱雅'], ['玛氏'], ['麦肯锡'], ['贝恩'], ['BCG', '波士顿咨询'], ['中金'], ['中信证券'], ['华泰证券'], ['国金证券'], ['高盛'], ['摩根'], ['普华永道'], ['德勤'], ['安永'], ['毕马威'], ['ServiceNow'], ['美世', 'Mercer'], ['SAP'], ['Oracle', '甲骨文'], ['IBM'], ['OPPO'], ['vivo'], ['荣耀'], ['商汤'], ['科大讯飞'], ['理想汽车'], ['蔚来'], ['小鹏'], ['希音', 'Shein', 'SHEIN'], ['招商银行'], ['平安']];
  const MAJOR_KW = {
    cs: /计算机|软件工程|人工智能专业|网络安全|信息安全/g, ee: /电子信息|通信工程|自动化|微电子|集成电路|电气工程/g,
    math: /数学|统计学|商业分析|数据科学|[Bb]usiness [Aa]nalytics/g, fin: /金融|经济学|会计|财务管理|国际贸易|国贸/g,
    mech: /机械|材料|能源|土木|车辆工程|航空航天|化工/g, biz: /市场营销|工商管理|管理学|人力资源|物流管理|电子商务|MBA/g,
    bio: /生物|化学|药学|医学|环境工程|环境科学/g, law: /法学|法律专业|社会学|政治学|公共管理|心理学|教育学/g,
    art: /设计专业|工业设计|视觉设计|视觉传达|交互设计|美术|动画|建筑学|艺术/g,
    lang: /西班牙语|葡萄牙语|英语专业|英语系|日语|法语|德语|翻译专业|中文系|汉语言|新闻学|新闻传播|传播学|广告学|历史学|哲学|小语种/g };
  const BOOST_KW = {
    algo: /大模型|算法|深度学习|机器学习|LLM|神经网络/i, dev: /后端|前端|开发|写代码|Java|C\+\+|编程/i, chip: /芯片|电路|嵌入式|FPGA|硬件/i,
    data: /数据分析|SQL|Python|建模|可视化|Tableau/i, aipm: /产品经理|产品实习|做产品|需求|PRD|用户调研|原型/i,
    gtm: /出海|跨境|海外市场|拉美|南美|东南亚|中东|西班牙语|葡萄牙语|GTM|墨西哥|巴西/i, ops: /运营|社群|增长|活动策划/i,
    brand: /品牌|市场营销|营销|快消|广告投放/i, ib: /投行|行研|券商|基金|CFA|证券/i, bank: /银行|风控|金融科技/i,
    consult: /咨询|四大|审计|CPA/i, soe: /国企|央企|体制内|事业单位/i, mfg: /新能源|制造|工艺|产线|汽车/i,
    bio: /医药|实验室|临床|药企/i, legal: /律所|合规|法务/i, game: /游戏/i, media: /短视频|抖音号|剪辑|编导|新媒体|自媒体/i, sales: /销售|客户|BD|商务拓展|解决方案/i };
  /* 钱以外的偏好 */
  const VALUE_KW = {
    growth: /成长|学东西|学到东西|锻炼|提升自己|上升空间/, income: /赚钱|挣钱|高薪|薪资高|财务自由|收入高/, stable: /稳定|安稳|铁饭碗|不被裁|旱涝保收/,
    wlb: /不想加班|不加班|双休|准点下班|生活平衡|有自己的时间|work.?life/i, fame: /大平台|名企|知名公司|背书|光环/, intl: /国际化|外语环境|全球化|跨文化|不同文化|和外国/,
    home: /离家近|回家|陪父母|陪家人|照顾父母|离爸妈/, house: /买房|安家|定居|落户|成家/, fun: /好玩|美食|生活气息|烟火气|演出|展览/, fit: /专业对口|学以致用|对口/ };
  const ASPIRE_KW = { expert: /专家|深耕|技术大牛|专业上做到/, manager: /管理者|带团队|管理岗|做管理/, founder: /创业|自己做老板|当老板|开公司/, settled: /安稳的生活|平平淡淡|小日子|过好自己的生活/, free: /自由职业|数字游民|旅居|移民/ };
  const CAPITAL = { 石家庄: '河北', 太原: '山西', 呼和浩特: '内蒙古', 沈阳: '辽宁', 大连: '辽宁', 长春: '吉林', 哈尔滨: '黑龙江', 南京: '江苏', 苏州: '江苏', 无锡: '江苏', 杭州: '浙江', 宁波: '浙江', 温州: '浙江', 合肥: '安徽', 福州: '福建', 厦门: '福建', 泉州: '福建', 南昌: '江西', 济南: '山东', 青岛: '山东', 郑州: '河南', 洛阳: '河南', 武汉: '湖北', 长沙: '湖南', 广州: '广东', 深圳: '广东', 东莞: '广东', 佛山: '广东', 南宁: '广西', 海口: '海南', 成都: '四川', 贵阳: '贵州', 昆明: '云南', 拉萨: '西藏', 西安: '陕西', 兰州: '甘肃', 西宁: '青海', 银川: '宁夏', 乌鲁木齐: '新疆' };
  const CN = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

  /* 把"三点五""九十二分"这类口语数字换成阿拉伯数字，方便后面取 GPA */
  function normalize(t) {
    return t.replace(/([零一二三四五六七八九])点([零一二三四五六七八九]{1,2})/g, (m, a, b) => CN[a] + '.' + [...b].map(c => CN[c]).join(''))
      .replace(/([二三四五六七八九])十([一二三四五六七八九])?(?=分|点)/g, (m, a, b) => String(CN[a] * 10 + (b ? CN[b] : 0)));
  }

  function parse(raw) {
    const out = { fields: {}, boosts: [], heard: {}, chars: (raw || '').replace(/\s/g, '').length, introBonus: 0 };
    if (!raw || out.chars < 6) return out;
    const text = normalize(raw), F = out.fields, H = out.heard;
    // 学历层次
    if (/博士|直博|PhD/i.test(text)) F.degree = 'phd'; else if (/硕士|研究生|读研|保研|考研|[Mm]aster/.test(text)) F.degree = 'ma'; else if (/本科|大四|学士/.test(text)) F.degree = 'ba';
    // 院校：长名字先匹配并遮住
    let masked = text; const ment = [];
    for (const [n, tier] of SCH.list) { let i; while ((i = masked.indexOf(n)) >= 0) { ment.push({ i, len: n.length, tier, n }); masked = masked.slice(0, i) + '＿'.repeat(n.length) + masked.slice(i + n.length); } }
    const generic = [[/强双非|行业名校/g, 'strong'], [/普通一本|双非|一本院校|一本大学/g, 'yiben'], [/二本|三本|民办|独立学院/g, 'erben'], [/专科|大专|高职/g, 'zhuan'], [/985/g, '985'], [/211|双一流/g, '211']];
    for (const [re, tier] of generic) masked = masked.replace(re, (m0, off) => { ment.push({ i: off, len: m0.length, tier, n: '' }); return '＿'.repeat(m0.length); });
    ment.sort((a, b) => a.i - b.i);
    /* 院校归属：不看先后顺序，看每所学校离哪个学历词最近（同一个分句内优先），再整体挑代价最小的一组配对 */
    const kws = []; let km;
    const TOP_RE = /硕士|研究生|读研|保研|考研|博士|直博|研[一二三]|博[一二三四五]|[Mm]aster|PhD|MBA/g, FIRST_RE = /本科|学士|大[一二三四](?!学)|高考/g;
    while ((km = TOP_RE.exec(text))) kws.push({ i: km.index, len: km[0].length, role: 'top' });
    while ((km = FIRST_RE.exec(text))) kws.push({ i: km.index, len: km[0].length, role: 'first' });
    const clauseOf = i => (text.slice(0, i).match(/[，。；,;！!？?\n]/g) || []).length;
    const cost = (m, role) => { let best = Infinity;
      for (const k of kws) { if (k.role !== role) continue;
        const d = k.i >= m.i + m.len ? k.i - (m.i + m.len) : m.i >= k.i + k.len ? m.i - (k.i + k.len) : 0;
        const c = d + (clauseOf(k.i) === clauseOf(m.i) ? 0 : 40); if (c < best) best = c; }
      if (role === 'top' && /后来|之后|然后|毕业后|接着|现在|目前/.test(text.slice(Math.max(0, m.i - 8), m.i))) best -= 8;
      if (role === 'first' && /之前|此前|原来|最早/.test(text.slice(Math.max(0, m.i - 8), m.i))) best -= 8;
      return best; };
    if (ment.length) {
      let a = null, b = null;
      const both = /本硕|本科[和与跟及、]?(?:硕士|研究生)(?:阶段)?(?:都|均|全)/.test(text);
      if (ment.length === 1 || both) { const m = ment[0];
        if (both || F.degree === 'ba' || !F.degree) { a = m; if (both) b = m; }
        else if (cost(m, 'first') < cost(m, 'top')) a = m; else { b = m; if (!/本科|学士/.test(text)) a = m; } }
      else { let bestC = Infinity;
        for (const x of ment) for (const y of ment) { if (x === y) continue;
          const cf = cost(x, 'first'), ct = cost(y, 'top');
          const c = (isFinite(cf) ? cf : 60) + (isFinite(ct) ? ct : 60) + (x.i < y.i ? 0 : 5);   // 实在没有线索时，默认先说的是本科
          if (c < bestC) { bestC = c; a = x; b = y; } } }
      if (a) { F.first = a.tier; F.firstName = a.n; } if (b) { F.top = b.tier; F.topName = b.n; }
    }
    if (!F.top && F.degree && F.degree !== 'ba' && /英国|美国|澳洲|澳大利亚|加拿大|海外|留学/.test(text)) F.top = 'qs200';
    // GPA
    const g = text.match(/(?:GPA|绩点|均分|平均分|加权)[^\d]{0,8}(\d{1,3}(?:\.\d{1,2})?)/i);
    if (g) { const v = parseFloat(g[1]); if (v > 0 && v <= 100) { F.gpa = v; F.scale = v <= 4.3 ? 4 : v <= 5 ? 5 : 100; } }
    // 专业：优先取和最高学历同一句里提到的
    const majorIn = t => { let mj = null, mi = -1; for (const k in MAJOR_KW) { const re = MAJOR_KW[k]; re.lastIndex = 0; let m; while ((m = re.exec(t))) { if (m.index > mi) { mi = m.index; mj = k; } } } return mj; };
    const topClause = text.split(/[，。；,;！!\n]/).filter(c => /硕士|研究生|读研|博士|[Mm]aster/.test(c)).map(majorIn).find(Boolean);
    const mj = (F.degree && F.degree !== 'ba' && topClause) || majorIn(text);
    if (mj) F.major = mj;
    // 实习
    const bigHit = BIG.filter(grp => grp.some(n => text.includes(n)));
    const seg = text.match(/([一二两三四五\d])\s*段[^。，,；]{0,8}实习/), cnt = (text.match(/实习/g) || []).length;
    if (/没有实习|没实习|无实习|没有任何实习|没做过实习/.test(text)) { F.big = 0; F.small = 0; }
    else if (bigHit.length || cnt) {
      const total = seg ? (CN[seg[1]] || parseInt(seg[1]) || cnt) : Math.max(cnt, bigHit.length);
      F.big = Math.min(3, bigHit.length); F.small = clamp(total - bigHit.length, 0, 3);
      if (F.small === 0 && /小公司|创业公司|初创|小厂|工作室/.test(text)) F.small = 1;
    }
    // 英语、奖项
    const ie = text.match(/雅思[^\d]{0,4}([5-9](?:\.\d)?)/), tf = text.match(/托福[^\d]{0,4}(\d{2,3})/), c6 = text.match(/六级[^\d]{0,4}(\d{3})?/);
    if (ie) F.eng = parseFloat(ie[1]) >= 7 ? 2 : 1; else if (tf) F.eng = parseInt(tf[1]) >= 100 ? 2 : 1; else if (c6) F.eng = c6[1] && parseInt(c6[1]) >= 600 ? 2 : 1;
    if (/国家奖学金|国奖|一等奖|顶会|SCI|专利|金牌|全国[^。，]{0,8}奖|发表[^。，]{0,10}论文/.test(text)) F.award = 2;
    else if (/奖学金|获奖|竞赛|比赛|挑战杯|数学建模|论文|学生会主席|部长/.test(text)) F.award = 1;
    // 方向关键词
    for (const k in BOOST_KW) if (BOOST_KW[k].test(text)) out.boosts.push(k);
    // 钱以外：看重的事、五年后、加班、家乡、想去的城市
    const vals = []; for (const k in VALUE_KW) if (VALUE_KW[k].test(text)) vals.push(k);
    if (vals.length) F.values = vals.slice(0, 3);
    for (const k in ASPIRE_KW) if (ASPIRE_KW[k].test(text)) { F.aspire = k; break; }
    if (/不想加班|不加班|准点下班|双休/.test(text)) F.otTol = 'low'; else if (/愿意加班|不怕加班|能吃苦|拼一把|年轻就该拼|卷一点/.test(text)) F.otTol = 'high';
    if (/出国|海外工作|外派|读博/.test(text) && !/不(?:想|打算)出国/.test(text)) F.abroad = true;
    if (/考公|考编|公务员|选调/.test(text) && !/不(?:想|打算)考公/.test(text)) F.gov = true;
    for (const hm of text.matchAll(/(?:我是|来自|老家(?:在|是)?|家(?:在|是)|家乡(?:在|是)?)\s*([一-龥]{2,5})/g)) {
      const prov = D.PROVINCES.find(p => hm[1].startsWith(p)) || Object.keys(CAPITAL).filter(c => hm[1].startsWith(c)).map(c => CAPITAL[c])[0];
      if (prov) { F.home = prov; break; } }
    const pc = []; for (const c of D.CITIES) { if (c.id === 'home') continue; if (new RegExp('(?:想去|想留在|留在|去|回|到)' + c.name + '(?:发展|工作|生活|定居)?').test(text)) pc.push(c.id); }
    if (/回老家|回家乡|回家发展/.test(text)) pc.push('home');
    if (pc.length) F.prefCities = pc;
    if (/我是(?:一[名个位])?男生|男孩子|本人男|小伙子/.test(text)) F.gender = 'm'; else if (/我是(?:一[名个位])?女生|女孩子|本人女|姑娘/.test(text)) F.gender = 'f';
    // 表达加分：讲够内容 +2，有量化成果 +1
    out.introBonus = (out.chars >= 150 ? 2 : out.chars >= 80 ? 1 : 0) + (/\d+\s*%|\d+\s*万|从[^。，]{0,8}到|提升了|增长了/.test(text) ? 1 : 0);
    for (const k in F) H[k] = true;
    return out;
  }
  const api = { parse, normalize };
  root.JBParser = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
