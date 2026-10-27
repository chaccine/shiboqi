'use strict';
// 采样缓冲、CH1 上升沿触发与 canvas 绘制辅助。

/** 定长环形采样缓冲。 */
function SampleBuffer(n) {
  this.n = n;
  this.buf = new Array(n);
  this.len = 0;
  this.head = 0;
}

SampleBuffer.prototype.reset = function () {
  this.len = 0;
  this.head = 0;
};

SampleBuffer.prototype.push = function (v) {
  this.buf[this.head] = v;
  this.head = (this.head + 1) % this.n;
  if (this.len < this.n) this.len++;
};

/** 从旧到新返回采样数组 */
SampleBuffer.prototype.samples = function () {
  const out = new Array(this.len);
  const start = (this.head - this.len + this.n) % this.n;
  for (let i = 0; i < this.len; i++) out[i] = this.buf[(start + i) % this.n];
  return out;
};

/**
 * 找 CH1 上升沿触发索引（低于 level → 高于 level）。
 * preferBefore：优先返回 ≤ 该索引的最近边沿，保证触发后还有足够采样可画满一屏。
 * 找不到返回 -1（自由滚动）。
 */
function findRisingEdge(samples, level, preferBefore) {
  const hi = preferBefore == null
    ? samples.length - 1
    : Math.min(preferBefore, samples.length - 1);
  for (let i = hi; i > 0; i--) {
    if (samples[i - 1] < level && samples[i] >= level) return i;
  }
  // 回退：任意最近边沿
  for (let i = samples.length - 1; i > hi; i--) {
    if (samples[i - 1] < level && samples[i] >= level) return i;
  }
  return -1;
}

/** 深色网格：水平 10 格、垂直 8 格，中间十字线稍粗。 */
function drawGrid(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = '#1a1f24';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(220, 226, 232, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < 10; c++) {
    const x = Math.round(c * w / 10) + 0.5;
    ctx.moveTo(x, 0); ctx.lineTo(x, h);
  }
  for (let r = 1; r < 8; r++) {
    const y = Math.round(r * h / 8) + 0.5;
    ctx.moveTo(0, y); ctx.lineTo(w, y);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(220, 226, 232, 0.28)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const cx = Math.round(w / 2) + 0.5, cy = Math.round(h / 2) + 0.5;
  ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
  ctx.moveTo(0, cy); ctx.lineTo(w, cy);
  ctx.stroke();

  ctx.fillStyle = 'rgba(220, 226, 232, 0.28)';
  for (let c = 0; c <= 10; c++) {
    for (let r = 0; r <= 8; r++) {
      if (c === 5 || r === 4) continue;
      ctx.fillRect(c * w / 10 - 1, r * h / 8 - 1, 2, 2);
    }
  }
  ctx.restore();
}

/** 画折线；samples 为空则跳过。 */
function drawTrace(ctx, w, h, samples, voltsDiv, color) {
  if (!samples || samples.length < 2) return;
  const cy = h / 2;
  const pxPerV = h / (8 * voltsDiv);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * w;
    const y = cy - samples[i] * pxPerV;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** YT：网格 + 触发线 + CH2 + CH1。 */
function drawYT(ctx, w, h, ch1, ch2, voltsDiv, triggerLevel, showCh1, showCh2) {
  drawGrid(ctx, w, h);
  const cy = h / 2, pxPerV = h / (8 * voltsDiv);
  const ty = cy - triggerLevel * pxPerV;
  ctx.save();
  ctx.strokeStyle = 'rgba(232, 155, 75, 0.45)';
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, ty); ctx.lineTo(w, ty);
  ctx.stroke();
  ctx.restore();

  if (showCh2) drawTrace(ctx, w, h, ch2, voltsDiv, '#5a8f7b');
  if (showCh1) drawTrace(ctx, w, h, ch1, voltsDiv, '#e89b4b');
}

/** X-Y：X=CH1，Y=CH2，李萨如图形。 */
function drawXY(ctx, w, h, ch1, ch2, voltsDiv) {
  drawGrid(ctx, w, h);
  if (!ch1 || !ch2 || ch1.length < 2 || ch2.length < 2) return;
  const cx = w / 2, cy = h / 2;
  const pxPerV = h / (8 * voltsDiv);
  const n = Math.min(ch1.length, ch2.length);
  ctx.save();
  ctx.strokeStyle = '#e8d9a8';
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = cx + ch1[i] * pxPerV;
    const y = cy - ch2[i] * pxPerV;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SampleBuffer, findRisingEdge, drawGrid, drawTrace, drawYT, drawXY };
}
