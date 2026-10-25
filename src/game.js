/* =========================================================
 *  节奏长跑 · 主循环 / 输入 / 音效（3D 版）
 * ========================================================= */
(function () {
  'use strict';

  var sceneCanvas = document.getElementById('scene');
  var hudCanvas = document.getElementById('hud');
  var ctx = hudCanvas.getContext('2d');
  var VW = 1280, VH = 720;
  var C = Logic.C;

  var dpr = 1, viewScale = 1, hudScale = 1, ox = 0, oy = 0;
  var s, view;
  var keyEver = false;              // 是否真的收到过键盘事件（判断焦点是否在页面上）
  var clickedEver = false;          // 是否点过画面
  var isTouch = (navigator.maxTouchPoints || 0) > 0 &&
    !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  var loadAt = performance.now() / 1000;

  var ITEM_NAME = { boost: '加速', jam: '干扰器', bottle: '空水瓶', peel: '香蕉皮' };

  /* ---------------- 音效 ---------------- */
  var Sfx = {
    ac: null, muted: false,
    init: function () {
      if (this.ac) {
        if (this.ac.state === 'suspended') { try { this.ac.resume(); } catch (e) {} }
        return;
      }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ac = new AC(); } catch (e) { this.ac = null; }
      if (this.ac && this.ac.state === 'suspended') { try { this.ac.resume(); } catch (e) {} }
    },
    tone: function (freq, dur, type, vol, slide) {
      if (!this.ac || this.muted) return;
      var t0 = this.ac.currentTime;
      var o = this.ac.createOscillator();
      var g = this.ac.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.ac.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    },
    step: function () { this.tone(150 + Math.random() * 24, 0.07, 'triangle', 0.045, 90); },
    steady: function (combo) {
      var base = 720 + Math.min(combo, 18) * 22;
      this.tone(base, 0.1, 'sine', 0.05);
      this.tone(base * 1.5, 0.14, 'sine', 0.032);
    },
    stumble: function () { this.tone(240, 0.14, 'sawtooth', 0.05, 120); },
    drink: function () { this.tone(420, 0.22, 'sine', 0.05, 780); },
    eat: function () {
      this.tone(300, 0.07, 'square', 0.035);
      var self = this;
      setTimeout(function () { self.tone(260, 0.07, 'square', 0.035); }, 130);
    },
    jump: function () { this.tone(520, 0.12, 'sine', 0.042, 900); },
    thud: function () { this.tone(120, 0.2, 'square', 0.055, 60); },
    slip: function () { this.tone(660, 0.28, 'sawtooth', 0.04, 180); },
    zap: function () { this.tone(1200, 0.16, 'square', 0.035, 300); },
    beep: function (f) { this.tone(f, 0.12, 'square', 0.05); },
    boost: function () { this.tone(300, 0.34, 'sine', 0.05, 1100); },
    finish: function () {
      var self = this, notes = [523, 659, 784, 1046];
      notes.forEach(function (n, i) {
        setTimeout(function () { self.tone(n, 0.28, 'sine', 0.055); }, i * 110);
      });
    },
    fail: function () { this.tone(220, 0.6, 'sine', 0.06, 70); }
  };

  /* ---------------- 复位 ---------------- */
  function resetView() {
    view = { phase: 0, popups: [], runnerScreen: null, p2Screen: null };
  }
  var mode = 'solo';
  function reset() {
    s = Logic.create(mode);
    resetView();
    Scene3D.reset();
  }

  /* ---------------- 尺寸 ---------------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = window.innerWidth, ch = window.innerHeight;
    viewScale = Math.min(cw / VW, ch / VH);
    var w = VW * viewScale, h = VH * viewScale;
    ox = (cw - w) / 2;
    oy = (ch - h) / 2;

    [sceneCanvas, hudCanvas].forEach(function (cv) {
      cv.style.left = ox + 'px';
      cv.style.top = oy + 'px';
      cv.style.width = w + 'px';
      cv.style.height = h + 'px';
    });

    Scene3D.resize(w, h);

    hudCanvas.width = Math.floor(w * dpr);
    hudCanvas.height = Math.floor(h * dpr);
    hudScale = hudCanvas.width / VW;
  }
  window.addEventListener('resize', resize);

  function toLogical(clientX, clientY) {
    var rect = hudCanvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / viewScale,
      y: (clientY - rect.top) / viewScale
    };
  }

  /* ---------------- 提示文字 ---------------- */
  function popup(text, color, size, player) {
    // 同一条提示 0.28 秒内重复触发时只刷新，避免低帧下堆成一摞
    for (var i = view.popups.length - 1; i >= 0; i--) {
      var q = view.popups[i];
      if (q.text === text && q.max - q.life < 0.55) { q.life = q.max; return; }
    }
    var scr = view.runnerScreen;
    if (player && player.id === 2 && view.p2Screen) scr = view.p2Screen;
    var rx = scr ? scr.x : 400;
    var ry = scr ? scr.y : 560;
    view.popups.push({
      text: text, color: color || '#f5a623', size: size || 22,
      x: rx + (Math.random() - 0.5) * 40, y: ry - 40,
      life: 0.85, max: 0.85
    });
  }

  /* ---------------- 事件 ---------------- */
  function evPlayer(e) {
    return s.players[(e.p || 1) - 1] || s.players[0];
  }
  function evTag(e) {
    return (s.mode === 'duo' && e.p === 2) ? 'P2 ' : '';
  }

  function handleEvents() {
    var x = s.distance;
    for (var i = 0; i < s.events.length; i++) {
      var e = s.events[i];
      switch (e.k) {
        case 'stride': {
          var sp = evPlayer(e);
          Scene3D.spawnDust(sp.distance - 0.2, (sp.lane || 0) + (Math.random() - 0.5) * 0.35);
          Sfx.step();
          break;
        }

        case 'countdown': Sfx.beep(660); break;
        case 'startpress':
          Sfx.beep(880);
          if (e.cd > C.START_FALSE) popup('太早了！', '#e05243', 20);
          break;
        case 'go':
          if (e.quality > 0.75) popup('完美起步！', '#2fb87f', 26);
          else if (e.quality > 0.4) popup('不错的起步', '#43d69b', 20);
          else popup('起步有点慢', 'rgba(90,105,126,0.92)', 18);
          Sfx.beep(1180);
          break;
        case 'false_start':
          popup('抢跑，等一下！', '#e05243', 22);
          Sfx.stumble();
          break;
        case 'late_start':
          popup('没按空格，慢起步', 'rgba(90,105,126,0.92)', 17);
          break;

        case 'jump':
          Sfx.jump();
          Scene3D.spawnDust(x, (Math.random() - 0.5) * 0.5);
          break;
        case 'clear':
          Scene3D.spawnSparks(x, 0.9, 0, 3);
          break;
        case 'hit':
          Sfx.thud();
          Scene3D.shake(0.45);
          popup(evTag(e) + (e.kind === 'puddle' ? '踩水坑了！' : '撞到障碍！'), '#e05243', 22, evPlayer(e));
          break;
        case 'slip':
          Sfx.slip();
          Scene3D.shake(0.35);
          popup(evTag(e) + '踩到香蕉皮！', '#f5a623', 21, evPlayer(e));
          break;
        case 'jammed':
          Sfx.zap();
          Scene3D.shake(0.4);
          popup(evTag(e) + '按键被打乱！', '#8a6bff', 23, evPlayer(e));
          break;
        case 'hitbottle':
          Sfx.thud();
          Scene3D.shake(0.35);
          popup(evTag(e) + '被水瓶砸中！', '#3aa6e0', 21, evPlayer(e));
          break;
        case 'incoming':
          popup('小心！', '#e05243', 19);
          break;

        case 'item':
          popup('获得 ' + ITEM_NAME[e.item], '#5b7cfa', 19);
          break;
        case 'itemfull':
          popup('道具满了', 'rgba(90,105,126,0.92)', 16);
          break;
        case 'boost':
          Sfx.boost();
          popup('加速！', '#2fb87f', 24);
          Scene3D.spawnSparks(x + 0.4, 1.2, 0, 6);
          break;
        case 'peel':
          popup('放下香蕉皮', '#f5a623', 18);
          break;
        case 'throw':
          Sfx.jump();
          break;
        case 'notarget':
          popup('前面没有对手', 'rgba(90,105,126,0.92)', 16);
          break;
        case 'hitrival':
          Sfx.zap();
          popup(e.mode === 'bottle' ? '命中！' + e.rival.name + '被砸中' : e.rival.name + '节奏被打乱',
            '#2fb87f', 20);
          Scene3D.spawnSparks(e.rival.dist, 1.4, 0, 6);
          break;

        case 'drink': Sfx.drink(); break;
        case 'eat': Sfx.eat(); break;
        case 'drank':
          popup(evTag(e) + '水分补满', '#3aa6e0', 20, evPlayer(e));
          Scene3D.spawnSparks(x, 1.5, 0, 6);
          break;
        case 'ate':
          popup(evTag(e) + '体力 +' + C.EAT_STAMINA, '#f5a623', 20, evPlayer(e));
          break;
        case 'thirst':
          popup(evTag(e) + '口渴了！', '#3aa6e0', 19, evPlayer(e));
          break;
        case 'finish':
          Sfx.finish();
          break;
        case 'exhausted':
          Scene3D.shake(0.32);
          Sfx.fail();
          popup(evTag(e) + '体力见底 · 走一走', '#e05243', 21, evPlayer(e));
          break;
        case 'recovered':
          Sfx.beep(980);
          popup(evTag(e) + '缓过来了，继续跑', '#43d69b', 19, evPlayer(e));
          break;
        case 'timeout':
          Scene3D.shake(0.5);
          Sfx.fail();
          popup('超时结束', 'rgba(90,105,126,0.95)', 22);
          break;
      }
    }
    s.events.length = 0;
  }

  /* ---------------- 输入 ---------------- */
  function stride(r, side) {
    if (s.phase === 'idle') { startGame('solo'); return; }
    if (s.phase !== 'run' || !r) return;
    Sfx.init();
    Logic.press(s, r, side);
  }
  function act(r, kind) {
    if (s.phase !== 'run' || !r) return;
    Logic.startAction(s, r, kind);
  }
  function pressSpace(r) {
    Sfx.init();
    var res = Logic.space(s, r || s.players[0]);
    if (res === 'jump') Sfx.jump();
  }
  /* 双人模式只有 4 个键，补给合并成一个：先喝水，水够了就吃香蕉 */
  function feed(r) {
    if (s.phase !== 'run' || !r) return;
    var g = Logic.activeGate(s, r);
    var idx = r.id - 1;
    if (g && !g.drankBy[idx] && r.water < 96) { act(r, 'drink'); return; }
    if (g && !g.ateBy[idx]) { act(r, 'eat'); return; }
    act(r, 'drink');
  }
  function startGame(m) {
    mode = m;
    reset();
    Sfx.init();
    Logic.space(s, s.players[0]);
  }
  function doAct(r, action) {
    if (!r) return;
    if (action === 'L') stride(r, 'L');
    else if (action === 'R') stride(r, 'R');
    else if (action === 'JUMP') pressSpace(r);
    else if (action === 'FEED') feed(r);
    else if (action === 'DRINK') act(r, 'drink');
    else if (action === 'EAT') act(r, 'eat');
  }

  /* ---------------- 键盘 ----------------
   * 优先用 ev.code（物理键位），不受输入法、键盘布局、大小写影响。
   * 中文输入法激活时 ev.key 会变成 "Process"，用 code 才不会漏键。 */
  var KEYMAP = {
    Space: 'SPACE', Enter: 'ENTER', NumpadEnter: 'ENTER',
    KeyA: 'A', KeyD: 'D', KeyW: 'W', KeyS: 'S',
    ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN',
    Digit1: 'I1', Numpad1: 'I1', Digit2: 'I2', Numpad2: 'I2',
    KeyR: 'RESET', KeyM: 'MUTE'
  };
  function keyName(ev) {
    var n = KEYMAP[ev.code];
    if (n) return n;
    var k = ev.key || '';
    if (k === ' ' || k === 'Spacebar') return 'SPACE';
    if (k === 'Enter') return 'ENTER';
    if (k === 'ArrowLeft') return 'LEFT';
    if (k === 'ArrowRight') return 'RIGHT';
    if (k === 'ArrowUp') return 'UP';
    if (k === 'ArrowDown') return 'DOWN';
    if (k === '1') return 'I1';
    if (k === '2') return 'I2';
    if (k.length === 1) {
      var c = k.toLowerCase();
      if (c === 'a') return 'A';
      if (c === 'd') return 'D';
      if (c === 'w') return 'W';
      if (c === 's') return 'S';
      if (c === 'r') return 'RESET';
      if (c === 'm') return 'MUTE';
    }
    return null;
  }

  window.addEventListener('keydown', function (ev) {
    if (ev.repeat) return;
    keyEver = true;
    var nm = keyName(ev);
    if (!nm) return;
    ev.preventDefault();

    if (nm === 'RESET') { reset(); Sfx.init(); return; }
    if (nm === 'MUTE') {
      Sfx.init();
      Sfx.muted = !Sfx.muted;
      popup(Sfx.muted ? '静音' : '开声音', 'rgba(90,105,126,0.95)', 16);
      return;
    }

    if (s.phase === 'idle') {
      if (nm === 'SPACE') startGame('solo');
      else if (nm === 'ENTER') startGame('duo');
      return;
    }
    if (nm === 'I1' || nm === 'I2') {
      if (s.phase === 'run' && s.mode === 'solo') {
        Logic.useItem(s, s.players[0], nm === 'I1' ? 0 : 1);
      }
      return;
    }

    var p1 = s.players[0], p2 = s.players[1];

    if (s.mode === 'duo' && p2) {
      if (nm === 'A') return doAct(p1, 'L');
      if (nm === 'D') return doAct(p1, 'R');
      if (nm === 'W') return doAct(p1, 'JUMP');
      if (nm === 'S') return doAct(p1, 'FEED');
      if (nm === 'LEFT') return doAct(p2, 'L');
      if (nm === 'RIGHT') return doAct(p2, 'R');
      if (nm === 'UP') return doAct(p2, 'JUMP');
      if (nm === 'DOWN') return doAct(p2, 'FEED');
      if (nm === 'SPACE') return doAct(p1, 'JUMP');
      return;
    }

    var jammed = p1.jamT > 0;
    if (nm === 'SPACE') return pressSpace(p1);
    if (nm === 'A' || nm === 'LEFT') return doAct(p1, 'L');
    if (nm === 'D' || nm === 'RIGHT') return doAct(p1, 'R');
    if (nm === 'W' || nm === 'UP') return doAct(p1, jammed ? 'L' : 'DRINK');
    if (nm === 'S' || nm === 'DOWN') return doAct(p1, jammed ? 'R' : 'EAT');
  }, { passive: false });

  /* 拿到键盘焦点（预览面板 / iframe 里首次点击时需要） */
  function grabFocus() {
    try { window.focus(); } catch (e) {}
  }
  window.addEventListener('load', function () { setTimeout(grabFocus, 60); });

  hudCanvas.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    grabFocus();                     // 让键盘事件进到这个页面（iframe / 预览面板里必须）
    clickedEver = true;
    var pt = toLogical(ev.clientX, ev.clientY);

    var p1 = s.players[0];

    if (s.phase === 'idle') {
      // 标题页：点哪个按钮进哪个模式
      var btns = HUD.TITLE_BTN;
      for (var bi = 0; bi < btns.length; bi++) {
        var bb = btns[bi];
        if (pt.x > bb.x && pt.x < bb.x + bb.w && pt.y > bb.y && pt.y < bb.y + bb.h) {
          startGame(bb.mode);
          return;
        }
      }
      startGame('solo');
      return;
    }
    if (s.phase === 'over') { reset(); Sfx.init(); return; }

    // 跳跃 / 起跑按钮
    var jb = HUD.JUMP_BTN;
    var jdx = pt.x - (jb.x + jb.w / 2), jdy = pt.y - (jb.y + jb.h / 2);
    if (jdx * jdx + jdy * jdy < (jb.w / 2 + 6) * (jb.w / 2 + 6)) { pressSpace(p1); return; }

    // 道具槽（单人模式）
    if (s.mode === 'solo') {
      var slots = HUD.ITEM_SLOTS;
      for (var i = 0; i < slots.length; i++) {
        var sp = slots[i];
        if (pt.x > sp.x && pt.x < sp.x + sp.w && pt.y > sp.y && pt.y < sp.y + sp.h) {
          if (s.phase === 'run') Logic.useItem(s, p1, i);
          return;
        }
      }
    }

    // 补给条
    if (s.phase === 'run' && Logic.activeGate(s, p1) && !(p1.jamT > 0)) {
      var gp = HUD.GATE_PANEL;
      if (pt.x > gp.x && pt.x < gp.x + gp.w &&
          pt.y > gp.y - 26 && pt.y < gp.y + gp.h) {
        if (s.mode === 'duo') feed(p1);
        else act(p1, pt.x < gp.x + gp.w / 2 ? 'drink' : 'eat');
        return;
      }
    }

    if (s.phase === 'run') stride(p1, pt.x < VW / 2 ? 'L' : 'R');
  }, { passive: false });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { s.inited = false; lastNow = performance.now() / 1000; }
  });

  /* ---------------- 循环 ---------------- */
  function updateView(dt, now) {
    if (s.phase === 'run') {
      var cycleRate = (s.speed / 3.6) / 2.2 / 2;
      if (s.speed > 0.6) view.phase += dt * cycleRate * Math.PI * 2;
    } else if (s.phase === 'idle') {
      view.phase += dt * 1.4;
    }
    for (var i = view.popups.length - 1; i >= 0; i--) {
      view.popups[i].life -= dt;
      if (view.popups[i].life <= 0) view.popups.splice(i, 1);
    }
  }

  var lastNow = performance.now() / 1000;

  function frame() {
    var now = performance.now() / 1000;
    var dt = now - lastNow;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    lastNow = now;

    var prevPhase = s.phase;
    Logic.tick(s, now);
    handleEvents();
    updateView(dt, now);

    Scene3D.update(s, view, dt, now);
    Scene3D.render();

    view.runnerScreen = Scene3D.runnerScreen(VW, VH);
    view.p2Screen = Scene3D.p2Screen ? Scene3D.p2Screen(VW, VH) : null;

    ctx.setTransform(hudScale, 0, 0, hudScale, 0, 0);
    ctx.clearRect(0, 0, VW, VH);

    if (s.phase === 'idle') {
      var hint, warn = false;
      if (isTouch) {
        hint = '手机：点屏幕左右两侧交替 · M 静音';
      } else if (!keyEver && now - loadAt > 3.5) {
        warn = true;
        hint = clickedEver
          ? '键盘还没响应 · 也可以直接点画面左右两边来跑'
          : '键盘没反应？先点一下画面';
      } else {
        hint = 'A / D 跑 · 空格跳 · 1 / 2 道具 · M 静音';
      }
      HUD.drawTitle(ctx, now, hint, warn);
    } else {
      HUD.drawHUD(ctx, s, view, now);
      if (s.phase === 'ready') HUD.drawCountdown(ctx, s, now);
      if (s.phase === 'over') HUD.drawResult(ctx, s, now);
      if (!keyEver && !isTouch && s.phase === 'run') HUD.drawFocusWarn(ctx, now);
    }

    requestAnimationFrame(frame);
  }

  /* ---------------- 启动 ---------------- */
  Scene3D.init(sceneCanvas);
  reset();
  resize();
  requestAnimationFrame(frame);
})();
