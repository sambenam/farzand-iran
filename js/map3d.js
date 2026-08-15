/* =====================================================================
   فرزندان ایران — نمای سه‌بعدی نقشه با Three.js
   ===================================================================== */
window.initMap3D = function () {
  const APP = window.APP;
  if (!window.THREE || !THREE.SVGLoader) {
    console.warn('Three.js در دسترس نیست؛ نمای سه‌بعدی غیرفعال شد.');
    return;
  }
  const container = document.getElementById('map3d');

  const LIT_COLOR = 0xff9e4f;
  const LIT_EMISSIVE = 0x6a2c00;
  const DARK_COLOR = 0x1b2332;
  const DARK_EMISSIVE = 0x000000;
  const SELECT_COLOR = 0xf4ead2;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, -48, 42);
  camera.lookAt(0, 0, 0);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.minDistance = 14;
  controls.maxDistance = 120;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.target.set(0, 0, 0);

  /* نورپردازی */
  const ambient = new THREE.AmbientLight(0x8f9cc4, 0.75);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x0a0d14, 0.5);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffd9a0, 1.15);
  key.position.set(-30, 40, 35);
  scene.add(key);

  const LIGHT_RADIUS = 3.3;

  /* ذرات درخشان شناور بالای استان‌های دارای نام */
  let particles = null;
  function buildParticles() {
    if (particles) { scene.remove(particles); particles.geometry.dispose(); particles.material.dispose(); }
    const positions = [];
    const meshes = APP3D.meshByPid || {};
    Object.keys(APP3D.meshByPid || {}).forEach((pid) => {
      if (APP.countOf(pid) === 0) return;
      const list = APP3D.meshByPid[pid];
      list.forEach((m) => {
        for (let i = 0; i < 4; i++) {
          positions.push(m.userData.cx, m.userData.cy, 0.9 + Math.random() * 4.2);
        }
      });
    });
    if (!positions.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffc27a, size: 0.22, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    particles = new THREE.Points(geo, mat);
    scene.add(particles);
  }

  /* ساخت اشکال از SVG */
  const meshByPid = {};
  function buildShapes() {
    const loader = new THREE.SVGLoader();
    const data = loader.parse(window.IRAN_SVG);
    const pathData = data.paths;
    const scale = 0.058;
    const baseZ = 0;

    pathData.forEach((p) => {
      const node = p.userData ? p.userData.node : null;
      const pid = node && node.id ? node.id : null;
      if (!pid) return;

      const shapes = THREE.SVGLoader.createShapes(p);
      const meshes = [];
      shapes.forEach((shape) => {
        const g = new THREE.ExtrudeGeometry(shape, {
          depth: 0.75, bevelEnabled: true, bevelThickness: 0.35,
          bevelSize: 0.3, bevelSegments: 3, curveSegments: 24
        });
        g.center();
        const lit = APP.countOf(pid) > 0;
        const mat = new THREE.MeshStandardMaterial({
          color: lit ? LIT_COLOR : DARK_COLOR,
          emissive: lit ? LIT_EMISSIVE : DARK_EMISSIVE,
          emissiveIntensity: lit ? 0.85 : 0,
          roughness: 0.52,
          metalness: 0.25,
          flatShading: false
        });
        const mesh = new THREE.Mesh(g, mat);
        mesh.scale.set(scale, scale, scale);
        mesh.position.set(0, 0, baseZ);
        mesh.userData.pid = pid;
        mesh.userData.lit = lit;
        meshes.push(mesh);
        scene.add(mesh);
      });

      if (meshes.length) {
        meshByPid[pid] = meshes;
        const box = new THREE.Box3();
        meshes.forEach((m) => box.expandByObject(m));
        const cx = (box.min.x + box.max.x) / 2;
        const cy = (box.min.y + box.max.y) / 2;
        meshes.forEach((m) => { m.userData.cx = cx; m.userData.cy = cy; });
      }
    });

    APP3D.meshByPid = meshByPid;
    buildParticles();
  }

  function setMeshState(pid) {
    const meshes = meshByPid[pid];
    if (!meshes) return;
    const lit = APP.countOf(pid) > 0;
    const selected = APP.selectedPid === pid;
    meshes.forEach((m) => {
      m.material.color.setHex(selected ? SELECT_COLOR : (lit ? LIT_COLOR : DARK_COLOR));
      m.material.emissive.setHex(selected ? 0x7a5a2a : (lit ? LIT_EMISSIVE : DARK_EMISSIVE));
      m.material.emissiveIntensity = selected ? 1.1 : (lit ? 0.85 : 0);
      m.scale.z = selected ? 1.25 : 1;
    });
  }
  function clearHighlight() { Object.keys(meshByPid).forEach((k) => setMeshState(k)); }

  const APP3D = window.APP3D = {
    meshByPid,
    setMeshState,
    clearHighlight,
    renderer,
    scene,
    camera,
    controls,
    onShow() { resize(); }
  };

  buildShapes();

  /* شمع‌های کوچک روی استان‌های دارای نام (نقطه‌های نور، بدون هندسه‌ی سنگین) */
  const glowGroup = new THREE.Group();
  scene.add(glowGroup);
  (function addGlowSprites() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,214,150,1)');
    grad.addColorStop(0.4, 'rgba(255,158,79,.55)');
    grad.addColorStop(1, 'rgba(255,122,61,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    Object.keys(meshByPid).forEach((pid) => {
      if (APP.countOf(pid) === 0) return;
      const m = meshByPid[pid][0];
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      sp.position.set(m.userData.cx, m.userData.cy, 1.5);
      sp.scale.set(LIGHT_RADIUS, LIGHT_RADIUS, 1);
      sp.userData.pid = pid;
      glowGroup.add(sp);
    });
  })();

  /* پالس نور شمع‌ها */
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    controls.update();
    if (particles) {
      particles.rotation.z = Math.sin(t * 0.05) * 0.02;
      particles.material.opacity = 0.75 + Math.sin(t * 1.7) * 0.2;
    }
    glowGroup.children.forEach((s, i) => {
      const k = 0.55 + Math.sin(t * 2 + i * 1.3) * 0.35;
      s.material.opacity = 0.55 + k * 0.45;
      s.scale.set(LIGHT_RADIUS * (0.85 + k * 0.25), LIGHT_RADIUS * (0.85 + k * 0.25), 1);
    });
    renderer.render(scene, camera);
  }
  animate();

  /* ردیابی ماوس برای تشخیص استان (با پرتاب پرتو) */
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredPid = null;
  let mapRect = { left: 0, top: 0 };

  function updateRect() {
    const r = container.getBoundingClientRect();
    mapRect = { left: r.left, top: r.top, w: r.width, h: r.height };
  }

  function onMove(e) {
    updateRect();
    mouse.x = ((e.clientX - mapRect.left) / mapRect.w) * 2 - 1;
    mouse.y = -((e.clientY - mapRect.top) / mapRect.h) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const flat = [];
    Object.keys(meshByPid).forEach((pid) => {
      meshByPid[pid].forEach((m) => flat.push(m));
    });
    const hits = raycaster.intersectObjects(flat, false);
    let pid = null;
    if (hits.length) pid = hits[0].object.userData.pid;

    if (pid !== hoveredPid) {
      hoveredPid = pid;
      if (pid) {
        APP.showTooltip(e, pid);
        container.style.cursor = 'pointer';
      } else {
        APP.hideTooltip();
        container.style.cursor = 'grab';
      }
    }
  }

  function onClick(e) {
    updateRect();
    mouse.x = ((e.clientX - mapRect.left) / mapRect.w) * 2 - 1;
    mouse.y = -((e.clientY - mapRect.top) / mapRect.h) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const flat = [];
    Object.keys(meshByPid).forEach((pid) => {
      meshByPid[pid].forEach((m) => flat.push(m));
    });
    const hits = raycaster.intersectObjects(flat, false);
    if (hits.length) APP.openPanel(hits[0].object.userData.pid);
  }

  renderer.domElement.addEventListener('mousemove', onMove);
  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('mouseleave', () => {
    hoveredPid = null;
    APP.hideTooltip();
    container.style.cursor = 'grab';
  });

  /* اندازه‌گیری */
  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();
};
