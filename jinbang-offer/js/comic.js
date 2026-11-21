/* 金榜 · 漫画主视觉：底图是 assets/comics/{情绪}_{城市档}_{性别}.svg（由 tools/make_comics.js 用代码绘制，低多边形风格，左侧留白给文字），
 * 上面叠加城市、岗位、数字和一句台词。想换成更精细的图，只要保持同名文件覆盖即可。 */
(function () {
  'use strict';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LINES = {
    up: x => [`${x.city.id === 'home' ? '家乡' : x.cityName}，我来了。`, '这张录用通知，是我自己挣来的。'],
    mid: () => ['大厂、国企、外企、回家……', '哪一边，才不会后悔？'],
    low: () => ['雨总会停的。', '回去把简历再改一版。'] };
  const yuan = v => (v < 0 ? '−' : '') + '¥' + Math.abs(Math.round(v / 100) * 100).toLocaleString('en-US');
  const k = v => (Math.round(v * 2) / 2).toString();

  /* el: 容器；x: 选中的去向；sc: 竞争力结果；gender: 'm' | 'f'；isBest: 是否就是最适合的那个；onGender: 切换主角回调 */
  function render(el, x, sc, gender, isBest, onGender) {
    const mood = sc.tier.mood, file = `assets/comics/${mood}_${x.city.bg}_${gender}.svg`;
    const say = LINES[mood](x);
    el.className = 'comic';
    el.innerHTML = `<img alt="${esc(sc.tier.name)}档的漫画：${mood === 'up' ? '意气风发' : mood === 'mid' ? '焦虑彷徨' : '失意落寞'}的应届生，背景是${esc(x.cityName)}" src="${file}">
      <div class="scrim"></div>
      <div class="txt"><div class="kicker">${isBest ? '最适合你的去向' : '你选中的去向'}</div>
        <div class="city${x.cityName.length > 3 ? ' long' : ''}">${esc(x.cityName)}</div>
        <div class="job"><span class="emp">${esc(x.emp.name)}</span>${esc(x.title)}</div>
        <div class="say">${say.map(esc).join('<br>')}</div></div>
      <div class="seal"><b>${esc(sc.tier.name)}</b><span>${sc.total} 分</span></div>
      <div class="stats">
        <div class="stat"><b>${k(x.lo)}–${k(x.hi)}<small>k</small></b><span>税前月薪（估算）</span></div>
        <div class="stat"><b>${x.ot}<small>小时</small></b><span>月加班</span></div>
        <div class="stat"><b>${Math.round(x.prob * 100)}<small>%</small></b><span>拿到这类 offer 的把握</span></div>
        <div class="stat"><b>${yuan(x.left)}</b><span>扣房租和开销后月结余</span></div></div>
      <button type="button" class="who" data-g="${gender === 'f' ? 'm' : 'f'}">主角换成${gender === 'f' ? '男生' : '女生'}</button>`;
    el.querySelector('img').addEventListener('error', () => { el.classList.add('noimg'); el.querySelector('img').remove(); });
    el.querySelector('.who').addEventListener('click', e => onGender(e.currentTarget.dataset.g));
  }
  window.JBComic = { render, yuan, k, esc };
})();
