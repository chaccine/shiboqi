'use strict';
// UI 绑定、rAF 循环、噪声 / 滤波、localStorage 持久化。

(function () {
  const canvas = document.getElementById('scope');
  const ctx = canvas.getContext('2d');

  const TIMEBASES = [0.5, 1, 2, 5, 10, 20, 50, 100, 200]; // ms/div
  const VOLTS = [0.5, 1, 2];
  const FS = 20000;
  const DT = 1 / FS;
  const RC = 0.002;
  const N = 16384;

  const state = {
    mode: 'yt',
    timebase: 5,
    voltsDiv: 1,
    trigger: 0,
    noise: 0,       // 0=关，σ = 0.15 × noise
    filter: false,
    running: true,
    ch1: { wave: 'sine', freq: 50, amp: 2, vdc: 0, duty: 50, on: true },
    ch2: { wave: 'sine', freq: 50, amp: 2, vdc: 0, duty: 50, phase: 90, on: true },
  };

  const buf1 = new SampleBuffer(N);
  const buf2 = new SampleBuffer(N);
  const lp1 = new LowPass(RC);
  const lp2 = new LowPass(RC);
  let simTime = 0;

  // ---------- localStorage ----------
  const PREFIX = 'shiboqi-';

  function saveState() {
    try { localStorage.setItem(PREFIX + 'state', JSON.stringify(state)); } catch (e) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(PREFIX + 'state');
      if (!raw) return;
      const s = JSON.parse(raw);
      for (const k of Object.keys(state)) {
        if (s[k] === undefined) continue;
        if (typeof state[k] === 'object' && state[k] !== null && typeof s[k] === 'object') {
          Object.assign(state[k], s[k]);
        } else {
          state[k] = s[k];
        }
      }
    } catch (e) {}
  }

  // ---------- 高斯近似噪声 ----------
  function randn() {
    let s = 0;
    for (let i = 0; i < 12; i++) s += Math.random();
    return s - 6;
  }

  // ---------- 采样 ----------
  function advanceAndSample() {
    const winSec = 10 * state.timebase / 1000;
    const count = Math.min(N, Math.max(64, Math.round(winSec * FS)));
    const ph2 = state.ch2.phase * Math.PI / 180;
    for (let i = 0; i < count; i++) {
      let v1 = wave(state.ch1.wave, simTime, state.ch1.freq, state.ch1.amp, state.ch1.vdc, state.ch1.duty / 100, 0);
      let v2 = wave(state.ch2.wave, simTime, state.ch2.freq, state.ch2.amp, state.ch2.vdc, state.ch2.duty / 100, ph2);
      if (state.noise > 0) {
        const sigma = 0.15 * state.noise;
        v1 += randn() * sigma;
        v2 += randn() * sigma;
      }
      if (state.filter) {
        v1 = lp1.filter(v1, DT);
        v2 = lp2.filter(v2, DT);
      }
      buf1.push(v1);
      buf2.push(v2);
      simTime += DT;
    }
  }

  function visibleCount() {
    return Math.max(2, Math.round(10 * state.timebase / 1000 * FS));
  }

  /** YT：以最近上升沿为窗口起点的两通道片段 */
  function alignedForYT() {
    const s1 = buf1.samples(), s2 = buf2.samples();
    const count = visibleCount();
    let start;
    const edge = state.ch1.on
      ? findRisingEdge(s1, state.trigger, Math.max(0, s1.length - count))
      : -1;
    if (edge >= 0) start = edge;
    else start = Math.max(0, s1.length - count);
    const end = Math.min(s1.length, start + count);
    return { ch1: s1.slice(start, end), ch2: s2.slice(start, end) };
  }

  /** X-Y：取缓冲末尾一屏 */
  function xyData() {
    const s1 = buf1.samples(), s2 = buf2.samples();
    const n = Math.min(s1.length, s2.length, visibleCount());
    return { ch1: s1.slice(s1.length - n), ch2: s2.slice(s2.length - n) };
  }

  // ---------- 渲染 ----------
  function render() {
    const w = canvas.width, h = canvas.height;
    if (state.mode === 'yt') {
      const a = alignedForYT();
      drawYT(ctx, w, h, a.ch1, a.ch2, state.voltsDiv, state.trigger, state.ch1.on, state.ch2.on);
    } else {
      const d = xyData();
      drawXY(ctx, w, h, d.ch1, d.ch2, state.voltsDiv);
    }
  }

  // ---------- 测量 ----------
  function fmtFreq(f) {
    if (f === null || !isFinite(f)) return '—';
    if (f >= 1000) return (f / 1000).toFixed(2) + ' kHz';
    return f.toFixed(1) + ' Hz';
  }
  function fmtTime(t) {
    if (t === null || !isFinite(t)) return '—';
    if (t >= 1) return t.toFixed(3) + ' s';
    if (t >= 1e-3) return (t * 1e3).toFixed(2) + ' ms';
    return (t * 1e6).toFixed(1) + ' μs';
  }

  function updateMeasures() {
    const view = alignedForYT();
    const samples = state.ch1.on ? view.ch1 : view.ch2;
    const f = freqEstimate(samples, DT, state.trigger);
    document.getElementById('mFreq').textContent = fmtFreq(f);
    document.getElementById('mPeriod').textContent = f ? fmtTime(1 / f) : '—';
    document.getElementById('mVpp').textContent = samples.length ? vpp(samples).toFixed(2) + ' V' : '—';
    document.getElementById('mVrms').textContent = samples.length ? vrms(samples).toFixed(2) + ' V' : '—';
  }

  // ---------- rAF ----------
  let lastMeasure = 0;
  function loop(ts) {
    if (state.running) {
      advanceAndSample();
      render();
      if (ts - lastMeasure > 250) {
        updateMeasures();
        lastMeasure = ts;
      }
    }
    requestAnimationFrame(loop);
  }

  // ---------- UI ----------
  const $ = (id) => document.getElementById(id);

  function sliderFreqFromIndex(i) {
    return Math.max(1, Math.round(Math.pow(10, i / 1000 * Math.log10(5000))));
  }
  function indexFromFreq(f) {
    return Math.round(Math.log10(Math.max(1, f)) / Math.log10(5000) * 1000);
  }

  function bindToggle(id, get, set) {
    $(id).addEventListener('click', () => { set(!get()); refreshUI(); saveState(); });
  }

  function refreshUI() {
    document.querySelectorAll('#modePills .pill').forEach(p => {
      p.classList.toggle('active', p.dataset.mode === state.mode);
    });
    const tb = TIMEBASES.indexOf(state.timebase);
    $('timebase').value = String(tb >= 0 ? tb : 3);
    $('timebaseVal').textContent =
      (state.timebase >= 1 ? state.timebase : state.timebase.toFixed(1)) + ' ms/div';
    const vd = VOLTS.indexOf(state.voltsDiv);
    $('voltsdiv').value = String(vd >= 0 ? vd : 1);
    $('voltsdivVal').textContent = state.voltsDiv + ' V/div';
    $('trigger').value = String(state.trigger);
    $('triggerVal').textContent = Number(state.trigger).toFixed(1) + ' V';
    $('noise').value = String(state.noise);
    $('noiseVal').textContent = state.noise > 0 ? (0.15 * state.noise).toFixed(2) + ' V' : '关';

    const fBtn = $('filterBtn');
    fBtn.classList.toggle('on', state.filter);
    fBtn.textContent = state.filter ? '开' : '关';
    const rBtn = $('runBtn');
    rBtn.classList.toggle('on', state.running);
    rBtn.textContent = state.running ? '运行中' : '已暂停';

    for (const p of ['ch1', 'ch2']) {
      const c = state[p];
      $(p + 'Wave').value = c.wave;
      const onBtn = $(p + 'On');
      onBtn.classList.toggle('on', c.on);
      onBtn.textContent = c.on ? '开' : '关';
      $(p + 'Freq').value = String(indexFromFreq(c.freq));
      $(p + 'FreqVal').textContent = c.freq + ' Hz';
      $(p + 'Amp').value = String(c.amp);
      $(p + 'AmpVal').textContent = Number(c.amp).toFixed(1) + ' V';
      $(p + 'Vdc').value = String(c.vdc);
      $(p + 'VdcVal').textContent = Number(c.vdc).toFixed(1) + ' V';
      $(p + 'Duty').value = String(c.duty);
      $(p + 'DutyVal').textContent = c.duty + '%';
      $(p + 'DutyRow').style.display = c.wave === 'square' ? '' : 'none';
    }
    $('ch2Phase').value = String(state.ch2.phase);
    $('ch2PhaseVal').textContent = state.ch2.phase + '°';

    $('rowTimebase').style.opacity = state.mode === 'xy' ? '0.4' : '1';
    $('timebase').disabled = state.mode === 'xy';
  }

  function wire() {
    document.querySelectorAll('#modePills .pill').forEach(p => {
      p.addEventListener('click', () => {
        state.mode = p.dataset.mode;
        buf1.reset(); buf2.reset();
        advanceAndSample();
        refreshUI(); saveState();
      });
    });

    $('timebase').addEventListener('input', e => {
      state.timebase = TIMEBASES[parseInt(e.target.value, 10)] || 5;
      refreshUI(); saveState();
    });
    $('voltsdiv').addEventListener('input', e => {
      state.voltsDiv = VOLTS[parseInt(e.target.value, 10)] || 1;
      refreshUI(); saveState();
    });
    $('trigger').addEventListener('input', e => {
      state.trigger = parseFloat(e.target.value);
      refreshUI(); saveState();
    });
    $('noise').addEventListener('input', e => {
      state.noise = parseFloat(e.target.value);
      refreshUI(); saveState();
    });
    bindToggle('filterBtn', () => state.filter, v => { state.filter = v; });
    bindToggle('runBtn', () => state.running, v => { state.running = v; });

    for (const p of ['ch1', 'ch2']) {
      $(p + 'Wave').addEventListener('change', e => {
        state[p].wave = e.target.value;
        refreshUI(); saveState();
      });
      bindToggle(p + 'On', () => state[p].on, v => { state[p].on = v; });
      $(p + 'Freq').addEventListener('input', e => {
        state[p].freq = sliderFreqFromIndex(parseFloat(e.target.value));
        refreshUI(); saveState();
      });
      $(p + 'Amp').addEventListener('input', e => {
        state[p].amp = parseFloat(e.target.value);
        refreshUI(); saveState();
      });
      $(p + 'Vdc').addEventListener('input', e => {
        state[p].vdc = parseFloat(e.target.value);
        refreshUI(); saveState();
      });
      $(p + 'Duty').addEventListener('input', e => {
        state[p].duty = parseInt(e.target.value, 10);
        refreshUI(); saveState();
      });
    }
    $('ch2Phase').addEventListener('input', e => {
      state.ch2.phase = parseFloat(e.target.value);
      refreshUI(); saveState();
    });

    $('helpBtn').addEventListener('click', () => {
      alert('玩法提示：\n· CH1 换方波 + 调占空比 → PWM\n· 切到 X-Y，两路同频相位 90° → 圆形李萨如\n· 开噪声再开低通滤波 → 毛刺被抹平\n\n所有设置自动保存在本机浏览器。');
    });
  }

  // ---------- 启动 ----------
  loadState();
  wire();
  refreshUI();
  advanceAndSample();
  render();
  updateMeasures();
  requestAnimationFrame(loop);
})();
