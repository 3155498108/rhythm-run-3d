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
  var s, view, screen = 'title';

  /* ---------------- 音效 ---------------- */
  var Sfx = {
    ac: null, muted: false,
    init: function () {
      if (this.ac) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ac = new AC(); } catch (e) { this.ac = null; }
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
    perfect: function (combo) {
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
    view = { phase: 0, popups: [], runnerScreen: null };
  }
  function reset() {
    s = Logic.create();
    resetView();
    Scene3D.reset();
    screen = 'title';
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
  function popup(text, color, size) {
    var rx = view.runnerScreen ? view.runnerScreen.x : 400;
    var ry = view.runnerScreen ? view.runnerScreen.y : 560;
    view.popups.push({
      text: text, color: color || '#f5a623', size: size || 22,
      x: rx + (Math.random() - 0.5) * 40, y: ry - 40,
      life: 0.85, max: 0.85
    });
  }

  /* ---------------- 事件 ---------------- */
  function handleEvents() {
    var x = s.distance;
    for (var i = 0; i < s.events.length; i++) {
      var e = s.events[i];
      switch (e.k) {
        case 'stride':
          Scene3D.spawnDust(x - 0.2, (Math.random() - 0.5) * 0.4);
          if (e.steady) {
            Sfx.perfect(e.combo);
            Scene3D.spawnSparks(x + 0.1, 1.1 + Math.random() * 0.4, 0, e.combo % 6 === 0 ? 4 : 2);
          } else {
            Sfx.step();
            if (e.ratio > 1.5) popup('间隔太长', 'rgba(90,105,126,0.92)', 16);
            else if (e.ratio < 0.68) popup('太急', 'rgba(90,105,126,0.92)', 16);
          }
          break;
        case 'stumble':
          Sfx.stumble();
          Scene3D.shake(0.28);
          popup('错步！', '#e05243', 22);
          break;
        case 'nofood':
          if (e.reason === 'used') popup('这站已经用过了', 'rgba(90,105,126,0.92)', 16);
          else popup('附近没有补给点', 'rgba(90,105,126,0.92)', 16);
          break;
        case 'drink': Sfx.drink(); break;
        case 'eat': Sfx.eat(); break;
        case 'drank':
          popup('水分补满', '#3aa6e0', 20);
          Scene3D.spawnSparks(x, 1.5, 0, 6);
          break;
        case 'ate':
          popup('体力 +' + C.EAT_STAMINA, '#f5a623', 20);
          break;
        case 'thirst':
          popup('口渴了！', '#3aa6e0', 19);
          break;
        case 'finish':
          screen = 'over';
          Sfx.finish();
          break;
        case 'collapse':
          screen = 'over';
          Scene3D.shake(0.5);
          Sfx.fail();
          break;
      }
    }
    s.events.length = 0;
  }

  /* ---------------- 输入 ---------------- */
  function stride(side) {
    if (screen === 'over') return;
    Sfx.init();
    if (screen === 'title') screen = 'run';
    Logic.press(s, side);
  }
  function act(kind) {
    if (screen !== 'run') return;
    Logic.startAction(s, kind);
  }

  window.addEventListener('keydown', function (ev) {
    var k = ev.key;
    if (ev.repeat) return;
    if (k === 'a' || k === 'A' || k === 'ArrowLeft') { ev.preventDefault(); stride('L'); return; }
    if (k === 'd' || k === 'D' || k === 'ArrowRight') { ev.preventDefault(); stride('R'); return; }
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { ev.preventDefault(); act('drink'); return; }
    if (k === 'ArrowDown' || k === 's' || k === 'S') { ev.preventDefault(); act('eat'); return; }
    if (k === 'r' || k === 'R') { ev.preventDefault(); reset(); Sfx.init(); return; }
    if (k === 'm' || k === 'M') {
      Sfx.init();
      Sfx.muted = !Sfx.muted;
      popup(Sfx.muted ? '静音' : '开声音', 'rgba(90,105,126,0.95)', 16);
      return;
    }
  }, { passive: false });

  hudCanvas.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    var pt = toLogical(ev.clientX, ev.clientY);
    if (screen === 'over') { reset(); Sfx.init(); return; }
    if (Logic.activeGate(s)) {
      var gp = HUD.GATE_PANEL;
      if (pt.x > gp.x && pt.x < gp.x + gp.w &&
          pt.y > gp.y - 26 && pt.y < gp.y + gp.h) {
        act(pt.x < gp.x + gp.w / 2 ? 'drink' : 'eat');
        return;
      }
    }
    stride(pt.x < VW / 2 ? 'L' : 'R');
  }, { passive: false });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { s.inited = false; lastNow = performance.now() / 1000; }
  });

  /* ---------------- 循环 ---------------- */
  function updateView(dt, now) {
    if (s.started && !s.finished && !s.collapsed) {
      // 步频跟着实际速度走，约 2.2 米一步、两步一个循环
      var cycleRate = (s.speed / 3.6) / 2.2 / 2;
      if (s.speed > 0.6) view.phase += dt * cycleRate * Math.PI * 2;
    } else if (!s.started) {
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

    Logic.tick(s, now);
    handleEvents();
    updateView(dt, now);

    Scene3D.update(s, view, dt, now);
    Scene3D.render();

    view.runnerScreen = Scene3D.runnerScreen(VW, VH);

    ctx.setTransform(hudScale, 0, 0, hudScale, 0, 0);
    ctx.clearRect(0, 0, VW, VH);

    if (screen === 'title') {
      HUD.drawTitle(ctx, now);
    } else {
      HUD.drawHUD(ctx, s, view, now);
      if (screen === 'over') HUD.drawResult(ctx, s, now);
    }

    requestAnimationFrame(frame);
  }

  /* ---------------- 启动 ---------------- */
  Scene3D.init(sceneCanvas);
  reset();
  resize();
  requestAnimationFrame(frame);
})();
