/* =====================================================================
   فرزندان ایران — نمای سه‌بعدی نقشه با Three.js
   نسخه ۲:
   - رفع باگ برعکس‌شدن نقشه (مختصات SVG برعکس محور Y در WebGL است)
   - قاب‌بندی خودکار دوربین روی کل نقشه
   - خطوط مرزی تمیز بین استان‌ها
   - چرخش آرام و خودکار تا اولین لمس کاربر
   ===================================================================== */
window.initMap3D = function () {
  var APP = window.APP;
  var container = document.getElementById('map3d');

  if (!window.THREE || !THREE.SVGLoader) { fallback3D(); return; }

  /* پالت شبِ سوگوار */
  var LIT_COLOR = 0xb06a45;       // استان دارای نام — اخگرِ کم‌نور
  var DARK_COLOR = 0x161c2a;      // استان بدون نام — سرمه‌ای
  var SELECT_COLOR = 0xe8e2d4;    // استان انتخاب‌شده — روشنِ آرام
  var LINE_COLOR = 0x0a0e16;      // خطوط مرزی
  var SCALE = 0.058;
  var BASE_Z = 0;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (e) { fallback3D(); return; }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', function (ev) {
    ev.preventDefault();
    fallback3D();
  });

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 800);
  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 12;
  controls.maxDistance = 180;
  controls.maxPolarAngle = Math.PI * 0.5;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.45;
  renderer.domElement.addEventListener('pointerdown', function () { controls.autoRotate = false; });

  /* نورپردازی کم‌نور و سرد با یک منبع گرمِ خیلی ملایم */
  scene.add(new THREE.AmbientLight(0x7e8aa6, 0.5));
  scene.add(new THREE.HemisphereLight(0x9fb4d6, 0x0a0c12, 0.45));
  var key = new THREE.DirectionalLight(0xffe3c0, 0.85);
  key.position.set(-25, 30, 45);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0x9fc4ff, 0.45);
  rim.position.set(18, -22, 25);
  scene.add(rim);

  var meshByPid = {};
  var glowGroup = new THREE.Group();
  scene.add(glowGroup);
  var particles = null;
  var hoveredPid = null;

  var APP3D = window.APP3D = {
    meshByPid: meshByPid,
    setMeshState: setMeshState,
    clearHighlight: clearHighlight,
    renderer: renderer,
    scene: scene,
    camera: camera,
    controls: controls,
    onShow: resize
  };

  /* ---------- ساخت اشکال از SVG ---------- */
  function build() {
    var loader = new THREE.SVGLoader();
    var data = loader.parse(window.IRAN_SVG);
    data.paths.forEach(function (p) {
      var node = p.userData ? p.userData.node : null;
      var pid = node && node.id ? node.id : null;
      if (!pid) return;

      var shapes = THREE.SVGLoader.createShapes(p);
      var meshes = [];
      shapes.forEach(function (shape) {
        /* مهم: هندسه را جداگانه center نکن، وگرنه همه‌ی استان‌ها
           روی هم در مبدأ جمع می‌شوند و نقشه خراب به نظر می‌رسد */
        var geo = new THREE.ExtrudeGeometry(shape, {
          depth: 2.0, bevelEnabled: false, curveSegments: 12
        });

        var lit = APP.countOf(pid) > 0;
        var mat = new THREE.MeshStandardMaterial({
          color: lit ? LIT_COLOR : DARK_COLOR,
          emissive: lit ? 0x2a1208 : 0x000000,
          emissiveIntensity: lit ? 0.45 : 0,
          roughness: 0.62,
          metalness: 0.18,
          side: THREE.DoubleSide
        });
        var mesh = new THREE.Mesh(geo, mat);
        /* نکته‌ی مهم: قلب محور Y تا نقشه وارونه نباشد */
        mesh.scale.set(SCALE, -SCALE, SCALE);
        mesh.position.set(0, 0, BASE_Z);
        mesh.userData.pid = pid;
        mesh.userData.lit = lit;
        mesh.userData.baseEmis = lit ? 0.45 : 0;
        mesh.userData.baseZ = BASE_Z;

        /* خطوط مرزی تمیز */
        var edges = new THREE.EdgesGeometry(geo, 25);
        var lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
          color: LINE_COLOR, transparent: true, opacity: 0.85
        }));
        lines.position.z = 0.06;
        mesh.add(lines);

        meshes.push(mesh);
        scene.add(mesh);
      });

      if (meshes.length) {
        meshByPid[pid] = meshes;
      }
    });

    /* کل نقشه را به مبدأ منتقل کن (نه هر استان را جداگانه) */
    scene.updateMatrixWorld(true);
    var allBox = new THREE.Box3();
    Object.keys(meshByPid).forEach(function (pid) {
      meshByPid[pid].forEach(function (m) { allBox.expandByObject(m); });
    });
    var mapCenter = allBox.getCenter(new THREE.Vector3());
    Object.keys(meshByPid).forEach(function (pid) {
      meshByPid[pid].forEach(function (m) {
        m.position.set(-mapCenter.x, -mapCenter.y, BASE_Z);
      });
    });

    /* مراکز استان‌ها را بعد از به‌روزرسانی ماتریس‌ها محاسبه کن */
    scene.updateMatrixWorld(true);
    Object.keys(meshByPid).forEach(function (pid) {
      var box = new THREE.Box3();
      meshByPid[pid].forEach(function (m) { box.expandByObject(m); });
      var cx = (box.min.x + box.max.x) / 2;
      var cy = (box.min.y + box.max.y) / 2;
      meshByPid[pid].forEach(function (m) { m.userData.cx = cx; m.userData.cy = cy; });
    });

    buildParticles();
    buildGlow();
    frameCamera();
  }

  /* ---------- ذرات شناور بالای استان‌های دارای نام ---------- */
  function buildParticles() {
    if (particles) { scene.remove(particles); particles.geometry.dispose(); particles.material.dispose(); }
    var positions = [];
    Object.keys(meshByPid).forEach(function (pid) {
      if (APP.countOf(pid) === 0) return;
      meshByPid[pid].forEach(function (m) {
        for (var i = 0; i < 4; i++) {
          positions.push(m.userData.cx, m.userData.cy, 0.7 + Math.random() * 3.6);
        }
      });
    });
    if (!positions.length) return;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    var mat = new THREE.PointsMaterial({
      color: 0xd9b58a, size: 0.2, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    particles = new THREE.Points(geo, mat);
    scene.add(particles);
  }

  /* ---------- هاله‌ی نور ملایم روی استان‌های دارای نام ---------- */
  function buildGlow() {
    glowGroup.children.forEach(function (c) {
      glowGroup.remove(c);
      if (c.material) c.material.dispose();
    });
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(236,205,168,.9)');
    grad.addColorStop(0.45, 'rgba(201,138,95,.4)');
    grad.addColorStop(1, 'rgba(178,95,61,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    var tex = new THREE.CanvasTexture(c);
    Object.keys(meshByPid).forEach(function (pid) {
      if (APP.countOf(pid) === 0) return;
      var m = meshByPid[pid][0];
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      sp.position.set(m.userData.cx, m.userData.cy, 1.3);
      sp.scale.set(2.6, 2.6, 1);
      sp.userData.pid = pid;
      glowGroup.add(sp);
    });
  }

  /* ---------- قاب‌بندی خودکار دوربین ---------- */
  function frameCamera() {
    scene.updateMatrixWorld(true);
    var box = new THREE.Box3();
    Object.keys(meshByPid).forEach(function (pid) {
      meshByPid[pid].forEach(function (m) { box.expandByObject(m); });
    });
    var center = box.getCenter(new THREE.Vector3());
    var size = box.getSize(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y);
    var fov = camera.fov * Math.PI / 180;
    var fit = (maxDim / 2) / Math.tan(fov / 2);
    var dist = fit * 1.22;
    camera.position.set(center.x, center.y - dist * 0.66, dist * 0.92);
    camera.near = dist / 60;
    camera.far = dist * 25;
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
  }

  /* ---------- وضعیت ظاهری هر استان ---------- */
  function setMeshState(pid) {
    var meshes = meshByPid[pid];
    if (!meshes) return;
    var lit = APP.countOf(pid) > 0;
    var selected = APP.selectedPid === pid;
    meshes.forEach(function (m) {
      var base = lit ? LIT_COLOR : DARK_COLOR;
      m.material.color.setHex(selected ? SELECT_COLOR : base);
      m.material.emissive.setHex(selected ? 0x6a5a3a : (lit ? 0x2a1208 : 0x000000));
      m.material.emissiveIntensity = selected ? 0.9 : m.userData.baseEmis;
      m.position.z = selected ? 0.55 : m.userData.baseZ;
    });
  }
  function clearHighlight() { Object.keys(meshByPid).forEach(function (k) { setMeshState(k); }); }

  /* ---------- هاور ---------- */
  function applyHover(pid) {
    if (hoveredPid === pid) return;
    if (hoveredPid) setMeshState(hoveredPid);
    hoveredPid = pid;
    if (pid && APP.selectedPid !== pid) {
      (meshByPid[pid] || []).forEach(function (m) {
        m.material.emissive.setHex(m.userData.lit ? 0x3a1a0c : 0x16202e);
        m.material.emissiveIntensity = m.userData.lit ? 1.0 : 0.4;
      });
    }
  }

  /* ---------- fallback در نبود WebGL ---------- */
  function fallback3D() {
    container.innerHTML =
      '<div class="panel-empty" style="padding-top:70px">' +
      '<span class="pe-icon">🗺</span>مرورگر شما از نمایش سه‌بعدی پشتیبانی نمی‌کند.<br>از نمای دوبعدی استفاده کنید.' +
      '</div>';
    var b = document.getElementById('btn2d');
    if (b) b.click();
  }

  /* ---------- رویدادهای ماوس ---------- */
  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();
  var rect = { left: 0, top: 0, w: 1, h: 1 };
  var downPos = null;

  function updateRect() {
    var r = container.getBoundingClientRect();
    rect = { left: r.left, top: r.top, w: r.width, h: r.height };
  }
  function pick(e) {
    updateRect();
    mouse.x = ((e.clientX - rect.left) / rect.w) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.h) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var flat = [];
    Object.keys(meshByPid).forEach(function (pid) {
      meshByPid[pid].forEach(function (m) { flat.push(m); });
    });
    var hits = raycaster.intersectObjects(flat, false);
    return hits.length ? hits[0].object.userData.pid : null;
  }

  renderer.domElement.addEventListener('pointerdown', function (e) {
    downPos = { x: e.clientX, y: e.clientY };
  });
  renderer.domElement.addEventListener('mousemove', function (e) {
    var pid = pick(e);
    applyHover(pid);
    if (pid) {
      APP.showTooltip(e, pid);
      container.style.cursor = 'pointer';
    } else {
      APP.hideTooltip();
      container.style.cursor = 'grab';
    }
  });
  renderer.domElement.addEventListener('mouseleave', function () {
    applyHover(null);
    APP.hideTooltip();
    container.style.cursor = 'grab';
  });
  renderer.domElement.addEventListener('click', function (e) {
    if (downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;
    var pid = pick(e);
    if (pid) APP.openPanel(pid);
  });

  /* ---------- اندازه‌گیری ---------- */
  function resize() {
    var w = container.clientWidth || 1;
    var h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- حلقه‌ی رندر ---------- */
  var clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    controls.update();
    if (particles) {
      particles.rotation.z = Math.sin(t * 0.05) * 0.02;
      particles.material.opacity = 0.55 + Math.sin(t * 1.5) * 0.18;
    }
    glowGroup.children.forEach(function (s, i) {
      var k = 0.5 + Math.sin(t * 1.6 + i * 1.3) * 0.3;
      s.material.opacity = 0.35 + k * 0.35;
      s.scale.set(2.6 * (0.85 + k * 0.3), 2.6 * (0.85 + k * 0.3), 1);
    });
    renderer.render(scene, camera);
  }
  animate();

  /* ---------- ساخت ---------- */
  build();
};
