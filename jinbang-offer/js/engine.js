/* 金榜 · 打分与匹配引擎（纯函数，不碰页面，可用 node 测试） */
(function (root) {
  'use strict';
  const D = root.JBData || require('./data.js'), SCH = root.JBSchools || require('./schools.js');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const E = {};

  /* 竞争力总分 0–100 */
  E.score = function (p) {
    const bf = SCH.bonus(p.firstName, p.major), bt = SCH.bonus(p.degree === 'ba' ? p.firstName : p.topName, p.major);   // 行业名校、专业对口
    const f = Math.min(20, D.byId(D.TIERS, p.first).pts + bf), t = Math.min(20, D.byId(D.TIERS, p.degree === 'ba' ? p.first : p.top).pts + bt);
    const school = p.degree === 'ba' ? f * 2 : f * .8 + t * 1.2;
    const deg = { ba: 0, ma: 6, phd: 8 }[p.degree];
    const ratio = p.gpa > 0 ? p.gpa / p.scale : 0;
    const gpa = clamp((ratio - .65) / .25, 0, 1) * 10;
    const major = D.byId(D.MAJORS, p.major).heat;
    const intern = Math.min(22, [0, 10, 16, 19][Math.min(3, p.big)] + [0, 4, 6, 7][Math.min(3, p.small)]);
    const extra = Math.min(8, p.eng * 2 + p.award * 2), intro = Math.min(3, p.introBonus || 0);
    const parts = [
      { label: '院校', val: school, max: 40 }, { label: '学历层次', val: deg, max: 8 }, { label: '成绩', val: gpa, max: 10 },
      { label: '专业热度', val: major, max: 12 }, { label: '实习', val: intern, max: 22 }, { label: '英语与奖项', val: extra, max: 8 }];
    const total = clamp(Math.round(school + deg + gpa + major + intern + extra + intro), 0, 100);
    return { total, parts, intro, specialty: bf > 0 || bt > 0, tier: D.TIER_LEVELS.find(l => total >= l.min) };
  };

  E.net = k => k * 1000 * clamp(.83 - .0025 * k, .70, .82);   // 税后到手的粗略估算
  const PRESS = ['轻松', '适中', '偏高', '高压', '爆肝'];

  /* 离家远近 0–1 */
  E.proximity = function (city, home) {
    if (!home) return city.id === 'home' ? .7 : .5;
    if (city.id === 'home' || city.prov === home) return 1;
    return D.regionOf(city.prov) === D.regionOf(home) ? .6 : .15;
  };

  /* 把选填项变成各项价值的权重 */
  E.weights = function (p) {
    const w = Object.assign({}, D.BASE_W);
    (p.values || []).forEach(v => { if (v in w) w[v] += 1.3; });
    const asp = D.byId(D.ASPIRE, p.aspire || '');
    if (asp) for (const k in asp.w) w[k] += asp.w[k];
    if (p.otTol === 'low') w.wlb += 1.2; else if (p.otTol === 'high') { w.wlb = Math.max(.1, w.wlb - .35); w.income += .3; w.growth += .3; }
    if (p.abroad) w.intl += .8;
    if (p.gov) { w.stable += .8; w.home += .3; }
    return w;
  };

  /* 枚举 城市 × 岗位 × 雇主类型，返回每座城市的最佳选项、三条路线、雇主类型对比 */
  E.evaluate = function (p) {
    const sc = E.score(p), s = sc.total;
    const degMult = { ba: 1, ma: 1.2, phd: 1.5 }[p.degree];
    const w = E.weights(p), wSum = Object.values(w).reduce((a, b) => a + b, 0);
    const asp = D.byId(D.ASPIRE, p.aspire || '') || {};
    const boosts = p.boosts instanceof Set ? p.boosts : new Set(p.boosts || []);
    const prefC = new Set(p.prefCities || []);
    const all = [];
    for (const c of D.CITIES) {
      const cands = [];
      for (const j of D.JOBS) {
        let fit = (j.fit[p.major] != null ? j.fit[p.major] : (j.dfit != null ? j.dfit : .15));
        const liked = boosts.has(j.id) || p.intent === j.id;
        if (boosts.has(j.id)) fit += .35;
        if (p.intent === j.id) fit += .45;
        fit = Math.min(fit, 1.3);
        const has = c.strong.includes(j.id);
        const emps = j.fixed ? [Object.assign({ sal: 1, ot: 1, thr: 0, fixed: true }, j.fixed)] : j.emp.map(id => D.byId(D.EMPLOYERS, id));
        for (const e of emps) {
          const avail = c.avail[e.id] != null ? c.avail[e.id] : .5;
          let thr = j.min + c.compet + (has ? 0 : 8) + e.thr + (1 - avail) * 10;
          if (e.id === 'foreign') thr += p.eng === 0 ? 8 : p.eng === 2 ? -3 : 0;
          const prob = 1 / (1 + Math.exp(-(s - thr) / 7));
          const salary = Math.max(4.2 * Math.sqrt(c.coef), j.base * Math.pow(c.coef, j.cexp) * degMult * Math.max(.65, 1 + j.e * (s - 60) / 100) * (has ? 1 : .88) * e.sal);
          const ot = Math.round(j.ot * c.otF * e.ot * (s >= 80 && e.id === 'big' ? 1.05 : 1) / 5) * 5;
          const net = E.net(salary), left = net - c.rent - c.life;
          const v = fit * fit * prob * (has ? 1 : .2) * (.3 + .7 * avail) * Math.sqrt(salary);
          cands.push({ city: c, job: j, emp: e, fit, liked, has, prob, salary, ot, net, left, v, avail });
        }
      }
      const vmax = Math.max(...cands.map(x => x.v));
      all.push(...cands.filter(x => x.v >= vmax * .5));
    }
    const lefts = all.map(x => x.left), lo = Math.min(...lefts), hi = Math.max(...lefts);
    for (const x of all) {
      const c = x.city, e = x.emp;
      x.vals = {
        growth: e.growth * (.55 + .45 * c.opp), income: hi === lo ? .5 : (x.left - lo) / (hi - lo), stable: e.stable, wlb: clamp(1 - x.ot / 75, 0, 1),
        fame: e.fame * (.7 + .3 * c.opp), intl: clamp(.65 * e.intl + .35 * c.intl + (x.job.intl || 0), 0, 1), home: E.proximity(c, p.home), house: c.house, fun: c.fun, fit: Math.min(x.fit, 1) };
      let u = 0; for (const k in w) u += w[k] * x.vals[k]; u /= wSum;
      let bonus = (x.liked ? .12 : 0) + (prefC.has(c.id) ? .1 : 0) + ((asp.emp && asp.emp[e.id]) || 0) + (p.gov && e.id === 'soe' ? .05 : 0) + (p.abroad && e.id === 'foreign' ? .05 : 0);
      if (p.otTol === 'low' && x.ot > 40) bonus -= .08;
      x.total = .44 * u + .22 * x.prob + .12 * Math.min(x.fit, 1) + .12 * x.avail * (x.has ? 1 : .5) + .06 * c.opp + bonus;
      x.match = clamp(Math.round(100 * x.total / 1.12), 1, 98);
      x.rentRatio = c.rent / x.net;
      const pr = .5 * clamp(x.ot / 80, 0, 1) + .3 * clamp((x.rentRatio - .12) / .33, 0, 1) + .2 * (1 - x.prob);
      x.pi = pr < .25 ? 0 : pr < .4 ? 1 : pr < .55 ? 2 : pr < .7 ? 3 : 4; x.pressure = PRESS[x.pi];
      x.title = (x.job.t && x.job.t[c.id]) || x.job.name;
      x.cityName = c.id === 'home' && p.home ? p.home + '小城' : c.name;
      x.lo = Math.round(x.salary * .9 * 2) / 2; x.hi = Math.round(x.salary * 1.12 * 2) / 2;
    }
    const best = arr => arr.reduce((a, b) => (b.total > a.total ? b : a));
    const rows = D.CITIES.map(c => best(all.filter(x => x.city === c))).sort((a, b) => b.total - a.total);
    // 三条路线
    const ok = all.filter(x => x.prob >= .4), pool = ok.length ? ok : all;
    const pick = (arr, f) => arr.reduce((a, b) => (f(b) > f(a) ? b : a));
    const routes = [
      { id: 'money', name: '搞钱线', hint: '月结余最高', opt: pick(pool, x => x.left * Math.sqrt(x.prob) * Math.min(x.fit, 1)) },
      { id: 'relax', name: '松弛线', hint: '加班最少', opt: pick(pool, x => -x.ot * 1000 + x.left) },
      { id: 'steady', name: '安稳线', hint: '最稳定、离家最近', opt: pick(pool, x => (x.emp.stable * .6 + x.vals.home * .4) * Math.sqrt(x.prob) * 1e6 + x.left) }];
    // 每类雇主在全国范围内的最好选项
    const employers = D.EMPLOYERS.map(e => { const arr = all.filter(x => x.emp.id === e.id); return arr.length ? { emp: e, opt: best(arr) } : { emp: e, opt: null }; });
    return { score: sc, rows, routes, employers, weights: w, all };
  };

  /* 提升建议：只列改得动的项，看各能加多少分 */
  E.advice = function (p) {
    const base = E.score(p), out = [];
    const tryIt = (label, patch) => { const q = Object.assign({}, p, patch), sc = E.score(q), d = sc.total - base.total; if (d > 0) out.push({ label, delta: d, tier: sc.tier.name !== base.tier.name ? sc.tier.name : null }); };
    if (p.big < 3) tryIt('再补一段大厂实习', { big: p.big + 1 });
    if (p.small < 3) tryIt('再补一段小厂实习', { small: p.small + 1 });
    if (p.eng < 2) tryIt(p.eng === 0 ? '把六级或雅思 6 考下来' : '把雅思刷到 7 或托福 100', { eng: p.eng + 1 });
    if (p.award < 2) tryIt(p.award === 0 ? '拿一个校级奖学金或竞赛奖' : '冲一个国家级奖项或发一篇论文', { award: p.award + 1 });
    if (p.gpa > 0 && p.gpa / p.scale < .9) tryIt('把均分再提 5%', { gpa: Math.min(p.scale, p.gpa + p.scale * .05) });
    if ((p.introBonus || 0) < 3) tryIt('自我介绍讲满一分钟，并带上一个量化成果', { introBonus: 3 });
    return out.sort((a, b) => b.delta - a.delta).slice(0, 4);
  };

  root.JBEngine = E;
  if (typeof module !== 'undefined') module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
