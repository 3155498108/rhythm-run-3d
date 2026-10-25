/* =========================================================
 *  节奏长跑 · HUD 层（2D Canvas 覆盖在 3D 画面之上）
 * ========================================================= */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var VW = 1280, VH = 720;
  var FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",system-ui,-apple-system,sans-serif';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function hexA(h, a) {
    var c = rgb(h);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  function mix(c1, c2, t) {
    t = clamp(t, 0, 1);
    var a = rgb(c1), b = rgb(c2);
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')';
  }

  var P = {
    ink: '#2c3442', ink2: '#5d6a7d', ink3: '#8c99ab'
  };

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shadowOn(ctx) {
    ctx.shadowColor = 'rgba(40,60,90,0.16)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
  }
  function shadowOff(ctx) {
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  function card(ctx, x, y, w, h, r, alpha) {
    shadowOn(ctx);
    ctx.fillStyle = 'rgba(255,255,255,' + (alpha === undefined ? 0.9 : alpha) + ')';
    rr(ctx, x, y, w, h, r);
    ctx.fill();
    shadowOff(ctx);
  }
  function pill(ctx, x, y, w, h, r, fill) {
    ctx.fillStyle = fill;
    rr(ctx, x, y, w, h, r);
    ctx.fill();
  }
  function label(ctx, text, x, y, size, color, weight) {
    ctx.fillStyle = color || P.ink2;
    ctx.font = (weight || '600') + ' ' + size + 'px ' + FONT;
    ctx.fillText(text, x, y);
  }
  function iconCircle(ctx, cx, cy, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
  }

  function staminaColor(p) {
    if (p > 0.55) return ['#43d69b', '#2fb87f'];
    if (p > 0.28) return [mix('#f2b53c', '#43d69b', (p - 0.28) / 0.27), mix('#e09b22', '#2fb87f', (p - 0.28) / 0.27)];
    return [mix('#ef6152', '#f2b53c', p / 0.28), mix('#d94a3d', '#e09b22', p / 0.28)];
  }

  function drawBar(ctx, x, y, w, h, pct, c1, c2, t, pulse) {
    ctx.fillStyle = 'rgba(46,64,90,0.12)';
    rr(ctx, x, y, w, h, h / 2);
    ctx.fill();
    var ww = Math.max(0, w * clamp(pct, 0, 1));
    if (ww > 2) {
      var g = ctx.createLinearGradient(x, y, x + w, y);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      rr(ctx, x, y, Math.max(h, ww), h, h / 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      rr(ctx, x + 3, y + 2.5, Math.max(h * 0.6, ww - 8), h * 0.3, h * 0.15);
      ctx.fill();
    }
    if (pulse) {
      var a = 0.25 + 0.25 * Math.sin(t * 8);
      ctx.strokeStyle = 'rgba(239,97,82,' + a + ')';
      ctx.lineWidth = 2.5;
      rr(ctx, x - 2, y - 2, w + 4, h + 4, (h + 4) / 2);
      ctx.stroke();
    }
  }

  function fmtTime(sec) {
    var m = Math.floor(sec / 60);
    var ss = Math.floor(sec % 60);
    return m + ':' + (ss < 10 ? '0' + ss : ss);
  }

  /* ---------------- 主 HUD ---------------- */
  function drawHUD(ctx, s, view, t) {
    var C = global.Logic.C;
    var p = s.distance / C.RACE_LEN;

    /* 距离卡 */
    card(ctx, 24, 22, 296, 118, 22);
    label(ctx, '距离', 46, 52, 14, P.ink3, '700');
    ctx.fillStyle = P.ink;
    ctx.font = '800 34px ' + FONT;
    var distTxt = String(Math.floor(s.distance));
    ctx.fillText(distTxt, 46, 90);
    var dw = ctx.measureText(distTxt).width;
    ctx.fillStyle = P.ink3;
    ctx.font = '700 15px ' + FONT;
    ctx.fillText('m', 46 + dw + 5, 90);

    ctx.fillStyle = P.ink2;
    ctx.font = '600 13px ' + FONT;
    ctx.fillText('用时 ' + fmtTime(s.elapsed), 46, 116);

    ctx.textAlign = 'right';
    ctx.fillStyle = s.speed > 21 ? '#ef7a4e' : P.ink;
    ctx.font = '800 20px ' + FONT;
    ctx.fillText(s.speed.toFixed(1), 262, 90);
    ctx.fillStyle = P.ink3;
    ctx.font = '700 12px ' + FONT;
    ctx.fillText('km/h', 294, 90);
    ctx.textAlign = 'left';

    /* 进度条 */
    var px0 = 348, pw = 566, py = 40;
    pill(ctx, px0, py, pw, 10, 5, 'rgba(255,255,255,0.55)');
    var pg = ctx.createLinearGradient(px0, 0, px0 + pw, 0);
    pg.addColorStop(0, '#ffb26b');
    pg.addColorStop(1, '#ff7a6b');
    ctx.fillStyle = pg;
    rr(ctx, px0, py, Math.max(10, pw * clamp(p, 0, 1)), 10, 5);
    ctx.fill();

    for (var i = 0; i < s.gates.length; i++) {
      var gx = px0 + pw * (s.gates[i].d / C.RACE_LEN);
      ctx.fillStyle = s.gates[i].passed ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(gx, py + 5, 4, 0, TAU);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px0 + pw + 1, py - 8);
    ctx.lineTo(px0 + pw + 1, py + 20);
    ctx.stroke();
    ctx.fillStyle = '#ff7a6b';
    ctx.beginPath();
    ctx.moveTo(px0 + pw + 2, py - 8);
    ctx.lineTo(px0 + pw + 20, py - 3);
    ctx.lineTo(px0 + pw + 2, py + 2);
    ctx.closePath();
    ctx.fill();

    var mx = px0 + pw * clamp(p, 0, 1);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mx, py + 5, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff7a6b';
    ctx.beginPath();
    ctx.arc(mx, py + 5, 5, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 12px ' + FONT;
    ctx.fillText('0', px0, py + 32);
    ctx.textAlign = 'right';
    ctx.fillText(C.RACE_LEN + 'm', px0 + pw, py + 32);
    ctx.textAlign = 'left';

    /* 状态条卡 */
    var bx = 936, by = 74, bw2 = 316, bh = 214;
    card(ctx, bx, by, bw2, bh, 22);
    var ix = bx + 22, iw = bw2 - 44;

    // 体力上限
    iconCircle(ctx, ix + 9, by + 30, 9, 'rgba(245,166,35,0.18)');
    ctx.fillStyle = '#f5a623';
    ctx.beginPath();
    ctx.moveTo(ix + 10, by + 22); ctx.lineTo(ix + 5, by + 31); ctx.lineTo(ix + 9, by + 31);
    ctx.lineTo(ix + 7, by + 39); ctx.lineTo(ix + 14, by + 28); ctx.lineTo(ix + 10, by + 28);
    ctx.closePath(); ctx.fill();
    label(ctx, '体力上限', ix + 26, by + 35, 14, P.ink, '700');
    ctx.textAlign = 'right';
    var vmaxNow = (C.VMAX_MIN + C.VMAX_SPAN * s.total / 100).toFixed(0);
    label(ctx, '最高 ' + vmaxNow + ' km/h', ix + iw, by + 35, 12, P.ink3, '700');
    ctx.textAlign = 'left';
    drawBar(ctx, ix, by + 44, iw, 13, s.total / 100, '#ffc86b', '#f59b2b', t, false);

    // 体力
    var sc = staminaColor(s.stamina / 100);
    iconCircle(ctx, ix + 9, by + 96, 9, 'rgba(67,214,155,0.18)');
    ctx.strokeStyle = '#2fb87f';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(ix + 6, by + 89); ctx.lineTo(ix + 12, by + 96); ctx.lineTo(ix + 6, by + 96);
    ctx.lineTo(ix + 12, by + 103);
    ctx.stroke();
    label(ctx, '体力', ix + 26, by + 101, 14, P.ink, '700');
    ctx.textAlign = 'right';
    label(ctx, Math.round(s.stamina) + '', ix + iw, by + 101, 13, s.stamina < 28 ? '#e05243' : P.ink3, '700');
    ctx.textAlign = 'left';
    drawBar(ctx, ix, by + 110, iw, 13, s.stamina / 100, sc[0], sc[1], t, s.stamina < 18);

    // 水分
    iconCircle(ctx, ix + 9, by + 162, 9, 'rgba(91,192,248,0.18)');
    ctx.fillStyle = '#3aa6e0';
    ctx.beginPath();
    ctx.moveTo(ix + 9, by + 154);
    ctx.quadraticCurveTo(ix + 15, by + 163, ix + 9, by + 169);
    ctx.quadraticCurveTo(ix + 3, by + 163, ix + 9, by + 154);
    ctx.fill();
    label(ctx, '水分', ix + 26, by + 167, 14, P.ink, '700');
    ctx.textAlign = 'right';
    label(ctx, Math.round(s.water) + '', ix + iw, by + 167, 13, s.water < 25 ? '#3aa6e0' : P.ink3, '700');
    ctx.textAlign = 'left';
    drawBar(ctx, ix, by + 176, iw, 13, s.water / 100, '#7cd4fb', '#2b9fe0', t, s.water < 16);

    /* 稳定连击 */
    if (s.combo >= 3 && view.runnerScreen) {
      var cAlpha = clamp((s.combo - 2) / 6, 0, 1);
      ctx.globalAlpha = cAlpha;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f5a623';
      ctx.font = '800 15px ' + FONT;
      ctx.fillText('节奏稳 ×' + s.combo, view.runnerScreen.x, view.runnerScreen.y - 110);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    drawGatePrompt(ctx, s, t);
    drawNextGateHint(ctx, s, t);
    drawObstacleHint(ctx, s, t);
    drawJumpBtn(ctx, s, t);
    drawItems(ctx, s, t);
    drawRank(ctx, s, t);
    drawRivalDots(ctx, s);
    drawFx(ctx, s, t);
    drawPopups(ctx, view);

    if (s.phase === 'run' && s.elapsed < 8) {
      var a2 = clamp(1 - (s.elapsed - 6) / 3, 0, 1);
      ctx.globalAlpha = a2;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = '800 18px ' + FONT;
      ctx.fillText('A / D 交替 · 每次间隔差不多就省力', VW / 2, 470);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }

  function drawPopups(ctx, view) {
    ctx.textAlign = 'center';
    var placed = [];
    for (var i = 0; i < view.popups.length; i++) {
      var p = view.popups[i];
      var a = clamp(p.life / p.max, 0, 1);
      var py = p.y - (1 - a) * 34;
      // 同帧多条飘字互相错开，避免叠在一起看不清
      var guard = 0;
      while (guard++ < 4) {
        var hit = false;
        for (var j = 0; j < placed.length; j++) {
          if (Math.abs(placed[j].y - py) < 26 && Math.abs(placed[j].x - p.x) < 110) { hit = true; break; }
        }
        if (!hit) break;
        py -= 30;
      }
      placed.push({ x: p.x, y: py });

      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.font = '800 ' + p.size + 'px ' + FONT;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeText(p.text, p.x, py);
      ctx.fillText(p.text, p.x, py);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }

  /* ---------------- 名次 ---------------- */
  function drawRank(ctx, s, t) {
    var x = 348, y = 80, w = 118, h = 34;
    pill(ctx, x, y, w, h, 17, 'rgba(255,255,255,0.9)');
    ctx.fillStyle = s.rank === 1 ? '#e2653f' : P.ink;
    ctx.font = '800 16px ' + FONT;
    ctx.fillText('第 ' + s.rank + ' 名', x + 16, y + 23);
    ctx.fillStyle = P.ink3;
    ctx.font = '700 13px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText('/ ' + (s.rivals.length + 1), x + w - 14, y + 23);
    ctx.textAlign = 'left';
  }

  /* 进度条上的对手小点 */
  function drawRivalDots(ctx, s) {
    var C0 = global.Logic.C;
    var px0 = 348, pw = 566, py = 40;
    for (var i = 0; i < s.rivals.length; i++) {
      var r = s.rivals[i];
      var f = clamp(r.dist / C0.RACE_LEN, 0, 1);
      var x = px0 + pw * f;
      ctx.fillStyle = '#' + ('000000' + r.color.toString(16)).slice(-6);
      ctx.beginPath();
      ctx.arc(x, py + 5, 5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /* ---------------- 道具槽 ---------------- */
  var ITEM_SLOTS = [
    { x: 1126, y: 620, w: 58, h: 58 },
    { x: 1196, y: 620, w: 58, h: 58 }
  ];

  var ITEM_LOOK = {
    boost: { bg: 'rgba(245,166,35,0.16)', fg: '#f5a623', name: '加速' },
    jam: { bg: 'rgba(138,107,255,0.16)', fg: '#8a6bff', name: '干扰' },
    bottle: { bg: 'rgba(91,192,248,0.16)', fg: '#3aa6e0', name: '水瓶' },
    peel: { bg: 'rgba(255,209,102,0.2)', fg: '#e0aa1f', name: '香蕉皮' }
  };

  function itemIcon(ctx, kind, cx, cy, scale) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    if (kind === 'boost') {
      ctx.fillStyle = '#f5a623';
      ctx.beginPath();
      ctx.moveTo(2, -15); ctx.lineTo(-8, 2); ctx.lineTo(-1, 2);
      ctx.lineTo(-4, 15); ctx.lineTo(9, -4); ctx.lineTo(2, -4);
      ctx.closePath(); ctx.fill();
    } else if (kind === 'jam') {
      ctx.strokeStyle = '#8a6bff';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      for (var i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-12 + i * 1.5, -10 + i * 9);
        ctx.quadraticCurveTo(-2, -16 + i * 9, 12 - i * 1.5, -10 + i * 9);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    } else if (kind === 'bottle') {
      ctx.fillStyle = '#3aa6e0';
      rr(ctx, -7, -8, 14, 20, 4); ctx.fill();
      rr(ctx, -4, -14, 8, 7, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      rr(ctx, -4.5, -5, 3.5, 13, 1.6); ctx.fill();
    } else if (kind === 'peel') {
      ctx.fillStyle = '#e8b92a';
      ctx.beginPath();
      ctx.moveTo(-13, 8);
      ctx.quadraticCurveTo(-6, -14, 1, -2);
      ctx.quadraticCurveTo(4, -12, 12, 6);
      ctx.quadraticCurveTo(0, 13, -13, 8);
      ctx.fill();
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.moveTo(-9, 7);
      ctx.quadraticCurveTo(-3, -4, 0, 1);
      ctx.quadraticCurveTo(3, -5, 8, 6);
      ctx.quadraticCurveTo(0, 10, -9, 7);
      ctx.fill();
    }
    ctx.restore();
  }

  var JUMP_BTN = { x: 24, y: 596, w: 90, h: 90 };

  function drawJumpBtn(ctx, s, t) {
    if (s.phase !== 'run' && s.phase !== 'ready') return;
    var b = JUMP_BTN;
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    var on = s.phase === 'run' && s.jumpT > 0;

    ctx.save();
    ctx.shadowColor = 'rgba(38,56,80,0.16)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = on ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.82)';
    ctx.beginPath();
    ctx.arc(cx, cy, b.w / 2, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = on ? 'rgba(226,101,63,0.55)' : 'rgba(46,64,90,0.12)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, b.w / 2 - 0.8, 0, TAU);
    ctx.stroke();

    // 向上的箭头
    ctx.strokeStyle = on ? '#e2653f' : '#4a5668';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy + 9);
    ctx.lineTo(cx, cy - 13);
    ctx.moveTo(cx - 10, cy - 3);
    ctx.lineTo(cx, cy - 15);
    ctx.lineTo(cx + 10, cy - 3);
    ctx.stroke();
    ctx.lineCap = 'butt';

    ctx.fillStyle = on ? '#e2653f' : 'rgba(74,86,104,0.72)';
    ctx.font = '800 10px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('空格', cx, cy + 28);
    ctx.textAlign = 'left';
  }

  function drawItems(ctx, s, t) {
    for (var i = 0; i < ITEM_SLOTS.length; i++) {
      var sl = ITEM_SLOTS[i];
      var kind = s.items[i];
      var look = kind ? ITEM_LOOK[kind] : null;

      ctx.fillStyle = kind ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.62)';
      rr(ctx, sl.x, sl.y, sl.w, sl.h, 16);
      ctx.fill();
      ctx.strokeStyle = kind ? 'rgba(46,64,90,0.12)' : 'rgba(46,64,90,0.16)';
      ctx.lineWidth = 1.5;
      rr(ctx, sl.x + 0.75, sl.y + 0.75, sl.w - 1.5, sl.h - 1.5, 15);
      ctx.stroke();

      if (look) {
        ctx.strokeStyle = 'rgba(226,101,63,0.16)';
        ctx.lineWidth = 2;
        rr(ctx, sl.x + 1, sl.y + 1, sl.w - 2, sl.h - 2, 15);
        ctx.stroke();
        itemIcon(ctx, kind, sl.x + sl.w / 2, sl.y + sl.h / 2, 1);
        ctx.fillStyle = P.ink3;
        ctx.font = '700 10px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText(look.name, sl.x + sl.w / 2, sl.y + sl.h - 6);
        ctx.textAlign = 'left';
      } else {
        ctx.fillStyle = 'rgba(120,134,154,0.35)';
        ctx.font = '800 20px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('+', sl.x + sl.w / 2, sl.y + sl.h / 2 + 7);
        ctx.textAlign = 'left';
      }

      // 键位提示
      ctx.fillStyle = 'rgba(46,64,90,0.07)';
      rr(ctx, sl.x + sl.w / 2 - 10, sl.y - 20, 20, 17, 6);
      ctx.fill();
      ctx.fillStyle = P.ink3;
      ctx.font = '800 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), sl.x + sl.w / 2, sl.y - 8);
      ctx.textAlign = 'left';
    }
  }

  /* ---------------- 障碍提示 ---------------- */
  function drawObstacleHint(ctx, s, t) {
    if (s.phase !== 'run' || s.jumpT > 0) return;
    var next = null;
    for (var i = 0; i < s.obstacles.length; i++) {
      var o = s.obstacles[i];
      if (!o.done && o.x > s.distance) { next = o; break; }
    }
    if (!next) return;
    var d = next.x - s.distance;
    if (d > 48) return;

    var urgent = d < 16;
    var w = 268, h = 54, x = VW / 2 - w / 2, y = 128;
    var a = clamp((48 - d) / 22, 0, 1);
    ctx.globalAlpha = a;
    card(ctx, x, y, w, h, 16, urgent ? 0.97 : 0.86);

    // 警示三角
    var ix = x + 26, iy = y + 27;
    ctx.fillStyle = urgent ? '#e8523f' : '#f0a03c';
    ctx.beginPath();
    ctx.moveTo(ix, iy - 12);
    ctx.lineTo(ix + 12, iy + 10);
    ctx.lineTo(ix - 12, iy + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '800 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('!', ix, iy + 7);

    ctx.textAlign = 'left';
    ctx.fillStyle = P.ink;
    ctx.font = '800 15px ' + FONT;
    ctx.fillText('障碍 ' + Math.round(d) + 'm', x + 50, y + 24);
    ctx.fillStyle = urgent ? '#e8523f' : P.ink3;
    ctx.font = '700 12px ' + FONT;
    ctx.fillText(urgent ? '空格 —— 现在跳！' : '空格 跳过', x + 50, y + 42);
    ctx.globalAlpha = 1;
  }

  /* ---------------- 状态特效：加速 / 干扰 ---------------- */
  function drawFx(ctx, s, t) {
    if (s.jamT > 0) {
      var g = ctx.createRadialGradient(VW / 2, VH / 2, 150, VW / 2, VH / 2, 760);
      g.addColorStop(0, 'rgba(138,107,255,0)');
      g.addColorStop(1, 'rgba(138,107,255,0.42)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VW, VH);

      var a = clamp(s.jamT, 0, 1);
      ctx.globalAlpha = 0.75 + 0.25 * a;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 26px ' + FONT;
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(110,80,220,0.9)';
      ctx.strokeText('按键错乱 · 改用 ↑ ↓ 交替', VW / 2, 96);
      ctx.fillText('按键错乱 · 改用 ↑ ↓ 交替', VW / 2, 96);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
    if (s.boostT > 0) {
      var p = clamp(s.boostT / global.Logic.C.BOOST_TIME, 0, 1);
      var bx = 478, by = 80;
      pill(ctx, bx, by, 176, 34, 17, 'rgba(255,255,255,0.9)');
      ctx.fillStyle = '#f5a623';
      ctx.beginPath();
      ctx.moveTo(bx + 22, by + 9); ctx.lineTo(bx + 14, by + 19); ctx.lineTo(bx + 20, by + 19);
      ctx.lineTo(bx + 17, by + 26); ctx.lineTo(bx + 27, by + 16); ctx.lineTo(bx + 20, by + 16);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.ink;
      ctx.font = '800 12px ' + FONT;
      ctx.fillText('加速', bx + 34, by + 22);
      pill(ctx, bx + 68, by + 13, 94, 8, 4, 'rgba(46,64,90,0.1)');
      pill(ctx, bx + 68, by + 13, Math.max(6, 94 * p), 8, 4, '#f5a623');
    }
  }

  /* ---------------- 起跑倒计时 ---------------- */
  function drawCountdown(ctx, s, t) {
    ctx.fillStyle = 'rgba(18,32,52,0.34)';
    ctx.fillRect(0, 0, VW, VH);

    var n = Math.ceil(s.cd - 0.2);
    var frac = 1 - (s.cd - Math.floor(s.cd));
    var label, color, size;

    if (n <= 0) {
      label = 'GO!'; color = '#2fb87f'; size = 118;
    } else {
      label = String(n); color = '#ffffff'; size = 132;
    }

    if (s.startAt !== null && s.phase === 'ready') {
      // 玩家已经按下：显示判定
      if (s.startAt > global.Logic.C.START_FALSE) {
        label = '太早'; color = '#ff7a6b'; size = 96;
      }
    }

    ctx.textAlign = 'center';
    // 底衬圆盘
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = n <= 0 ? 'rgba(47,184,127,0.92)' : 'rgba(28,48,70,0.55)';
    ctx.beginPath();
    ctx.arc(VW / 2, 292, n <= 0 ? 96 : 92 + (1 - frac) * 8, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = n <= 0 ? 1 : 0.55 + 0.45 * frac;
    ctx.lineWidth = 10;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(20,34,54,0.35)';
    ctx.font = '800 ' + size + 'px ' + FONT;
    ctx.strokeText(label, VW / 2, 330);
    ctx.fillStyle = color;
    ctx.fillText(label, VW / 2, 330);
    ctx.globalAlpha = 1;

    var hint = s.startAt === null ? '按 空格 起跑' : '已就绪';
    ctx.font = '800 24px ' + FONT;
    var pulse = s.startAt === null ? (0.75 + 0.25 * Math.sin(t * 6)) : 1;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = s.startAt === null ? '#ffffff' : '#9df0c8';
    ctx.fillText(hint, VW / 2, 424);
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = '700 15px ' + FONT;
    ctx.fillText('越接近 GO 起跑，起步加速越快', VW / 2, 458);
    ctx.textAlign = 'left';
  }

  function drawNextGateHint(ctx, s, t) {
    var C = global.Logic.C;
    if (global.Logic.activeGate(s)) return;
    var nx = null;
    for (var i = 0; i < s.gates.length; i++) {
      if (s.distance < s.gates[i].d - C.GATE_AHEAD) { nx = s.gates[i]; break; }
    }
    if (!nx) return;
    var dist = nx.d - s.distance;
    if (dist > 190) return;
    var a = clamp((190 - dist) / 60, 0, 1);
    ctx.globalAlpha = a;
    var hx = 1252, hy = 330;
    card(ctx, hx - 138, hy - 26, 138, 52, 16, 0.88);
    ctx.fillStyle = '#ff8f6e';
    ctx.beginPath();
    ctx.moveTo(hx - 122, hy - 6);
    ctx.lineTo(hx - 110, hy);
    ctx.lineTo(hx - 122, hy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = P.ink;
    ctx.font = '800 15px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText('补给 ' + Math.round(dist) + 'm', hx - 16, hy + 5);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  /* 补给提示条：贴着画面底部，两个大按键提示 */
  var GATE_PANEL = { x: 356, y: 618, w: 568, h: 86 };

  function keycap(ctx, x, y, w, h, dir, active, t) {
    rr(ctx, x, y, w, h, 11);
    ctx.fillStyle = active ? '#ffffff' : 'rgba(255,255,255,0.55)';
    ctx.fill();

    ctx.strokeStyle = active ? 'rgba(226,101,63,0.32)' : 'rgba(46,64,90,0.10)';
    ctx.lineWidth = 2;
    rr(ctx, x + 1, y + 1, w - 2, h - 2, 10);
    ctx.stroke();

    if (active) {
      var pulse = 0.3 + 0.3 * Math.sin(t * 5);
      ctx.strokeStyle = 'rgba(255,138,107,' + pulse + ')';
      ctx.lineWidth = 3;
      rr(ctx, x - 3, y - 3, w + 6, h + 6, 14);
      ctx.stroke();
    }

    // 箭头用矢量画，比字形更清楚
    var cx = x + w / 2, cy = y + h / 2;
    var g = dir === 'up' ? 1 : -1;
    ctx.strokeStyle = active ? '#e2653f' : '#a9b4c2';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy + 10 * g);
    ctx.lineTo(cx, cy - 9 * g);
    ctx.moveTo(cx - 7, cy - 2 * g);
    ctx.lineTo(cx, cy - 10 * g);
    ctx.lineTo(cx + 7, cy - 2 * g);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function drawGatePrompt(ctx, s, t) {
    var C = global.Logic.C;
    var g = global.Logic.activeGate(s);
    if (!g) return;

    var P0 = GATE_PANEL;
    var drinkLeft = !g.drank, eatLeft = !g.ate;
    var anyLeft = drinkLeft || eatLeft;

    /* 上面的小标题 */
    ctx.textAlign = 'center';
    ctx.font = '800 14px ' + FONT;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(28,48,70,0.30)';
    var head = anyLeft ? ('补给点 ' + g.d + 'm · 现在可以补给了') : ('补给点 ' + g.d + 'm · 这站已用过');
    ctx.strokeText(head, VW / 2, P0.y - 14);
    ctx.fillStyle = anyLeft ? '#ffffff' : 'rgba(255,255,255,0.78)';
    ctx.fillText(head, VW / 2, P0.y - 14);
    ctx.textAlign = 'left';

    /* 卡片 */
    card(ctx, P0.x, P0.y, P0.w, P0.h, 22, anyLeft ? 0.94 : 0.82);

    var colW = P0.w / 2;
    var rows = [
      { x: P0.x + 22, key: 'up', title: '喝水', on: drinkLeft, used: '这站喝过了',
        desc: '水分补满 · 得到空水瓶', accent: '#3aa6e0', tag: 'water' },
      { x: P0.x + colW + 6, key: 'down', title: '吃香蕉', on: eatLeft, used: '这站吃过了',
        desc: '体力 +' + C.EAT_STAMINA + ' · 得到香蕉皮', accent: '#f5a623', tag: 'food' }
    ];

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      keycap(ctx, r.x, P0.y + 21, 46, 44, r.key, r.on, t);

      ctx.fillStyle = r.on ? P.ink : '#aeb9c6';
      ctx.font = '800 16px ' + FONT;
      ctx.fillText(r.title, r.x + 60, P0.y + 42);

      ctx.fillStyle = r.on ? P.ink3 : '#c2cbd6';
      ctx.font = '600 12px ' + FONT;
      ctx.fillText(r.on ? r.desc : r.used, r.x + 60, P0.y + 62);

      /* 右侧小图标 */
      var ix = P0.x + (i === 0 ? colW : P0.w) - 34, iy = P0.y + 43;
      ctx.fillStyle = r.on ? hexA(r.accent, 0.16) : 'rgba(46,64,90,0.06)';
      ctx.beginPath();
      ctx.arc(ix, iy, 15, 0, TAU);
      ctx.fill();
      ctx.fillStyle = r.on ? r.accent : '#c2cbd6';
      if (r.tag === 'water') {
        ctx.beginPath();
        ctx.moveTo(ix, iy - 9);
        ctx.quadraticCurveTo(ix + 9, iy + 2, ix, iy + 9);
        ctx.quadraticCurveTo(ix - 9, iy + 2, ix, iy - 9);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(ix, iy - 3, 8, Math.PI, TAU);
        ctx.lineTo(ix + 8, iy + 6);
        ctx.quadraticCurveTo(ix, iy + 11, ix - 8, iy + 6);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /* ---------------- 标题 / 结算 ---------------- */
  function overlay(ctx, a) {
    ctx.fillStyle = 'rgba(18,32,52,' + a + ')';
    ctx.fillRect(0, 0, VW, VH);
  }

  function drawTitle(ctx, t, hint, warn) {
    overlay(ctx, 0.22);
    var x = 300, y = 96, w = 680, h = 528;
    card(ctx, x, y, w, h, 32, 0.96);

    ctx.textAlign = 'center';
    ctx.fillStyle = P.ink;
    ctx.font = '800 66px ' + FONT;
    ctx.fillText('节奏长跑', VW / 2, y + 108);
    ctx.fillStyle = P.ink3;
    ctx.font = '600 16px ' + FONT;
    ctx.fillText('和三个对手抢 1000 米 · 踩稳节奏，道具开路', VW / 2, y + 144);

    var rows = [
      { icon: 'AD', title: 'A / D 交替点击', desc: '左右换着来，每次间隔差不多就省力' },
      { icon: '跳', title: '空格：起跑 / 跳跃', desc: '倒计时越接近 GO 起跑越快，路上空格越过障碍' },
      { icon: '道', title: '1 / 2 用道具', desc: '加速、干扰对手；喝水的空瓶、香蕉皮都能扔出去' }
    ];
    for (var i = 0; i < rows.length; i++) {
      var ry = y + 186 + i * 66;
      ctx.fillStyle = 'rgba(255,138,107,0.12)';
      rr(ctx, x + 74, ry, 62, 46, 14);
      ctx.fill();
      ctx.fillStyle = '#e2653f';
      ctx.font = '800 16px ' + FONT;
      ctx.fillText(rows[i].icon, x + 105, ry + 30);
      ctx.textAlign = 'left';
      ctx.fillStyle = P.ink;
      ctx.font = '700 17px ' + FONT;
      ctx.fillText(rows[i].title, x + 156, ry + 20);
      ctx.fillStyle = '#71809a';
      ctx.font = '600 13px ' + FONT;
      ctx.fillText(rows[i].desc, x + 156, ry + 40);
      ctx.textAlign = 'center';
    }

    var pulse = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.fillStyle = 'rgba(255,122,107,' + (0.9 + pulse * 0.1) + ')';
    rr(ctx, VW / 2 - 175, y + h - 96, 350, 58, 29);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '800 19px ' + FONT;
    ctx.fillText('点击画面 · 或按 空格 开始', VW / 2, y + h - 59);

    var warnC = warn === true;
    ctx.fillStyle = warnC ? '#e2653f' : 'rgba(140,153,171,1)';
    ctx.font = (warnC ? '800 13px ' : '600 12px ') + FONT;
    ctx.fillText(hint || '', VW / 2, y + h - 18);
    ctx.textAlign = 'left';
  }

  /* 键盘一直没响应时的兜底提示（鼠标 / 触摸也能玩） */
  function drawFocusWarn(ctx, t) {
    var text = '键盘未响应 · 点画面左右两边来跑';
    ctx.font = '800 13px ' + FONT;
    var w = ctx.measureText(text).width + 38;
    var x = 22, y = 138;
    ctx.globalAlpha = 0.88 + 0.12 * Math.sin(t * 4);
    ctx.fillStyle = 'rgba(255,255,255,0.93)';
    rr(ctx, x, y, w, 32, 16);
    ctx.fill();
    ctx.fillStyle = '#e2653f';
    ctx.beginPath();
    ctx.arc(x + 18, y + 16, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5a6577';
    ctx.fillText(text, x + 31, y + 21);
    ctx.globalAlpha = 1;
  }

  function drawResult(ctx, s, t) {
    overlay(ctx, 0.46);
    var x = 330, y = 108, w = 620, h = 508;
    card(ctx, x, y, w, h, 32, 0.97);

    var g = global.Logic.grade(s.elapsed, s.collapsed, s.finishRank || s.rank);
    ctx.textAlign = 'center';

    ctx.fillStyle = P.ink3;
    ctx.font = '700 15px ' + FONT;
    ctx.fillText(s.collapsed ? '体力见底，被迫退赛' : ('到达终点 · 第 ' + (s.finishRank || s.rank) + ' 名'), VW / 2, y + 46);

    var gcol = s.collapsed ? '#8c99ab' : (g.letter === 'S' ? '#f5a623' : g.letter === 'A' ? '#43d69b' : '#5ba8e8');
    ctx.fillStyle = gcol;
    ctx.font = '800 86px ' + FONT;
    ctx.fillText(g.letter, VW / 2, y + 132);
    ctx.font = '700 15px ' + FONT;
    ctx.fillStyle = P.ink2;
    ctx.fillText(g.label, VW / 2, y + 160);

    var stats = [
      ['用时', fmtTime(s.elapsed)],
      ['距离', Math.floor(s.distance) + ' m'],
      ['平均配速', global.Logic.paceText(s.elapsed, s.distance)],
      ['节奏稳定', (s.strides ? Math.round(100 * s.steady / s.strides) : 0) + '%'],
      ['跳过障碍', s.cleared + ' / ' + (s.cleared + s.hits)],
      ['道具命中', s.shotsFired + ' 次']
    ];
    for (var i = 0; i < stats.length; i++) {
      var col = i % 2, row = Math.floor(i / 2);
      var sx = x + 66 + col * 254;
      var sy = y + 206 + row * 62;
      ctx.textAlign = 'left';
      ctx.fillStyle = P.ink3;
      ctx.font = '600 13px ' + FONT;
      ctx.fillText(stats[i][0], sx, sy);
      ctx.fillStyle = P.ink;
      ctx.font = '800 24px ' + FONT;
      ctx.fillText(stats[i][1], sx, sy + 28);
    }

    ctx.textAlign = 'center';
    var pulse = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.fillStyle = 'rgba(255,122,107,' + (0.92 + pulse * 0.08) + ')';
    rr(ctx, VW / 2 - 130, y + h - 88, 260, 54, 27);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '800 19px ' + FONT;
    ctx.fillText('再来一次', VW / 2, y + h - 53);
    ctx.fillStyle = 'rgba(140,153,171,1)';
    ctx.font = '600 12px ' + FONT;
    ctx.fillText('按 R / 点击屏幕', VW / 2, y + h - 16);
    ctx.textAlign = 'left';
  }

  global.HUD = {
    VW: VW, VH: VH,
    drawHUD: drawHUD, drawTitle: drawTitle, drawResult: drawResult, drawCountdown: drawCountdown,
    drawFocusWarn: drawFocusWarn,
    GATE_PANEL: GATE_PANEL, ITEM_SLOTS: ITEM_SLOTS, JUMP_BTN: JUMP_BTN, fmtTime: fmtTime, clamp: clamp
  };
})(typeof window !== 'undefined' ? window : globalThis);
