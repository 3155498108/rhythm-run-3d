/* =========================================================
 *  节奏长跑 · 3D 场景（three.js）
 *  世界坐标：X = 前进方向（1 单位 = 1 米），Y = 上，Z = 横向
 * ========================================================= */
(function (global) {
  'use strict';
  var THREE = global.THREE;
  var TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---------- 便于调参的相机配置 ---------- */
  var CAM = {
    backX: -2.6,   // 相机在跑者后方
    height: 2.46,
    side: 7.9,     // z 距离
    aimX: 3.8,     // 注视点在跑者前方（越大视线越朝前，前方障碍不会挤到画面边）
    aimY: 1.05,
    aimZ: 0.0,
    fov: 45
  };

  /* ---------- 工具：程序化贴图 ---------- */
  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    draw(g, w, h);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }

  function roadTexture() {
    var t = canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#7d869a';
      g.fillRect(0, 0, w, h);
      // 颗粒
      for (var i = 0; i < 2600; i++) {
        var a = Math.random() * 0.05;
        g.fillStyle = 'rgba(255,255,255,' + a + ')';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      for (var j = 0; j < 1400; j++) {
        g.fillStyle = 'rgba(40,50,70,' + (Math.random() * 0.05) + ')';
        g.fillRect(Math.random() * w, Math.random() * h, 2.5, 2.5);
      }
      // 中线（虚线）
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fillRect(0, h * 0.485, w * 0.52, h * 0.028);
      // 边线
      g.fillStyle = 'rgba(255,255,255,0.82)';
      g.fillRect(0, h * 0.045, w, h * 0.016);
      g.fillRect(0, h * 0.94, w, h * 0.016);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function grassTexture() {
    var t = canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = '#7fc96f';
      g.fillRect(0, 0, w, h);
      for (var i = 0; i < 900; i++) {
        var r = Math.random();
        g.fillStyle = r > 0.6 ? 'rgba(96,178,88,0.55)' : (r > 0.3 ? 'rgba(146,214,128,0.55)' : 'rgba(78,160,78,0.45)');
        g.beginPath();
        g.ellipse(Math.random() * w, Math.random() * h, 1 + Math.random() * 2.6, 1 + Math.random() * 2, 0, 0, TAU);
        g.fill();
      }
      // 小花
      for (var k = 0; k < 14; k++) {
        g.fillStyle = ['rgba(255,255,255,0.75)', 'rgba(255,230,140,0.8)', 'rgba(255,190,200,0.7)'][k % 3];
        g.beginPath();
        g.arc(Math.random() * w, Math.random() * h, 1.6, 0, TAU);
        g.fill();
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function stripeTexture() {
    var t = canvasTex(64, 256, function (g, w, h) {
      g.fillStyle = '#fdfdff';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#ff8165';
      for (var i = 0; i < 6; i++) g.fillRect(0, i * 44, w, 22);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 3);
    return t;
  }

  function bannerTexture(text) {
    return canvasTex(512, 128, function (g, w, h) {
      var grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, '#ff9a76');
      grd.addColorStop(1, '#ff6a52');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(0, 0, w, 8);
      g.fillStyle = '#ffffff';
      g.font = '800 62px "PingFang SC","Microsoft YaHei",sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 2);
    });
  }

  function checkerTexture() {
    return canvasTex(128, 128, function (g, w, h) {
      var n = 8, cw = w / n;
      for (var y = 0; y < n; y++) {
        for (var x = 0; x < n; x++) {
          g.fillStyle = (x + y) % 2 ? '#22283a' : '#ffffff';
          g.fillRect(x * cw, y * cw, cw, cw);
        }
      }
    });
  }

  function finishBannerTexture() {
    return canvasTex(512, 128, function (g, w, h) {
      var n = 8, cw = w / n;
      for (var x = 0; x < n; x++) {
        g.fillStyle = x % 2 ? '#22283a' : '#ffffff';
        g.fillRect(x * cw, 0, cw, h);
      }
      g.fillStyle = 'rgba(20,26,40,0.86)';
      g.fillRect(w * 0.22, h * 0.16, w * 0.56, h * 0.68);
      g.fillStyle = '#ffffff';
      g.font = '800 62px "PingFang SC","Microsoft YaHei",sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('FINISH', w / 2, h / 2 + 2);
    });
  }

  function bibTexture() {
    return canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#2c3442';
      g.font = '800 64px "PingFang SC","Microsoft YaHei",sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('07', w / 2, h / 2 + 3);
    });
  }

  function radialTexture(inner, outer) {
    return canvasTex(128, 128, function (g, w, h) {
      var grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grd.addColorStop(0, inner);
      grd.addColorStop(1, outer);
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    });
  }

  function skyTexture() {
    return canvasTex(64, 512, function (g, w, h) {
      var grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0.00, '#69bde9');
      grd.addColorStop(0.28, '#8ed2f2');
      grd.addColorStop(0.55, '#bfe6f9');
      grd.addColorStop(0.78, '#e2f3fd');
      grd.addColorStop(1.00, '#d8eef9');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    });
  }

  function mat(color, opts) {
    var o = Object.assign({ color: color, roughness: 0.82, metalness: 0.0 }, opts || {});
    return new THREE.MeshStandardMaterial(o);
  }

  /* ================= 场景 ================= */
  var scene, camera, renderer, sunLight, hemi;
  var runner, playerRig, p2Rig = null, p2Runner = null, rivalRigs = [];
  var obstacleMeshes = [], bananaPool = [], shotPool = [];
  var dustPool = [], sparkPool = [], ringPool = [];
  var treeList = [], bushList = [], gateGroups = [];
  var backdrop, sunSprite, cloudGroup;
  var shakeAmt = 0, p2Phase = 0;
  var titleAim = 0;
  var finishPull = 0;
  var tmpV = new THREE.Vector3();
  var WORLD_SPAN = 220;   // 树木回收周期（米）

  function init(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xd5ebfa, 95, 340);

    camera = new THREE.PerspectiveCamera(CAM.fov, 16 / 9, 0.4, 900);

    hemi = new THREE.HemisphereLight(0xcfeeff, 0x8ec98a, 0.62);
    scene.add(hemi);

    sunLight = new THREE.DirectionalLight(0xfff4e2, 1.02);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    var sc = sunLight.shadow.camera;
    sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 60;
    sunLight.shadow.bias = -0.0009;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);
    scene.add(sunLight.target);

    buildSky();
    buildHills();
    buildGround();
    buildTrees();
    buildCrowd();
    buildGates();
    buildRunner();
    buildRivals();
    buildObstacles();
    buildProps();
    buildPools();

    return { scene: scene, camera: camera, renderer: renderer };
  }

  /* ---------- 天空 ---------- */
  function buildSky() {
    var tex = skyTexture();
    scene.background = tex;

    // 太阳
    var sunTex = radialTexture('rgba(255,250,222,1)', 'rgba(255,220,140,0)');
    sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTex, transparent: true, depthWrite: false, fog: false, opacity: 0.42
    }));
    sunSprite.position.set(0, 96, -418);
    sunSprite.scale.set(190, 190, 1);
    scene.add(sunSprite);

    // 云
    cloudGroup = new THREE.Group();
    var cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
    for (var i = 0; i < 24; i++) {
      var g = new THREE.Group();
      var n = 3 + Math.floor(Math.random() * 3);
      for (var k = 0; k < n; k++) {
        var s = 6 + Math.random() * 9;
        var m2 = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), cloudMat);
        m2.position.set(k * s * 1.15 - n * s * 0.5, Math.random() * s * 0.4, Math.random() * s * 0.5);
        m2.scale.y = 0.62;
        g.add(m2);
      }
      g.position.set((Math.random() - 0.5) * 1500, 34 + Math.random() * 120, -230 - Math.random() * 150);
      cloudGroup.add(g);
    }
    scene.add(cloudGroup);
  }

  /* ---------- 地面与跑道 ---------- */
  function buildGround() {
    var gt = grassTexture();
    gt.repeat.set(220, 40);
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(3200, 560),
      new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(500, 0, -240);
    ground.receiveShadow = true;
    scene.add(ground);

    var rt = roadTexture();
    rt.repeat.set(266, 1);
    var road = new THREE.Mesh(
      new THREE.PlaneGeometry(3200, 6.4),
      new THREE.MeshStandardMaterial({ map: rt, roughness: 0.72, metalness: 0 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(500, 0.02, 0);
    road.receiveShadow = true;
    scene.add(road);

    // 路缘
    var curbMat = new THREE.MeshStandardMaterial({ color: 0xe6ecf3, roughness: 0.8 });
    for (var sgn = -1; sgn <= 1; sgn += 2) {
      var curb = new THREE.Mesh(new THREE.BoxGeometry(3200, 0.12, 0.28), curbMat);
      curb.position.set(500, 0.06, sgn * 3.34);
      curb.receiveShadow = true;
      curb.castShadow = true;
      scene.add(curb);
    }
  }

  /* ---------- 远景丘陵 ---------- */
  function buildHills() {
    var near = new THREE.MeshStandardMaterial({ color: 0x7dbe86, roughness: 1, flatShading: true });
    var far = new THREE.MeshStandardMaterial({ color: 0x9dc9b0, roughness: 1, flatShading: true });
    var far2 = new THREE.MeshStandardMaterial({ color: 0xa9cec9, roughness: 1, flatShading: true });
    var geo = new THREE.IcosahedronGeometry(1, 0);
    for (var i = 0; i < 30; i++) {
      var r = 24 + Math.random() * 30;
      var m = new THREE.Mesh(geo, i % 4 === 0 ? far2 : (i % 2 === 0 ? far : near));
      m.scale.set(r, r * (0.26 + Math.random() * 0.12), r * 0.6);
      m.position.set(i * 40 + Math.random() * 26, -5, -105 - Math.random() * 95);
      m.rotation.y = Math.random() * 3;
      scene.add(m);
    }
  }

  /* ---------- 树 / 灌木 ---------- */
  function makeTree(scale) {
    var g = new THREE.Group();
    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.19, 1.5, 7),
      new THREE.MeshStandardMaterial({ color: 0x8a6244, roughness: 0.95, flatShading: true })
    );
    trunk.position.y = 0.75;
    trunk.castShadow = true;
    g.add(trunk);

    var cols = [0x2f9e6e, 0x288f64, 0x3bab7c];
    for (var i = 0; i < 3; i++) {
      var r = 0.75 + Math.random() * 0.45;
      var crown = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r, 0),
        new THREE.MeshStandardMaterial({ color: cols[i % 3], roughness: 0.9, flatShading: true })
      );
      crown.position.set((Math.random() - 0.5) * 0.7, 1.75 + i * 0.5 + Math.random() * 0.3, (Math.random() - 0.5) * 0.6);
      crown.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      crown.castShadow = true;
      g.add(crown);
    }
    g.scale.setScalar(scale);
    return g;
  }

  function makeBush(scale) {
    var g = new THREE.Group();
    var cols = [0x4aab6f, 0x5cbd7e, 0x3f9c62];
    for (var i = 0; i < 3; i++) {
      var r = 0.28 + Math.random() * 0.22;
      var m = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r, 0),
        new THREE.MeshStandardMaterial({ color: cols[i % 3], roughness: 0.95, flatShading: true })
      );
      m.position.set((i - 1) * 0.4, r * 0.8, (Math.random() - 0.5) * 0.3);
      m.castShadow = true;
      g.add(m);
    }
    g.scale.setScalar(scale);
    return g;
  }

  function buildTrees() {
    // 远排树（赛道对面）
    for (var i = 0; i < 26; i++) {
      var t = makeTree(0.9 + Math.random() * 0.85);
      t.userData.base = i * 9.2;
      t.userData.z = -9 - Math.random() * 26;
      scene.add(t);
      treeList.push(t);
    }
    // 中排
    for (var j = 0; j < 18; j++) {
      var t2 = makeTree(0.7 + Math.random() * 0.5);
      t2.userData.base = j * 13.5 + 4;
      t2.userData.z = -5.6 - Math.random() * 3;
      scene.add(t2);
      treeList.push(t2);
    }
    // 近景灌木
    for (var k = 0; k < 30; k++) {
      var b = makeBush(0.5 + Math.random() * 0.4);
      b.userData.base = k * 7.4;
      b.userData.z = 4.9 + Math.random() * 1.0;
      scene.add(b);
      bushList.push(b);
    }
  }

  /* ---------- 路边观众 ---------- */
  var crowd = [];
  function buildCrowd() {
    var bodyCols = [0x6d8cff, 0xff8a6b, 0x4fc4a8, 0xf5a623, 0xa77bff, 0xffd166];
    var bodyGeo = new THREE.CapsuleGeometry(0.17, 0.34, 4, 8);
    var headGeo = new THREE.SphereGeometry(0.15, 10, 8);
    var headMat = new THREE.MeshStandardMaterial({ color: 0xffd7b5, roughness: 0.85 });
    for (var i = 0; i < 16; i++) {
      var grp = new THREE.Group();
      var n = 2 + Math.floor(Math.random() * 3);
      for (var k = 0; k < n; k++) {
        var one = new THREE.Group();
        var b = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({
          color: bodyCols[Math.floor(Math.random() * bodyCols.length)], roughness: 0.85
        }));
        b.position.y = 0.38;
        b.castShadow = true;
        one.add(b);
        var hd = new THREE.Mesh(headGeo, headMat);
        hd.position.y = 0.74;
        hd.castShadow = true;
        one.add(hd);
        one.position.set((Math.random() - 0.5) * 1.6, 0, (Math.random() - 0.5) * 0.8);
        one.userData.ph = Math.random() * 6.28;
        one.userData.baseY = 0;
        grp.add(one);
      }
      grp.position.set(30 + i * 62 + Math.random() * 24, 0, -5.4 - Math.random() * 2.6);
      scene.add(grp);
      crowd.push(grp);
    }
  }

  /* ---------- 补给点 ---------- */
  function buildGates() {
    var C = global.Logic.C;
    var stripe = stripeTexture();
    var postMat = new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.75 });

    for (var d = C.GATE_STEP; d < C.RACE_LEN; d += C.GATE_STEP) {
      var g = new THREE.Group();
      g.position.set(d, 0, 0);

      // 立柱：只留远离镜头那一根。近侧立柱正好夹在镜头和跑者之间，
      // 每经过一个补给站都会把画面挡掉半秒，所以改成单柱悬臂横梁。
      var sgn = -1;
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 3.6, 10), postMat);
      post.position.set(0, 1.8, sgn * 4.4);
      post.castShadow = true;
      g.add(post);
      var foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.16, 10),
        new THREE.MeshStandardMaterial({ color: 0xdfe6ef, roughness: 0.85 }));
      foot.position.set(0, 0.08, sgn * 4.4);
      foot.castShadow = true;
      g.add(foot);

      // 近侧改成一个矮的补给箱堆，不挡视线
      var crate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.86),
        new THREE.MeshStandardMaterial({ color: 0xf0c98a, roughness: 0.85 }));
      crate.position.set(0.1, 0.36, 4.1);
      crate.castShadow = true;
      g.add(crate);

      // 横幅（单侧悬挑）
      var banner = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.92, 6.2),
        new THREE.MeshStandardMaterial({ map: bannerTexture(d + ' m'), roughness: 0.7 })
      );
      banner.position.set(0, 3.45, -1.3);
      banner.castShadow = true;
      g.add(banner);

      // 横幅正反两面贴字
      var faceMat = new THREE.MeshStandardMaterial({ map: bannerTexture(d + ' m'), roughness: 0.7, transparent: true });
      for (var f = -1; f <= 1; f += 2) {
        var face = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 0.86), faceMat);
        face.position.set(f * 0.075, 3.45, -1.3);
        face.rotation.y = f > 0 ? Math.PI / 2 : -Math.PI / 2;
        g.add(face);
      }

      // 补给桌
      var tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 2.6),
        new THREE.MeshStandardMaterial({ color: 0xf2e3ca, roughness: 0.85 }));
      tableTop.position.set(0.2, 0.86, -4.9);
      tableTop.castShadow = true;
      tableTop.receiveShadow = true;
      g.add(tableTop);
      for (var lg = 0; lg < 2; lg++) {
        var leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.86, 0.1),
          new THREE.MeshStandardMaterial({ color: 0xc8ab86, roughness: 0.9 }));
        leg.position.set(0.2, 0.43, -4.9 + (lg ? 1.1 : -1.1));
        g.add(leg);
      }
      // 水杯
      var cupMat = new THREE.MeshStandardMaterial({
        color: 0x8fd6f7, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.92
      });
      for (var c = 0; c < 5; c++) {
        var cup = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.2, 8), cupMat);
        cup.position.set(0.2 + (Math.random() - 0.5) * 0.4, 1.01, -5.6 + c * 0.42);
        cup.castShadow = true;
        g.add(cup);
      }
      // 香蕉 / 能量块
      var food = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.16, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.7 }));
      food.position.set(0.2, 0.98, -4.2);
      food.rotation.z = Math.PI / 2;
      g.add(food);

      // 观众
      for (var v = 0; v < 4; v++) {
        var vg = new THREE.Group();
        var bodyCol = [0x6d8cff, 0xff8a6b, 0x4fc4a8, 0xf5a623][v % 4];
        var body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.38, 4, 10),
          new THREE.MeshStandardMaterial({ color: bodyCol, roughness: 0.85 }));
        body.position.y = 0.42;
        body.castShadow = true;
        vg.add(body);
        var head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0xffd7b5, roughness: 0.85 }));
        head.position.y = 0.84;
        head.castShadow = true;
        vg.add(head);
        vg.position.set(0, 0, -6.6 - v * 0.7);
        vg.userData.phase = v * 1.7;
        vg.userData.baseY = 0;
        g.add(vg);
        g.userData['spec' + v] = vg;
      }

      scene.add(g);
      gateGroups.push(g);
    }

    buildFinish();
  }

  /* ---------- 终点 ---------- */
  function buildFinish() {
    var C = global.Logic.C;
    var g = new THREE.Group();
    g.position.set(C.RACE_LEN, 0, 0);

    var checker = checkerTexture();
    checker.wrapS = checker.wrapT = THREE.RepeatWrapping;
    checker.repeat.set(1, 6);

    for (var sgn = -1; sgn <= 1; sgn += 2) {
      var post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 4.0, 12),
        new THREE.MeshStandardMaterial({ map: checker, roughness: 0.7 })
      );
      post.position.set(0, 2.0, sgn * 4.6);
      post.castShadow = true;
      g.add(post);
      var foot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.18, 12),
        new THREE.MeshStandardMaterial({ color: 0xdfe6ef, roughness: 0.85 }));
      foot.position.set(0, 0.09, sgn * 4.6);
      foot.castShadow = true;
      g.add(foot);
    }

    var bannerMat = new THREE.MeshStandardMaterial({ map: finishBannerTexture(), roughness: 0.7 });
    var banner = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 8.9), bannerMat);
    banner.position.set(0, 3.62, 0);
    banner.castShadow = true;
    g.add(banner);
    for (var f = -1; f <= 1; f += 2) {
      var face = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 0.98), bannerMat);
      face.position.set(f * 0.085, 3.62, 0);
      face.rotation.y = f > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(face);
    }

    // 地面格纹终点线
    var lineTex = checkerTexture();
    lineTex.wrapS = lineTex.wrapT = THREE.RepeatWrapping;
    lineTex.repeat.set(2, 14);
    var line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 6.4),
      new THREE.MeshStandardMaterial({ map: lineTex, roughness: 0.75 })
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.03, 0);
    line.receiveShadow = true;
    g.add(line);

    // 彩旗
    var flagCols = [0xff7a6b, 0xffd166, 0x4fc4a8, 0x6d8cff];
    for (var i = 0; i < 14; i++) {
      var flag = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.3, 3),
        new THREE.MeshStandardMaterial({ color: flagCols[i % 4], roughness: 0.8 })
      );
      flag.position.set(0.1, 3.05 - Math.abs(i - 6.5) * 0.04, -3.9 + i * 0.6);
      flag.rotation.x = Math.PI;
      g.add(flag);
    }

    scene.add(g);
    gateGroups.push(g);
  }

  /* ---------- 跑者 ---------- */
  function limb(r, len, material) {
    var geo = new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 5, 12);
    var m = new THREE.Mesh(geo, material);
    m.position.y = -len / 2;
    m.castShadow = true;
    return m;
  }

  function buildRig(opt) {
    opt = opt || {};
    var R = {};
    var root = new THREE.Group();

    var skin = mat(opt.skin || 0xf9cda8, { roughness: 0.72 });
    var jersey = mat(opt.jersey || 0xff7a6b, { roughness: 0.78 });
    var shorts = mat(opt.shorts || 0x3f526d, { roughness: 0.85 });
    var hairMat = mat(opt.hair || 0x342c3e, { roughness: 0.72 });
    var shoeMat = mat(opt.shoe || 0xffffff, { roughness: 0.55 });
    var shoeAcc = mat(opt.shoeAcc || 0xff7a6b, { roughness: 0.55 });
    var bandMat = mat(opt.band || 0xffcf5c, { roughness: 0.7 });

    // 髋
    var hips = new THREE.Group();
    hips.position.y = 0.80;
    root.add(hips);
    R.hips = hips;

    // 躯干
    var torso = new THREE.Group();
    hips.add(torso);
    R.torso = torso;

    var pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.172, 0.13, 4, 12), shorts);
    pelvis.position.y = 0.07;
    pelvis.scale.z = 0.9;
    pelvis.castShadow = true;
    torso.add(pelvis);

    // 短裤腿
    for (var sl = -1; sl <= 1; sl += 2) {
      var shortLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.104, 0.1, 4, 10), shorts);
      shortLeg.position.set(0, -0.02, sl * 0.098);
      shortLeg.castShadow = true;
      torso.add(shortLeg);
    }

    // 上衣
    var chest = new THREE.Mesh(new THREE.CylinderGeometry(0.212, 0.185, 0.4, 16), jersey);
    chest.position.y = 0.27;
    chest.castShadow = true;
    torso.add(chest);
    var shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.212, 16, 12), jersey);
    shoulderCap.position.y = 0.46;
    shoulderCap.scale.y = 0.62;
    shoulderCap.castShadow = true;
    torso.add(shoulderCap);

    var trim = new THREE.Mesh(new THREE.CylinderGeometry(0.216, 0.216, 0.035, 16),
      new THREE.MeshStandardMaterial({ color: 0xfff4ef, roughness: 0.75 }));
    trim.position.y = 0.435;
    torso.add(trim);

    // 号码布（略侧向，方便看清）
    var bib = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.2),
      new THREE.MeshStandardMaterial({ map: bibTexture(), roughness: 0.8, transparent: true })
    );
    bib.position.set(0.06, 0.29, 0.175);
    bib.rotation.y = 0.62;
    torso.add(bib);

    // 脖子
    var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 10), skin);
    neck.position.y = 0.5;
    torso.add(neck);

    // 头
    var head = new THREE.Group();
    head.position.y = 0.55;
    head.rotation.y = -0.12;
    torso.add(head);
    R.head = head;

    var skull = new THREE.Mesh(new THREE.SphereGeometry(0.245, 24, 20), skin);
    skull.position.y = 0.22;
    skull.castShadow = true;
    head.add(skull);

    // 鼻子（侧影上凸一点，更好认）
    var nose = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), skin);
    nose.position.set(0.236, 0.0, 0.014);
    nose.scale.set(1.0, 0.82, 0.9);
    head.add(nose);

    // 头发：头顶盖 + 后脑
    var hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.254, 24, 16, 0, TAU, 0, Math.PI * 0.38),
      hairMat
    );
    hairCap.position.y = 0.228;
    hairCap.rotation.z = -0.04;
    hairCap.castShadow = true;
    head.add(hairCap);
    var hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.235, 18, 16), hairMat);
    hairBack.position.set(-0.105, 0.23, 0);
    hairBack.scale.set(0.8, 0.97, 0.97);
    head.add(hairBack);

    // 发带
    var band = new THREE.Mesh(new THREE.CylinderGeometry(0.257, 0.257, 0.064, 24, 1, true), bandMat);
    band.position.y = 0.283;
    band.rotation.z = -0.07;
    head.add(band);

    // 飘带
    var ribbon = new THREE.Group();
    ribbon.position.set(-0.2, 0.288, -0.02);
    head.add(ribbon);
    R.ribbon = ribbon;
    for (var rb = 0; rb < 2; rb++) {
      var seg = new THREE.Mesh(
        new THREE.BoxGeometry(0.17, 0.042, 0.015),
        new THREE.MeshStandardMaterial({ color: 0xffcf5c, roughness: 0.8 })
      );
      seg.position.x = -0.085 - rb * 0.14;
      seg.position.y = -rb * 0.028;
      ribbon.add(seg);
    }

    /* —— 侧脸：五官贴在朝向镜头的 +Z 面 —— */
    var ear = new THREE.Mesh(new THREE.SphereGeometry(0.064, 12, 10), mat(0xf3c19c, { roughness: 0.75 }));
    ear.position.set(-0.115, -0.008, 0.192);
    ear.scale.set(0.95, 1.05, 0.6);
    head.add(ear);
    var earIn = new THREE.Mesh(new THREE.SphereGeometry(0.033, 8, 8), mat(0xe6b08b, { roughness: 0.85 }));
    earIn.position.set(-0.113, -0.008, 0.218);
    earIn.scale.set(1, 1.05, 0.4);
    head.add(earIn);

    var eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.3 });
    var eye = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 14), eyeMat);
    eye.position.set(0.072, 0.018, 0.226);
    eye.scale.set(0.9, 1.22, 0.6);
    head.add(eye);
    var glint = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
    glint.position.set(0.088, 0.05, 0.25);
    head.add(glint);

    var brow = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.017, 0.032), hairMat);
    brow.position.set(0.078, 0.098, 0.21);
    brow.rotation.z = 0.12;
    head.add(brow);

    var mouth = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.012, 6, 14, Math.PI * 0.85),
      new THREE.MeshStandardMaterial({ color: 0xc85f4d, roughness: 0.7 }));
    mouth.position.set(0.108, -0.062, 0.212);
    mouth.rotation.set(Math.PI / 2, 0, Math.PI * 0.56);
    head.add(mouth);

    var blush = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xff9585, roughness: 0.9, transparent: true, opacity: 0.45 }));
    blush.position.set(0.0, -0.048, 0.228);
    blush.scale.set(0.6, 0.42, 0.3);
    head.add(blush);

    // 手臂
    function makeArm(sideZ) {
      var shoulder = new THREE.Group();
      shoulder.position.set(0, 0.42, sideZ);
      torso.add(shoulder);
      shoulder.add(limb(0.058, 0.25, skin));
      var elbow = new THREE.Group();
      elbow.position.y = -0.25;
      shoulder.add(elbow);
      elbow.add(limb(0.05, 0.23, skin));
      var hand = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), skin);
      hand.position.y = -0.23;
      hand.castShadow = true;
      elbow.add(hand);
      return { shoulder: shoulder, elbow: elbow, hand: hand };
    }
    R.armL = makeArm(0.228);
    R.armR = makeArm(-0.228);

    // 腿
    function makeLeg(sideZ) {
      var hip = new THREE.Group();
      hip.position.set(0, -0.02, sideZ);
      hips.add(hip);
      hip.add(limb(0.088, 0.36, skin));
      var knee = new THREE.Group();
      knee.position.y = -0.36;
      hip.add(knee);
      knee.add(limb(0.072, 0.32, skin));
      var foot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.145), shoeMat);
      foot.position.set(0.055, -0.335, 0);
      foot.castShadow = true;
      knee.add(foot);
      var sole = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.04, 0.155), shoeAcc);
      sole.position.set(0.055, -0.39, 0);
      knee.add(sole);
      return { hip: hip, knee: knee, foot: foot };
    }
    R.legL = makeLeg(0.105);
    R.legR = makeLeg(-0.105);

    // 饭团 & 水壶
    var rice = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xfffdf5, roughness: 0.85 }));
    rice.scale.set(1, 1.12, 1);
    rice.position.set(0.01, -0.27, 0.03);
    rice.visible = false;
    R.armL.elbow.add(rice);
    R.rice = rice;

    var bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.17, 10),
      new THREE.MeshStandardMaterial({ color: 0x5bc0f8, roughness: 0.35 }));
    bottle.position.set(0, -0.3, 0);
    bottle.visible = false;
    R.armL.elbow.add(bottle);
    R.bottle = bottle;

    // 脚下软阴影
    var shTex = radialTexture('rgba(40,60,90,0.42)', 'rgba(40,60,90,0)');
    R.shadowBlob = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false })
    );
    R.shadowBlob.rotation.x = -Math.PI / 2;
    R.shadowBlob.position.y = 0.02;
    root.add(R.shadowBlob);
    R.root = root;
    return R;
  }

  function buildRunner() {
    playerRig = buildRig({});
    runner = playerRig.root;
    scene.add(runner);

    // P2（双人模式才显示）
    p2Rig = buildRig({ jersey: 0xff8a5c, shorts: 0x7a3a24, band: 0xfff0d8, hair: 0x3a2a22 });
    p2Runner = p2Rig.root;
    p2Runner.visible = false;
    scene.add(p2Runner);
  }

  /* ---------- 对手 ---------- */
  var RIVAL_LOOK = [
    { jersey: 0x5b7cfa, shorts: 0x2c3b6b, band: 0xffffff, hair: 0x272a38 },
    { jersey: 0xf5a623, shorts: 0x5a4a2c, band: 0xfff3d6, hair: 0x4a2f22 },
    { jersey: 0x35b58c, shorts: 0x2f4a45, band: 0xffe9a8, hair: 0x2b2b2b }
  ];

  function buildRivals() {
    for (var i = 0; i < 3; i++) {
      var rig = buildRig(RIVAL_LOOK[i]);
      rig.root.visible = false;
      scene.add(rig.root);
      rivalRigs.push(rig);
    }
  }

  /* ---------- 障碍物 ---------- */
  function buildObstacles() {
    var white = mat(0xffffff, { roughness: 0.6 });
    var red = mat(0xe8523f, { roughness: 0.7 });
    var orange = mat(0xff8a3d, { roughness: 0.7 });
    var wood = mat(0xd8dde6, { roughness: 0.8 });

    for (var k = 0; k < 6; k++) {
      var grp = new THREE.Group();

      // 跨栏
      var hurdle = new THREE.Group();
      for (var sg = -1; sg <= 1; sg += 2) {
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.78, 8), wood);
        post.position.set(0, 0.39, sg * 0.72);
        post.castShadow = true;
        hurdle.add(post);
        var foot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.14), red);
        foot.position.set(0, 0.03, sg * 0.72);
        hurdle.add(foot);
      }
      var bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 1.5), white);
      bar.position.y = 0.66;
      bar.castShadow = true;
      hurdle.add(bar);
      for (var rb = -1; rb <= 1; rb++) {
        var stripe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.17, 0.18), red);
        stripe.position.set(0, 0.66, rb * 0.45);
        hurdle.add(stripe);
      }
      grp.add(hurdle);

      // 路障锥
      var cone = new THREE.Group();
      var body = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.62, 12), orange);
      body.position.y = 0.33;
      body.castShadow = true;
      cone.add(body);
      var ring = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.1, 12), white);
      ring.position.y = 0.3;
      cone.add(ring);
      var base = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.46), orange);
      base.position.y = 0.03;
      cone.add(base);
      cone.visible = false;
      grp.add(cone);

      // 水坑：贴地的东西最容易看不见，所以加大、加深，再补一圈白边
      var puddle = new THREE.Group();
      var water = new THREE.Mesh(
        new THREE.CircleGeometry(1.15, 22),
        new THREE.MeshStandardMaterial({
          color: 0x2f86c4, roughness: 0.08, metalness: 0.25,
          transparent: true, opacity: 0.95
        })
      );
      water.rotation.x = -Math.PI / 2;
      water.scale.set(1.45, 1, 1);
      water.position.y = 0.03;
      puddle.add(water);

      var rim = new THREE.Mesh(
        new THREE.RingGeometry(1.55, 1.78, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
      );
      rim.rotation.x = -Math.PI / 2;
      rim.scale.set(1.45, 1, 1);
      rim.position.y = 0.035;
      puddle.add(rim);

      var shine = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.62, 18),
        new THREE.MeshBasicMaterial({ color: 0xa8e0ff, transparent: true, opacity: 0.55 })
      );
      shine.rotation.x = -Math.PI / 2;
      shine.scale.set(1.6, 1, 1);
      shine.position.set(-0.25, 0.04, 0.15);
      puddle.add(shine);
      puddle.visible = false;
      grp.add(puddle);

      grp.userData.hurdle = hurdle;
      grp.userData.cone = cone;
      grp.userData.puddle = puddle;
      grp.visible = false;
      scene.add(grp);
      obstacleMeshes.push(grp);
    }
  }

  /* ---------- 香蕉皮 / 投掷物 ---------- */
  function buildProps() {
    var peelMat = mat(0xffd93d, { roughness: 0.75 });
    var peelTip = mat(0xd9a916, { roughness: 0.8 });
    for (var i = 0; i < 10; i++) {
      var g = new THREE.Group();
      var core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), peelMat);
      core.scale.set(1, 0.34, 1);
      core.position.y = 0.04;
      g.add(core);
      for (var k = 0; k < 3; k++) {
        var arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.075), peelMat);
        var ang = k * 2.1;
        arm.position.set(Math.cos(ang) * 0.12, 0.03, Math.sin(ang) * 0.12);
        arm.rotation.y = -ang;
        arm.rotation.z = 0.22;
        g.add(arm);
        var tip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), peelTip);
        tip.position.set(Math.cos(ang) * 0.22, 0.02, Math.sin(ang) * 0.22);
        g.add(tip);
      }
      g.visible = false;
      scene.add(g);
      bananaPool.push(g);
    }

    for (var j = 0; j < 4; j++) {
      var m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.2, 10),
        new THREE.MeshStandardMaterial({ color: 0x8ed0f2, roughness: 0.3 })
      );
      m.castShadow = true;
      m.visible = false;
      scene.add(m);
      shotPool.push(m);
    }
  }

  /* ---------- 姿态 ---------- */
  function applyPose(R, s, phase, now, dt) {
    var spd = clamp(s.speed / 26, 0, 1.2);
    var running = s.speed > 1.2;
    var ph = phase;

    var sw = Math.sin(ph);
    var sw2 = Math.sin(ph + Math.PI);
    var amp = 0.5 + 0.4 * spd;

    if (running) {
      var hA = sw * amp;
      var hB = sw2 * amp;

      R.legL.hip.rotation.z = hA;
      R.legR.hip.rotation.z = hB;
      R.legL.knee.rotation.z = -(0.2 + Math.max(0, -sw) * 1.75 + Math.max(0, sw) * 0.25);
      R.legR.knee.rotation.z = -(0.2 + Math.max(0, -sw2) * 1.75 + Math.max(0, sw2) * 0.25);
      R.legL.foot.rotation.z = 0.12 - hA * 0.28;
      R.legR.foot.rotation.z = 0.12 - hB * 0.28;

      R.armL.shoulder.rotation.z = -hA * 1.15 - 0.12;
      R.armR.shoulder.rotation.z = -hB * 1.15 - 0.12;
      R.armL.elbow.rotation.z = 0.9 + Math.max(0, sw) * 0.32;
      R.armR.elbow.rotation.z = 0.9 + Math.max(0, sw2) * 0.32;

      R.hips.position.y = 0.80 - 0.025 + Math.abs(Math.cos(ph)) * 0.055;
      R.torso.rotation.z = -(0.12 + 0.12 * spd);
      R.torso.rotation.y = sw * 0.1;
      R.head.rotation.z = (0.12 + 0.12 * spd) * 0.7;
      R.head.rotation.y = -0.12 - sw * 0.05;
    } else {
      var idle = Math.sin(now * 1.8);
      R.legL.hip.rotation.z = 0.16;
      R.legR.hip.rotation.z = -0.14;
      R.legL.knee.rotation.z = -0.18;
      R.legR.knee.rotation.z = -0.12;
      R.legL.foot.rotation.z = -0.05;
      R.legR.foot.rotation.z = 0.08;
      R.armL.shoulder.rotation.z = -0.2 + idle * 0.03;
      R.armR.shoulder.rotation.z = 0.14 - idle * 0.03;
      R.armL.elbow.rotation.z = 0.55;
      R.armR.elbow.rotation.z = 0.45;
      R.hips.position.y = 0.80 + idle * 0.008;
      R.torso.rotation.z = -0.05;
      R.torso.rotation.y = idle * 0.03;
      R.head.rotation.z = 0.03;
      R.head.rotation.y = -0.12 + idle * 0.05;
    }

    // 吃东西 / 喝水
    if (s.action === 'eat') {
      R.armL.shoulder.rotation.z = 0.7;
      R.armL.elbow.rotation.z = 2.3;
      R.rice.visible = true;
      R.bottle.visible = false;
      R.head.rotation.z += 0.14;
      R.head.rotation.x = Math.sin(now * 16) * 0.05;
    } else if (s.action === 'drink') {
      R.armL.shoulder.rotation.z = 0.9;
      R.armL.elbow.rotation.z = 2.2;
      R.bottle.visible = true;
      R.rice.visible = false;
      R.head.rotation.z += -0.2;
      R.head.rotation.x = -0.14;
    } else {
      R.rice.visible = false;
      R.bottle.visible = false;
      R.head.rotation.x = 0;
    }

    var flap = Math.sin(now * (6 + s.speed * 0.35)) * (0.18 + 0.3 * spd);
    R.ribbon.rotation.z = flap;
    R.ribbon.rotation.y = flap * 0.7;

    R.shadowBlob.scale.setScalar(1 + spd * 0.18);

    // 被干扰 / 打滑时的摇晃
    var wob = 0;
    if (s.jamT > 0) wob = 0.11;
    if (s.slipT > 0) wob = 0.2;
    if (wob > 0) {
      R.torso.rotation.z += Math.sin(now * 24) * wob;
      R.head.rotation.z += Math.sin(now * 19) * wob * 0.8;
      R.armL.shoulder.rotation.z += Math.sin(now * 21) * wob;
      R.armR.shoulder.rotation.z -= Math.sin(now * 21) * wob;
    }
  }

  /* ---------- 粒子池 ---------- */
  function buildPools() {
    var dustGeo = new THREE.IcosahedronGeometry(1, 0);
    for (var i = 0; i < 34; i++) {
      var m = new THREE.Mesh(dustGeo, new THREE.MeshBasicMaterial({
        color: 0xe8eaf0, transparent: true, opacity: 0, depthWrite: false
      }));
      m.visible = false;
      scene.add(m);
      dustPool.push({ mesh: m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1 });
    }

    var sparkGeo = new THREE.OctahedronGeometry(1, 0);
    for (var j = 0; j < 26; j++) {
      var sm = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({
        color: 0xffd166, transparent: true, opacity: 0, depthWrite: false
      }));
      sm.visible = false;
      scene.add(sm);
      sparkPool.push({ mesh: sm, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1 });
    }

    var ringGeo = new THREE.RingGeometry(0.62, 0.72, 40);
    for (var k = 0; k < 4; k++) {
      var rm = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xffc453, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false
      }));
      rm.rotation.x = -Math.PI / 2;
      rm.visible = false;
      scene.add(rm);
      ringPool.push({ mesh: rm, life: 0, max: 0.5 });
    }
  }

  function spawnDust(x, z) {
    for (var i = 0; i < dustPool.length; i++) {
      var p = dustPool[i];
      if (p.life <= 0) {
        p.life = p.max = 0.55 + Math.random() * 0.25;
        p.mesh.visible = true;
        p.mesh.position.set(x + (Math.random() - 0.5) * 0.3, 0.08 + Math.random() * 0.12, z + (Math.random() - 0.5) * 0.3);
        p.vx = -0.6 - Math.random() * 1.4;
        p.vy = 0.5 + Math.random() * 0.9;
        p.vz = (Math.random() - 0.5) * 0.8;
        p.size = 0.09 + Math.random() * 0.08;
        return;
      }
    }
  }

  function spawnSparks(x, y, z, n) {
    for (var c = 0; c < n; c++) {
      for (var i = 0; i < sparkPool.length; i++) {
        var p = sparkPool[i];
        if (p.life <= 0) {
          p.life = p.max = 0.45 + Math.random() * 0.25;
          p.mesh.visible = true;
          p.mesh.position.set(x, y, z);
          p.vx = (Math.random() - 0.5) * 3;
          p.vy = 1.5 + Math.random() * 2.6;
          p.vz = (Math.random() - 0.5) * 3;
          p.size = 0.045 + Math.random() * 0.05;
          break;
        }
      }
    }
  }

  function spawnRing(x, z) {
    for (var i = 0; i < ringPool.length; i++) {
      var p = ringPool[i];
      if (p.life <= 0) {
        p.life = p.max;
        p.mesh.visible = true;
        p.mesh.position.set(x, 0.05, z);
        p.mesh.scale.setScalar(0.35);
        return;
      }
    }
  }

  /* ---------- 每帧更新 ---------- */
  function update(s, view, dt, now) {
    var JUMP_H = 0.66;
    runner.position.x = s.distance;
    runner.position.z = s.lane || 0;
    runner.position.y = (s.jumpY || 0) * JUMP_H;
    applyPose(playerRig, s, view.phase, now, dt);

    // P2
    var p2 = s.p2;
    var leadD = s.distance, trailD = s.distance, duoGap = 0;
    if (p2 && p2Runner) {
      p2Runner.visible = true;
      p2Runner.position.x = p2.distance;
      p2Runner.position.z = p2.lane || 0.7;
      p2Runner.position.y = (p2.jumpY || 0) * JUMP_H;
      if (s.phase === 'run') {
        p2Phase += dt * ((p2.speed / 3.6) / 2.2 / 2) * Math.PI * 2;
      } else if (s.phase === 'idle') {
        p2Phase = view.phase;
      }
      applyPose(p2Rig, p2, p2Phase, now, dt);
      leadD = Math.max(s.distance, p2.distance);
      trailD = Math.min(s.distance, p2.distance);
      duoGap = leadD - trailD;
    } else if (p2Runner) {
      p2Runner.visible = false;
    }
    var refDist = trailD;
    var midD = (leadD + trailD) / 2;
    var fastSpeed = p2 ? Math.max(s.speed, p2.speed) : s.speed;

    // 对手
    for (var ri = 0; ri < rivalRigs.length; ri++) {
      var rr = s.rivals[ri];
      var rg = rivalRigs[ri];
      if (!rr) { rg.root.visible = false; continue; }
      var dv = rr.dist - refDist;
      rg.root.visible = rr.dist > refDist - 24 && dv < 62 + duoGap;
      rg.root.position.x = rr.dist;
      rg.root.position.z = rr.z;
      rg.root.position.y = (rr.jumpY || 0) * JUMP_H;
      if (rg.root.visible) applyPose(rg, rr, rr.phase, now, dt);
    }

    // 摄像机：双人时以落后者为基准，并按两人分差把镜头往后、往外拉，
    // 保证两个人始终同框
    var pullTarget = (s.finished && !(p2 && !p2.finished)) ? 3.4 : 0;
    finishPull += (pullTarget - finishPull) * (1 - Math.exp(-dt * 2.0));
    var behind = Math.min(duoGap * 0.30, 9);
    var camX = trailD + CAM.backX - finishPull - behind;
    var targetFov = CAM.fov + clamp((fastSpeed - 12) * 0.16, 0, 2.2);
    camera.fov = lerp(camera.fov, targetFov, 1 - Math.exp(-dt * 3));
    camera.updateProjectionMatrix();
    camera.position.x = camX;
    camera.position.y = CAM.height + Math.sin(now * 3.1) * 0.012 * (fastSpeed / 20);
    camera.position.z = CAM.side + Math.min(duoGap * 0.62, 10);
    if (shakeAmt > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shakeAmt;
      camera.position.y += (Math.random() - 0.5) * shakeAmt;
      shakeAmt *= Math.exp(-dt * 7);
    }
    var aimTarget = s.phase === 'idle' ? 1.9 : 0;
    titleAim += (aimTarget - titleAim) * (1 - Math.exp(-dt * 3));
    camera.lookAt(midD + CAM.aimX + titleAim, CAM.aimY, CAM.aimZ);

    // 光照跟随
    sunLight.position.set(midD + 6, 14, 9);
    sunLight.target.position.set(midD + 1, 0, -1);
    sunLight.target.updateMatrixWorld();

    // 天空跟随
    sunSprite.position.x = camX + 250;
    sunSprite.position.y = 104;
    cloudGroup.position.x = camX * 0.94;

    // 树回收
    var i, span = WORLD_SPAN;
    for (i = 0; i < treeList.length; i++) {
      var t = treeList[i];
      t.position.x = t.userData.base + span * Math.round((camX - t.userData.base) / span);
      t.position.z = t.userData.z;
    }
    for (i = 0; i < bushList.length; i++) {
      var b = bushList[i];
      b.position.x = b.userData.base + span * Math.round((camX - b.userData.base) / span);
      b.position.z = b.userData.z;
    }

    // 路边观众
    for (i = 0; i < crowd.length; i++) {
      var cg = crowd[i];
      var near = Math.abs(cg.position.x - s.distance) < 26;
      for (var ci = 0; ci < cg.children.length; ci++) {
        var one = cg.children[ci];
        var tt = now * (near ? 7.5 : 2.2) + one.userData.ph;
        one.position.y = near ? Math.abs(Math.sin(tt)) * 0.18 : Math.sin(tt) * 0.02;
        one.rotation.z = near ? Math.sin(tt * 0.6) * 0.09 : 0;
      }
    }

    // 补给点观众晃动
    for (i = 0; i < gateGroups.length; i++) {
      var g = gateGroups[i];
      for (var v = 0; v < 4; v++) {
        var sp = g.userData['spec' + v];
        if (!sp) continue;
        var t2 = now * 3.2 + sp.userData.phase;
        sp.position.y = Math.abs(Math.sin(t2)) * 0.14;
        sp.rotation.z = Math.sin(t2) * 0.08;
      }
    }

    // 粒子
    for (i = 0; i < dustPool.length; i++) {
      var d = dustPool[i];
      if (d.life > 0) {
        d.life -= dt;
        if (d.life <= 0) { d.mesh.visible = false; continue; }
        d.mesh.position.x += d.vx * dt;
        d.mesh.position.y += d.vy * dt;
        d.mesh.position.z += d.vz * dt;
        d.vy -= 0.8 * dt;
        var k = d.life / d.max;
        d.mesh.scale.setScalar(d.size * (2.2 - k * 1.2));
        d.mesh.material.opacity = k * 0.55;
      }
    }
    for (i = 0; i < sparkPool.length; i++) {
      var p = sparkPool[i];
      if (p.life > 0) {
        p.life -= dt;
        if (p.life <= 0) { p.mesh.visible = false; continue; }
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.vy -= 9 * dt;
        p.mesh.rotation.x += dt * 9;
        p.mesh.rotation.z += dt * 7;
        var k2 = p.life / p.max;
        p.mesh.scale.setScalar(p.size * (0.4 + k2 * 0.9));
        p.mesh.material.opacity = k2;
      }
    }
    // 障碍物：按距离把「视野内的障碍」滚动分配到模型池
    // （以前是 obstacleMeshes[i] 对应 s.obstacles[i]，池子只有 3 个，
    //   于是第 4 个之后的障碍永远不显示）
    var mi = 0;
    for (i = 0; i < s.obstacles.length && mi < obstacleMeshes.length; i++) {
      var o = s.obstacles[i];
      if (o.done) continue;
      var od = o.x - refDist;
      if (od <= -10 || od >= 76) continue;
      var og = obstacleMeshes[mi++];
      og.visible = true;
      og.position.set(o.x, 0, 0);
      og.userData.hurdle.visible = o.kind === 'hurdle';
      og.userData.cone.visible = o.kind === 'cone';
      og.userData.puddle.visible = o.kind === 'puddle';
    }
    for (; mi < obstacleMeshes.length; mi++) obstacleMeshes[mi].visible = false;

    // 香蕉皮
    for (i = 0; i < bananaPool.length; i++) {
      var bm = bananaPool[i];
      var bb = s.bananas[i];
      if (!bb || bb.used) { bm.visible = false; continue; }
      var bd = bb.x - s.distance;
      bm.visible = bd > -14 && bd < 40;
      if (!bm.visible) continue;
      bm.position.set(bb.x, 0.02, bb.z === undefined ? 0.15 : bb.z);
      bm.rotation.y = now * 0.6 + i;
    }

    // 飞行中的投掷物
    for (i = 0; i < shotPool.length; i++) {
      var sm = shotPool[i];
      var sh = s.shots[i];
      if (!sh) { sm.visible = false; continue; }
      sm.visible = true;
      var prog = 1 - sh.t / sh.total;
      var fromX = sh.from !== undefined ? sh.from : s.distance;
      var toX = sh.to === 'player' ? s.distance : (sh.target ? sh.target.dist : fromX);
      sm.position.set(fromX + (toX - fromX) * prog, 0.9 + Math.sin(prog * Math.PI) * 0.85, 0.1);
      sm.rotation.z = prog * 9;
    }

    for (i = 0; i < ringPool.length; i++) {
      var rg = ringPool[i];
      if (rg.life > 0) {
        rg.life -= dt;
        if (rg.life <= 0) { rg.mesh.visible = false; continue; }
        var k3 = 1 - rg.life / rg.max;
        rg.mesh.scale.setScalar(1 + k3 * 1.3);
        rg.mesh.material.opacity = (1 - k3) * 0.6;
      }
    }
  }

  function render() { renderer.render(scene, camera); }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = 16 / 9;
    camera.updateProjectionMatrix();
  }

  function projectionAt(pos, vw, vh) {
    tmpV.set(pos.x, pos.y + 1.35, pos.z);
    tmpV.project(camera);
    return {
      x: (tmpV.x * 0.5 + 0.5) * vw,
      y: (-tmpV.y * 0.5 + 0.5) * vh
    };
  }

  function runnerScreen(vw, vh) {
    return projectionAt(runner.position, vw, vh);
  }

  function p2Screen(vw, vh) {
    if (!p2Runner || !p2Runner.visible) return null;
    return projectionAt(p2Runner.position, vw, vh);
  }

  function shake(a) { shakeAmt = Math.max(shakeAmt, a); }

  function reset() {
    runner.position.x = 0;
    runner.position.y = 0;
    for (var q = 0; q < rivalRigs.length; q++) rivalRigs[q].root.visible = false;
    for (var q2 = 0; q2 < bananaPool.length; q2++) bananaPool[q2].visible = false;
    for (var q3 = 0; q3 < shotPool.length; q3++) shotPool[q3].visible = false;
    for (var q4 = 0; q4 < obstacleMeshes.length; q4++) obstacleMeshes[q4].visible = false;
    shakeAmt = 0;
    for (var i = 0; i < dustPool.length; i++) { dustPool[i].life = 0; dustPool[i].mesh.visible = false; }
    for (var j = 0; j < sparkPool.length; j++) { sparkPool[j].life = 0; sparkPool[j].mesh.visible = false; }
    for (var k = 0; k < ringPool.length; k++) { ringPool[k].life = 0; ringPool[k].mesh.visible = false; }
  }

  global.Scene3D = {
    init: init, update: update, render: render, resize: resize,
    reset: reset, shake: shake, spawnDust: spawnDust, spawnSparks: spawnSparks,
    spawnRing: spawnRing, runnerScreen: runnerScreen, p2Screen: p2Screen, CAM: CAM,
    get runner() { return runner; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
