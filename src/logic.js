/* =========================================================
 *  节奏长跑 · 核心逻辑（纯函数，无 DOM 依赖，可被 node 直接 require 做数值仿真）
 *
 *  体力模型：
 *    - 每一步的消耗只跟「这一步的间隔」有关，踩得越快单步越贵（超线性）。
 *    - 所以想省体力唯一的手段就是放慢节奏 —— 没有别的捷径。
 *    - 体力见底不会退赛，只是被迫走路：速度锁到 7 km/h，边走边回体力，
 *      回到 WALK_EXIT 才能重新跑起来。
 *
 *  双人：
 *    - players 数组里第 0 个就是 s 本身（P1 的状态直接挂在 s 上，
 *      这样渲染层读 s.distance / s.stamina 的老代码不用动）。
 *    - P2 是 s.p2，同一套 stepRunner 逻辑。
 * ========================================================= */
(function (global) {
  'use strict';

  var C = {
    RACE_LEN: 1000,       // 赛道长度（米）
    GATE_STEP: 200,       // 每隔多少米一个补给点
    GATE_AHEAD: 58,       // 补给点提前多少米可操作
    GATE_AFTER: 12,       // 过后多少米失效

    IDEAL: 0.32,          // 消耗参考步频（秒/步）≈ 187 步/分：踩到这个速度刚好收支平衡
    SPD_IV: 0.26,         // 速度参考步频：踩到这个步频才是满速，慢于此会明显掉速
    DEBOUNCE: 0.085,      // 防连发

    /* —— 体力：只跟步频有关 ——
     * COST_RATE 是「参考步频下每秒消耗」，不是单步扣费。
     * 消耗按 cadence 折算成每秒功率、每帧扣，所以掉帧不会放大消耗
     * （以前是每次按键固定扣一坨，帧率低时同样手速会扣得快好几倍）。 */
    COST_RATE: 3.0,       // 参考步频下每秒消耗
    COST_EXP: 0.85,       // >1：踩得越快，每秒消耗越贵，想省体力只能放慢
    EFFORT_LO: 0.55,
    EFFORT_HI: 1.90,
    REGEN: 10.6,          // 每秒自然回复

    WALK_SPEED: 7.0,      // 体力见底时的走路速度（km/h）
    WALK_EXIT: 40,        // 体力回到多少才能重新跑
    WALK_MIN: 2.6,        // 走路的强制最短时间，避免刚站起来又趴下
    WALK_REGEN: 2.0,      // 走路时回复倍率

    VMAX_MIN: 21.2,
    VMAX_SPAN: 5.0,
    TOTAL_DRAIN: 0.16,
    WATER_BASE: 0.50,
    WATER_KMH: 0.020,

    EAT_TIME: 2.8,
    DRINK_TIME: 1.1,
    EAT_SLOW: 0.40,
    DRINK_SLOW: 0.76,
    EAT_STAMINA: 40,
    EAT_TOTAL: 4.5,
    EAT_WATER: -6,
    DRINK_STAMINA: 8,

    CAD_CAP: 1.35,        // 步频换算成速度的上限（跑到这个步频就到顶，再快只费体力）
    SPEED_TAU: 3.2,

    /* —— 比赛 —— */
    TIME_LIMIT: 420,      // 比赛时间上限（秒），超时强制结束
    COUNTDOWN: 3.2,
    START_WINDOW: 0.5,    // 起步判定窗口
    START_FALSE: 0.62,    // 早于这个秒数算抢跑

    /* —— 跳跃 / 障碍 —— */
    JUMP_TIME: 0.62,
    JUMP_HEIGHT: 0.66,
    JUMP_SPEED: 1.05,
    JUMP_LOCK: 0.10,
    OBST_HIT: 0.38,
    OBST_STAM: 10,

    /* —— 道具 —— */
    ITEM_SLOTS: 2,
    BOOST_TIME: 5.0,
    BOOST_MULT: 1.26,
    JAM_TIME: 3.5,
    SLIP_TIME: 1.7,
    BOTTLE_TIME: 2.0,
    SHOT_RANGE: 48,
    SHOT_FLY: 0.45,

    /* —— 车道 —— */
    LANE_1: -0.62,
    LANE_2: 0.72
  };

  var RIVAL_DEFS = [
    { name: '阿虎', color: 0x5b7cfa, base: 22.9, z: -1.85, ph: 0.4, avoid: 0.78, aggro: 0.40 },
    { name: '小鹿', color: 0xf5a623, base: 22.3, z: 0.10, ph: 2.2, avoid: 0.62, aggro: 0.34 },
    { name: '老陈', color: 0x35b58c, base: 21.7, z: 1.90, ph: 4.1, avoid: 0.46, aggro: 0.28 }
  ];

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function makeObstacles(gates) {
    var out = [], x = 82, kinds = ['hurdle', 'cone', 'puddle'];
    while (x < C.RACE_LEN - 78) {
      var ok = true;
      for (var g = 0; g < gates.length; g++) {
        if (Math.abs(gates[g].d - x) < 36) ok = false;
      }
      if (ok) {
        out.push({
          x: x, kind: kinds[Math.floor(Math.random() * kinds.length)],
          done: false,            // 是否所有玩家都已结算（用于隐藏）
          doneP: [false, false]   // 每个玩家是否已经过
        });
      }
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
        dist: -2.2 - i * 1.1, speed: 0, phase: Math.random() * 6.28,
        jamT: 0, slipT: 0, boostT: 0, jumpT: 0, jumpY: 0,
        obsIdx: 0, planObs: -1, willJump: false, gateIdx: 0,
        delay: 0.18 + Math.random() * 0.35,
        finished: false, finishT: 0
      });
    }
    return out;
  }

  /* ---------------- 跑者状态 ---------------- */
  function makeRunner(id) {
    return {
      id: id,
      lane: id === 1 ? C.LANE_1 : C.LANE_2,
      startDist: id === 1 ? -0.6 : -1.9,

      distance: 0, speed: 0, target: 0, peakSpeed: 0,
      stamina: 100, total: 100, water: 100,
      cadence: 0, cadenceT: -99,
      lastSide: null, lastStride: -99, lastPress: -99,
      strides: 0, hits: 0, cleared: 0, jumps: 0, walks: 0,

      jumpT: 0, jumpY: 0, jumpLock: 0,
      jamT: 0, slipT: 0, boostT: 0, hitT: 0, hitKind: null,

      startAt: null, startQuality: 0, startBoostT: 0, startPenalty: 0,
      action: null, actionT: 0, actionDur: 0, actionGate: null,
      items: [null, null],

      elapsed: 0, finished: false, finishT: 0, finishRank: 0, rank: 1,
      walking: false, walkT: 0, waterWarn: false
    };
  }

  function create(mode) {
    var gates = [];
    for (var d = C.GATE_STEP; d < C.RACE_LEN; d += C.GATE_STEP) {
      gates.push({
        d: d, passed: false,
        drankBy: [false, false], ateBy: [false, false], lootedBy: [false, false]
      });
    }

    var s = {
      t: 0, gt: 0, inited: false, started: false,
      phase: 'idle', cd: C.COUNTDOWN, cdN: 4, goT: 0,
      mode: mode === 'duo' ? 'duo' : 'solo',

      gates: gates,
      obstacles: makeObstacles(gates),
      bananas: [],
      shots: [],
      rivals: makeRivals(),
      events: [],

      rank: 1, finishRank: 0, finishT: 0, shotsFired: 0,
      p2: null
    };

    // P1 的跑者状态直接挂在 s 上（渲染层的老代码读 s.distance / s.stamina 依旧有效）
    var p1 = makeRunner(1);
    for (var k in p1) {
      if (Object.prototype.hasOwnProperty.call(p1, k)) s[k] = p1[k];
    }
    s.players = [s];

    if (s.mode === 'duo') {
      s.p2 = makeRunner(2);
      s.players.push(s.p2);
    }

    for (var i = 0; i < s.players.length; i++) {
      var r = s.players[i];
      r.distance = r.startDist;
    }
    return s;
  }

  function runnerByIndex(s, i) { return s.players[i] || s; }

  /* ---------------- 补给点 ---------------- */
  function activeGate(s, r) {
    r = r || s;
    for (var i = 0; i < s.gates.length; i++) {
      var g = s.gates[i];
      if (r.distance >= g.d - C.GATE_AHEAD && r.distance <= g.d + C.GATE_AFTER) return g;
    }
    return null;
  }

  /* 前方最近的对手（相对于某个跑者） */
  function nearestAhead(s, r, range) {
    r = r || s;
    var best = null, bd = 1e9;
    for (var i = 0; i < s.rivals.length; i++) {
      var rv = s.rivals[i];
      var d = rv.dist - r.distance;
      if (d > -1.5 && d < range && d < bd) { bd = d; best = rv; }
    }
    return best;
  }

  /* ---------------- 道具 ---------------- */
  function giveItem(s, r, kind) {
    r = r || s;
    for (var i = 0; i < C.ITEM_SLOTS; i++) {
      if (!r.items[i]) {
        r.items[i] = kind;
        s.events.push({ k: 'item', item: kind, slot: i, p: r.id });
        return true;
      }
    }
    s.events.push({ k: 'itemfull', p: r.id });
    return false;
  }

  function useItem(s, r, slot) {
    r = r || s;
    if (s.phase !== 'run') return false;
    var it = r.items[slot];
    if (!it) return false;

    if (it === 'boost') {
      r.items[slot] = null;
      r.boostT = C.BOOST_TIME;
      s.events.push({ k: 'boost', p: r.id });
      return true;
    }
    if (it === 'peel') {
      r.items[slot] = null;
      s.bananas.push({ x: r.distance - 1.1, used: false, mine: true, z: r.lane });
      s.events.push({ k: 'peel', p: r.id });
      return true;
    }
    var t = nearestAhead(s, r, C.SHOT_RANGE);
    if (!t) { s.events.push({ k: 'notarget', p: r.id }); return false; }
    r.items[slot] = null;
    s.shots.push({ kind: it, target: t, to: 'rival', t: C.SHOT_FLY, total: C.SHOT_FLY, from: r.distance });
    s.shotsFired++;
    s.events.push({ k: 'throw', item: it, rival: t, p: r.id });
    return true;
  }

  /* ---------------- 按空格 / W / ↑：起跑、跳跃 ---------------- */
  function space(s, r) {
    r = r || s;
    if (s.phase === 'idle') {
      s.phase = 'ready';
      s.cd = C.COUNTDOWN;
      for (var i = 0; i < s.players.length; i++) s.players[i].startAt = null;
      s.cdN = 3;
      s.events.push({ k: 'countdown', n: 3 });
      return 'ready';
    }
    if (s.phase === 'ready') {
      if (r.startAt === null) {
        r.startAt = s.cd;
        s.events.push({ k: 'startpress', cd: s.cd, p: r.id });
      }
      return 'start';
    }
    if (s.phase !== 'run') return null;
    if (r.finished) return null;
    if (r.jumpT > 0 || r.jumpLock > 0) return null;
    r.jumpT = C.JUMP_TIME;
    r.jumpLock = C.JUMP_TIME + 0.12;
    r.jumps++;
    s.events.push({ k: 'jump', p: r.id });
    return 'jump';
  }

  function beginRun(s) {
    s.phase = 'run';
    s.started = true;
    s.goT = s.gt;
    s.cd = 0;

    for (var i = 0; i < s.players.length; i++) {
      var r = s.players[i];
      var q = 0;
      if (r.startAt === null) {
        q = 0.15;
        s.events.push({ k: 'late_start', p: r.id });
      } else if (r.startAt > C.START_FALSE) {
        q = 0;
        r.startPenalty = 0.55;
        s.events.push({ k: 'false_start', p: r.id });
      } else {
        q = clamp(1 - Math.abs(r.startAt) / C.START_WINDOW, 0, 1);
        s.events.push({ k: 'go', quality: q, p: r.id });
      }
      r.startQuality = q;
      r.startBoostT = 1.4 + 1.5 * q;
      r.speed = 4 + 12 * q;
    }
  }

  /* ---------------- 一次踩步 ----------------
   * 体力消耗只跟这一步的间隔有关：间隔越短（踩得越急）单步越贵。
   * 同侧连点不算一步，也不扣体力（不再有「错步」提示）。 */
  function press(s, r, side) {
    r = r || s;
    if (s.phase !== 'run' || r.finished) return false;
    var gap = s.gt - r.lastPress;
    if (gap < C.DEBOUNCE) return false;
    r.lastPress = s.gt;

    if (side === r.lastSide) return false;

    var interval = (r.lastStride < 0) ? C.IDEAL : (s.gt - r.lastStride);
    interval = clamp(interval, 0.15, 1.8);

    var effort = clamp(C.IDEAL / interval, C.EFFORT_LO, C.EFFORT_HI);
    var cost = C.COST_RATE * Math.pow(effort, C.COST_EXP) / Math.max(0.1, interval);

    r.cadence = 1 / interval;
    r.cadenceT = s.gt;
    r.lastStride = s.gt;
    r.lastSide = side;
    r.strides++;

    s.events.push({ k: 'stride', side: side, p: r.id, rate: cost, interval: interval });
    return true;
  }

  /* ---------------- 喝水 / 吃香蕉 ---------------- */
  function startAction(s, r, kind) {
    r = r || s;
    if (s.phase !== 'run' || r.finished) return false;
    if (r.action) return false;
    var g = activeGate(s, r);
    if (!g) { s.events.push({ k: 'nofood', reason: 'none', p: r.id }); return false; }
    var idx = r.id - 1;
    var used = kind === 'eat' ? g.ateBy[idx] : g.drankBy[idx];
    if (used) { s.events.push({ k: 'nofood', reason: 'used', p: r.id }); return false; }

    if (kind === 'eat') g.ateBy[idx] = true; else g.drankBy[idx] = true;
    r.action = kind;
    r.actionGate = g;
    r.actionDur = kind === 'eat' ? C.EAT_TIME : C.DRINK_TIME;
    r.actionT = r.actionDur;
    s.events.push({ k: kind, p: r.id });
    return true;
  }

  function finishAction(s, r) {
    r = r || s;
    if (r.action === 'drink') {
      r.water = 100;
      r.stamina = clamp(r.stamina + C.DRINK_STAMINA, 0, 100);
      giveItem(s, r, 'bottle');
      s.events.push({ k: 'drank', p: r.id });
    } else if (r.action === 'eat') {
      r.stamina = clamp(r.stamina + C.EAT_STAMINA, 0, 100);
      r.total = clamp(r.total + C.EAT_TOTAL, 0, 100);
      r.water = clamp(r.water + C.EAT_WATER, 0, 100);
      giveItem(s, r, 'peel');
      s.events.push({ k: 'ate', p: r.id });
    }
    r.action = null;
    r.actionT = 0;
    r.actionGate = null;
  }

  /* ---------------- 障碍 / 打滑 ---------------- */
  function hitObstacle(s, r, o) {
    r.hits++;
    r.speed *= C.OBST_HIT;
    r.hitT = 0.45;
    r.hitKind = o.kind;
    r.stamina = Math.max(0, r.stamina - C.OBST_STAM);
    s.events.push({ k: 'hit', kind: o.kind, p: r.id });
  }

  function slipPlayer(s, r, reason) {
    r = r || s;
    r.slipT = C.SLIP_TIME;
    r.speed *= 0.55;
    s.events.push({ k: 'slip', reason: reason, p: r.id });
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

      while (r.obsIdx < s.obstacles.length && s.obstacles[r.obsIdx].x <= r.dist) {
        if (r.jumpY < 0.35) {
          r.slipT = Math.max(r.slipT, 0.75);
          r.speed *= 0.6;
        }
        r.obsIdx++;
      }

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

      // 经过补给点：加速一下，并可能偷袭最近的那个玩家
      if (r.gateIdx < s.gates.length && r.dist >= s.gates[r.gateIdx].d - 40) {
        r.gateIdx++;
        r.boostT = 2.5;
        if (s.phase === 'run' && Math.random() < r.aggro) {
          var victim = null, vd = 1e9;
          for (var pi = 0; pi < s.players.length; pi++) {
            var p = s.players[pi];
            var gap = Math.abs(r.dist - p.distance);
            if (gap < vd) { vd = gap; victim = p; }
          }
          if (victim && vd < 26) {
            var lead = r.dist - victim.distance;
            var kind = lead > 0 ? 'bottle' : 'jam';
            s.shots.push({ kind: kind, to: 'player', victim: victim, t: 0.55, total: 0.55, from: r.dist });
            s.events.push({ k: 'incoming', item: kind, rival: r, p: victim.id });
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

  function computeRank(s, r) {
    r = r || s;
    var ahead = 0, i;
    for (i = 0; i < s.rivals.length; i++) {
      var rv = s.rivals[i];
      if (rv.finished) {
        if (!r.finished || rv.finishT < r.finishT) ahead++;
      } else if (rv.dist > r.distance) {
        ahead++;
      }
    }
    for (i = 0; i < s.players.length; i++) {
      var o = s.players[i];
      if (o === r) continue;
      if (o.finished) {
        if (!r.finished || o.finishT < r.finishT) ahead++;
      } else if (o.distance > r.distance) {
        ahead++;
      }
    }
    r.rank = 1 + ahead;
    if (r === s) s.rank = r.rank;
    return r.rank;
  }

  /* ---------------- 单个跑者的一帧 ---------------- */
  function stepRunner(s, r, dt) {
    if (r.finished) return;

    var i;

    r.elapsed += dt;

    if (r.jumpT > 0) r.jumpT -= dt;
    r.jumpY = r.jumpT > 0 ? Math.sin(Math.PI * (1 - r.jumpT / C.JUMP_TIME)) : 0;
    if (r.jumpLock > 0) r.jumpLock -= dt;
    if (r.jamT > 0) r.jamT -= dt;
    if (r.slipT > 0) r.slipT -= dt;
    if (r.boostT > 0) r.boostT -= dt;
    if (r.hitT > 0) r.hitT -= dt;
    if (r.startBoostT > 0) r.startBoostT -= dt;
    if (r.startPenalty > 0) r.startPenalty -= dt;

    if (!r.action && s.gt - r.cadenceT > 0.42) r.cadence *= Math.exp(-dt * 2.0);
    if (r.cadence < 0.06) r.cadence = 0;

    if (r.action) {
      r.actionT -= dt;
      if (r.actionT <= 0) finishAction(s, r);
    }

    // ---- 体力：按当前步频持续扣（连续功率，掉帧也不会多扣） ----
    if (!r.walking && r.cadence > 0.06) {
      var iv = 1 / r.cadence;
      var eff = clamp(C.IDEAL / iv, C.EFFORT_LO, C.EFFORT_HI);
      var rate = C.COST_RATE * Math.pow(eff, C.COST_EXP) / Math.max(0.1, iv);
      if (r.water <= 0) rate *= 1.30;
      if (r.boostT > 0) rate *= 0.62;
      r.stamina = Math.max(0, r.stamina - rate * dt);
    }

    // ---- 体力见底：被迫走路 ----
    if (!r.walking && r.stamina <= 0.01) {
      r.walking = true;
      r.walkT = 0;
      r.walks++;
      s.events.push({ k: 'exhausted', p: r.id });
    } else if (r.walking) {
      r.walkT += dt;
      if (r.walkT >= C.WALK_MIN && r.stamina >= C.WALK_EXIT) {
        r.walking = false;
        s.events.push({ k: 'recovered', p: r.id });
      }
    }

    // ---- 速度 ----
    var cadRatio = clamp(r.cadence * C.SPD_IV, 0, C.CAD_CAP);
    var vmax = C.VMAX_MIN + C.VMAX_SPAN * (r.total / 100);
    var target = vmax * cadRatio;
    if (r.walking) target = Math.min(target, C.WALK_SPEED);
    if (r.action === 'eat') target *= C.EAT_SLOW;
    else if (r.action === 'drink') target *= C.DRINK_SLOW;
    if (r.jumpT > 0) target *= C.JUMP_SPEED;
    if (r.boostT > 0) target *= C.BOOST_MULT;
    if (r.jamT > 0) target *= 0.84;
    if (r.slipT > 0) target *= 0.5;
    if (r.hitT > 0) target *= 0.88;
    if (r.startBoostT > 0) target *= 1 + 0.2 * r.startQuality;
    if (r.startPenalty > 0) target = 0;
    r.target = target;
    r.speed += (target - r.speed) * (1 - Math.exp(-dt * C.SPEED_TAU));
    if (r.speed < 0.02) r.speed = 0;
    if (r.speed > r.peakSpeed) r.peakSpeed = r.speed;

    // ---- 水分 ----
    r.water = clamp(r.water - (C.WATER_BASE + C.WATER_KMH * r.speed) * dt, 0, 100);

    // ---- 体力回复 ----
    var wf = r.water <= 0 ? 0.45 : (r.water < 25 ? 0.45 + 0.55 * (r.water / 25) : 1);
    var regen = C.REGEN * (0.42 + 0.58 * (r.total / 100)) * wf;
    if (r.walking) regen *= C.WALK_REGEN;
    if (r.boostT > 0) regen *= 1.35;
    r.stamina = clamp(r.stamina + regen * dt, 0, 100);

    // ---- 体力上限衰减 ----
    var over = Math.max(0, (r.target / Math.max(1, vmax)) - 1);
    var low = r.walking ? 0 : Math.max(0, (28 - r.stamina) / 28);
    var dTot = C.TOTAL_DRAIN + 0.30 * over + 0.50 * over * over + 0.55 * low + (r.water <= 0 ? 0.28 : 0);
    r.total = clamp(r.total - dTot * dt, 0, 100);

    // ---- 前进 ----
    var prev = r.distance;
    r.distance += r.speed / 3.6 * dt;
    var pidx = r.id - 1;

    // 障碍
    for (i = 0; i < s.obstacles.length; i++) {
      var o = s.obstacles[i];
      if (o.doneP[pidx]) continue;
      if (prev < o.x && r.distance >= o.x) {
        o.doneP[pidx] = true;
        if (r.jumpY < 0.35) {
          hitObstacle(s, r, o);
        } else {
          r.cleared++;
          s.events.push({ k: 'clear', kind: o.kind, p: r.id });
        }
        o.done = o.doneP[0] && (s.players.length < 2 || o.doneP[1]);
      }
    }

    // 地上的香蕉
    for (i = 0; i < s.bananas.length; i++) {
      var ba = s.bananas[i];
      if (ba.used) continue;
      if (prev < ba.x && r.distance >= ba.x) {
        ba.used = true;
        if (r.jumpY < 0.35) slipPlayer(s, r, 'peel');
      }
    }

    // 被砸中
    for (i = s.shots.length - 1; i >= 0; i--) {
      var sh = s.shots[i];
      if (sh.to !== 'player' || sh.victim !== r) continue;
      sh.t -= dt;
      if (sh.t > 0) continue;
      if (sh.kind === 'bottle') {
        r.slipT = C.BOTTLE_TIME;
        r.speed *= 0.62;
        s.events.push({ k: 'hitbottle', p: r.id });
      } else {
        r.jamT = C.JAM_TIME;
        s.events.push({ k: 'jammed', p: r.id });
      }
      s.shots.splice(i, 1);
    }

    if (r.water < 18 && !r.waterWarn) { r.waterWarn = true; s.events.push({ k: 'thirst', p: r.id }); }
    if (r.water > 40) r.waterWarn = false;

    if (r.distance >= C.RACE_LEN) {
      r.distance = C.RACE_LEN;
      r.finished = true;
      r.finishT = r.elapsed;
      computeRank(s, r);
      r.finishRank = r.rank;
      s.events.push({ k: 'finish', rank: r.rank, p: r.id });
    }
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
      // 数字用的是 ceil(cd - 0.2)，音效跟着同一个分界走，画面和声音不会错位
      var cn = Math.ceil(s.cd - 0.2);
      if (cn < s.cdN) {
        s.cdN = cn;
        if (cn > 0) s.events.push({ k: 'countdown', n: cn });
      }
      for (var k = 0; k < s.players.length; k++) {
        var pr = s.players[k];
        pr.speed = 0;
        pr.distance = pr.startDist;
      }
      if (s.cd <= 0) beginRun(s);
      return;
    }
    if (s.phase !== 'run') return;

    var i;

    for (i = 0; i < s.players.length; i++) stepRunner(s, s.players[i], dt);

    // 敌方投掷物（没指定受害者的兜底）
    for (i = s.shots.length - 1; i >= 0; i--) {
      var sh = s.shots[i];
      if (sh.to !== 'rival') continue;
      sh.t -= dt;
      if (sh.t > 0) continue;
      if (sh.target) {
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

    for (i = 0; i < s.players.length; i++) {
      var rr = s.players[i];
      computeRank(s, rr);

      // 补给点随机道具（单人模式才有道具赛；双人靠纯节奏对抗）
      if (s.mode === 'solo') {
        var g = activeGate(s, rr);
        if (g && !g.lootedBy[rr.id - 1]) {
          g.lootedBy[rr.id - 1] = true;
          giveItem(s, rr, Math.random() < 0.55 ? 'boost' : 'jam');
        }
      }

      for (var gi = 0; gi < s.gates.length; gi++) {
        var gg = s.gates[gi];
        if (!gg.passed && rr.distance > gg.d + C.GATE_AFTER) {
          var allPast = true;
          for (var pj = 0; pj < s.players.length; pj++) {
            if (s.players[pj].distance <= gg.d + C.GATE_AFTER) allPast = false;
          }
          if (allPast) { gg.passed = true; s.events.push({ k: 'gatepass', gate: gg }); }
          break;
        }
      }
    }

    // ---- 结束：所有人都到终点（或超时） ----
    if (s.gt - s.goT > C.TIME_LIMIT) {
      s.phase = 'over';
      s.events.push({ k: 'timeout' });
      return;
    }
    var allDone = true;
    for (i = 0; i < s.players.length; i++) {
      if (!s.players[i].finished) allDone = false;
    }
    if (allDone) {
      s.phase = 'over';
      if (s.players.length > 1) {
        s.events.push({ k: 'duofinish', winner: s.players[0].finishT <= s.players[1].finishT ? 1 : 2 });
      }
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
    nearestAhead: nearestAhead, computeRank: computeRank,
    grade: grade, paceText: paceText, clamp: clamp
  };

  global.Logic = Logic;
  if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
})(typeof window !== 'undefined' ? window : globalThis);
