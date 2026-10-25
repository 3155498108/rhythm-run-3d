/* =========================================================
 *  节拍长跑 · 核心逻辑（纯函数，无 DOM 依赖，可被 node 直接 require 做数值仿真）
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

    /* —— 节奏判定：只看「每次间隔是不是差不多」，不要求踩某个固定点 —— */
    STEADY_DEV: 0.17,     // 间隔相对波动低于这个值就算稳
    STEADY_WARMUP: 2,     // 起步后至少几步才开始计入
    STEADY_MULT: 0.78,    // 稳的时候每步体力打折
    RHYTHM_KEEP: 0.28,    // 平均间隔的更新权重
    DEV_KEEP: 0.34,       // 波动的更新权重

    COST_BASE: 6.8,       // 每步基础体力消耗
    COST_EXP: 0.40,       // 步频越快越费力的曲线（接近线性，避免快一点就崩）
    EFFORT_LO: 0.62,
    EFFORT_HI: 1.85,
    COMBO_STEP: 0.007,    // 每层稳定连击的额外折扣
    COMBO_CAP: 16,
    COMBO_SPEED: 0.0014,  // 每层连击的速度加成
    COMBO_SPEED_CAP: 18,

    REGEN: 18.0,           // 基础回复（每秒）
    VMAX_MIN: 16,         // 体力上限 0 时的最高速度 km/h
    VMAX_SPAN: 10,        // 体力上限 100 时额外速度
    TOTAL_DRAIN: 0.22,    // 体力上限每秒自然衰减
    WATER_BASE: 0.50,     // 水分每秒基础流失
    WATER_KMH: 0.020,     // 每 km/h 额外流失

    EAT_TIME: 2.8,
    DRINK_TIME: 1.1,
    EAT_SLOW: 0.40,
    DRINK_SLOW: 0.76,
    EAT_STAMINA: 28,
    EAT_TOTAL: 4.5,
    EAT_WATER: -6,
    DRINK_STAMINA: 8,

    SPEED_TAU: 3.2,
    EMPTY_SLOW: 0.45,     // 体力见底时的速度倍率
  };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function create() {
    var gates = [];
    for (var d = C.GATE_STEP; d < C.RACE_LEN; d += C.GATE_STEP) {
      gates.push({ d: d, drank: false, ate: false, passed: false });
    }
    return {
      t: 0, gt: 0, inited: false, started: false,
      distance: 0, speed: 0, target: 0,
      stamina: 100, total: 100, water: 100,
      cadence: 0, cadenceT: -99,
      lastSide: null, lastStride: -99, lastPress: -99,
      ivMean: 0, ivDev: 0, rhythmWarm: 0,
      combo: 0, bestCombo: 0, steady: 0, strides: 0, stumbles: 0,
      action: null, actionT: 0, actionDur: 0, actionGate: null,
      gates: gates,
      finished: false, collapsed: false, elapsed: 0,
      events: [],
      waterWarn: false,
      peakSpeed: 0
    };
  }

  /* 当前可交互的补给点 */
  function activeGate(s) {
    for (var i = 0; i < s.gates.length; i++) {
      var g = s.gates[i];
      if (s.distance >= g.d - C.GATE_AHEAD && s.distance <= g.d + C.GATE_AFTER) return g;
    }
    return null;
  }

  /* 一次踩步 */
  function press(s, side) {
    if (s.finished || s.collapsed) return false;
    s.started = true;
    var gap = s.gt - s.lastPress;
    if (gap < C.DEBOUNCE) return false;
    s.lastPress = s.gt;

    // 同侧连点 → 错步
    if (side === s.lastSide) {
      s.stumbles++;
      s.combo = 0;
      s.rhythmWarm = 0;
      s.ivDev = Math.max(s.ivDev, 0.5);   // 节奏被打乱，要重新稳几拍
      s.stamina = Math.max(0, s.stamina - 1.6);
      s.events.push({ k: 'stumble' });
      return false;
    }

    var interval = (s.lastStride < 0) ? C.IDEAL : (s.gt - s.lastStride);

    // 停了很久（吃东西 / 发呆）再起步，节奏重新计
    if (interval > C.IDEAL * 3.2) {
      s.ivMean = interval;
      s.ivDev = 0;
      s.rhythmWarm = 0;
    }

    var ref = s.ivMean > 0 ? s.ivMean : interval;
    var dev = Math.abs(interval - ref) / ref;      // 这次跟最近平均差多少
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

  /* 开启喝水 / 吃东西 */
  function startAction(s, kind) {
    if (s.finished || s.collapsed) return false;
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
      s.events.push({ k: 'drank' });
    } else if (s.action === 'eat') {
      s.stamina = clamp(s.stamina + C.EAT_STAMINA, 0, 100);
      s.total = clamp(s.total + C.EAT_TOTAL, 0, 100);
      s.water = clamp(s.water + C.EAT_WATER, 0, 100);
      s.events.push({ k: 'ate' });
    }
    s.action = null;
    s.actionT = 0;
    s.actionGate = null;
  }

  function tick(s, now) {
    if (!s.inited) { s.inited = true; s.t = now; return; }
    var dt = now - s.t;
    if (dt < 0) dt = 0;
    s.t = now;
    if (dt > 0.06) dt = 0.06;
    // 游戏内时间：所有节奏判定/回复都以它为准，避免掉帧时两套时间错位
    s.gt += dt;
    if (!s.started) return;
    if (s.finished || s.collapsed) return;

    s.elapsed += dt;

    // 步频衰减
    if (!s.action && s.gt - s.cadenceT > 0.42) s.cadence *= Math.exp(-dt * 2.0);
    if (s.cadence < 0.06) s.cadence = 0;

    // 补给动作
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
    s.target = target;
    s.speed += (target - s.speed) * (1 - Math.exp(-dt * C.SPEED_TAU));
    if (s.speed < 0.02) s.speed = 0;
    if (s.speed > s.peakSpeed) s.peakSpeed = s.speed;

    // ---- 水分 ----
    s.water = clamp(s.water - (C.WATER_BASE + C.WATER_KMH * s.speed) * dt, 0, 100);

    // ---- 体力回复 ----
    var wf = s.water <= 0 ? 0.30 : (s.water < 25 ? 0.30 + 0.70 * (s.water / 25) : 1);
    var regen = C.REGEN * (0.42 + 0.58 * (s.total / 100)) * wf;
    s.stamina = clamp(s.stamina + regen * dt, 0, 100);

    // ---- 体力上限衰减 ----
    var over = Math.max(0, cadRatio - 1);
    var low = Math.max(0, (28 - s.stamina) / 28);
    var dTot = C.TOTAL_DRAIN + 0.95 * over + 1.5 * over * over + 0.55 * low + (s.water <= 0 ? 0.28 : 0);
    s.total = clamp(s.total - dTot * dt, 0, 100);

    // ---- 前进 ----
    s.distance += s.speed / 3.6 * dt;

    // 补给点标记
    for (var i = 0; i < s.gates.length; i++) {
      var g = s.gates[i];
      if (!g.passed && s.distance > g.d + C.GATE_AFTER) {
        g.passed = true;
        s.events.push({ k: 'gatepass', gate: g });
      }
    }

    // 口渴提醒
    if (s.water < 18 && !s.waterWarn) { s.waterWarn = true; s.events.push({ k: 'thirst' }); }
    if (s.water > 40) s.waterWarn = false;

    // ---- 结束判定 ----
    if (s.total <= 0.001 && !s.finished) {
      s.collapsed = true;
      s.events.push({ k: 'collapse' });
      return;
    }
    if (s.distance >= C.RACE_LEN) {
      s.distance = C.RACE_LEN;
      s.finished = true;
      s.events.push({ k: 'finish' });
    }
  }

  /* 结算评级：纯看用时（秒） */
  function grade(sec, collapsed) {
    if (collapsed) return { letter: 'D', label: '力竭退赛' };
    if (sec <= 150) return { letter: 'S', label: '破风者' };
    if (sec <= 168) return { letter: 'A', label: '老练跑者' };
    if (sec <= 190) return { letter: 'B', label: '稳住了' };
    if (sec <= 215) return { letter: 'C', label: '完赛' };
    return { letter: 'D', label: '下次更快' };
  }

  function paceText(sec, dist) {
    if (dist < 1) return '--';
    var perKm = sec / (dist / 1000);
    var m = Math.floor(perKm / 60);
    var ss = Math.floor(perKm % 60);
    return m + "'" + (ss < 10 ? '0' + ss : ss) + '"';
  }

  var Logic = {
    C: C, create: create, press: press, tick: tick,
    startAction: startAction, activeGate: activeGate,
    grade: grade, paceText: paceText, clamp: clamp
  };

  global.Logic = Logic;
  if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
})(typeof window !== 'undefined' ? window : globalThis);
