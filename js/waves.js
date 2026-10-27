'use strict';
// 波形生成（纯函数）。浏览器与 Node 通用。

/** 归一化相位 frac = θ/(2π) mod 1 */
function phaseFrac(t, freq, phase) {
  const theta = 2 * Math.PI * freq * t + (phase || 0);
  return ((theta / (2 * Math.PI)) % 1 + 1) % 1;
}

/** 正弦：A·sin(θ) + Vdc。与 wave() 统一为 (…, duty, phase)；亦兼容旧 5 参把第 5 参当 phase。 */
function sine(t, freq, amp, vdc, dutyOrPhase, phase) {
  const ph = (phase === undefined) ? (dutyOrPhase || 0) : (phase || 0);
  const theta = 2 * Math.PI * freq * t + ph;
  return amp * Math.sin(theta) + (vdc || 0);
}

/** 方波：前 duty 段 +A，其余 −A，加 Vdc */
function square(t, freq, amp, vdc, duty, phase) {
  const d = duty === undefined ? 0.5 : duty;
  return (phaseFrac(t, freq, phase) < d ? amp : -amp) + (vdc || 0);
}

/** 三角波：−1…+1，加 Vdc */
function triangle(t, freq, amp, vdc, dutyIgnored, phase) {
  const frac = phaseFrac(t, freq, phase);
  const tri = frac < 0.5 ? 4 * frac - 1 : 3 - 4 * frac;
  return amp * tri + (vdc || 0);
}

/** 锯齿波：frac 0→1 对应 −A→+A，加 Vdc */
function sawtooth(t, freq, amp, vdc, dutyIgnored, phase) {
  return amp * (2 * phaseFrac(t, freq, phase) - 1) + (vdc || 0);
}

const WAVE_TYPES = ['sine', 'square', 'triangle', 'sawtooth'];
const GENERATORS = { sine, square, triangle, sawtooth };

/** 按类型取波形值；未知类型按正弦处理 */
function wave(type, t, freq, amp, vdc, duty, phase) {
  const gen = GENERATORS[type] || sine;
  return gen(t, freq, amp, vdc, duty, phase);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { phaseFrac, sine, square, triangle, sawtooth, wave, WAVE_TYPES };
}
