/* 离线语音识别：SenseVoice-Small（sherpa-onnx WebAssembly），全部在浏览器本地运行。
 * 上游运行库（asr/ 下的 sherpa-onnx-*.js / .wasm）原样使用、未做修改：
 * 它本来要加载一个打包好的 .data 文件，这里用 getPreloadedPackage 钩子跳过，
 * 改为自己下载 model.int8.onnx 和 tokens.txt 后写进它的虚拟文件系统。 */
(function () {
  'use strict';
  const ASR = {
    ready: false, failed: null,
    onStatus: null,   // ({phase:'download'|'init'|'ready'|'error', progress:0..1, message})
    onPartial: null,  // (text) 录音过程中每识别完一小段回调一次，text 是这一段的文字
    onLevel: null,    // (0..1) 音量，用来画声波
    onStop: null,     // ({reason:'manual'|'timeout'|'error', text, voice:{f0, frames, gender}})
  };
  let recognizer = null, loading = null;
  const status = (phase, progress, message) => { try { ASR.onStatus && ASR.onStatus({ phase, progress, message }); } catch (e) {} };

  async function fetchBytes(url, onProgress) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`读取 ${url} 失败（HTTP ${res.status}）`);
    const total = +res.headers.get('content-length') || 0;
    if (!res.body || !total) return new Uint8Array(await res.arrayBuffer());
    const out = new Uint8Array(total); let got = 0; const reader = res.body.getReader();
    for (;;) { const { done, value } = await reader.read(); if (done) break; out.set(value, got); got += value.length; onProgress && onProgress(got / total); }
    return out;
  }
  /* 线上版：模型切成几块（GitHub 单文件不能超过 100 MB），下载后放进浏览器的缓存，下次打开不用再下 */
  async function cachedBytes(url, onProgress) {
    let cache = null; try { cache = window.caches ? await caches.open('jb-asr-v1') : null; } catch (e) {}
    if (cache) { try { const hit = await cache.match(url); if (hit) { const b = new Uint8Array(await hit.arrayBuffer()); onProgress && onProgress(1); return b; } } catch (e) {} }
    const bytes = await fetchBytes(url, onProgress);
    if (cache) { try { await cache.put(url, new Response(bytes.slice(0), { headers: { 'Content-Type': 'application/octet-stream' } })); } catch (e) {} }
    return bytes;
  }
  async function loadModel(base) {
    let man = null; try { const r = await fetch(base + 'model.manifest.json', { cache: 'no-cache' }); if (r.ok) man = await r.json(); } catch (e) {}
    if (!man || !man.parts) return fetchBytes(base + 'model.int8.onnx', p => status('download', p, '正在读取语音模型'));
    const out = new Uint8Array(man.size); let off = 0;
    for (const part of man.parts) { const b = await cachedBytes(base + part.name, p => status('download', (off + p * part.size) / man.size, '正在下载语音模型')); out.set(b, off); off += b.length; }
    if (off !== man.size) throw new Error('语音模型没有下载完整');
    return out;
  }
  const loadScript = src => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('加载脚本失败：' + src)); document.head.appendChild(s); });

  ASR.load = function (base) {
    base = base || 'asr/';
    if (loading) return loading;
    loading = (async () => {
      status('download', 0, '正在读取语音模型');
      const [model, tokens] = await Promise.all([
        loadModel(base),
        fetchBytes(base + 'tokens.txt')]);
      status('init', 1, '正在启动识别引擎');
      await new Promise((ok, bad) => {
        window.Module = {
          locateFile: p => base + p,
          getPreloadedPackage: () => new ArrayBuffer(1),          // 不去下载上游的 .data 包
          preRun: [() => {
            window.Module.FS_createDataFile('/', 'sense-voice.onnx', model, true, true, true);
            window.Module.FS_createDataFile('/', 'sv-tokens.txt', tokens, true, true, true);
          }],
          setStatus: () => {}, print: () => {}, printErr: () => {},
          onRuntimeInitialized: ok, onAbort: e => bad(new Error('识别引擎启动失败：' + e)),
        };
        loadScript(base + 'sherpa-onnx-asr.js').then(() => loadScript(base + 'sherpa-onnx-wasm-main-vad-asr.js')).catch(bad);
      });
      await new Promise(r => setTimeout(r, 30));
      recognizer = new OfflineRecognizer({ modelConfig: { debug: 0, tokens: './sv-tokens.txt',
        senseVoice: { model: './sense-voice.onnx', language: 'zh', useInverseTextNormalization: 1 } } }, window.Module); // eslint-disable-line no-undef
      ASR.ready = true; status('ready', 1, '语音识别就绪');
    })().catch(e => { ASR.failed = e; loading = null; status('error', 0, e.message || String(e)); throw e; });
    return loading;
  };

  /* 识别一段 16k 单声道 Float32 音频，返回文字 */
  ASR.transcribe = function (samples, sampleRate) {
    if (!recognizer) throw new Error('识别引擎还没准备好');
    const s = recognizer.createStream();
    try { s.acceptWaveform(sampleRate || 16000, samples); recognizer.decode(s); return (recognizer.getResult(s).text || '').trim(); }
    finally { s.free(); }
  };

  /* ---------- 录音：AudioWorklet 采集，按停顿切段，边录边出字 ---------- */
  const SR = 16000;
  let ctx = null, stream = null, node = null, src = null, recording = false, timer = null;
  let seg = [], segLen = 0, silence = 0, voiced = 0, allText = '', startedAt = 0, maxMs = 60000, pitches = [];
  function flush() {
    if (segLen < SR * 0.4 || voiced < SR * 0.2) { seg = []; segLen = 0; voiced = 0; return; }
    const buf = new Float32Array(segLen); let o = 0; for (const c of seg) { buf.set(c, o); o += c.length; }
    seg = []; segLen = 0; voiced = 0;
    let t = '';
    try { t = ASR.transcribe(buf, SR); } catch (e) { console.error(e); }
    if (t) { allText += t; ASR.onPartial && ASR.onPartial(t); }
  }
  function onChunk(chunk) {
    if (!recording) return;
    let sum = 0; for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i];
    const rms = Math.sqrt(sum / chunk.length);
    ASR.onLevel && ASR.onLevel(Math.min(1, rms * 9));
    const speaking = rms > 0.012;
    if (speaking) { silence = 0; voiced += chunk.length; if (window.JBPitch && pitches.length < 400) pitches.push(window.JBPitch.f0(chunk, SR)); } else silence += chunk.length;
    if (segLen === 0 && !speaking) return;                  // 段首的静音不要
    seg.push(chunk); segLen += chunk.length;
    if ((silence > SR * 0.55 && segLen > SR * 1.2) || segLen > SR * 18) flush();
  }
  ASR.elapsed = () => recording ? Date.now() - startedAt : 0;
  ASR.isRecording = () => recording;
  ASR.start = async function (opts) {
    if (recording) return;
    if (!ASR.ready) throw new Error('语音模型还没加载好');
    maxMs = (opts && opts.maxMs) || 60000;
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR });
    await ctx.audioWorklet.addModule('js/asr-worklet.js');
    src = ctx.createMediaStreamSource(stream);
    node = new AudioWorkletNode(ctx, 'jb-capture');
    node.port.onmessage = e => onChunk(e.data);
    src.connect(node);
    seg = []; segLen = 0; silence = 0; voiced = 0; allText = ''; pitches = []; recording = true; startedAt = Date.now();
    timer = setInterval(() => { if (Date.now() - startedAt >= maxMs) ASR.stop('timeout'); }, 200);
  };
  ASR.stop = function (reason) {
    if (!recording) return allText;
    recording = false; clearInterval(timer); timer = null;
    try { src && src.disconnect(); node && node.port.close(); stream && stream.getTracks().forEach(t => t.stop()); ctx && ctx.close(); } catch (e) {}
    flush();
    const text = allText;
    ASR.onLevel && ASR.onLevel(0);
    const voice = window.JBPitch ? window.JBPitch.summarize(pitches) : { f0: 0, frames: 0, gender: null };   // 音高只用来给漫画挑主角
    ASR.onStop && ASR.onStop({ reason: reason || 'manual', text, voice });
    return text;
  };
  window.JBASR = ASR;
})();
