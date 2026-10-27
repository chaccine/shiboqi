'use strict';
// 一阶 RC 低通状态机（纯逻辑）。

function step(y, x, rc, dt) {
  const a = dt / (rc + dt);
  return y + a * (x - y);
}

function LowPass(rc) {
  this.rc = rc;
  this.y = 0;
}

LowPass.prototype.reset = function () { this.y = 0; };

LowPass.prototype.filter = function (x, dt) {
  this.y = step(this.y, x, this.rc, dt);
  return this.y;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LowPass, step };
}
