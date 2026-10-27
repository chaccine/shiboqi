'use strict';
// 自动测量（纯函数）：Vpp / Vrms / 频率估计。

function vpp(samples) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] < lo) lo = samples[i];
    if (samples[i] > hi) hi = samples[i];
  }
  return samples.length ? hi - lo : 0;
}

function vrms(samples) {
  if (!samples.length) return 0;
  let s = 0;
  for (let i = 0; i < samples.length; i++) s += samples[i] * samples[i];
  return Math.sqrt(s / samples.length);
}

/**
 * 频率估计：统计相邻上升沿（低于 level → 高于 level）的索引间距，
 * 用平均间距除以采样间隔。样本太少或几乎直流返回 null。
 */
function freqEstimate(samples, dt, level) {
  const n = samples.length;
  if (n < 4 || !dt || dt <= 0) return null;
  const edges = [];
  for (let i = 1; i < n; i++) {
    if (samples[i - 1] < level && samples[i] >= level) edges.push(i);
  }
  if (edges.length < 2) return null;
  let sum = 0;
  for (let i = 1; i < edges.length; i++) sum += edges[i] - edges[i - 1];
  const meanGap = sum / (edges.length - 1);
  if (meanGap <= 0) return null;
  const f = 1 / (meanGap * dt);
  // 几乎直流的守门：极低频率不可信
  return isFinite(f) && f > 0 ? f : null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { vpp, vrms, freqEstimate };
}
