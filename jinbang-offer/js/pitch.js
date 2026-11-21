/* 金榜 · 音高估计：用自相关法估计一小段语音的基频（Hz），只用来给漫画挑主角形象。
 * 成年男声基频大多在 85–155 Hz，女声大多在 165–255 Hz，这里以 165 Hz 为界；会有判错的时候。 */
(function (root) {
  'use strict';
  /* 估计一帧（建议 1024–2048 个采样点）的基频；不是浊音或不确定时返回 0 */
  function f0(frame, sr) {
    const n = frame.length, minLag = Math.floor(sr / 400), maxLag = Math.min(n - 1, Math.floor(sr / 70));
    let mean = 0; for (let i = 0; i < n; i++) mean += frame[i]; mean /= n;
    let e0 = 0; for (let i = 0; i < n; i++) { const v = frame[i] - mean; e0 += v * v; }
    if (e0 / n < 1e-5) return 0;
    const corr = new Float32Array(maxLag + 1); let best = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0, e1 = 0, e2 = 0;
      for (let i = 0; i < n - lag; i++) { const a = frame[i] - mean, b = frame[i + lag] - mean; s += a * b; e1 += a * a; e2 += b * b; }
      const c = s / Math.sqrt(e1 * e2 + 1e-12); corr[lag] = c; if (c > best) best = c;
    }
    if (best < .5) return 0;
    // 取第一个接近最高峰的局部峰，避免把两倍周期当成基频
    for (let lag = minLag + 1; lag < maxLag; lag++) if (corr[lag] >= best * .9 && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) return sr / lag;
    return 0;
  }
  const median = a => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
  /* 由一串基频估计值给出 {f0, gender, frames}；有效帧太少时 gender 为 null */
  function summarize(list) { const v = list.filter(x => x > 0), m = median(v); return { f0: Math.round(m), frames: v.length, gender: v.length < 6 ? null : (m < 165 ? 'm' : 'f') }; }
  const api = { f0, summarize, median };
  root.JBPitch = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
