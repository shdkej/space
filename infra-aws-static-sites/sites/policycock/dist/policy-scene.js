import * as THREE from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';

// The HTML archive remains the source of readable policy details and fallback links.
const host = document.getElementById('policy-scene');
const labels = document.getElementById('scene-labels');
const policies = window.POLICY_ATLAS_DATA;
let cleanupPartial = () => {};

if (host && labels) {
  initialize().catch(() => {
    cleanupPartial();
    host.dataset.status = 'fallback';
    document.dispatchEvent(new Event('policy-scene-unavailable'));
  });
}

async function initialize() {
  if (!Array.isArray(policies) || !policies.length) throw new Error('Policy data is unavailable');
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = window.matchMedia('(max-width: 1100px)');
  let mobile = narrow.matches;
  let disposed = false;
  let visible = true;
  let frame = 0;
  let previousTime = 0;
  let selected = null;
  let hovered = null;
  let expanded = false;
  let evening = false;
  let rotationEnabled = !mobile;
  let cameraTween = null;
  let pendingSelection = null;
  let renderer, controls, canvas, environment, room, pmrem;
  const cleanup = [];
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const tiles = [];
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    cleanup.forEach(fn => fn());
    controls?.dispose();
    geometries.forEach(geo => geo.dispose());
    materials.forEach(mat => mat.dispose());
    textures.forEach(value => value.dispose());
    environment?.dispose(); room?.dispose(); pmrem?.dispose();
    renderer?.dispose();
    canvas?.remove();
    host.style.touchAction = 'pan-y';
    labels.replaceChildren();
    delete window.policyScene;
  }
  cleanupPartial = dispose;
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const projected = new THREE.Vector3();
  const white = new THREE.Color('#f3f0e6');
  const green = new THREE.Color('#356553');
  const baseGraphite = new THREE.Color('#213a33');
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-10, 10, 7, -7, .1, 90);
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.3 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  canvas = renderer.domElement;
  canvas.className = 'policy-scene-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'display:block;width:100%;height:100%;position:absolute;inset:0;';
  host.prepend(canvas);

  controls = new OrbitControls(camera, host);
  controls.enableDamping = !media.matches;
  controls.dampingFactor = .095;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minPolarAngle = .31;
  controls.maxPolarAngle = 1.1;
  controls.minAzimuthAngle = -.62;
  controls.maxAzimuthAngle = .82;
  controls.rotateSpeed = .6;
  controls.enableRotate = rotationEnabled;
  canvas.style.touchAction = mobile ? 'pan-y' : 'auto';

  const hemisphere = new THREE.HemisphereLight('#fffaf0', '#93a69d', 2.3);
  scene.add(hemisphere);
  const keyLight = new THREE.DirectionalLight('#fff3db', 4.1);
  keyLight.position.set(-5, 12, 6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
  Object.assign(keyLight.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: .1, far: 35 });
  keyLight.shadow.normalBias = .035;
  keyLight.shadow.bias = -.00025;
  keyLight.shadow.radius = 4;
  scene.add(keyLight);
  cleanup.push(() => keyLight.shadow.dispose());
  const fillLight = new THREE.DirectionalLight('#d9e7ff', 1.1);
  fillLight.position.set(6, 5, -7);
  scene.add(fillLight);
  room = new RoomEnvironment();
  pmrem = new THREE.PMREMGenerator(renderer);
  environment = pmrem.fromScene(room, .06);
  scene.environment = environment.texture;
  scene.environmentIntensity = .65;
  room.dispose();
  pmrem.dispose();
  room = pmrem = null;

  const board = new THREE.Group();
  scene.add(board);
  let lowerPlate, upperPlate, rimPlate, deck, boardWidth, boardDepth;
  const graphite = material({ color: baseGraphite, metalness: .48, roughness: .3 });
  const silver = material({ color: '#b7c7bd', metalness: .88, roughness: .27 });
  const socket = material({ color: '#10251f', metalness: .45, roughness: .38 });
  const bronze = material({ color: '#b6aa87', metalness: .8, roughness: .31 });
  const screwMaterial = material({ color: '#768c7e', metalness: .9, roughness: .3 });
  const groundMaterial = new THREE.ShadowMaterial({ color: '#253c31', opacity: .20 });
  materials.add(groundMaterial);
  const ground = new THREE.Mesh(geometry(new THREE.PlaneGeometry(80, 80)), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.85;
  ground.receiveShadow = true;
  scene.add(ground);
  // A broad contact shadow anchors the assembly even on devices with coarse shadow maps.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const shadowContext = shadowCanvas.getContext('2d');
  const shadowGradient = shadowContext.createRadialGradient(64, 64, 12, 64, 64, 62);
  shadowGradient.addColorStop(0, 'rgba(33,52,42,.26)');
  shadowGradient.addColorStop(.45, 'rgba(33,52,42,.13)');
  shadowGradient.addColorStop(1, 'rgba(33,52,42,0)');
  shadowContext.fillStyle = shadowGradient;
  shadowContext.fillRect(0, 0, 128, 128);
  const contactTexture = texture(new THREE.CanvasTexture(shadowCanvas));
  const contactShadow = new THREE.Mesh(geometry(new THREE.PlaneGeometry(1, 1)), material({ map: contactTexture, transparent: true, depthWrite: false, roughness: 1 }));
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = -.83;
  scene.add(contactShadow);

  function geometry(value) { geometries.add(value); return value; }
  function texture(value) { textures.add(value); return value; }
  function material(options) { const value = new THREE.MeshStandardMaterial(options); materials.add(value); return value; }
  function roundedBox(width, depth, height, radius = .16) {
    const shape = new THREE.Shape();
    const x = -width / 2, y = -depth / 2, r = radius;
    shape.moveTo(x + r, y);
    shape.lineTo(x + width - r, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + r);
    shape.lineTo(x + width, y + depth - r);
    shape.quadraticCurveTo(x + width, y + depth, x + width - r, y + depth);
    shape.lineTo(x + r, y + depth);
    shape.quadraticCurveTo(x, y + depth, x, y + depth - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    const geo = geometry(new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .035, bevelThickness: .035, curveSegments: 10 }));
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -height / 2, 0);
    return geo;
  }
  function mesh(geo, mat, parent, y = 0) {
    const item = new THREE.Mesh(geo, mat);
    item.position.y = y;
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  function rebuildBoard() {
    const sharedMaterials = new Set([graphite, silver, socket, bronze, screwMaterial]);
    board.traverse(object => {
      if (object.geometry) { object.geometry.dispose(); geometries.delete(object.geometry); }
      if (object.material && !sharedMaterials.has(object.material)) { object.material.dispose(); materials.delete(object.material); }
    });
    board.clear();
    tiles.length = 0;
    labels.replaceChildren();
    const columns = mobile ? 3 : 5;
    const rows = Math.ceil(policies.length / columns);
    boardWidth = columns * 2.26 + .74;
    boardDepth = rows * 2.37 + 1.45;
    lowerPlate = mesh(roundedBox(boardWidth, boardDepth, .34, .38), graphite, board, -.12);
    rimPlate = mesh(roundedBox(boardWidth - .08, boardDepth - .08, .075, .37), silver, board, .12);
    upperPlate = mesh(roundedBox(boardWidth - .08, boardDepth - .08, .18, .37), graphite, board, .245);
    deck = new THREE.Group();
    board.add(deck);
    contactShadow.scale.set(boardWidth * 1.4, boardDepth * 1.4, 1);
    const socketGeometry = roundedBox(2.05, 2.08, .12, .22);
    const tileGeometry = roundedBox(1.88, 1.88, .34, .19);
    const insetGeometry = roundedBox(1.74, 1.74, .022, .15);
    const pinGeometry = geometry(new THREE.CylinderGeometry(.043, .043, .018, 16));
    for (let i = 0; i < policies.length; i++) {
      const policy = policies[i];
      const row = Math.floor(i / columns), col = i % columns;
      const x = (col - (columns - 1) / 2) * 2.26;
      const z = (row - (rows - 1) / 2) * 2.37 - .27;
      const well = mesh(socketGeometry, socket, deck, .4);
      well.position.x = x; well.position.z = z;
      const node = new THREE.Group();
      node.position.set(x, .68, z);
      board.add(node);
      const porcelain = material({ color: white.clone(), metalness: .08, roughness: .31 });
      const body = mesh(tileGeometry, porcelain, node);
      body.userData.policyId = policy.id;
      const glaze = material({ color: white.clone(), metalness: .03, roughness: .38 });
      const top = mesh(insetGeometry, glaze, node, .177);
      top.userData.policyId = policy.id;
      const pin = mesh(pinGeometry, bronze, node, .203);
      pin.position.set(-.62, .203, -.62);
      const notch = mesh(geometry(new THREE.BoxGeometry(.4, .009, .015)), bronze, node, .203);
      notch.position.set(.43, .203, .65);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'scene-label';
      button.dataset.scenePolicy = policy.id;
      button.setAttribute('aria-label', `${policy.policy} / ${policy.name} / ${policy.year} ${policy.stage} 선택`);
      button.setAttribute('aria-pressed', 'false');
      const index = document.createElement('span');
      index.className = 'scene-label-index';
      index.textContent = `${policy.year} · ${policy.stage}`;
      const name = document.createElement('span');
      name.className = 'scene-label-title';
      const mobileTitles = {park:'평등에 관한\n법률안',hong:'어르신 통합\n무임교통',na:'신혼부부\n주거 지원',han:'금융투자\n소득세 폐지', 'kim-dongyeon':'예술인\n기회소득', 'kim-kyungsoo':'부울경\n메가시티'};
      name.textContent = mobile ? mobileTitles[policy.id] || policy.policy : policy.policy;
      button.append(index, name);
      button.style.position = 'absolute';
      button.style.transform = 'translate(-50%,-50%)';
      button.addEventListener('click', event => { if (event.detail === 0) api.select(policy.id); });
      button.addEventListener('pointerenter', () => setHover(policy.id));
      button.addEventListener('pointerleave', () => setHover(null));
      button.addEventListener('focus', () => setHover(policy.id));
      button.addEventListener('blur', () => setHover(null));
      labels.append(button);
      tiles.push({ id: policy.id, node, body, top, porcelain, glaze, button, x, z, index: i });
    }
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const screw = mesh(geometry(new THREE.CylinderGeometry(.085, .085, .025, 16)), screwMaterial, deck, .36);
      screw.position.set(x * (boardWidth / 2 - .3), .36, z * (boardDepth / 2 - .3));
      const groove = mesh(geometry(new THREE.BoxGeometry(.09, .009, .018)), socket, screw, .018);
      groove.rotation.y = Math.PI / 4;
    }
    const badge = mesh(roundedBox(mobile ? 2.3 : 3.4, .34, .018, .08), bronze, deck, .36);
    badge.position.z = boardDepth / 2 - .45;
  }

  function defaultPose() {
    const aspect = Math.max(.1, host.clientWidth / Math.max(1, host.clientHeight));
    const vertical = mobile ? Math.max(10.6, 10.3 / aspect) : Math.max(9.7, 15.4 / aspect);
    return {
      position: new THREE.Vector3(...(mobile ? [1.6, 25, 18] : [8.7, 13.5, 14])),
      target: new THREE.Vector3(0, expanded ? .7 : .1, 0),
      zoom: 1,
      vertical
    };
  }
  function applyFrustum() {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    const pose = defaultPose(), aspect = width / height;
    camera.left = -pose.vertical * aspect / 2;
    camera.right = pose.vertical * aspect / 2;
    camera.top = pose.vertical / 2;
    camera.bottom = -pose.vertical / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  function emitSelection() {
    if (!pendingSelection) return;
    const id = pendingSelection;
    pendingSelection = null;
    document.dispatchEvent(new CustomEvent('policy-scene-select', { detail: { id } }));
  }
  function tweenCamera(position, target, zoom, done) {
    cameraTween = {
      start: performance.now(), duration: media.matches ? 0 : 620,
      from: camera.position.clone(), to: position.clone(),
      fromTarget: controls.target.clone(), toTarget: target.clone(),
      fromZoom: camera.zoom, toZoom: zoom, done
    };
    requestFrame();
  }
  function setHover(id) {
    if (hovered === id || disposed) return;
    hovered = id;
    tiles.forEach(tile => tile.button.classList.toggle('is-hovered', tile.id === id));
    canvas.style.cursor = id ? 'pointer' : rotationEnabled ? 'grab' : 'default';
    requestFrame();
  }
  function updateLabels() {
    const width = host.clientWidth, height = host.clientHeight;
    for (const tile of tiles) {
      projected.copy(tile.node.position);
      projected.y += .22;
      projected.project(camera);
      const x = (projected.x + 1) / 2 * width, y = (1 - projected.y) / 2 * height;
      tile.button.style.left = `${x.toFixed(2)}px`;
      tile.button.style.top = `${y.toFixed(2)}px`;
      tile.button.style.zIndex = String(10 + Math.round((1 - projected.z) * 100));
      const outside = projected.z < -1 || projected.z > 1 || x < 8 || x > width - 8 || y < 8 || y > height - 8;
      tile.button.style.visibility = outside ? 'hidden' : 'visible';
    }
  }
  function updateAssembly(delta) {
    let changing = false;
    const speed = media.matches ? 1 : 1 - Math.exp(-delta * 9);
    function move(object, key, value) {
      const before = object[key];
      object[key] = THREE.MathUtils.lerp(before, value, speed);
      if (Math.abs(object[key] - value) < .001) object[key] = value;
      else changing = true;
    }
    move(lowerPlate.position, 'y', expanded ? -.4 : -.12);
    move(rimPlate.position, 'y', expanded ? .01 : .12);
    move(upperPlate.position, 'y', expanded ? .46 : .245);
    move(deck.position, 'y', expanded ? .22 : 0);
    for (const tile of tiles) {
      const chosen = tile.id === selected, active = chosen || tile.id === hovered;
      move(tile.node.position, 'x', tile.x * (expanded ? 1.08 : 1));
      move(tile.node.position, 'z', tile.z * (expanded ? 1.08 : 1));
      move(tile.node.position, 'y', .68 + (expanded ? 1.06 : 0) + (chosen ? .32 : active ? .13 : 0));
      const targetColor = chosen ? green : white;
      if (!tile.porcelain.color.equals(targetColor)) {
        tile.porcelain.color.lerp(targetColor, speed);
        if (Math.abs(tile.porcelain.color.r - targetColor.r) + Math.abs(tile.porcelain.color.g - targetColor.g) + Math.abs(tile.porcelain.color.b - targetColor.b) < .001) tile.porcelain.color.copy(targetColor);
        else changing = true;
      }
      tile.glaze.color.copy(tile.porcelain.color);
    }
    return changing;
  }
  function requestFrame() {
    if (!frame && !disposed && visible && !document.hidden) frame = requestAnimationFrame(render);
  }
  function render(time) {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const delta = Math.min(.5, Math.max(.001, (time - (previousTime || time - 16)) / 1000));
    previousTime = time;
    let moving = updateAssembly(delta);
    if (cameraTween) {
      const tween = cameraTween;
      const progress = tween.duration ? Math.min(1, (time - tween.start) / tween.duration) : 1;
      const eased = 1 - Math.pow(1 - progress, 3);
      camera.position.lerpVectors(tween.from, tween.to, eased);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
      camera.zoom = THREE.MathUtils.lerp(tween.fromZoom, tween.toZoom, eased);
      camera.updateProjectionMatrix();
      moving = true;
      if (progress === 1) { cameraTween = null; tween.done?.(); }
    }
    controls.dampingFactor = 1 - Math.exp(-delta * 6);
    controls.update();
    camera.updateMatrixWorld();
    updateLabels();
    renderer.render(scene, camera);
    if (moving) requestFrame();
  }
  function hitTest(event) {
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(tiles.flatMap(tile => [tile.body, tile.top]), false)[0]?.object.userData.policyId || null;
  }
  let down = null;
  function pointerDown(event) { down = { x: event.clientX, y: event.clientY, id: event.pointerId, labelId: event.target.closest('[data-scene-policy]')?.dataset.scenePolicy }; }
  function pointerMove(event) {
    if (down?.id === event.pointerId && !down.dragged && Math.hypot(event.clientX - down.x, event.clientY - down.y) >= 7) down.dragged = true;
    if (event.pointerType === 'mouse' && !event.buttons) setHover(hitTest(event));
  }
  function pointerUp(event) {
    if (down?.id === event.pointerId && !down.dragged && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 7) {
      const id = down.labelId || hitTest(event);
      if (id) api.select(id);
    }
    down = null;
  }
  function listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    cleanup.push(() => target.removeEventListener(type, listener, options));
  }
  function unavailable(event) {
    event?.preventDefault();
    api.dispose();
    host.dataset.status = 'fallback';
    document.dispatchEvent(new Event('policy-scene-unavailable'));
  }
  const api = {
    select(id) {
      const tile = tiles.find(item => item.id === id);
      if (!tile || disposed) return;
      selected = id;
      pendingSelection = id;
      tiles.forEach(item => {
        item.button.classList.toggle('is-selected', item.id === id);
        item.button.setAttribute('aria-pressed', String(item.id === id));
      });
      const target = tile.node.position.clone();
      target.x *= .42;
      target.z *= .42;
      target.y = expanded ? 1.3 : .75;
      const offset = camera.position.clone().sub(controls.target);
      tweenCamera(target.clone().add(offset), target, mobile ? 1.04 : 1.12, emitSelection);
    },
    reset() {
      if (disposed) return;
      selected = null; pendingSelection = null;
      tiles.forEach(tile => { tile.button.classList.remove('is-selected'); tile.button.setAttribute('aria-pressed', 'false'); });
      const pose = defaultPose();
      tweenCamera(pose.position, pose.target, pose.zoom, () => document.dispatchEvent(new Event('policy-scene-reset')));
    },
    setExpanded(value) {
      if (disposed) return;
      expanded = Boolean(value);
      host.dataset.expanded = String(expanded);
      if (selected) api.select(selected);
      else {
        const pose = defaultPose();
        tweenCamera(pose.position, pose.target, expanded ? .93 : 1);
      }
      requestFrame();
    },
    setLighting(value) {
      if (disposed) return;
      evening = value === 'evening';
      host.dataset.lighting = evening ? 'evening' : 'day';
      keyLight.color.set(evening ? '#ffd09b' : '#fff3db');
      keyLight.intensity = evening ? 3.2 : 4.1;
      fillLight.color.set(evening ? '#a8bfff' : '#d9e7ff');
      fillLight.intensity = evening ? 1.5 : 1.1;
      hemisphere.intensity = evening ? 1.4 : 2.3;
      renderer.toneMappingExposure = evening ? .92 : 1.05;
      ground.material.color.set(evening ? '#4b3729' : '#253c31');
      requestFrame();
    },
    setRotationEnabled(value) {
      if (disposed) return;
      rotationEnabled = Boolean(value);
      controls.enableRotate = rotationEnabled;
      host.style.touchAction = canvas.style.touchAction = rotationEnabled ? 'none' : 'pan-y';
      host.dataset.rotation = String(rotationEnabled);
      canvas.style.cursor = rotationEnabled ? 'grab' : 'default';
    },
    dispose
  };
  window.policyScene = api;
  rebuildBoard();
  applyFrustum();
  const pose = defaultPose();
  camera.position.copy(pose.position);
  controls.target.copy(pose.target);
  controls.update();
  api.setRotationEnabled(rotationEnabled);
  listen(controls, 'change', requestFrame);
  listen(controls, 'start', () => { cameraTween = null; emitSelection(); });
  listen(host, 'pointerdown', pointerDown);
  listen(host, 'pointermove', pointerMove);
  listen(host, 'pointerup', pointerUp);
  listen(host, 'pointercancel', () => { down = null; setHover(null); });
  listen(host, 'pointerleave', () => setHover(null));
  listen(canvas, 'webglcontextlost', unavailable);
  listen(document, 'visibilitychange', requestFrame);
  listen(media, 'change', () => { controls.enableDamping = !media.matches; requestFrame(); });
  const resize = new ResizeObserver(() => {
    if (disposed) return;
    if (mobile !== narrow.matches) {
      mobile = narrow.matches;
      cameraTween = null;
      rebuildBoard();
      selected = null; pendingSelection = null;
      const nextPose = defaultPose();
      camera.position.copy(nextPose.position);
      controls.target.copy(nextPose.target);
      camera.zoom = 1;
      api.setRotationEnabled(!mobile);
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.3 : 1.6));
      document.dispatchEvent(new Event('policy-scene-reset'));
    }
    applyFrustum(); requestFrame();
  });
  resize.observe(host);
  cleanup.push(() => resize.disconnect());
  const intersection = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true;
    if (visible) { previousTime = 0; requestFrame(); }
    else { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: '100px' });
  intersection.observe(host);
  cleanup.push(() => intersection.disconnect());
  listen(window, 'pagehide', () => { cancelAnimationFrame(frame); frame = 0; });
  listen(window, 'pageshow', requestFrame);
  camera.updateMatrixWorld();
  updateLabels();
  renderer.render(scene, camera);
  host.dataset.status = 'ready';
  host.dataset.expanded = 'false';
  host.dataset.lighting = 'day';
  document.dispatchEvent(new Event('policy-scene-ready'));
  requestFrame();
}
