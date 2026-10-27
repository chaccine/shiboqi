'use strict';
const test = require('node:test');
const assert = require('node:assert');
const w = require('../js/waves.js');
const EPS = 1e-9;

test('正弦 t=0、φ=0 时值为 Vdc', () => {
  assert.ok(Math.abs(w.sine(0, 50, 2, 1.5) - 1.5) < EPS);
});

test('正弦 t=1/(4f) 时约为 A+Vdc', () => {
  const v = w.sine(1 / (4 * 50), 50, 2, 0.5);
  assert.ok(Math.abs(v - 2.5) < EPS);
});

test('方波 duty=0.25：一个周期内约 25% 为 +A', () => {
  const N = 10000, f = 1, A = 2;
  let high = 0;
  for (let i = 0; i < N; i++) {
    if (w.square(i / N / f, f, A, 0, 0.25) === A) high++;
  }
  assert.ok(Math.abs(high / N - 0.25) < 0.01);
});

test('三角波峰值约 ±A', () => {
  assert.ok(Math.abs(w.triangle(0.5 / 10, 10, 3, 0) - 3) < EPS);
  assert.ok(Math.abs(w.triangle(0, 10, 3, 0) + 3) < EPS);
});

test('锯齿波峰值约 ±A', () => {
  // frac→1（周期末尾）对应 +A；t=0（frac=0）对应 −A
  const eps = 1e-9;
  const tEnd = 1 / 20 - eps;
  assert.ok(Math.abs(w.sawtooth(tEnd, 20, 4, 0) - 4) < 1e-6);
  assert.ok(Math.abs(w.sawtooth(0, 20, 4, 0) + 4) < eps);
});

test('相位 φ=π 的正弦与 φ=0 反相', () => {
  const t = 0.003;
  const a = w.sine(t, 100, 2, 0, 0);
  const b = w.sine(t, 100, 2, 0, Math.PI);
  assert.ok(Math.abs(a + b) < EPS);
});
