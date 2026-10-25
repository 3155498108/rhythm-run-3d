/* =========================================================
 *  节奏长跑 · 核心逻辑（纯函数，无 DOM 依赖，可被 node 直接 require 做数值仿真）
 * ========================================================= */
(function (global) {
  'use strict';

  var C = {
    RACE_LEN: 1000,       // 赛道长度（米）
    GATE_STEP: 200,       // 每隔多少米一个补给点
    GATE_AHEAD: 58,       // 补给点提前多少米可操作
    GATE_AFTER: 12,       // 过后多少米失效

    IDEAL: 0.32,          // 参考步频间隔（秒）≈ 187 步/分
    DEBOUNCE: 0.085,      // 防连发

    /* —— 节奏判定：只看「每次间隔是不是差不多」 —— */
    STEADY_DEV: 0.17,
    STEADY_WARMUP: 2,
    STEADY_MULT: 0.78,
    RHYTHM_KEEP: 0.28,
    DEV_KEEP: 0.34,

    COST_BASE: 6.8,
    COST_EXP: 0.40,
    EFFORT_LO: 0.62,
    EFFORT_HI: 1.85,
    COMBO_STEP: 0.007,
    COMBO_CAP: 16,
    COMBO_SPEED: 0.0014,
    COMBO_SPEED_CAP: 18,

    REGEN: 18.0,
    VMAX_MIN: 16,
    VMAX_SPAN: 10,
    TOTAL_DRAIN: 0.22,
    WATER_BASE: 0.50,
    WATER_KMH: 0.020,

    EAT_TIME: 2.8,
    DRINK_TIME: 1.1,
    EAT_SLOW: 0.40,
    DRINK_SLOW: 0.76,
    EAT_STAMINA: 28,
    EAT_TOTAL: 4.5,
    EAT_WATER: -6,
    DRINK_STAMINA: 8,

    SPEED_TAU: 3.2,
    EMPTY_SLOW: 0.45,

    /* —— 比赛 —— */
    COUNTDOWN: 3.2,
    START_WINDOW: 0.5,    // 起步判定窗口
    START_FALSE: 0.62,    // 早于这个秒数算抢跑

    /* —— 跳跃 / 障碍 —— */
    JUMP_TIME: 0.62,
    JUMP_HEIGHT: 0.66,
    JUMP_SPEED: 1.05,
    JUMP_LOCK: 0.10,
    OBST_HIT: 0.38,       // 撞障碍后速度倍率
    OBST_STAM: 10,

    /* —— 道具 —— */
    ITEM_SLOTS: 2,
    BOOST_TIME: 5.0,
    BOOST_MULT: 1.26,
    JAM_TIME: 3.5,
    SLIP_TIME: 1.7,
    BOTTLE_TIME: 2.0,
    SHOT_RANGE: 48,
    SHOT_FLY: 0.45
  };

  var RIVAL_DEFS = [
    { name: '阿虎', color: 0x5b7cfa, base: 23.8, z: -1.55, ph: 0.4, avoid: 0.78, aggro: 0.40 },
    { name: '小鹿', color: 0xf5a623, base: 23.2, z: 0.15, ph: 2.2, avoid: 0.62, aggro: 0.34 },
    { name: '老陈', color: 0x35b58c, base: 22.6, z: 1.5, ph: 4.1, avoid: 0.46, aggro: 0.28 }
  ];

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function makeObstacles(gates) {
    var out = [], x = 82, kinds = ['hurdle', 'cone', 'puddle'];
    while (x < C.RACE_LEN - 78) {
      var ok = true;
      for (var g = 0; g < gates.length; g++) {
        if (Math.abs(gates[g].d - x) < 36) ok = false;
      }
      if (ok) out.push({ x: x, kind: kinds[Math.floor(Math.random() * kinds.length)], done: false });
      x += 56 + Math.random() * 32;
    }
    return out;
  }

  function makeRivals() {
    var out = [];
    for (var i = 0; i < RIVAL_DEFS.length; i++) {
      var d = RIVAL_DEFS[i];
      out.push({
        name: d.name, color: d.color, base: d.base, z: d.z, ph: d.ph,
        avoid: d.avoid, aggro: d.aggro,
        dist: -0.8 - i * 0.92, speed: 0, phase: Math.random() * 6.28,
        jamT: 0, slipT: 0, boostT: 0, jumpT: 0, jumpY: 0,
        obsIdx: 0, planObs: -1, willJump: false, gateIdx: 0,
        delay: 0.18 + Math.random() * 0.35,
        finished: false, finishT: 0
      });
    }
    return out;
  }

  function create() {
    var gates = [];
    for (var d = C.GATE_STEP; d < C.RACE_LEN; d += C.GATE_STEP) {
      gates.push({ d: d, drank: false, ate: false, passed: false, looted: false });
    }
    return {
      t: 0, gt: 0, inited: false, started: false,
      phase: 'idle', cd: C.COUNTDOWN, goT: 0,
      startAt: null, startQuality: 0, startBoostT: 0, startPenalty: 0,

      distance: 0, speed: 0, target: 0,
      stamina: 100, total: 100, water: 100,
      cadence: 0, cadenceT: -99,
      lastSide: null, lastStride: -99, lastPress: -99,
      ivMean: 0, ivDev: 0, rhythmWarm: 0,
      combo: 0, bestCombo: 0, steady: 0, strides: 0, stumbles: 0,

      action: null, actionT: 0, actionDur: 0, actionGate: null,
      gates: gates,

      finished: false, collapsed: false, elapsed: 0,
      events: [], waterWarn: false, peakSpeed: 0,

      /* 跳跃 */
      jumpT: 0, jumpY: 0, jumpLock: 0, jumps: 0, cleared: 0,
      /* 状态异常 */
      jamT: 0, slipT: 0, boostT: 0, hitT: 0, hitKind: null,
      /* 道具 */
      items: [null, null],
      obstacles: makeObstacles(gates),
      bananas: [],
      shots: [],
      /* 对手 */
      rivals: makeRivals(),
      rank: 1, finishRank: 0, finishT: 0, hits: 0, shotsFired: 0
    };
  }

  /* ---------------- 补给点 ---------------- */
  function activeGate(s) {
    for (var i = 0; i < s.gates.length; i++) {
      var g = s.gates[i];
      if (s.distance >= g.d - C.GATE_AHEAD && s.distance <= g.d + C.GATE_AFTER) return g;
    }
    return null;
  }

  /* 前方最近的对手 */
  function nearestAhead(s, range) {
    var best = null, bd = 1e9;
    for (var i = 0; i < s.rivals.length; i++) {
      var r = s.rivals[i];
      var d = r.dist - s.distance;
      if (d > -1.5 && d < range && d < bd) { bd = d; best = r; }
    }
    return best;
  }

  /* ---------------- 道具 ---------------- */
  function giveItem(s, kind) {
    for (var i = 0; i < C.ITEM_SLOTS; i++) {
      if (!s.items[i]) {
        s.items[i] = kind;
        s.events.push({ k: 'item', item: kind, slot: i });
        return true;
      }
    }
    s.events.push({ k: 'itemfull' });
    return false;
  }

  function useItem(s, slot) {
    if (s.phase !== 'run') return false;
    var it = s.items[slot];
    if (!it) return false;

    if (it === 'boost') {
      s.items[slot] = null;
      s.boostT = C.BOOST_TIME;
      s.events.push({ k: 'boost' });
      return true;
    }
    if (it === 'peel') {
      s.items[slot] = null;
      s.bananas.push({ x: s.distance - 1.1, used: false, mine: true });
      s.events.push({ k: 'peel' });
      return true;
    }
    // 水瓶 / 干扰：需要前方有人
    var t = nearestAhead(s, C.SHOT_RANGE);
    if (!t) { s.events.push({ k: 'notarget' }); return false; }
    s.items[slot] = null;
    s.shots.push({ kind: it, target: t, to: 'rival', t: C.SHOT_FLY, total: C.SHOT_FLY });
    s.shotsFired++;
    s.events.push({ k: 'throw', item: it, rival: t });
    return true;
  }

  /* ---------------- 按空格：起跑 / 跳跃 ---------------- */
  function space(s) {
    if (s.phase === 'idle') {
      s.phase = 'ready';
      s.cd = C.COUNTDOWN;
      s.startAt = null;
      s.events.push({ k: 'countdown' });
      return 'ready';
    }
    if (s.phase === 'ready') {
      if (s.startAt === null) {
        s.startAt = s.cd;              // 记录按下时还剩几秒
        s.events.push({ k: 'startpress', cd: s.cd });
      }
      return 'start';
    }
    if (s.phase !== 'run') return null;
    if (s.jumpT > 0 || s.jumpLock > 0) return null;
    s.jumpT = C.JUMP_TIME;
    s.jumpLock = C.JUMP_TIME + 0.12;
    s.jumps++;
    s.events.push({ k: 'jump' });
    return 'jump';
  }

  function beginRun(s) {
    s.phase = 'run';
    s.started = true;
    s.goT = s.gt;
    s.cd = 0;

    var q = 0;
    if (s.startAt === null) {
      q = 0.15;
      s.events.push({ k: 'late_start' });
    } else if (s.startAt > C.START_FALSE) {
      q = 0;
      s.startPenalty = 0.55;
      s.events.push({ k: 'false_start' });
    } else {
      q = clamp(1 - Math.abs(s.startAt) / C.START_WINDOW, 0, 1);
      s.events.push({ k: 'go', quality: q });
    }
    s.startQuality = q;
    s.startBoostT = 1.4 + 1.5 * q;
    s.speed = 4 + 12 * q;
  }

  /* ---------------- 一次踩步 ---------------- */
  function press(s, side) {
    if (s.phase !== 'run') return false;
    var gap = s.gt - s.lastPress;
    if (gap < C.DEBOUNCE) return false;
    s.lastPress = s.gt;

    if (side === s.lastSide) {
      s.stumbles++;
      s.combo = 0;
      s.rhythmWarm = 0;
      s.ivDev = Math.max(s.ivDev, 0.5);
      s.stamina = Math.max(0, s.stamina - 1.6);
      s.events.push({ k: 'stumble' });
      return false;
    }

    var interval = (s.lastStride < 0) ? C.IDEAL : (s.gt - s.lastStride);

    if (interval > C.IDEAL * 3.2) {
      s.ivMean = interval;
      s.ivDev = 0;
      s.rhythmWarm = 0;
    }

    var ref = s.ivMean > 0 ? s.ivMean : interval;
    var dev = Math.abs(interval - ref) / ref;
    s.ivMean += (interval - s.ivMean) * C.RHYTHM_KEEP;
    s.ivDev += (dev - s.ivDev) * C.DEV_KEEP;
    if (!(s.ivMean > 0.05)) s.ivMean = interval;

    s.rhythmWarm++;
    var steady = s.rhythmWarm > C.STEADY_WARMUP &&
      s.ivDev <= C.STEADY_DEV && dev <= C.STEADY_DEV * 1.8;

    var effort = clamp(C.IDEAL / interval, C.EFFORT_LO, C.EFFORT_HI);
    var comboMult = 1 - Math.min(s.combo, C.COMBO_CAP) * C.COMBO_STEP;
    var waterMult = s.water <= 0 ? 1.30 : 1;
    var cost = C.COST_BASE * Math.pow(effort, C.COST_EXP) * comboMult * waterMult;
    if (steady) cost *= C.STEADY_MULT;
    if (s.boostT > 0) cost *= 0.62;      // 加速期间更省力

    s.stamina = Math.max(0, s.stamina - cost);
    s.cadence = 1 / interval;
    s.cadenceT = s.gt;
    s.lastStride = s.gt;
    s.lastSide = side;
    s.strides++;

    if (steady) {
      s.steady++;
      s.combo++;
      if (s.combo > s.bestCombo) s.bestCombo = s.combo;
    } else {
      s.combo = 0;
    }

    s.events.push({
      k: 'stride', side: side, steady: steady, ratio: interval / C.IDEAL,
      combo: s.combo, cost: cost
    });
    return true;
  }

  /* ---------------- 喝水 / 吃香蕉 ---------------- */
  function startAction(s, kind) {
    if (s.phase !== 'run') return false;
    if (s.action) return false;
    var g = activeGate(s);
    if (!g) { s.events.push({ k: 'nofood', reason: 'none' }); return false; }
    var used = kind === 'eat' ? g.ate : g.drank;
    if (used) { s.events.push({ k: 'nofood', reason: 'used' }); return false; }

    if (kind === 'eat') g.ate = true; else g.drank = true;
    s.action = kind;
    s.actionGate = g;
    s.actionDur = kind === 'eat' ? C.EAT_TIME : C.DRINK_TIME;
    s.actionT = s.actionDur;
    s.events.push({ k: kind });
    return true;
  }

  function finishAction(s) {
    if (s.action === 'drink') {
      s.water = 100;
      s.stamina = clamp(s.stamina + C.DRINK_STAMINA, 0, 100);
      giveItem(s, 'bottle');           // 喝完的空瓶
      s.events.push({ k: 'drank' });
    } else if (s.action === 'eat') {
      s.stamina = clamp(s.stamina + C.EAT_STAMINA, 0, 100);
      s.total = clamp(s.total + C.EAT_TOTAL, 0, 100);
      s.water = clamp(s.water + C.EAT_WATER, 0, 100);
      giveItem(s, 'peel');             // 香蕉皮
      s.events.push({ k: 'ate' });
    }
    s.action = null;
    s.actionT = 0;
    s.actionGate = null;
  }

  /* ---------------- 障碍 / 香蕉 ---------------- */
  function hitObstacle(s, o) {
    s.hits++;
    s.speed *= C.OBST_HIT;
    s.hitT = 0.45;
    s.hitKind = o.kind;
    s.stamina = Math.max(0, s.stamina - C.OBST_STAM);
    s.combo = 0;
    s.events.push({ k: 'hit', kind: o.kind });
  }

  function slipPlayer(s, reason) {
    s.slipT = C.SLIP_TIME;
    s.speed *= 0.55;
    s.combo = 0;
    s.events.push({ k: 'slip', reason: reason });
  }

  /* ---------------- 对手 ---------------- */
  function updateRivals(s, dt) {
    for (var i = 0; i < s.rivals.length; i++) {
      var r = s.rivals[i];
      if (s.gt - s.goT < r.delay) continue;
      if (r.finished) continue;

      r.jamT = Math.max(0, r.jamT - dt);
      r.slipT = Math.max(0, r.slipT - dt);
      r.boostT = Math.max(0, r.boostT - dt);
      if (r.jumpT > 0) {
        r.jumpT -= dt;
        r.jumpY = r.jumpT > 0 ? Math.sin(Math.PI * (1 - r.jumpT / C.JUMP_TIME)) : 0;
      } else {
        r.jumpY = 0;
      }

      var mult = 1;
      if (r.jamT > 0) mult *= 0.55;
      if (r.slipT > 0) mult *= 0.45;
      if (r.boostT > 0) mult *= 1.1;
      var base = r.base * (1 + 0.045 * Math.sin(s.gt * 0.55 + r.ph));
      var tgt = base * mult;
      r.speed += (tgt - r.speed) * (1 - Math.exp(-dt * 2.4));
      r.dist += r.speed / 3.6 * dt;
      r.phase += dt * (r.speed / 3.6) / 2.2 * Math.PI;

      // 提前决定要不要跳过障碍
      var nextO = s.obstacles[r.obsIdx];
      if (nextO) {
        var gapO = nextO.x - r.dist;
        if (gapO < 9 && gapO > 0 && r.planObs !== r.obsIdx) {
          r.planObs = r.obsIdx;
          r.willJump = Math.random() < r.avoid;
        }
        if (gapO < 2.6 && gapO > 0 && r.willJump && r.jumpT <= 0) {
          r.jumpT = C.JUMP_TIME;
          r.jumpY = 0.01;
        }
      }

      // 撞障碍
      while (r.obsIdx < s.obstacles.length && s.obstacles[r.obsIdx].x <= r.dist) {
        if (r.jumpY < 0.35) {
          r.slipT = Math.max(r.slipT, 0.75);
          r.speed *= 0.6;
        }
        r.obsIdx++;
      }

      // 踩到香蕉
      for (var b = 0; b < s.bananas.length; b++) {
        var ba = s.bananas[b];
        if (ba.used) continue;
        if (ba.x > r.dist - 1.2 && ba.x <= r.dist + 0.6) {
          ba.used = true;
          if (r.jumpY < 0.35) {
            r.slipT = 1.5;
            r.speed *= 0.5;
          }
        }
      }

      // 经过补给点：可能用道具偷袭玩家
      if (r.gateIdx < s.gates.length && r.dist >= s.gates[r.gateIdx].d - 40) {
        r.gateIdx++;
        r.boostT = 2.5;
        if (s.phase === 'run' && Math.random() < r.aggro) {
          var lead = r.dist - s.distance;
          if (lead > 0 && lead < 18) {
            s.shots.push({ kind: 'bottle', to: 'player', t: 0.55, total: 0.55, from: r.dist });
            s.events.push({ k: 'incoming', item: 'bottle', rival: r });
          } else if (lead <= 0 && lead > -30) {
            s.shots.push({ kind: 'jam', to: 'player', t: 0.55, total: 0.55, from: r.dist });
            s.events.push({ k: 'incoming', item: 'jam', rival: r });
          }
        }
      }

      if (r.dist >= C.RACE_LEN && !r.finished) {
        r.dist = C.RACE_LEN;
        r.finished = true;
        r.finishT = s.gt - s.goT;
      }
    }
  }

  function computeRank(s) {
    var ahead = 0;
    for (var i = 0; i < s.rivals.length; i++) {
      var r = s.rivals[i];
      if (r.finished) {
        if (!s.finished || r.finishT < s.finishT) ahead++;
      } else if (r.dist > s.distance) {
        ahead++;
      }
    }
    s.rank = 1 + ahead;
  }

  /* ---------------- 主循环 ---------------- */
  function tick(s, now) {
    if (!s.inited) { s.inited = true; s.t = now; return; }
    var dt = now - s.t;
    if (dt < 0) dt = 0;
    s.t = now;
    if (dt > 0.06) dt = 0.06;
    s.gt += dt;

    if (s.phase === 'idle') return;

    if (s.phase === 'ready') {
      s.cd -= dt;
      if (s.cd <= 0) beginRun(s);
      return;
    }
    if (s.phase !== 'run') return;

    s.elapsed += dt;

    var i;

    // 计时器
    if (s.jumpT > 0) s.jumpT -= dt;
    s.jumpY = s.jumpT > 0 ? Math.sin(Math.PI * (1 - s.jumpT / C.JUMP_TIME)) : 0;
    if (s.jumpLock > 0) s.jumpLock -= dt;
    if (s.jamT > 0) s.jamT -= dt;
    if (s.slipT > 0) s.slipT -= dt;
    if (s.boostT > 0) s.boostT -= dt;
    if (s.hitT > 0) s.hitT -= dt;
    if (s.startBoostT > 0) s.startBoostT -= dt;
    if (s.startPenalty > 0) s.startPenalty -= dt;

    // 步频衰减（补给时保持）
    if (!s.action && s.gt - s.cadenceT > 0.42) s.cadence *= Math.exp(-dt * 2.0);
    if (s.cadence < 0.06) s.cadence = 0;

    if (s.action) {
      s.actionT -= dt;
      if (s.actionT <= 0) finishAction(s);
    }

    // ---- 速度 ----
    var cadRatio = clamp(s.cadence * C.IDEAL, 0, 1.18);
    var vmax = C.VMAX_MIN + C.VMAX_SPAN * (s.total / 100);
    var target = vmax * cadRatio;
    target *= 1 + Math.min(s.combo, C.COMBO_SPEED_CAP) * C.COMBO_SPEED;
    if (s.stamina <= 0.01) target *= C.EMPTY_SLOW;
    if (s.action === 'eat') target *= C.EAT_SLOW;
    else if (s.action === 'drink') target *= C.DRINK_SLOW;
    if (s.jumpT > 0) target *= C.JUMP_SPEED;
    if (s.boostT > 0) target *= C.BOOST_MULT;
    if (s.jamT > 0) target *= 0.84;
    if (s.slipT > 0) target *= 0.5;
    if (s.hitT > 0) target *= 0.88;
    if (s.startBoostT > 0) target *= 1 + 0.2 * s.startQuality;
    if (s.startPenalty > 0) target = 0;
    s.target = target;
    s.speed += (target - s.speed) * (1 - Math.exp(-dt * C.SPEED_TAU));
    if (s.speed < 0.02) s.speed = 0;
    if (s.speed > s.peakSpeed) s.peakSpeed = s.speed;

    // ---- 水分 ----
    s.water = clamp(s.water - (C.WATER_BASE + C.WATER_KMH * s.speed) * dt, 0, 100);

    // ---- 体力回复 ----
    var wf = s.water <= 0 ? 0.30 : (s.water < 25 ? 0.30 + 0.70 * (s.water / 25) : 1);
    var regen = C.REGEN * (0.42 + 0.58 * (s.total / 100)) * wf;
    if (s.boostT > 0) regen *= 1.35;
    s.stamina = clamp(s.stamina + regen * dt, 0, 100);

    // ---- 体力上限衰减 ----
    var over = Math.max(0, cadRatio - 1);
    var low = Math.max(0, (28 - s.stamina) / 28);
    var dTot = C.TOTAL_DRAIN + 0.95 * over + 1.5 * over * over + 0.55 * low + (s.water <= 0 ? 0.28 : 0);
    s.total = clamp(s.total - dTot * dt, 0, 100);

    // ---- 前进 ----
    var prev = s.distance;
    s.distance += s.speed / 3.6 * dt;

    // 障碍
    for (i = 0; i < s.obstacles.length; i++) {
      var o = s.obstacles[i];
      if (o.done) continue;
      if (prev < o.x && s.distance >= o.x) {
        o.done = true;
        if (s.jumpY < 0.35) {
          hitObstacle(s, o);
        } else {
          s.cleared++;
          s.events.push({ k: 'clear', kind: o.kind });
        }
      }
    }

    // 地上的香蕉
    for (i = 0; i < s.bananas.length; i++) {
      var ba = s.bananas[i];
      if (ba.used) continue;
      if (prev < ba.x && s.distance >= ba.x) {
        ba.used = true;
        if (s.jumpY < 0.35) slipPlayer(s, 'peel');
      }
    }

    // 飞行中的投掷物
    for (i = s.shots.length - 1; i >= 0; i--) {
      var sh = s.shots[i];
      sh.t -= dt;
      if (sh.t > 0) continue;
      if (sh.to === 'player') {
        if (sh.kind === 'bottle') {
          s.slipT = C.BOTTLE_TIME;
          s.speed *= 0.62;
          s.combo = 0;
          s.events.push({ k: 'hitbottle' });
        } else {
          s.jamT = C.JAM_TIME;
          s.events.push({ k: 'jammed' });
        }
      } else if (sh.target) {
        if (sh.kind === 'bottle') {
          sh.target.slipT = C.BOTTLE_TIME;
          sh.target.speed *= 0.55;
          s.events.push({ k: 'hitrival', mode: 'bottle', rival: sh.target });
        } else {
          sh.target.jamT = C.JAM_TIME;
          s.events.push({ k: 'hitrival', mode: 'jam', rival: sh.target });
        }
      }
      s.shots.splice(i, 1);
    }

    updateRivals(s, dt);
    computeRank(s);

    // 补给点随机道具
    var g = activeGate(s);
    if (g && !g.looted) {
      g.looted = true;
      giveItem(s, Math.random() < 0.55 ? 'boost' : 'jam');
    }

    // 补给点标记
    for (i = 0; i < s.gates.length; i++) {
      var gg = s.gates[i];
      if (!gg.passed && s.distance > gg.d + C.GATE_AFTER) {
        gg.passed = true;
        s.events.push({ k: 'gatepass', gate: gg });
      }
    }

    if (s.water < 18 && !s.waterWarn) { s.waterWarn = true; s.events.push({ k: 'thirst' }); }
    if (s.water > 40) s.waterWarn = false;

    // ---- 结束 ----
    if (s.total <= 0.001 && !s.finished) {
      s.collapsed = true;
      s.phase = 'over';
      s.events.push({ k: 'collapse' });
      return;
    }
    if (s.distance >= C.RACE_LEN) {
      s.distance = C.RACE_LEN;
      s.finished = true;
      s.finishT = s.elapsed;
      computeRank(s);
      s.finishRank = s.rank;
      s.phase = 'over';
      s.events.push({ k: 'finish', rank: s.rank });
    }
  }

  /* 结算评级：名次 */
  function grade(sec, collapsed, rank) {
    if (collapsed) return { letter: 'D', label: '力竭退赛' };
    if (rank === 1) return { letter: 'S', label: '冠军' };
    if (rank === 2) return { letter: 'A', label: '亚军' };
    if (rank === 3) return { letter: 'B', label: '季军' };
    return { letter: 'C', label: '完赛' };
  }

  function paceText(sec, dist) {
    if (dist < 1) return '--';
    var perKm = sec / (dist / 1000);
    var m = Math.floor(perKm / 60);
    var ss = Math.floor(perKm % 60);
    return m + "'" + (ss < 10 ? '0' + ss : ss) + '"';
  }

  var Logic = {
    C: C, create: create, press: press, tick: tick, space: space,
    startAction: startAction, activeGate: activeGate, useItem: useItem,
    nearestAhead: nearestAhead,
    grade: grade, paceText: paceText, clamp: clamp
  };

  global.Logic = Logic;
  if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
})(typeof window !== 'undefined' ? window : globalThis);
