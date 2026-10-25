/* 整场比赛仿真：稳节奏玩家 vs 三个 AI 对手 */
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

function run(kind, seed) {
  const s = L.create();
  const rnd = mulberry(seed || 42);
  let t = 0, dt = 1 / 120;
  let next = 0, side = 0, i = 0;
  let minS = 100;

  // 倒计时：按空格起步
  s.phase = 'ready';
  s.cd = 0.12;
  s.startAt = 0.1;              // 接近完美起步

  while (s.phase !== 'over' && t < 400) {
    t += dt;
    L.tick(s, t);
    if (s.phase !== 'run') continue;
    if (s.stamina < minS) minS = s.stamina;

    // 补给：喝水优先，水够了吃香蕉
    const g = L.activeGate(s);
    if (g && !s.action && kind !== 'masher') {
      if (!g.drank && s.water < 75) L.startAction(s, 'drink');
      else if (!g.ate && s.stamina < 60) L.startAction(s, 'eat');
    }

    // 用道具：加速自己用，水里/干扰丢前面
    if (kind !== 'masher') {
      for (let k = 0; k < 2; k++) {
        const it = s.items[k];
        if (!it) continue;
        if (it === 'boost') { if (s.boostT <= 0.2) L.useItem(s, k); }
        else if (it === 'peel') { if (s.rivals.some(r => r.dist - s.distance > 3 && r.dist - s.distance < 14)) L.useItem(s, k); }
        else if (L.nearestAhead(s, 40)) L.useItem(s, k);
      }
    }

    // 跳跃：障碍到位就跳
    if (kind !== 'masher') {
      for (const o of s.obstacles) {
        const d = o.x - s.distance;
        if (d > 0.9 && d < 1.9 && s.jumpT <= 0) { L.space(s); break; }
      }
    }

    if (t >= next && !s.action) {
      let iv = C.IDEAL;
      if (kind === 'human') iv = C.IDEAL * (1 + (rnd() - 0.5) * 0.2);
      else if (kind === 'jitter') iv = C.IDEAL * (1 + (rnd() - 0.5) * 0.55);
      else if (kind === 'slow') iv = C.IDEAL * 1.4;
      else if (kind === 'masher') iv = 0.16;
      next = t + iv;
      side = 1 - side;
      L.press(s, side ? 'L' : 'R');
    }
    s.events.length = 0;
  }

  return {
    kind, t: s.elapsed, dist: s.distance, done: s.finished, dead: s.collapsed,
    rank: s.finishRank || s.rank, minS,
    rivals: s.rivals.map(r => ({
      n: r.name, d: r.dist, ft: r.finished ? r.finishT : 0
    })),
    hits: s.hits, cleared: s.cleared, jumps: s.jumps, shots: s.shotsFired
  };
}

for (const k of ['steady', 'human', 'jitter', 'slow', 'masher']) {
  const r = run(k);
  const best = r.rivals.map(x => x.n + ' ' + (x.ft ? x.ft.toFixed(0) + 's' : Math.round(x.d) + 'm')).join(' / ');
  console.log(
    `${r.kind.padEnd(7)} ${r.done ? '完赛' : '退赛'} ${r.t.toFixed(1)}s 名次 ${r.rank} ` +
    `体力最低 ${r.minS.toFixed(0)} 跳${r.jumps} 过${r.cleared} 撞${r.hits} 投${r.shots} | ${best}`
  );
}
