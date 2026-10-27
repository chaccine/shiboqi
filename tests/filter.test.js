'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { LowPass, step } = require('../js/filter.js');

test('阶跃输入：输出平滑上升且不越过终值', () => {
  const lp = new LowPass(0.002);
  const dt = 0.0001;
  let prev = 0;
  for (let i = 0; i < 200; i++) {
    const y = lp.filter(1, dt);
    assert.ok(y >= prev - 1e-12, '应单调上升');
    assert.ok(y <= 1 + 1e-12, '不应越过终值');
    prev = y;
  }
  assert.ok(prev > 0.99, '稳态应接近 1');
});

test('公式 a = dt/(RC+dt)', () => {
  const y0 = 0.4, x = 1, rc = 0.002, dt = 0.0001;
  const a = dt / (rc + dt);
  assert.ok(Math.abs(step(y0, x, rc, dt) - (y0 + a * (x - y0))) < 1e-15);
});

test('RC 很大时输出几乎不变', () => {
  const lp = new LowPass(1000);
  const y = lp.filter(5, 0.0001);
  assert.ok(Math.abs(y) < 0.001);
});

test('RC→0 时输出紧跟输入', () => {
  const lp = new LowPass(1e-15);
  const y = lp.filter(3.7, 0.0001);
  assert.ok(Math.abs(y - 3.7) < 1e-6);
});
