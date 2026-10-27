'use strict';
const test = require('node:test');
const assert = require('node:assert');
const m = require('../js/measure.js');

test('纯直流：Vpp≈0，Vrms≈|Vdc|，频率为 null', () => {
  const s = new Array(100).fill(1.5);
  assert.ok(Math.abs(m.vpp(s)) < 1e-12);
  assert.ok(Math.abs(m.vrms(s) - 1.5) < 1e-12);
  assert.equal(m.freqEstimate(s, 0.0001, 0), null);
});

test('已知正弦：Vpp≈2A，Vrms≈A/√2，频率接近 f', () => {
  const f = 50, A = 2, fs = 10000;
  const dt = 1 / fs, N = Math.round(3 * fs / f); // 至少 3 个周期，保证 ≥2 个上升沿
  const s = [];
  for (let i = 0; i < N; i++) s.push(A * Math.sin(2 * Math.PI * f * i * dt));
  assert.ok(Math.abs(m.vpp(s) - 2 * A) < 0.05 * 2 * A);
  assert.ok(Math.abs(m.vrms(s) - A / Math.SQRT2) < 0.02 * A);
  const fe = m.freqEstimate(s, dt, 0);
  assert.ok(fe !== null && Math.abs(fe - f) / f < 0.02);
});
