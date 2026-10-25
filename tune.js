/* 整场比赛仿真：不同手速的玩家 vs 三个 AI 对手（以及双人对抗自检） */
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
  const s = L.create('solo');
  const P = s;                       // P1 就是 s
  const rnd = mulberry(seed || 42);
  let t = 0, dt = 1 / 120;
  let next = 0, side = 0;
  let minS = 100, walkT = 0, wasWalking = false;

  s.phase = 'ready';
  s.cd = 0.12;
  P.startAt = 0.1;

  while (s.phase !== 'over' && t < 400) {
    t += dt;
    L.tick(s, t);
    if (s.phase !== 'run') continue;
    if (P.stamina < minS) minS = P.stamina;
    if (P.walking) { walkT += dt; wasWalking = true; }

    const g = L.activeGate(s, P);
    if (g && !P.action && kind !== 'masher') {
      if (!g.drankBy[0] && P.water < 78) L.startAction(s, P, 'drink');
      else if (!g.ateBy[0] && P.stamina < 62) L.startAction(s, P, 'eat');
    }

    if (kind !== 'masher') {
      for (let k = 0; k < 2; k++) {
        const it = P.items[k];
        if (!it) continue;
        if (it === 'boost') { if (P.boostT <= 0.2) L.useItem(s, P, k); }
        else if (it === 'peel') {
          if (s.rivals.some(r => r.dist - P.distance > 3 && r.dist - P.distance < 14)) L.useItem(s, P, k);
        } else if (L.nearestAhead(s, P, 40)) L.useItem(s, P, k);
      }
    }

    if (kind !== 'masher') {
      for (const o of s.obstacles) {
        const d = o.x - P.distance;
        if (d > 0.9 && d < 1.9 && P.jumpT <= 0) { L.space(s, P); break; }
      }
    }

    if (t >= next && !P.action) {
      let iv = C.IDEAL;
      if (kind === 'human') iv = C.IDEAL * (1 + (rnd() - 0.5) * 0.2);
      else if (kind === 'jitter') iv = C.IDEAL * (1 + (rnd() - 0.5) * 0.55);
      else if (kind === 'slow') iv = C.IDEAL * 1.28;
      else if (kind === 'cruise') iv = C.IDEAL * 1.12;
      else if (kind === 'masher') iv = 0.15;
      next = t + iv;
      side = 1 - side;
      L.press(s, P, side ? 'L' : 'R');
    }
    s.events.length = 0;
  }

  return {
    kind, t: P.elapsed, dist: P.distance, done: P.finished,
    rank: P.finishRank || P.rank, minS, walkT, walked: wasWalking,
    rivals: s.rivals.map(r => ({ n: r.name, d: r.dist, ft: r.finished ? r.finishT : 0 })),
    hits: P.hits, cleared: P.cleared, jumps: P.jumps, shots: s.shotsFired
  };
}

console.log('—— 单人：不同手速 ——');
for (const k of ['steady', 'human', 'jitter', 'cruise', 'slow', 'masher']) {
  const r = run(k);
  const best = r.rivals.map(x => x.n + ' ' + (x.ft ? x.ft.toFixed(0) + 's' : Math.round(x.d) + 'm')).join(' / ');
  console.log(
    r.kind.padEnd(7) + ' ' + (r.done ? '完赛' : '未完赛') +
    '  ' + r.t.toFixed(1) + 's  名次 ' + r.rank +
    '  体力最低 ' + r.minS.toFixed(0) + '  走路 ' + r.walkT.toFixed(1) + 's' +
    '  跳' + r.jumps + ' 过' + r.cleared + ' 撞' + r.hits + ' 投' + r.shots +
    '  | ' + best
  );
}

/* ---- 双人：两个人以不同步频对抗，检查两套状态互不干扰 ---- */
console.log('\n—— 双人：同屏两套状态 ----');
(function duo() {
  const s = L.create('duo');
  const p1 = s, p2 = s.p2;
  let t = 0, dt = 1 / 120;
  let n1 = 0, n2 = 0, s1 = 0, s2 = 0;
  s.phase = 'ready'; s.cd = 0.1; p1.startAt = 0.1; p2.startAt = 0.12;

  while (s.phase !== 'over' && t < 400) {
    t += dt;
    L.tick(s, t);
    if (s.phase !== 'run') continue;
    if (t >= n1) { s1 = 1 - s1; L.press(s, p1, s1 ? 'L' : 'R'); n1 = t + 0.30; }
    if (t >= n2) { s2 = 1 - s2; L.press(s, p2, s2 ? 'L' : 'R'); n2 = t + 0.38; }
    [p1, p2].forEach(P => {
      const g = L.activeGate(s, P);
      if (g && !P.action) {
        if (!g.drankBy[P.id - 1] && P.water < 78) L.startAction(s, P, 'drink');
        else if (!g.ateBy[P.id - 1] && P.stamina < 62) L.startAction(s, P, 'eat');
      }
      for (const o of s.obstacles) {
        const d = o.x - P.distance;
        if (d > 0.9 && d < 1.9 && P.jumpT <= 0) { L.space(s, P); break; }
      }
    });
    s.events.length = 0;
  }
  console.log(`P1 步频0.30 完赛 ${p1.finishT.toFixed(1)}s 名次 ${p1.finishRank} 结束体力 ${p1.stamina.toFixed(0)} 走路${p1.walks} 撞${p1.hits}`);
  console.log(`P2 步频0.38 完赛 ${p2.finishT.toFixed(1)}s 名次 ${p2.finishRank} 结束体力 ${p2.stamina.toFixed(0)} 走路${p2.walks} 撞${p2.hits}`);
  console.log(`总时长 ${t.toFixed(1)}s  阶段 ${s.phase}`);
})();
