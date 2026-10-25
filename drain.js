/* 体力曲线体检：固定手速，看体力能撑多久、跑多快 */
const L = require('./src/logic.js');

function hold(iv) {
  const s = L.create('solo');
  s.phase = 'run';
  s.goT = 0;
  L.tick(s, 0);
  const dt = 1 / 60;
  let now = 0, next = 0, side = 0;
  let walkAt = -1, recAt = -1, runKmh = 0;
  for (let i = 0; i < 60 * 300; i++) {
    now += dt;
    L.tick(s, now);                       // 先推进，press 才能读到准确的 s.gt
    if (now >= next) {
      side = 1 - side;
      L.press(s, s, side ? 'L' : 'R');
      next = now + iv;
    }
    if (i === 60 * 6) runKmh = s.speed;   // 第 6 秒的巡航速度

    // 模拟真实玩家：路过补给站就喝水吃香蕉
    const g = L.activeGate(s, s);
    if (g && !s.action) {
      if (!g.drankBy[0] && s.water < 90) L.startAction(s, s, 'drink');
      else if (!g.ateBy[0] && s.stamina < 70) L.startAction(s, s, 'eat');
    }
    // 障碍自动跳
    for (const o of s.obstacles) {
      const d = o.x - s.distance;
      if (d > 0.9 && d < 1.9 && s.jumpT <= 0) { L.space(s, s); break; }
    }
    if (walkAt < 0 && s.walking) walkAt = s.gt;
    if (walkAt > 0 && recAt < 0 && !s.walking) recAt = s.gt;
    if (s.distance >= 999) break;
    s.events.length = 0;
  }
  return { walkAt, recAt, runKmh, walks: s.walks, done: s.finished, el: s.gt, dist: s.distance, total: s.total };
}

console.log('手速  步频/分 巡航速度   第一次见底  恢复  走路次数  结果');
for (const iv of [0.15, 0.18, 0.20, 0.22, 0.24, 0.26, 0.28, 0.32, 0.36, 0.44]) {
  const r = hold(iv);
  console.log(
    String(iv).padEnd(6),
    String(Math.round(60 / iv)).padEnd(8),
    (r.runKmh.toFixed(1) + ' km/h').padEnd(11),
    (r.walkAt > 0 ? r.walkAt.toFixed(1) + 's' : '没见底').padEnd(11),
    (r.walkAt > 0 && r.recAt > 0 ? (r.recAt - r.walkAt).toFixed(1) + 's' : '-').padEnd(6),
    String(r.walks).padEnd(9),
    r.done ? '完赛 ' + r.el.toFixed(0) + 's' : Math.round(r.dist) + 'm'
  );
}
