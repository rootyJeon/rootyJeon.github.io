/* Interactive Franka Emika Panda on a desk (three.js).
 * Loads the real Panda meshes (assets/robot/panda.glb, see LICENSE-panda.txt), builds the
 * kinematic chain from the MuJoCo Menagerie model, and drives joints 1/2/4/6 with a damped
 * least-squares IK so the gripper hovers over the cursor pointing straight down. Click an
 * object to pick it up, click again to put it down (objects stack). Lazy-loads when the
 * section scrolls near; honours prefers-reduced-motion. */
(function () {
  var view = document.getElementById('robot-view');
  if (!view) return;
  var status = document.getElementById('robot-status');
  var bubble = document.getElementById('robot-bubble');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var started = false;

  function fail(msg) { if (status) { status.hidden = false; status.textContent = msg; } }

  function boot() {
    if (started) return; started = true;
    Promise.all([
      import('three'),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/environments/RoomEnvironment.js')
    ]).then(function (mods) {
      try { init(mods[0], mods[1].GLTFLoader, mods[2].RoomEnvironment); }
      catch (e) { console.error(e); fail('The robot could not start in this browser.'); }
    }).catch(function (e) { console.error(e); fail('The robot could not be loaded.'); });
  }

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries, obs) {
      if (entries[0].isIntersecting) { obs.disconnect(); boot(); }
    }, { rootMargin: '400px' }).observe(view);
  } else { boot(); }

  function init(THREE, GLTFLoader, RoomEnvironment) {
    // ---------- renderer / scene ----------
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    view.insertBefore(renderer.domElement, view.firstChild);

    var scene = new THREE.Scene();
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    var camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
    var LOOK_AT = new THREE.Vector3(0.0, 0.3, -0.02);
    camera.position.set(-0.8, 0.74, 1.38);
    camera.lookAt(LOOK_AT);

    var hemi = new THREE.HemisphereLight(0xffffff, 0x9aa0a8, 0.4);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(-1.2, 2.4, 1.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -1.2; sun.shadow.camera.right = 1.2;
    sun.shadow.camera.top = 1.2; sun.shadow.camera.bottom = -1.2;
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 6;
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.01;
    scene.add(sun);

    // ---------- desk ----------
    var DESK_W = 1.7, DESK_D = 0.78, DESK_T = 0.035;
    var deskMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd3, roughness: 0.75, metalness: 0 });
    var legMat = new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: 0.8 });
    var desk = new THREE.Mesh(new THREE.BoxGeometry(DESK_W, DESK_T, DESK_D), deskMat);
    desk.position.y = -DESK_T / 2; desk.receiveShadow = true; desk.castShadow = true;
    scene.add(desk);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.05), legMat);
      leg.position.set(s[0] * (DESK_W / 2 - 0.06), -DESK_T - 0.35, s[1] * (DESK_D / 2 - 0.06));
      leg.castShadow = true; leg.receiveShadow = true; scene.add(leg);
    });

    // ---------- objects ----------
    var objects = [];
    function std(color, rough, metal) { return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.5 : rough, metalness: metal || 0 }); }
    function shadowed(o) { o.traverse(function (m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }

    function makeMug() {
      var g = new THREE.Group();
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.032, 0.09, 40, 1, true), std(0xfafafa, 0.35));
      body.material.side = THREE.DoubleSide; body.position.y = 0.045; g.add(body);
      var bottom = new THREE.Mesh(new THREE.CircleGeometry(0.032, 40), std(0xfafafa, 0.35)); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.002; g.add(bottom);
      var coffee = new THREE.Mesh(new THREE.CircleGeometry(0.034, 40), std(0x4a2c1c, 0.25)); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.078; g.add(coffee);
      var handle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 12, 32, Math.PI), std(0xfafafa, 0.35));
      handle.position.set(0.036, 0.045, 0); handle.rotation.z = -Math.PI / 2; handle.rotation.y = 0; g.add(handle);
      g.userData = { name: 'mug', w: 0.072, h: 0.09, r: 0.045, grip: 0.072 };
      return shadowed(g);
    }
    function makeApple() {
      var g = new THREE.Group();
      var a = new THREE.Mesh(new THREE.SphereGeometry(0.036, 36, 28), std(0xd2302f, 0.3)); a.position.y = 0.036; a.scale.y = 0.92; g.add(a);
      var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.02, 8), std(0x5b3a29, 0.8)); stem.position.set(0, 0.078, 0); stem.rotation.z = 0.2; g.add(stem);
      var leaf = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), std(0x3f9b4e, 0.6)); leaf.scale.set(1.4, 0.25, 0.7); leaf.position.set(0.012, 0.08, 0.004); g.add(leaf);
      g.userData = { name: 'apple', w: 0.072, h: 0.07, r: 0.04, grip: 0.07 };
      return shadowed(g);
    }
    function makeLaptop() {
      var g = new THREE.Group();
      var base = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.012, 0.21), std(0x9aa0a8, 0.35, 0.6)); base.position.y = 0.006; g.add(base);
      var kb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.002, 0.10), std(0x3b4048, 0.6)); kb.position.set(0, 0.0125, 0.02); g.add(kb);
      var lid = new THREE.Group(); lid.position.set(0, 0.012, -0.105); lid.rotation.x = -0.35;   // lid leans back
      var lidBody = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.20, 0.008), std(0x9aa0a8, 0.35, 0.6)); lidBody.position.set(0, 0.10, 0); lid.add(lidBody);
      var screen = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x1e3a5f, emissiveIntensity: 0.9, roughness: 0.3 }));
      screen.position.set(0, 0.10, 0.0045); lid.add(screen);
      [[-0.09, 0.14, 0x60a5fa, 0.06], [-0.04, 0.11, 0x34d399, 0.11], [-0.07, 0.08, 0xf472b6, 0.09], [-0.09, 0.05, 0xfbbf24, 0.05]].forEach(function (l) {
        var bar = new THREE.Mesh(new THREE.PlaneGeometry(l[3], 0.012), new THREE.MeshBasicMaterial({ color: l[2] }));
        bar.position.set(l[0] + l[3] / 2, l[1], 0.0048); lid.add(bar);
      });
      g.add(lid);
      g.userData = { name: 'laptop', w: 0.30, h: 0.21, top: 0.014, r: 0.16, grip: 0.012, graspDepth: 0.03 };
      return shadowed(g);
    }
    function makeNotes() {
      var g = new THREE.Group();
      var pad = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.024, 0.075), std(0xfde68a, 0.9)); pad.position.y = 0.012; g.add(pad);
      var top = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.002, 0.075), std(0xfef3c7, 0.9)); top.position.y = 0.025; g.add(top);
      g.userData = { name: 'notes', w: 0.075, h: 0.026, r: 0.05, grip: 0.075 };
      return shadowed(g);
    }

    var BASE = new THREE.Vector3(0.2, 0, -0.16);   // robot pedestal centre on the desk
    function addObject(o, x, z) { o.position.set(x, 0, z); o.userData.on = null; scene.add(o); objects.push(o); return o; }
    addObject(makeLaptop(), -0.36, -0.06);
    addObject(makeNotes(), -0.08, 0.2);
    addObject(makeMug(), 0.12, 0.05);
    addObject(makeApple(), 0.46, 0.14);

    // ---------- robot chain (MuJoCo Menagerie panda.xml body tree) ----------
    var root = new THREE.Group();
    root.position.copy(BASE);
    root.rotation.x = -Math.PI / 2;   // MJCF is z-up, three.js is y-up
    scene.add(root);

    var CHAIN = [
      { name: 'link1', pos: [0, 0, 0.333], quat: [1, 0, 0, 0], joint: true },
      { name: 'link2', pos: [0, 0, 0], quat: [1, -1, 0, 0], joint: true },
      { name: 'link3', pos: [0, -0.316, 0], quat: [1, 1, 0, 0], joint: true },
      { name: 'link4', pos: [0.0825, 0, 0], quat: [1, 1, 0, 0], joint: true },
      { name: 'link5', pos: [-0.0825, 0.384, 0], quat: [1, -1, 0, 0], joint: true },
      { name: 'link6', pos: [0, 0, 0], quat: [1, 1, 0, 0], joint: true },
      { name: 'link7', pos: [0.088, 0, 0], quat: [1, 1, 0, 0], joint: true },
      { name: 'hand', pos: [0, 0, 0.107], quat: [0.9238795, 0, 0, -0.3826834], joint: false }
    ];
    var bodies = { link0: root };
    var joints = [];
    var parent = root;
    CHAIN.forEach(function (b) {
      var frame = new THREE.Group();
      frame.position.set(b.pos[0], b.pos[1], b.pos[2]);
      frame.quaternion.set(b.quat[1], b.quat[2], b.quat[3], b.quat[0]).normalize();
      parent.add(frame);
      var body = new THREE.Group();   // rotates about local z by the joint angle
      frame.add(body);
      bodies[b.name] = body;
      if (b.joint) joints.push(body);
      parent = body;
    });
    var hand = bodies.hand;
    var fingers = [];
    [[0, 0], [1, Math.PI]].forEach(function (f) {
      var frame = new THREE.Group(); frame.position.set(0, 0, 0.0584); frame.rotation.z = f[1];
      hand.add(frame);
      var slide = new THREE.Group(); frame.add(slide);   // translates along local +y
      bodies[f[0] ? 'right_finger' : 'left_finger'] = slide;
      fingers.push(slide);
    });
    var TIP_Z = 0.1034;   // hand origin -> point between the finger pads

    var LIMITS = [[-2.8973, 2.8973], [-1.7628, 1.7628], [-2.8973, 2.8973], [-3.0718, -0.0698], [-2.8973, 2.8973], [-0.0175, 3.7525], [-2.8973, 2.8973]];
    var q = [0, -0.4, 0, -2.3, 0, 1.95, 0.785];      // current joint angles
    var qSol = q.slice();                             // IK state (warm start)
    var IK_J = [1, 3, 5];   // joint 1 (yaw) is set analytically; 2/4/6 solve the in-plane problem
    var fingerPos = 0.04, fingerTarget = 0.04;

    function applyJoints(arr) {
      for (var i = 0; i < 7; i++) joints[i].rotation.z = arr[i];
    }

    var _tip = new THREE.Vector3(), _z = new THREE.Vector3(), _tmp = new THREE.Vector3();
    var DOWN = new THREE.Vector3(0, -1, 0);
    var ROT_W = 0.25;
    function evalF(arr, out) {   // F(q) = [tip xyz, ROT_W * hand z-axis]; goal = [target, ROT_W * down]
      applyJoints(arr);
      root.updateMatrixWorld(true);
      _tip.set(0, 0, TIP_Z); hand.localToWorld(_tip);
      hand.getWorldDirection(_z);
      out[0] = _tip.x; out[1] = _tip.y; out[2] = _tip.z;
      out[3] = ROT_W * _z.x; out[4] = ROT_W * _z.y; out[5] = ROT_W * _z.z;
      return out;
    }
    var F0 = new Array(6), F1 = new Array(6), Jm = [], goal = new Array(6);
    for (var r = 0; r < 6; r++) Jm.push(new Array(3));
    function solve6(A, b) {   // Gaussian elimination, A 6x6 (modified in place)
      var n = 6, i, j, k;
      for (i = 0; i < n; i++) {
        var p = i; for (k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k;
        var t = A[i]; A[i] = A[p]; A[p] = t; var tb = b[i]; b[i] = b[p]; b[p] = tb;
        for (k = i + 1; k < n; k++) { var f = A[k][i] / A[i][i]; for (j = i; j < n; j++) A[k][j] -= f * A[i][j]; b[k] -= f * b[i]; }
      }
      var x = new Array(n);
      for (i = n - 1; i >= 0; i--) { var s = b[i]; for (j = i + 1; j < n; j++) s -= A[i][j] * x[j]; x[i] = s / A[i][i]; }
      return x;
    }
    function ik(target, iters) {
      goal[0] = target.x; goal[1] = target.y; goal[2] = target.z; goal[3] = 0; goal[4] = -ROT_W; goal[5] = 0;
      // Yaw the base toward the target (MJCF x = three x, MJCF y = -three z).
      qSol[0] = Math.atan2(-(target.z - BASE.z), target.x - BASE.x);
      var lambda = 0.05, d = 1e-3, i, j, k, en = 0;
      for (var it = 0; it < iters; it++) {
        evalF(qSol, F0);
        var e = new Array(6); en = 0;
        for (i = 0; i < 6; i++) { e[i] = goal[i] - F0[i]; en += e[i] * e[i]; }
        if (en < 1e-7) break;
        for (j = 0; j < 3; j++) {
          var jj = IK_J[j], old = qSol[jj]; qSol[jj] = old + d; evalF(qSol, F1); qSol[jj] = old;
          for (i = 0; i < 6; i++) Jm[i][j] = (F1[i] - F0[i]) / d;
        }
        var A = [];
        for (i = 0; i < 6; i++) { A.push(new Array(6)); for (k = 0; k < 6; k++) { var s = 0; for (j = 0; j < 3; j++) s += Jm[i][j] * Jm[k][j]; A[i][k] = s + (i === k ? lambda * lambda : 0); } }
        var y = solve6(A, e.slice());
        for (j = 0; j < 3; j++) {
          var dq = 0; for (i = 0; i < 6; i++) dq += Jm[i][j] * y[i];
          var jj2 = IK_J[j], lim = LIMITS[jj2];
          qSol[jj2] = Math.min(lim[1], Math.max(lim[0], qSol[jj2] + Math.max(-0.35, Math.min(0.35, dq))));
        }
      }
      // If a pose gets wedged against joint limits, restart from the ready pose.
      if (en > 0.004) { if (++stuck > 45) { for (i = 1; i < 7; i++) qSol[i] = READY[i]; stuck = 0; } } else stuck = 0;
    }
    var READY = [0, -0.4, 0, -2.3, 0, 1.95, 0.785], stuck = 0;

    // ---------- load meshes ----------
    var loader = new GLTFLoader();
    var ready = false;
    loader.load('assets/robot/panda.glb', function (gltf) {
      var meshes = [];
      gltf.scene.traverse(function (m) { if (m.isMesh) meshes.push(m); });
      meshes.forEach(function (m) {
        var n = m, key = null;
        while (n && !key) { var mm = /^(link\d|hand|left_finger|right_finger)__/.exec(n.name || ''); if (mm) key = mm[1]; n = n.parent; }
        if (!key || !bodies[key]) return;
        m.castShadow = true; m.receiveShadow = true;
        if (m.material) {
          var mat = m.material, nm = mat.name || '';
          mat.envMapIntensity = 0.55; mat.side = THREE.FrontSide;
          if (nm === 'white') { mat.color.set(0xf4f5f7); mat.roughness = 0.32; }
          else if (nm === 'off_white') { mat.color.set(0xe3e6e9); mat.roughness = 0.4; }
          else if (nm === 'black') { mat.color.set(0x1d2024); mat.roughness = 0.45; }
          else if (nm === 'light_blue') { mat.color.set(0x0a8ac7); mat.roughness = 0.4; }
          else if (nm === 'green') { mat.color.set(0x22c55e); mat.roughness = 0.4; }
        }
        bodies[key].add(m);
      });
      ready = true;
      if (status) status.hidden = true;
      applyJoints(q); setFingers(fingerPos);
      if (reduced) { root.updateMatrixWorld(true); renderer.render(scene, camera); }
      else start();
    }, undefined, function (e) { console.error(e); fail('The robot model could not be loaded.'); });

    function setFingers(s) { fingers[0].position.y = s; fingers[1].position.y = s; }

    // ---------- interaction ----------
    var raycaster = new THREE.Raycaster();
    var ndc = new THREE.Vector2();
    var deskPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    var cursor = null, lastCursor = null, cursorIn = false;
    var mode = 'free', held = null, pickObj = null, modeSince = 0, placeAt = new THREE.Vector3(), placeOn = null;
    var waveUntil = 0, bubbleUntil = 0, bubbleText = '';
    var HOVER_H = 0.16, GRIP_DEPTH = 0.02, REACH_MIN = 0.22, REACH_MAX = 0.62;
    var target = new THREE.Vector3(-0.2, HOVER_H, 0.05);

    // objTop: the surface something else can rest on; graspTop: where the gripper grabs.
    function objTop(o) { return (o.userData.on ? objTop(o.userData.on) : 0) + (o.userData.top || o.userData.h); }
    function graspTop(o) { return (o.userData.on ? objTop(o.userData.on) : 0) + o.userData.h; }
    function graspY(o) { return graspTop(o) - (o.userData.graspDepth || GRIP_DEPTH); }

    function clampXZ(v, margin) {
      margin = margin || 0;
      v.x = Math.max(-DESK_W / 2 + 0.08 + margin, Math.min(DESK_W / 2 - 0.08 - margin, v.x));
      v.z = Math.max(-DESK_D / 2 + 0.06 + margin, Math.min(DESK_D / 2 - 0.06 - margin, v.z));
      var dx = v.x - BASE.x, dz = v.z - BASE.z, d = Math.hypot(dx, dz) || 1e-6;
      var dc = Math.max(REACH_MIN + margin, Math.min(REACH_MAX, d));
      v.x = BASE.x + dx / d * dc; v.z = BASE.z + dz / d * dc;
      return v;
    }

    function pointerToDesk(e) {
      var r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var p = new THREE.Vector3();
      return raycaster.ray.intersectPlane(deskPlane, p) ? p : null;
    }
    function pointerObject(e) {
      var r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects(objects.filter(function (o) { return o !== held; }), true);
      if (!hits.length) return null;
      var n = hits[0].object; while (n && objects.indexOf(n) < 0) n = n.parent;
      return n;
    }
    function supportAt(p, self) {
      var best = null;
      objects.forEach(function (o) {
        if (o === self) return;
        var c = o; while (c && c !== self) c = c.userData.on; if (c === self) return;
        var d = Math.hypot(o.position.x - p.x, o.position.z - p.z);
        if (d < (o.userData.r + self.userData.r) * 0.75 && (!best || objTop(o) > objTop(best))) best = o;
      });
      return best;
    }
    function setMode(m, now) { mode = m; modeSince = now; }
    function greet(now, text) { waveUntil = now + 1500; bubbleUntil = now + 1400; bubbleText = text; }

    function onMove(e) {
      var r = renderer.domElement.getBoundingClientRect(), m = 80;
      var inside = e.clientX > r.left - m && e.clientX < r.right + m && e.clientY > r.top - m && e.clientY < r.bottom + m;
      if (inside) {
        var p = pointerToDesk(e);
        if (p) { if (!cursorIn && mode === 'free') greet(performance.now(), 'Hi there!'); cursor = p; lastCursor = p.clone(); cursorIn = true; }
      } else { cursor = null; cursorIn = false; }
    }
    function onDown(e) {
      if (!ready || reduced) return;
      var r = renderer.domElement.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      var now = performance.now();
      var p = pointerToDesk(e); if (p) { cursor = p; lastCursor = p.clone(); cursorIn = true; }
      if (mode === 'free') {
        var o = pointerObject(e);
        if (o && Math.hypot(o.position.x - BASE.x, o.position.z - BASE.z) < REACH_MAX + 0.05) { pickObj = o; setMode('reach', now); }
        else greet(now, 'Hi there!');
      } else if (mode === 'carry' && p) {
        placeAt.copy(p); clampXZ(placeAt, held.userData.r * 0.5);
        // keep clear of the pedestal
        var dx = placeAt.x - BASE.x, dz = placeAt.z - BASE.z, d = Math.hypot(dx, dz) || 1e-6, minD = 0.16 + held.userData.r;
        if (d < minD) { placeAt.x = BASE.x + dx / d * minD; placeAt.z = BASE.z + dz / d * minD; }
        placeOn = supportAt(placeAt, held);
        setMode('place', now);
      }
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    renderer.domElement.addEventListener('pointerdown', function (e) { onDown(e); e.preventDefault(); });
    document.addEventListener('pointerleave', function () { cursor = null; cursorIn = false; });
    window.addEventListener('blur', function () { cursor = null; cursorIn = false; });

    // ---------- theme ----------
    function applyTheme() {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      deskMat.color.set(dark ? 0x3b4149 : 0xe6dfd3);
      legMat.color.set(dark ? 0x2c3137 : 0xcfc6b8);
      hemi.intensity = dark ? 0.3 : 0.4;
      sun.intensity = dark ? 1.1 : 1.3;
      renderer.toneMappingExposure = dark ? 0.85 : 0.9;
    }
    applyTheme();
    if (window.MutationObserver) new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // ---------- sizing ----------
    function resize() {
      var w = view.clientWidth, h = view.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w < 560 ? 40 : 30;
      camera.updateProjectionMatrix();
    }
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(view); else window.addEventListener('resize', resize);

    // ---------- animation ----------
    var visible = true, rafId = 0;
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) start(); }, { rootMargin: '60px' }).observe(view);
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });
    function start() { if (!ready || reduced || rafId || !visible || document.hidden) return; rafId = requestAnimationFrame(step); }

    var _hp = new THREE.Vector3();
    function updateBubble(now) {
      if (now >= bubbleUntil) { bubble.hidden = true; return; }
      _hp.set(0.08, 0, 0.02); hand.localToWorld(_hp); _hp.y += 0.1;
      _hp.project(camera);
      var w = view.clientWidth, h = view.clientHeight;
      bubble.hidden = false; bubble.textContent = bubbleText;
      bubble.style.left = Math.round((_hp.x + 1) / 2 * w) + 'px';
      bubble.style.top = Math.round((1 - _hp.y) / 2 * h) + 'px';
      bubble.style.opacity = Math.min(1, (bubbleUntil - now) / 300);
    }

    var tipNow = new THREE.Vector3();
    function step(now) {
      rafId = 0;
      var t = now / 1000;
      var near = cursor || lastCursor;

      switch (mode) {
        case 'free':
          if (cursor) target.set(cursor.x, HOVER_H, cursor.z);
          else target.set(-0.12 + 0.18 * Math.sin(t * 0.5), HOVER_H + 0.04 + 0.02 * Math.sin(t * 1.3), 0.12 + 0.1 * Math.cos(t * 0.37));
          clampXZ(target);
          fingerTarget = now < waveUntil ? (Math.sin(now * 0.013) > 0 ? 0.04 : 0.004) : 0.03 + 0.006 * Math.sin(now * 0.002);
          break;
        case 'reach':
          target.set(pickObj.position.x, graspY(pickObj), pickObj.position.z);
          fingerTarget = 0.04;
          if (tipNow.distanceTo(target) < 0.006 || now - modeSince > 1600) setMode('grasp', now);
          break;
        case 'grasp':
          target.set(pickObj.position.x, graspY(pickObj), pickObj.position.z);
          fingerTarget = Math.min(0.04, pickObj.userData.grip / 2);
          if (now - modeSince > 320) {
            held = pickObj; pickObj = null;
            objects.forEach(function (o) { if (o.userData.on === held) o.userData.on = null; });
            held.userData.on = null;
            greet(now, 'Got it!');
            setMode('lift', now);
          }
          break;
        case 'lift':
          target.y += 0.012;
          if (now - modeSince > 450) setMode('carry', now);
          break;
        case 'carry':
          if (near) { target.x = near.x; target.z = near.z; }
          target.y = HOVER_H + (held.userData.h - (held.userData.graspDepth || GRIP_DEPTH)) + 0.02;
          clampXZ(target, held.userData.r * 0.5);
          break;
        case 'place':
          target.set(placeAt.x, (placeOn ? objTop(placeOn) : 0) + held.userData.h - (held.userData.graspDepth || GRIP_DEPTH), placeAt.z);
          if (tipNow.distanceTo(target) < 0.006 || now - modeSince > 1800) {
            held.position.set(target.x, placeOn ? objTop(placeOn) : 0, target.z);
            held.userData.on = placeOn; held = null;
            fingerTarget = 0.04;
            setMode('release', now);
          }
          break;
        case 'release':
          target.y += 0.012; fingerTarget = 0.04;
          if (now - modeSince > 380) setMode('free', now);
          break;
      }

      ik(target, 6);
      var k = (mode === 'free' && !cursor) ? 0.05 : 0.14, maxStep = (mode === 'free' && !cursor) ? 0.02 : 0.06;
      for (var i = 0; i < 7; i++) {
        var d = (qSol[i] - q[i]) * k;
        q[i] += Math.max(-maxStep, Math.min(maxStep, d));
      }
      fingerPos += (fingerTarget - fingerPos) * 0.25;
      applyJoints(q); setFingers(fingerPos);
      root.updateMatrixWorld(true);
      tipNow.set(0, 0, TIP_Z); hand.localToWorld(tipNow);

      if (held) {
        held.position.set(tipNow.x, tipNow.y - (held.userData.h - (held.userData.graspDepth || GRIP_DEPTH)), tipNow.z);
      }
      updateBubble(now);
      renderer.render(scene, camera);
      if (visible && !document.hidden) rafId = requestAnimationFrame(step);
    }
  }
})();
