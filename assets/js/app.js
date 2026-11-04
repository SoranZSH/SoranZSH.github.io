'use strict';
/*
 * 站点交互。所有逻辑都限定在 root 范围内，便于：
 *  1) 正常页面：root = document
 *  2) 单文件离线版：每次切换页面后重新 init(document)
 *  3) PDF 打印版：多个页面拼在一起，每页一个 root，并以 print 模式渲染（展开所有内容）
 */
(function () {
  const $ = (root, sel) => root.querySelector(sel);
  const $$ = (root, sel) => [...root.querySelectorAll(sel)];
  const readJSON = (root, sel) => { const el = $(root, sel); if (!el) return null; try { return JSON.parse(el.textContent); } catch (e) { return null; } };

  const cleanups = new WeakMap();
  const onCleanup = (root, fn) => cleanups.get(root)?.push(fn);

  /* ---------- 快速导航弹窗（文档级快捷键只绑定一次） ---------- */
  function initDialog(root) {
    const dialog = $(root, '#command-dialog');
    if (!dialog) return;
    $$(root, '.command-open').forEach(b => b.addEventListener('click', () => dialog.showModal()));
    dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
    dialog.querySelectorAll('a').forEach(a => a.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('click', ev => {
      if (ev.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) dialog.close();
    });
  }
  if (!window.__siteKeysBound) {
    window.__siteKeysBound = true;
    document.addEventListener('keydown', ev => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
        const d = document.querySelector('#command-dialog');
        if (!d) return;
        ev.preventDefault();
        d.open ? d.close() : d.showModal();
      }
    });
  }

  /* ---------- 流程标签：数据来自页面内 <script type="application/json" id="stage-data"> ---------- */
  function initStages(root, print) {
    const stages = readJSON(root, '#stage-data');
    const box = $(root, '.pipeline');
    if (!stages || !box) return;
    if (print) {
      box.innerHTML = stages.map((s, i) =>
        `<div class="stage-print"><span class="mono">${String(i + 1).padStart(2, '0')} · ${s.kind}</span><h3>${s.title}</h3><p>${s.copy}</p><div class="contract"><span>OUTPUT</span><code>${s.output}</code></div></div>`).join('');
      return;
    }
    const buttons = $$(box, '[data-stage]');
    const fill = (id, v) => { const el = $(box, '#' + id); if (el) el.textContent = v; };
    function select(i, focus) {
      buttons.forEach((b, j) => { b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; });
      const s = stages[i];
      fill('stage-kind', s.kind); fill('stage-title', s.title); fill('stage-copy', s.copy); fill('stage-output', s.output);
      $(box, '#stage-panel')?.setAttribute('aria-labelledby', 'stage-tab-' + i);
      if (focus) buttons[i].focus();
    }
    const n = buttons.length;
    buttons.forEach((b, i) => {
      b.addEventListener('click', () => select(i));
      b.addEventListener('keydown', ev => {
        let k = i;
        if (ev.key === 'ArrowRight') k = (i + 1) % n;
        else if (ev.key === 'ArrowLeft') k = (i + n - 1) % n;
        else if (ev.key === 'Home') k = 0;
        else if (ev.key === 'End') k = n - 1;
        else return;
        ev.preventDefault(); select(k, true);
      });
    });
    select(0);
  }

  /* ---------- 学习回路：90 秒练习演示 ---------- */
  function initPractice(root, print) {
    const timerEl = $(root, '#timer');
    if (!timerEl) return;
    const el = id => $(root, '#' + id);
    if (print) {
      el('answer-pane').hidden = false;
      el('done-pane').hidden = false;
      el('done-copy').textContent = '完成后可安排后续复习；完成一次行为不等于已经掌握。此处仅展示流程，不保存记录。';
      $$(root, '.demo-controls, #reset-demo').forEach(x => x.hidden = true);
      return;
    }
    let seconds = 90, ticker = null, running = false, endTime = 0;
    const stop = () => { clearInterval(ticker); ticker = null; running = false; };
    const draw = () => { timerEl.innerHTML = `${String(seconds).padStart(2, '0')}<span> SEC</span>`; };
    function reset() {
      stop(); seconds = 90; draw();
      el('recall-pane').hidden = false; el('answer-pane').hidden = true; el('done-pane').hidden = true;
      el('demo-phase').textContent = '01 — RECALL';
      el('start-timer').innerHTML = '开始 90 秒练习 <span>▷</span>';
      el('demo-status').textContent = '练习已重置。';
    }
    el('start-timer').addEventListener('click', () => {
      if (running) { seconds = Math.max(0, Math.ceil((endTime - Date.now()) / 1000)); stop(); el('start-timer').innerHTML = '继续练习 <span>▷</span>'; draw(); return; }
      if (seconds === 0) seconds = 90;
      running = true; endTime = Date.now() + seconds * 1000;
      el('start-timer').innerHTML = '暂停计时 <span>Ⅱ</span>';
      el('demo-status').textContent = '计时开始，不会录音。';
      ticker = setInterval(() => {
        seconds = Math.max(0, Math.ceil((endTime - Date.now()) / 1000)); draw();
        if (!seconds) { stop(); el('start-timer').innerHTML = '再练 90 秒 <span>↻</span>'; el('demo-status').textContent = '90 秒结束。可以揭晓参考思路。'; }
      }, 250);
    });
    el('reveal-answer').addEventListener('click', () => {
      stop(); el('recall-pane').hidden = true; el('answer-pane').hidden = false;
      el('demo-phase').textContent = '02 — REFLECT'; el('demo-status').textContent = '参考思路已展开。';
      el('complete-demo').focus({ preventScroll: true });
    });
    function finish(review) {
      stop(); el('answer-pane').hidden = true; el('done-pane').hidden = false;
      el('demo-phase').textContent = '03 — RETURN';
      el('done-title').textContent = review ? '没记住，也是有用的反馈。' : '你已走完一次练习流程。';
      el('done-copy').textContent = review
        ? '真实工具会将这道题安排到明天复习。此处为流程演示，不创建提醒、不保存记录。'
        : '真实工具会记录完成，并安排后续复习。完成是一次行为，不等于已经掌握；此处不保存记录。';
      el('demo-status').textContent = el('done-title').textContent;
      el('again-demo').focus({ preventScroll: true });
    }
    el('complete-demo').addEventListener('click', () => finish(false));
    el('review-demo').addEventListener('click', () => finish(true));
    el('reset-demo').addEventListener('click', reset);
    el('again-demo').addEventListener('click', () => { reset(); el('start-timer').focus({ preventScroll: true }); });
    window.addEventListener('pagehide', stop);
    onCleanup(root, () => { stop(); window.removeEventListener('pagehide', stop); });
  }

  /* ---------- 约会助理：规则回放（真实批次数据，按 v1.2 规则复算） ---------- */
  function initReplay(root, print) {
    const box = $(root, '#replay');
    const data = readJSON(root, '#replay-data');
    if (!box || !data) return;
    const list = $(box, '.replay-list');
    const summary = $(box, '.replay-summary');
    const tabs = $$(box, '[data-rule]');
    const label = { pass: '仍过线', venue: '降权后落线', gate: '闸门剔除' };
    function render(rule) {
      tabs.forEach(t => t.setAttribute('aria-pressed', String(t.dataset.rule === rule)));
      const v2 = rule === 'v12';
      let shown = 0;
      list.innerHTML = data.items.map(it => {
        const ok = v2 ? it.status === 'pass' : true;
        if (ok) shown++;
        const score = v2 && it.status === 'venue' ? `<s>${it.old.toFixed(1)}</s> ${it.new.toFixed(1)}` : it.old.toFixed(1);
        const badge = v2 ? `<span class="rp-badge rp-${it.status}">${label[it.status]}</span>` : '<span class="rp-badge rp-pass">推荐</span>';
        const why = v2 && it.reason ? `<span class="rp-why">${it.reason}</span>` : '';
        return `<li class="${ok ? (v2 && it.reason ? 'rp-unresolved' : '') : 'rp-out'}"><div class="rp-main"><strong>${it.title}</strong><span>${it.venue || '场地字段为空'} · ${it.cat}</span>${why}</div><div class="rp-score">${score}</div>${badge}</li>`;
      }).join('');
      summary.innerHTML = v2
        ? `新规则下仍有 <b>${shown}</b> / ${data.items.length} 条过线（不等于适合约会）：${data.counts.gate} 条被约会适配闸门剔除，${data.counts.venue} 条因社区场地 ×0.8 落到 68 分线以下。`
        : `旧规则（rubric v1.1.0）下，这一批 ${data.items.length} 条全部达到 68 分推荐线。`;
    }
    if (print) {
      tabs.forEach(t => t.hidden = true);
      list.insertAdjacentHTML('beforebegin', '<p class="mono rp-print-note">以下为 v1.2 规则复算结果（划线为旧分）</p>');
      render('v12');
      return;
    }
    tabs.forEach(t => t.addEventListener('click', () => render(t.dataset.rule)));
    render('v11');
  }

  /* ---------- 案例目录高亮 ---------- */
  function initToc(root) {
    const links = $$(root, '.case-toc a');
    if (!links.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      for (const en of entries) if (en.isIntersecting) links.forEach(a => a.classList.toggle('current', a.hash === '#' + en.target.id));
    }, { rootMargin: '-10% 0px -55% 0px' });
    links.forEach(a => { const s = root.querySelector(a.hash); if (s) io.observe(s); });
    onCleanup(root, () => io.disconnect());
  }

  // Set this URL after the independent Armillary website is published.
  // Empty values preserve the disabled grey button in every entry point.
  const projectURLs = { armillary: '' };
  function initProjectLinks(root) {
    $$(root, '[data-project-link]').forEach(button => {
      const url = projectURLs[button.dataset.projectLink];
      if (!url || !/^https:\/\//.test(url)) return;
      const link = document.createElement('a');
      link.className = 'button outline';
      link.href = url;
      link.textContent = '访问独立网站 ↗';
      link.target = '_blank';
      link.rel = 'noopener';
      button.replaceWith(link);
    });
  }
  const escapeText = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function relationMarkup(item) {
    const path = item.path.length
      ? `<ol class="dependency-path">${item.path.map(name => `<li>${escapeText(name)}</li>`).join('')}</ol>`
      : '<div class="empty-path">当前快照未收录路径</div>';
    return `<h3>${escapeText(item.pair)}</h3>${path}<p class="relation-conclusion">${escapeText(item.conclusion)}</p><p>${escapeText(item.note)}</p>`;
  }
  function initRelations(root, print) {
    const box = $(root, '#relation-demo');
    const data = readJSON(root, '#relation-data');
    if (!box || !data) return;
    if (print) {
      $(box, '.choice-row').remove();
      $(box, '.relation-output').innerHTML = data.map(item => `<article class="print-event">${relationMarkup(item)}</article>`).join('');
      return;
    }
    const buttons = $$(box, '[data-relation]');
    const select = index => {
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
      $(box, '.relation-output').innerHTML = relationMarkup(data[index]);
    };
    buttons.forEach((button, i) => button.addEventListener('click', () => select(i)));
    select(0);
  }

  function dayMarkup(item, blocked) {
    if (blocked) return `<p class="event-type">这次继续等</p><h3>${escapeText(item.time)} · 场景 ${escapeText(item.scene)}</h3><p class="event-reason">${escapeText(item.reason)}</p><p>这是模拟日志保留的一条候选提醒暂缓记录。</p>`;
    return `<p class="event-type">场景 ${escapeText(item.scene)} / ${escapeText(item.state)}</p><h3>${escapeText(item.time)} · ${escapeText(item.scene_name)}</h3><blockquote class="mom-line">${escapeText(item.line)}</blockquote><dl class="ledger-values"><div><dt>饮水账</dt><dd>${item.water}<small> 有效分钟</small></dd></div><div><dt>久坐账</dt><dd>${item.sitting}<small> 有效分钟</small></dd></div></dl><p class="event-reason">出现依据 · ${escapeText(item.basis)}</p><p class="event-outcome">模拟中的后续记录 · ${escapeText(item.outcome)}${item.outcome_how ? '（'+escapeText(item.outcome_how)+'）' : ''}</p>`;
  }
  function initDay(root, print) {
    const box = $(root, '#day-demo');
    const data = readJSON(root, '#day-data');
    if (!box || !data) return;
    const output = $(box, '.day-output');
    const events = $(box, '.day-events');
    if (print) {
      $(box, '.choice-row').remove();
      events.remove();
      output.innerHTML = data.flashes.map(item => `<article class="print-event">${dayMarkup(item, false)}</article>`).join('') +
        '<article class="print-event"><h3>暂缓记录汇总</h3><ul>' + Object.entries(data.summary.blocked_by).map(([reason,count]) => `<li>${escapeText(reason)} · ${count} 条</li>`).join('') + '</ul><p>记录已按原因与时间去重。</p></article>';
      return;
    }
    let mode = 'shown';
    function setMode(next) {
      mode = next;
      const blocked = mode === 'blocked';
      const items = blocked ? data.blocked : data.flashes;
      $$(box, '[data-day-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.dayMode === mode)));
      events.replaceChildren();
      const buttons = items.map((item, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = item.time;
        button.setAttribute('aria-label', `${item.time} ${blocked ? item.reason : item.scene_name}`);
        button.addEventListener('click', () => select(i));
        button.addEventListener('keydown', event => {
          let target = i;
          if (event.key === 'ArrowRight') target = (i + 1) % items.length;
          else if (event.key === 'ArrowLeft') target = (i + items.length - 1) % items.length;
          else if (event.key === 'Home') target = 0;
          else if (event.key === 'End') target = items.length - 1;
          else return;
          event.preventDefault();
          select(target);
          buttons[target].focus();
        });
        events.appendChild(button);
        return button;
      });
      function select(i) {
        buttons.forEach((button,j) => button.setAttribute('aria-pressed', String(j === i)));
        output.innerHTML = dayMarkup(items[i], blocked);
      }
      select(0);
    }
    $$(box, '[data-day-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.dayMode)));
    setMode('shown');
  }

  function init(root, opts) {
    root = root || document;
    (cleanups.get(root) || []).forEach(fn => fn());
    cleanups.set(root, []);
    const print = !!(opts && opts.print);
    if (!print) initDialog(root);
    initStages(root, print);
    initPractice(root, print);
    initReplay(root, print);
    initProjectLinks(root);
    initRelations(root, print);
    initDay(root, print);
    if (!print) initToc(root);
    if (print) $$(root, 'details').forEach(d => d.open = true);
  }

  window.SiteApp = { init };
  if (!window.__SITE_MANUAL_INIT__) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init(document));
    else init(document);
  }
})();

