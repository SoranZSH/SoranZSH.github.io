/* 金榜 · 页面逻辑：开口（语音 / 文字）→ 核对（自动填充、可手改）→ 放榜 */
(function () {
  'use strict';
  const D = window.JBData, E = window.JBEngine, P = window.JBParser, SCH = window.JBSchools, ASR = window.JBASR, C = window.JBComic;
  const $ = id => document.getElementById(id), esc = C.esc;
  const EXAMPLE = '大家好，我叫小林，本科就读于一所普通一本的西班牙语专业，硕士在中山大学读市场营销，绩点3.5。我在字节跳动做过一段海外增长运营实习，也在一家跨境电商小公司做过拉美市场的投放，独立负责墨西哥站的社媒账号，三个月粉丝从零做到两万。我是湖南人，喜欢和不同文化的人打交道，希望毕业后做出海相关的工作，想去深圳发展。';
  const DEFAULTS = { gender: null, degree: 'ba', first: 'yiben', top: 'yiben', firstName: '', topName: '', major: 'biz', gpa: 3.3, scale: 4, big: 0, small: 0, eng: 1, award: 0,
    home: '', intent: '', aspire: '', values: [], otTol: 'mid', abroad: false, gov: false, prefCities: [] };
  const REQUIRED = ['degree', 'first', 'top', 'major', 'gpa', 'big', 'small', 'eng', 'award'];
  const st = { heard: {}, boosts: [], introBonus: 0, selected: null, revealed: false, llm: false, gender: 'f', voiceText: '', mode: 'voice' };
  try { st.gender = localStorage.getItem('jb-gender') || 'f'; } catch (e) {}
  const setGender = g => { if (g !== 'm' && g !== 'f') return; st.gender = g; try { localStorage.setItem('jb-gender', g); } catch (e) {} };

  /* ---------- 初始化表单选项 ---------- */
  const opts = (arr, f) => arr.map(x => `<option value="${x.id}">${esc(f ? f(x) : x.name)}</option>`).join('');
  $('first').innerHTML = $('top').innerHTML = opts(D.TIERS);
  $('major').innerHTML = opts(D.MAJORS);
  $('intent').innerHTML += opts(D.JOBS);
  $('home').innerHTML += D.PROVINCES.map(p => `<option value="${p}">${p}</option>`).join('');
  $('school-list').innerHTML = SCH.names().map(n => `<option value="${esc(n)}">`).join('');
  const chip = (type, name, v, label) => `<label class="chip"><input type="${type}" name="${name}" value="${v}">${esc(label)}</label>`;
  $('aspire').innerHTML = D.ASPIRE.map(a => chip('radio', 'aspire', a.id, a.name)).join('');
  $('values').innerHTML = D.VALUES.map(v => chip('checkbox', 'values', v.id, v.name)).join('');
  $('otTol').innerHTML = D.OT_TOL.map(o => chip('radio', 'otTol', o.id, o.name)).join('');
  $('prefCities').innerHTML = D.CITIES.map(c => chip('checkbox', 'prefCities', c.id, c.id === 'home' ? '回家乡' : c.name)).join('');

  const radio = n => { const el = document.querySelector(`input[name=${n}]:checked`); return el ? el.value : ''; };
  const setRadio = (n, v) => { const el = document.querySelector(`input[name=${n}][value="${v}"]`); if (el) el.checked = true; };
  const checks = n => [...document.querySelectorAll(`input[name=${n}]:checked`)].map(e => e.value);
  const setChecks = (n, arr) => document.querySelectorAll(`input[name=${n}]`).forEach(e => { e.checked = arr.includes(e.value); });

  function writeForm(f) {
    setRadio('degree', f.degree); $('first').value = f.first; $('top').value = f.top; $('firstName').value = f.firstName || ''; $('topName').value = f.topName || '';
    $('major').value = f.major; $('gpa').value = f.gpa; $('scale').value = String(f.scale);
    setRadio('big', Math.min(3, f.big)); setRadio('small', Math.min(3, f.small)); $('eng').value = String(f.eng); $('award').value = String(f.award);
    $('home').value = f.home || ''; $('intent').value = f.intent || ''; setRadio('aspire', f.aspire || ''); setChecks('values', f.values || []); setRadio('otTol', f.otTol || 'mid');
    $('abroad').checked = !!f.abroad; $('gov').checked = !!f.gov; setChecks('prefCities', f.prefCities || []);
    $('f-top').style.display = f.degree === 'ba' ? 'none' : '';
  }
  function readForm() {
    const degree = radio('degree') || 'ba';
    return { degree, first: $('first').value, top: degree === 'ba' ? $('first').value : $('top').value, firstName: $('firstName').value, topName: $('topName').value, major: $('major').value,
      gpa: parseFloat($('gpa').value) || 0, scale: parseFloat($('scale').value), big: +radio('big') || 0, small: +radio('small') || 0, eng: +$('eng').value, award: +$('award').value,
      home: $('home').value, intent: $('intent').value, aspire: radio('aspire'), values: checks('values'), otTol: radio('otTol') || 'mid', abroad: $('abroad').checked, gov: $('gov').checked,
      prefCities: checks('prefCities'), boosts: st.boosts, introBonus: st.introBonus };
  }
  function markHeard() {
    document.querySelectorAll('#fields .f').forEach(el => { const k = el.dataset.key; el.classList.toggle('heard', !!st.heard[k]); el.classList.toggle('guess', !st.heard[k]); });
    document.querySelectorAll('.fields.opt .f').forEach(el => { const k = el.dataset.key, h = k === 'plans' ? (st.heard.abroad || st.heard.gov) : st.heard[k]; el.classList.toggle('heard', !!h); });
  }
  function setStep(n) { document.querySelectorAll('#steps li').forEach(li => { const s = +li.dataset.step; li.classList.toggle('on', s === n); li.classList.toggle('done', s < n); }); }
  function show(id) { const el = $(id); el.hidden = false; setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); }

  /* ---------- 解析自我介绍 ---------- */
  function applyParsed(res, note) {
    const f = Object.assign({}, DEFAULTS, res.fields);
    if (f.degree === 'ba') f.top = f.first; else if (!res.fields.top && res.fields.first) f.top = res.fields.first;
    st.heard = Object.assign({}, res.heard); st.boosts = res.boosts || []; st.introBonus = res.introBonus || 0; st.selected = null;
    if (res.fields.gender) setGender(res.fields.gender);   // 文字里明说了男生 / 女生
    writeForm(f); markHeard();
    const miss = REQUIRED.filter(k => !st.heard[k] && !(k === 'top' && f.degree === 'ba')).length;
    $('pstatus').textContent = note || '';
    $('h2t').textContent = miss ? `我听到的是这些，还有 ${miss} 项没听到，请确认` : '我听到的是这些，不对的直接改';
    setStep(2); show('stage2');
    if (st.revealed) render();
  }
  async function parseNow(source) {
    const text = (source === 'voice' ? st.voiceText : $('intro').value).trim();
    if (text.replace(/\s/g, '').length < 6) { $('pstatus').textContent = '还没有内容：先说几句，或者切到文字输入粘贴一段自我介绍'; return; }
    const local = P.parse(text);
    applyParsed(local, `已识别 ${local.chars} 个字`);
    if (!st.llm) return;
    $('pstatus').textContent = '本地规则已解析，正在请大模型复核……';
    try {
      const r = await fetch('api/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const v = (await r.json()).fields || {}, F = Object.assign({}, local.fields), ok = (arr, id) => arr.some(x => x.id === id);
      if (['ba', 'ma', 'phd'].includes(v.degree)) F.degree = v.degree;
      if (ok(D.TIERS, v.first)) F.first = v.first; if (ok(D.TIERS, v.top)) F.top = v.top; if (ok(D.MAJORS, v.major)) F.major = v.major;
      if (typeof v.firstName === 'string' && v.firstName) F.firstName = v.firstName; if (typeof v.topName === 'string' && v.topName) F.topName = v.topName;
      if (typeof v.gpa === 'number' && v.gpa > 0) { F.gpa = v.gpa; F.scale = [4, 5, 100].includes(v.scale) ? v.scale : (v.gpa <= 4.3 ? 4 : v.gpa <= 5 ? 5 : 100); }
      for (const k of ['big', 'small']) if (Number.isInteger(v[k])) F[k] = Math.max(0, Math.min(3, v[k]));
      for (const k of ['eng', 'award']) if (Number.isInteger(v[k])) F[k] = Math.max(0, Math.min(2, v[k]));
      if (D.PROVINCES.includes(v.home)) F.home = v.home;
      if (Array.isArray(v.values)) { const vv = v.values.filter(x => ok(D.VALUES, x)).slice(0, 3); if (vv.length) F.values = vv; }
      if (ok(D.ASPIRE, v.aspire) && v.aspire) F.aspire = v.aspire;
      const boosts = Array.isArray(v.boosts) ? v.boosts.filter(b => ok(D.JOBS, b)) : [];
      const heard = {}; for (const k in F) heard[k] = true;
      applyParsed({ fields: F, heard, boosts: [...new Set([...local.boosts, ...boosts])], introBonus: local.introBonus, chars: local.chars }, '已由大模型复核');
    } catch (e) { $('pstatus').textContent = `已识别 ${local.chars} 个字（大模型复核没连上，用的是本地规则）`; }
  }
  $('parse').addEventListener('click', () => parseNow('text'));
  $('use-example').addEventListener('click', () => { setMode('text'); $('intro').value = EXAMPLE; parseNow('example'); });
  $('mode-voice').addEventListener('click', () => setMode('voice'));
  $('mode-text').addEventListener('click', () => setMode('text'));
  function setMode(m) {
    const text = m === 'text'; st.mode = m;
    if (text && ASR.isRecording()) ASR.stop('manual');
    $('voice-pane').hidden = text; $('text-pane').hidden = !text;
    $('mode-voice').setAttribute('aria-selected', String(!text)); $('mode-text').setAttribute('aria-selected', String(text));
    $('h1t').textContent = text ? '贴一段自我介绍，看看你的校招去向' : '说一分钟，看看你的校招去向';
    if (text) { if (!$('intro').value && st.voiceText) $('intro').value = st.voiceText; $('intro').focus(); }
  }

  /* ---------- 语音 ---------- */
  const RING = 490, MAX = 60000; let tick = null;
  ASR.onStatus = ({ phase, progress, message }) => {
    if (phase === 'download') { $('mic-s').textContent = '正在准备 ' + Math.round(progress * 100) + '%'; $('loadbar-i').style.width = (progress * 100) + '%'; $('mic-hint').textContent = LOCAL ? '正在读取本地语音模型（约 240 MB，只在本机运行，不上传）' : '正在下载语音模型（约 160 MB，只下载这一次；识别在你的浏览器里完成，录音不上传）'; }
    else if (phase === 'init') { $('mic-s').textContent = '马上就好'; $('mic-hint').textContent = '正在启动识别引擎……'; }
    else if (phase === 'ready') { $('mic').disabled = false; $('mic-s').textContent = '点麦克风开始'; $('mic-hint').textContent = '最多说一分钟，说完再点一下。'; $('loadbar').classList.add('hide'); }
    else if (phase === 'error') { $('loadbar').classList.add('hide'); $('mic-s').textContent = '语音暂时用不了'; $('mic-hint').textContent = '语音模型没加载成功（' + message + '），已切到文字输入。'; setMode('text'); }
  };
  ASR.onPartial = t => { st.voiceText += t; $('live').textContent = st.voiceText; };
  ASR.onLevel = v => $('mic').style.setProperty('--lv', v.toFixed(2));
  ASR.onStop = ({ reason, text, voice }) => {
    clearInterval(tick); tick = null; $('mic').classList.remove('rec'); $('mic-s').textContent = '点麦克风重新说'; $('ring').style.strokeDashoffset = RING;
    $('mic').setAttribute('aria-label', '开始说话');
    if (voice && voice.gender) setGender(voice.gender);   // 按音高挑漫画主角，结果页可以一键换
    if (!st.voiceText.trim()) { $('mic-hint').textContent = '没有听清内容。靠近麦克风再说一遍，或者切到文字输入。'; return; }
    $('mic-hint').textContent = reason === 'timeout' ? '一分钟到了，已经整理好，往下看。' : '收到，已经整理好，往下看。';
    $('intro').value = st.voiceText;
    parseNow('voice');
  };
  $('mic').addEventListener('click', async () => {
    if (!asrAsked) { asrAsked = true; $('mic').disabled = true; $('loadbar').classList.remove('hide'); ASR.load().catch(() => { asrAsked = false; }); return; }
    if (ASR.isRecording()) { $('mic-s').textContent = '正在识别最后一句'; setTimeout(() => ASR.stop('manual'), 20); return; }
    try {
      st.voiceText = ''; $('live').textContent = '';
      await ASR.start({ maxMs: MAX });
      $('mic').classList.add('rec'); $('mic').setAttribute('aria-label', '停止'); $('mic-hint').textContent = '正在听。学校、专业、实习、想去的城市、想过的生活，想到哪说到哪。';
      const upd = () => { const e = ASR.elapsed(); $('mic-s').textContent = '还剩 ' + Math.max(0, Math.ceil((MAX - e) / 1000)) + ' 秒 · 再点一下结束'; $('ring').style.strokeDashoffset = RING * (1 - Math.min(1, e / MAX)); };
      upd(); tick = setInterval(upd, 200);
    } catch (err) {
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      $('mic-hint').textContent = denied ? '没有拿到麦克风权限。在浏览器地址栏左侧允许麦克风后再点一次，或者切到文字输入。' : '麦克风没有启动（' + (err && err.message || err) + '）。可以切到文字输入。';
    }
  });
  /* 本机运行时直接加载模型；线上版等访客点了麦克风再下载（约 240 MB），手机默认用文字输入 */
  const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && !/[?&]hosted=1/.test(location.search);
  let asrAsked = LOCAL;
  if (LOCAL) { ASR.load().catch(() => {}); fetch('api/status').then(r => r.ok ? r.json() : {}).then(j => { st.llm = !!j.llm; }).catch(() => {}); }
  else {
    $('mic').disabled = false; $('loadbar').classList.add('hide'); $('mic-s').textContent = '点麦克风启用语音';
    $('mic-hint').textContent = '第一次用语音要下载约 160 MB 的识别模型（之后会缓存在浏览器里），建议连着 Wi-Fi；不想下载可以切到文字输入。';
    if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) setMode('text');
  }

  /* ---------- 核对：手改 ---------- */
  function onEdit(e) {
    const t = e.target, wrap = t.closest('.f');
    if (t.id === 'firstName' || t.id === 'topName') { const tier = SCH.lookup(t.value); if (tier) $(t.id === 'firstName' ? 'first' : 'top').value = tier; }
    if (t.name === 'values' && checks('values').length > 3) { t.checked = false; return; }
    if (t.name === 'degree') $('f-top').style.display = radio('degree') === 'ba' ? 'none' : '';
    if (t.id === 'ideal') { const r = P.parse('我的理想是' + t.value + '。').fields;   // 从一句话理想里再读一遍偏好
      if (r.values && !checks('values').length) setChecks('values', r.values); if (r.aspire && !radio('aspire')) setRadio('aspire', r.aspire);
      if (r.otTol) setRadio('otTol', r.otTol); if (r.abroad) $('abroad').checked = true; if (r.gov) $('gov').checked = true; }
    if (wrap) { wrap.classList.remove('guess'); }
    st.selected = null;
    if (st.revealed) render();
  }
  $('stage2').addEventListener('input', onEdit); $('stage2').addEventListener('change', onEdit);
  $('reveal').addEventListener('click', () => { st.revealed = true; st.selected = null; render(); setStep(3); show('stage3'); });
  $('again').addEventListener('click', () => { setStep(1); $('stage1').scrollIntoView({ behavior: 'smooth' }); });
  $('edit').addEventListener('click', () => { setStep(2); $('stage2').scrollIntoView({ behavior: 'smooth' }); });

  /* ---------- 放榜 ---------- */
  const key = x => `${x.city.id}|${x.job.id}|${x.emp.id}|${x.emp.name}`;
  const line = x => `${C.k(x.lo)}–${C.k(x.hi)}k · 月加班 ${x.ot} 小时 · 结余 ${C.yuan(x.left)}`;
  function render() {
    const p = readForm(), ev = E.evaluate(p), best = ev.rows[0];
    const sel = ev.all.find(x => key(x) === st.selected) || best, isBest = sel === best;
    C.render($('comic'), sel, ev.score, st.gender, isBest, g => { setGender(g); render(); });
    $('verdict').innerHTML = `${isBest ? '匹配到最适合你的去向是' : '你选中的去向是'} <b>${esc(sel.cityName)}</b>，去<b>${esc(sel.emp.name)}</b>做<b>${esc(sel.title)}</b>：月薪约 ${C.k(sel.lo)}–${C.k(sel.hi)}k，月加班约 ${sel.ot} 小时。${esc(sel.city.vibe)}`;
    // 为什么是这里：按你的权重从高到低列出这条路线的表现
    const w = ev.weights, picked = new Set(p.values), keys = Object.keys(w).sort((a, b) => w[b] - w[a]).slice(0, 6);
    const nm = k => (D.byId(D.VALUES, k) || {}).name || k;
    let why = keys.map(k => `<div class="vbar${picked.has(k) ? ' pick' : ''}"><span>${nm(k)}${picked.has(k) ? ' ★' : ''}</span><span class="t"><i style="width:${Math.round(sel.vals[k] * 100)}%"></i></span><span class="n">${Math.round(sel.vals[k] * 100)}</span></div>`).join('');
    const money = ev.routes[0].opt;
    why += `<p class="trade">${picked.size ? '带 ★ 的是你选的看重项，排在前面的在排序里权重更大；分数是在你够得着的选项之间相对比较。' : '你还没选看重的事，现在按多数应届生的默认权重排：收入和成长优先。'}` +
      (key(money) === key(sel) ? '这条也是结余最高的路线。' : `和搞钱线（${esc(money.cityName)} · ${esc(money.emp.name)}）相比，每月${money.left - sel.left >= 0 ? '少结余 ' + C.yuan(money.left - sel.left) : '多结余 ' + C.yuan(sel.left - money.left)}，${money.ot - sel.ot >= 0 ? '少加班 ' + (money.ot - sel.ot) : '多加班 ' + (sel.ot - money.ot)} 小时。`) +
      (p.home ? `离家：${sel.vals.home >= 1 ? '就在本省' : sel.vals.home >= .6 ? '同一片区，高铁可达' : '比较远'}。` : '') + '</p>';
    $('why').innerHTML = why;
    $('routes').innerHTML = ev.routes.map(r => `<button type="button" class="route" data-key="${esc(key(r.opt))}" aria-pressed="${key(r.opt) === key(sel)}"><span class="nm">${r.name}</span><span class="ln1">${esc(r.opt.cityName)} · ${esc(r.opt.emp.name)} · ${esc(r.opt.title)}</span><span class="ln2">${r.hint}：${line(r.opt)}</span></button>`).join('');
    $('employers').innerHTML = ev.employers.map(e => e.opt ? `<button type="button" class="emp-row" data-key="${esc(key(e.opt))}" aria-pressed="${key(e.opt) === key(sel)}"><span class="nm">${esc(e.emp.name)}</span><span class="t"><i style="width:${e.opt.match}%"></i></span><span class="n">${e.opt.match}</span><span class="d">最好的选择：${esc(e.opt.cityName)} · ${esc(e.opt.title)}，${line(e.opt)}。${esc(e.emp.note)}。</span></button>`
      : `<button type="button" class="emp-row" disabled><span class="nm">${esc(e.emp.name)}</span><span class="t"></span><span class="n">–</span><span class="d">按你现在的背景和专业，这类公司的校招岗位把握太低，没有进入候选。</span></button>`).join('');
    $('bars').innerHTML = ev.score.parts.map(x => `<div class="sbar"><span>${x.label}</span><span class="t"><i style="width:${Math.min(100, x.val / x.max * 100).toFixed(0)}%"></i></span><span class="n">${Math.round(x.val * 10) / 10} / ${x.max}</span></div>`).join('');
    $('tierline').innerHTML = `总分 <b>${ev.score.total}</b>，档位 <b>${ev.score.tier.name}</b>：${ev.score.tier.desc}。` + (ev.score.specialty ? '院校分里含行业名校、专业对口的加分。' : '') + (ev.score.intro ? `自我介绍的表达加了 ${ev.score.intro} 分。` : '');
    const adv = E.advice(p);
    $('advice').innerHTML = adv.length ? adv.map(a => `<li>${esc(a.label)}：<b>+${a.delta} 分</b>${a.tier ? `，档位升到${a.tier}` : ''}</li>`).join('') : '<li>能改的项已经接近满分了。</li>';
    $('rows').innerHTML = ev.rows.map((r, i) => `<button type="button" class="city-row" data-key="${esc(key(r))}" aria-pressed="${r.city === sel.city}">
      <span class="rk">${i + 1}</span><span class="cn">${esc(r.cityName)}</span><span class="jb"><em>${esc(r.emp.name)}</em>${esc(r.title)}</span>
      <span>${C.k(r.lo)}–${C.k(r.hi)}k</span><span>${r.ot}h</span><span class="${r.left < 0 ? 'neg' : ''}">${C.yuan(r.left)}</span>
      <span><span class="pill p${r.pi}">${r.pressure}</span></span><span class="m"><span class="t"><i style="width:${r.match}%"></i></span>${r.match}</span></button>`).join('');
  }
  $('stage3').addEventListener('click', e => { const b = e.target.closest('[data-key]'); if (!b) return; st.selected = b.dataset.key; render(); $('comic').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });

  writeForm(DEFAULTS);
  window.JBApp = { render, parseNow, state: st };   // 方便调试
})();
