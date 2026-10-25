/* =========================================================
 *  节拍长跑 · HUD 层（2D Canvas 覆盖在 3D 画面之上）
 * ========================================================= */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var VW = 1280, VH = 720;
  var FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",system-ui,-apple-system,sans-serif';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
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

    /* 连击 */
    if (s.combo >= 3 && view.runnerScreen) {
      var cAlpha = clamp((s.combo - 2) / 6, 0, 1);
      ctx.globalAlpha = cAlpha;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f5a623';
      ctx.font = '800 15px ' + FONT;
      ctx.fillText('连击 ×' + s.combo, view.runnerScreen.x, view.runnerScreen.y - 110);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    drawPace(ctx, s, view, t);
    drawGatePrompt(ctx, s, t);
    drawNextGateHint(ctx, s, t);
    drawPopups(ctx, view);

    if (s.started && s.elapsed < 9) {
      var a2 = clamp(1 - (s.elapsed - 6) / 3, 0, 1);
      ctx.globalAlpha = a2;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = '800 18px ' + FONT;
      ctx.fillText('A / D 交替 · 踩准节拍', VW / 2, 636);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }

  function drawPopups(ctx, view) {
    ctx.textAlign = 'center';
    for (var i = 0; i < view.popups.length; i++) {
      var p = view.popups[i];
      var a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.font = '800 ' + p.size + 'px ' + FONT;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeText(p.text, p.x, p.y - (1 - a) * 34);
      ctx.fillText(p.text, p.x, p.y - (1 - a) * 34);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }

  function drawPace(ctx, s, view, t) {
    var C = global.Logic.C;
    var x0 = 392, w = 496, y = 664, h = 50;
    card(ctx, x0, y, w, h, 18, 0.93);

    var tx = x0 + 22, tw = w - 44, ty = y + 20, th = 10;
    pill(ctx, tx, ty, tw, th, th / 2, 'rgba(46,64,90,0.12)');

    var lo = C.PERFECT_LO / 1.75, hi = C.PERFECT_HI / 1.75;
    var zx = tx + tw * lo, zw = tw * (hi - lo);
    var zg = ctx.createLinearGradient(zx, 0, zx + zw, 0);
    zg.addColorStop(0, 'rgba(255,209,102,0.55)');
    zg.addColorStop(0.5, 'rgba(255,178,58,0.95)');
    zg.addColorStop(1, 'rgba(255,209,102,0.55)');
    ctx.fillStyle = zg;
    rr(ctx, zx, ty - 3, zw, th + 6, 6);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx + tw / 1.75, ty - 7);
    ctx.lineTo(tx + tw / 1.75, ty + th + 7);
    ctx.stroke();

    var r = s.lastGood < 0 ? 0 : (s.t - s.lastGood) / C.IDEAL;
    var show = s.started && !s.finished && !s.collapsed;
    if (show && r <= 1.75) {
      var mx = tx + tw * (r / 1.75);
      var inZone = r >= C.PERFECT_LO && r <= C.PERFECT_HI;
      if (inZone) {
        ctx.fillStyle = 'rgba(255,178,58,0.22)';
        ctx.beginPath();
        ctx.arc(mx, ty + th / 2, 17, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = inZone ? '#ff9b2f' : 'rgba(70,86,110,0.55)';
      rr(ctx, mx - 4, ty - 9, 8, th + 18, 4);
      ctx.fill();
    } else if (show) {
      ctx.fillStyle = 'rgba(120,134,154,0.35)';
      rr(ctx, tx - 2, ty - 6, 7, th + 12, 3.5);
      ctx.fill();
    }

    ctx.fillStyle = P.ink3;
    ctx.font = '800 12px ' + FONT;
    ctx.fillText('节拍', x0 + 22, y + 41);
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

  function keycap(ctx, x, y, w, h, text, active) {
    ctx.fillStyle = active ? 'rgba(255,138,107,0.16)' : 'rgba(46,64,90,0.07)';
    rr(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.fillStyle = active ? '#e2653f' : P.ink3;
    ctx.font = '800 15px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawGatePrompt(ctx, s, t) {
    var C = global.Logic.C;
    var g = global.Logic.activeGate(s);
    if (!g) return;
    var x = 886, y = 468, w = 366, h = 176;
    card(ctx, x, y, w, h, 20, 0.95);

    ctx.fillStyle = '#ff8f6e';
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 18);
    ctx.lineTo(x + 20, y + 40);
    ctx.lineTo(x + 30, y + 34);
    ctx.lineTo(x + 40, y + 40);
    ctx.lineTo(x + 40, y + 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = P.ink;
    ctx.font = '800 19px ' + FONT;
    ctx.fillText('补给点 ' + g.d + 'm', x + 52, y + 38);
    ctx.fillStyle = P.ink3;
    ctx.font = '600 12px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText('路过时按', x + w - 22, y + 38);
    ctx.textAlign = 'left';

    // 喝水
    var rowY = y + 52;
    keycap(ctx, x + 20, rowY, 34, 34, '↑', !g.drank);
    ctx.fillStyle = g.drank ? P.ink3 : P.ink;
    ctx.font = '700 15px ' + FONT;
    ctx.fillText('喝水', x + 66, rowY + 16);
    ctx.fillStyle = g.drank ? '#b9c3d0' : P.ink3;
    ctx.font = '600 12px ' + FONT;
    ctx.fillText(g.drank ? '这站已经喝过' : '水分补满 · 体力 +' + C.DRINK_STAMINA, x + 66, rowY + 32);
    ctx.fillStyle = 'rgba(91,192,248,0.18)';
    ctx.beginPath();
    ctx.arc(x + w - 34, rowY + 17, 15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = g.drank ? '#b9c3d0' : '#3aa6e0';
    ctx.beginPath();
    ctx.moveTo(x + w - 34, rowY + 8);
    ctx.quadraticCurveTo(x + w - 24, rowY + 19, x + w - 34, rowY + 27);
    ctx.quadraticCurveTo(x + w - 44, rowY + 19, x + w - 34, rowY + 8);
    ctx.fill();

    // 吃东西
    rowY = y + 104;
    keycap(ctx, x + 20, rowY, 34, 34, '↓', !g.ate);
    ctx.fillStyle = g.ate ? P.ink3 : P.ink;
    ctx.font = '700 15px ' + FONT;
    ctx.fillText('吃东西', x + 66, rowY + 16);
    ctx.fillStyle = g.ate ? '#b9c3d0' : P.ink3;
    ctx.font = '600 12px ' + FONT;
    ctx.fillText(g.ate ? '这站已经吃过' : '体力 +' + C.EAT_STAMINA + ' · 但要慢跑一段', x + 66, rowY + 32);
    ctx.fillStyle = 'rgba(245,166,35,0.18)';
    ctx.beginPath();
    ctx.arc(x + w - 34, rowY + 17, 15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = g.ate ? '#b9c3d0' : '#f5a623';
    ctx.beginPath();
    ctx.arc(x + w - 34, rowY + 6, 9, Math.PI, TAU);
    ctx.lineTo(x + w - 25, rowY + 20);
    ctx.quadraticCurveTo(x + w - 34, rowY + 25, x + w - 43, rowY + 20);
    ctx.closePath();
    ctx.fill();
  }

  /* ---------------- 标题 / 结算 ---------------- */
  function overlay(ctx, a) {
    ctx.fillStyle = 'rgba(18,32,52,' + a + ')';
    ctx.fillRect(0, 0, VW, VH);
  }

  function drawTitle(ctx, t) {
    overlay(ctx, 0.22);
    var x = 300, y = 96, w = 680, h = 528;
    card(ctx, x, y, w, h, 32, 0.96);

    ctx.textAlign = 'center';
    ctx.fillStyle = P.ink;
    ctx.font = '800 66px ' + FONT;
    ctx.fillText('节拍长跑', VW / 2, y + 108);
    ctx.fillStyle = P.ink3;
    ctx.font = '600 16px ' + FONT;
    ctx.fillText('一步一拍 · 别乱按，按稳了就省力', VW / 2, y + 144);

    var rows = [
      { icon: 'AD', title: 'A / D 交替点击', desc: '左右换着来，同侧连点会绊步' },
      { icon: '拍', title: '踩准金色节拍区', desc: '踩得越准越省体力，连击还有加速' },
      { icon: '水', title: '补给点喝水吃东西', desc: '水必须补，吃东西回体力但会慢一段' }
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
    rr(ctx, VW / 2 - 150, y + h - 96, 300, 58, 29);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '800 20px ' + FONT;
    ctx.fillText('按 A / D 开始', VW / 2, y + h - 59);

    ctx.fillStyle = 'rgba(140,153,171,1)';
    ctx.font = '600 12px ' + FONT;
    ctx.fillText('手机：点屏幕左右两侧交替 · M 静音', VW / 2, y + h - 18);
    ctx.textAlign = 'left';
  }

  function drawResult(ctx, s, t) {
    overlay(ctx, 0.46);
    var x = 330, y = 108, w = 620, h = 508;
    card(ctx, x, y, w, h, 32, 0.97);

    var g = global.Logic.grade(s.elapsed, s.collapsed);
    ctx.textAlign = 'center';

    ctx.fillStyle = P.ink3;
    ctx.font = '700 15px ' + FONT;
    ctx.fillText(s.collapsed ? '体力见底，被迫退赛' : '到达终点', VW / 2, y + 46);

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
      ['完美踩点', (s.strides ? Math.round(100 * s.perfect / s.strides) : 0) + '%'],
      ['最高连击', s.bestCombo + ''],
      ['剩余体力上限', Math.round(s.total) + '']
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
    drawHUD: drawHUD, drawTitle: drawTitle, drawResult: drawResult,
    fmtTime: fmtTime, clamp: clamp
  };
})(typeof window !== 'undefined' ? window : globalThis);
