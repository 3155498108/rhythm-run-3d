/* 数值仿真：用真实 logic.js 跑各种玩家，检查平衡 */
const L = require('./src/logic.js');
const C = L.C;

function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function profile(kind, rnd, i) {
  switch (kind) {
    case 'steady': return C.IDEAL;
    case 'human': return C.IDEAL * (1 + (rnd() - 0.5) * 0.18);
    case 'jitter': return C.IDEAL * (1 + (rnd() - 0.5) * 0.55);
    case 'uneven': return C.IDEAL * (i % 2 ? 1.55 : 0.62);
    case 'fast': return C.IDEAL * 0.78;
    case 'slow': return C.IDEAL * 1.45;
    case 'spam': return 0.15;
    default: return C.IDEAL;
  }
}

function run(kind) {
  const s = L.create();
  let t = 0, dt = 1 / 120;
  let nextPress = C.IDEAL;
  let rnd = mulberry(42);
  let i = 0;
  let minStamina = 100, minTotal = 100;

  while (!s.finished && !s.collapsed && t < 400) {
    t += dt;
    L.tick(s, t);
    if (s.stamina < minStamina) minStamina = s.stamina;
    if (s.total < minTotal) minTotal = s.total;

    const g = s.gates.find(g => s.distance >= g.d - C.GATE_AHEAD && s.distance <= g.d + C.GATE_AFTER);
    if (g && !s.action) {
      if (kind === 'slow' || kind === 'steady' || kind === 'fast' || kind === 'jitter' || kind === 'uneven' || kind === 'spam' || kind === 'human') {
        // 普遍策略：水低于 70 就喝；体力低于 55 就吃
        if (!g.drank && s.water < 70) L.startAction(s, 'drink');
        else if (!g.ate && s.stamina < 55) L.startAction(s, 'eat');
      }
    }

    if (t >= nextPress && !s.action) {
      const iv = profile(kind, rnd, i++);
      nextPress = t + iv + dt;
      const side = s.lastSide === 'L' ? 'R' : 'L';
      L.press(s, side);
      s.events.length = 0;
    }
  }
  return {
    kind, time: s.elapsed, dist: Math.round(s.distance),
    done: s.finished, dead: s.collapsed,
    stamina: s.stamina, total: s.total, water: s.water,
    minStamina, minTotal,
    steadyRate: s.strides ? 100 * s.steady / s.strides : 0,
    bestCombo: s.bestCombo,
    avgSpeed: s.elapsed ? s.distance / s.elapsed * 3.6 : 0
  };
}

const kinds = ['steady', 'human', 'jitter', 'uneven', 'fast', 'slow', 'spam'];
console.log('类型     用时    距离  完赛 退赛  体力  最低  上限  最低  水   稳率  连击  均速');
for (const k of kinds) {
  const r = run(k);
  console.log(
    r.kind.padEnd(8) +
    `${r.time.toFixed(1).padStart(6)}s ${String(r.dist).padStart(5)}m  ` +
    `${r.done ? 'Y' : 'n'}    ${r.dead ? 'Y' : 'n'}   ` +
    `${r.stamina.toFixed(0).padStart(3)}  ${r.minStamina.toFixed(0).padStart(3)}  ` +
    `${r.total.toFixed(0).padStart(3)}  ${r.minTotal.toFixed(0).padStart(3)}  ` +
    `${r.water.toFixed(0).padStart(3)}  ` +
    `${r.steadyRate.toFixed(0).padStart(3)}%  ${String(r.bestCombo).padStart(3)}  ` +
    `${r.avgSpeed.toFixed(1)}km/h`
  );
}
