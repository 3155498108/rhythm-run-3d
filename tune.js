/* 数值仿真：用真实 logic.js 跑三种玩家，检查平衡 */
const L = require('./src/logic.js');
const C = L.C;

function run(kind) {
  const s = L.create();
  let t = 0, dt = 1 / 120;
  let nextPress = C.IDEAL;
  let gates = s.gates.slice();
  let rnd = mulberry(42);

  while (!s.finished && !s.collapsed && t < 400) {
    t += dt;
    L.tick(s, t);

    // 补给决策
    const g = s.gates.find(g => t >= 0 && s.distance >= g.d - C.GATE_AHEAD && s.distance <= g.d + C.GATE_AFTER);
    if (g && !s.action) {
      if (kind === 'perfect') {
        if (!g.drank) L.startAction(s, 'drink');
        else if (!g.ate) L.startAction(s, 'eat');
      } else if (kind === 'human') {
        if (!g.drank && s.water < 62) L.startAction(s, 'drink');
        else if (!g.ate && s.stamina < 55) L.startAction(s, 'eat');
      } else if (kind === 'masher') {
        if (!g.drank && s.water < 40) L.startAction(s, 'drink');
      }
    }

    // 步伐
    if (t >= nextPress && !s.action) {
      let iv = C.IDEAL;
      if (kind === 'human') iv = C.IDEAL * (1 + (rnd() - 0.5) * 0.26);
      else if (kind === 'slow') iv = C.IDEAL * 1.45;
      else if (kind === 'masher') iv = 0.145;
      else if (kind === 'quick') iv = C.IDEAL * 0.82;
      nextPress = t + iv + dt;
      const side = s.lastSide === 'L' ? 'R' : 'L';
      L.press(s, side);
      s.events.length = 0;
    }
  }
  return {
    kind, time: s.elapsed, dist: Math.round(s.distance),
    done: s.finished, dead: s.collapsed,
    stamina: s.stamina.toFixed(0), total: s.total.toFixed(0), water: s.water.toFixed(0),
    perfectRate: s.strides ? (100 * s.perfect / s.strides).toFixed(0) + '%' : '-',
    bestCombo: s.bestCombo, avgSpeed: (s.distance / s.elapsed * 3.6).toFixed(1)
  };
}

function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

for (const k of ['perfect', 'human', 'quick', 'slow', 'masher']) {
  const r = run(k);
  console.log(
    `${r.kind.padEnd(8)} 用时 ${r.time.toFixed(1)}s  距离 ${r.dist}m  完赛:${r.done ? 'Y' : 'N'} 退赛:${r.dead ? 'Y' : 'N'}` +
    `  体力 ${r.stamina}  上限 ${r.total}  水 ${r.water}  完美率 ${r.perfectRate}  连击 ${r.bestCombo}  均速 ${r.avgSpeed}km/h`
  );
}
