import * as THREE from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';

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
  const white = new THREE.Color('#252d32');
  const green = new THREE.Color('#e9dfca');
  const baseGraphite = new THREE.Color('#1b2024');
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-10, 10, 7, -7, .1, 90);
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.3 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
  controls.minPolarAngle = .34;
  controls.maxPolarAngle = 1.18;
  controls.minAzimuthAngle = -.62;
  controls.maxAzimuthAngle = .72;
  controls.rotateSpeed = .6;
  controls.enableRotate = rotationEnabled;
  canvas.style.touchAction = mobile ? 'pan-y' : 'auto';

  const hemisphere = new THREE.HemisphereLight('#f6f1e8', '#262c35', .7);
  scene.add(hemisphere);
  const keyLight = new THREE.DirectionalLight('#fff2dc', 2.8);
  keyLight.position.set(-8, 11, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
  Object.assign(keyLight.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: .1, far: 40 });
  keyLight.shadow.normalBias = .025;
  keyLight.shadow.bias = -.0003;
  keyLight.shadow.radius = 3;
  scene.add(keyLight);
  cleanup.push(() => keyLight.shadow.dispose());
  const fillLight = new THREE.DirectionalLight('#d7e5ff', .8);
  fillLight.position.set(7, 4, -5);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight('#ffffff', 1.7);
  rimLight.position.set(-3, 6, -9);
  scene.add(rimLight);
  room = new RoomEnvironment();
  pmrem = new THREE.PMREMGenerator(renderer);
  environment = pmrem.fromScene(room, .025);
  scene.environment = environment.texture;
  scene.environmentIntensity = .6;
  room.dispose(); pmrem.dispose(); room = pmrem = null;

  // Load the same local Korean typeface as the surrounding interface before engraving.
  await document.fonts.load('600 32px PolicySans');
  if (disposed) return;
  const board = new THREE.Group();
  scene.add(board);
  let lowerPlate, upperPlate, rimPlate, deck, boardWidth, boardDepth, knob, display, displayTexture;
  let pointerLeanX = 0, pointerLeanZ = 0;
  let boardVersion = 0;
  const boardTextures = new Set();
  const brushed = document.createElement('canvas');
  brushed.width = brushed.height = 128;
  const brushContext = brushed.getContext('2d');
  let seed = 17;
  for (let y = 0; y < 128; y++) {
    seed = (seed * 16807) % 2147483647;
    const gray = 125 + seed % 38;
    brushContext.fillStyle = `rgb(${gray},${gray},${gray})`;
    brushContext.fillRect(0, y, 128, 1);
  }
  const brushTexture = texture(new THREE.CanvasTexture(brushed));
  brushTexture.wrapS = brushTexture.wrapT = THREE.RepeatWrapping;
  brushTexture.repeat.set(3, 8);
  const graphite = material({ color: baseGraphite, metalness: .85, roughness: .5, clearcoat: 0, envMapIntensity: .18, bumpMap: brushTexture, bumpScale: .009 });
  const silver = material({ color: '#aeb7bb', metalness: .95, roughness: .25 });
  const socket = material({ color: '#111517', metalness: .35, roughness: .37 });
  const bronze = material({ color: '#c2a777', metalness: .75, roughness: .3 });
  const screwMaterial = material({ color: '#555f65', metalness: .95, roughness: .23 });
  const circuitMaterial = material({ color: '#25463d', metalness: .35, roughness: .45 });
  const groundMaterial = new THREE.ShadowMaterial({ color: '#000000', opacity: .18 });
  materials.add(groundMaterial);
  const ground = new THREE.Mesh(geometry(new THREE.PlaneGeometry(80, 80)), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.96;
  ground.receiveShadow = true;
  scene.add(ground);
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const shadowContext = shadowCanvas.getContext('2d');
  const shadowGradient = shadowContext.createRadialGradient(64, 64, 10, 64, 64, 63);
  shadowGradient.addColorStop(0, 'rgba(0,0,0,.65)');
  shadowGradient.addColorStop(.45, 'rgba(0,0,0,.3)');
  shadowGradient.addColorStop(1, 'rgba(0,0,0,0)');
  shadowContext.fillStyle = shadowGradient;
  shadowContext.fillRect(0, 0, 128, 128);
  const contactTexture = texture(new THREE.CanvasTexture(shadowCanvas));
  const contactMaterial = new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, depthWrite: false });
  materials.add(contactMaterial);
  const contactShadow = new THREE.Mesh(geometry(new THREE.PlaneGeometry(1, 1)), contactMaterial);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = -.94;
  scene.add(contactShadow);

  function geometry(value) { geometries.add(value); return value; }
  function texture(value) { textures.add(value); return value; }
  function material(options) { const value = new THREE.MeshPhysicalMaterial(options); materials.add(value); return value; }
  function roundedBox(width, depth, height, radius = .16, bevel = .035, aperture = null) {
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
    if (aperture) {
      const [w, d] = aperture;
      const hole = new THREE.Path();
      hole.moveTo(-w / 2, -d / 2); hole.lineTo(-w / 2, d / 2); hole.lineTo(w / 2, d / 2); hole.lineTo(w / 2, -d / 2); hole.closePath();
      shape.holes.push(hole);
    }
    const geo = geometry(new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: bevel, bevelThickness: bevel, curveSegments: 8 }));
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -height / 2, 0);
    return geo;
  }
  function sculptedKey() {
    // Cross-sections form the rounded lip, tapered side walls and soft shoulder.
    const rings = [[1.94,.04,.18],[2.0,.09,.21],[1.99,.16,.22],[1.79,.55,.23],[1.69,.65,.23],[1.60,.69,.22]];
    const vertices = [], indices = [], segments = 40;
    for (const [width, y, radius] of rings) {
      for (let corner = 0; corner < 4; corner++) {
        const angle = corner * Math.PI / 2;
        const cx = (corner === 0 || corner === 3 ? 1 : -1) * (width / 2 - radius);
        const cz = (corner < 2 ? 1 : -1) * (width / 2 - radius);
        for (let j = 0; j < 10; j++) {
          const a = angle + j / 9 * Math.PI / 2;
          vertices.push(cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius);
        }
      }
    }
    for (let ring = 0; ring < rings.length - 1; ring++) for (let j = 0; j < segments; j++) {
      const a = ring * segments + j, b = ring * segments + (j + 1) % segments, c = a + segments, d = b + segments;
      indices.push(a, c, b, b, c, d);
    }
    const last = vertices.length / 3;
    const edgeStart = (rings.length - 1) * segments * 3;
    vertices.push(...vertices.slice(edgeStart));
    const center = vertices.length / 3;
    vertices.push(0, .69, 0);
    for (let j = 0; j < segments; j++) indices.push(center, last + (j + 1) % segments, last + j);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices); geo.computeVertexNormals();
    return geometry(geo);
  }
  function mesh(geo, mat, parent, y = 0) {
    const item = new THREE.Mesh(geo, mat);
    item.position.y = y; item.castShadow = true; item.receiveShadow = true;
    parent.add(item); return item;
  }
  function canvasMap(draw, width = 768, height = 768) {
    const source = document.createElement('canvas'); source.width = width; source.height = height;
    draw(source.getContext('2d'), width, height);
    const map = texture(new THREE.CanvasTexture(source));
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    boardTextures.add(map); return map;
  }
  const titleLines = {
    lee:['청년','기본소득'], 'kim-dongyeon':['예술인','기회소득'], 'kim-kyungsoo':['부울경','메가시티'],
    park:['평등에 관한','법률안'], moon:['아동수당'], oh:['기후동행','카드'],
    hong:['어르신 통합','무임교통'], yoo:['육아휴직','3년'], na:['신혼부부','주거 지원'], han:['금융투자','소득세 폐지']
  };
  function engraving(policy, index) {
    return canvasMap((ctx, width) => {
      ctx.clearRect(0, 0, width, width);
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left';
      ctx.font = '500 37px PolicySans, sans-serif';
      ctx.fillText(String(index + 1).padStart(2, '0'), 74, 113);
      ctx.textAlign = 'right'; ctx.font = '500 30px PolicySans, sans-serif';
      if (!mobile) ctx.fillText(policy.year, 694, 111);
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.font = `600 ${mobile ? 150 : 116}px PolicySans, sans-serif`;
      const mobileLines = {park:['평등에','관한','법률안'], hong:['어르신','통합','무임교통'], han:['금융투자','소득세','폐지']};
      const lines = (mobile && mobileLines[policy.id]) || titleLines[policy.id] || [policy.policy];
      const firstLine = mobile ? (lines.length === 3 ? 285 : lines.length === 1 ? 400 : 340) : 350;
      lines.forEach((line, i) => ctx.fillText(line, 74, firstLine + i * (mobile ? 140 : 112), 620));
      ctx.fillStyle = '#bdbdbd'; ctx.font = '500 31px PolicySans, sans-serif';
      if (!mobile) ctx.fillText(policy.stage, 76, 635);
      ctx.fillStyle = '#bdbdbd'; ctx.fillRect(642, 621, 45, 5);
    });
  }
  function refreshDisplay() {
    if (!displayTexture) return;
    const ctx = displayTexture.image.getContext('2d');
    const p = policies.find(item => item.id === selected);
    ctx.fillStyle = '#111719'; ctx.fillRect(0, 0, 1280, 256);
    ctx.fillStyle = '#c2d2c4'; ctx.font = '500 24px PolicySans, sans-serif';
    ctx.fillText(mobile ? '정책 아카이브' : '모두의정책  /  정책 아카이브', 48, 63);
    ctx.fillStyle = '#f1ede1'; ctx.font = `600 ${mobile ? 64 : 46}px PolicySans, sans-serif`;
    ctx.fillText(mobile ? (p ? `${String(policies.indexOf(p) + 1).padStart(2,'0')} / 10` : '모두의정책') : (p ? p.policy : '10개의 정책, 하나씩 가까이.'), 48, 139);
    ctx.fillStyle = '#8c9c96'; ctx.font = '500 23px PolicySans, sans-serif';
    ctx.fillText(mobile ? '키를 눌러 살펴보세요' : (p ? `${p.year} · ${p.stage}` : '키를 눌러 내용과 출처를 살펴보세요'), 48, 205);
    ctx.fillStyle = selected ? '#e8c98a' : '#9fb5a3';
    for (let i = 0; i < 10; i++) ctx.fillRect(1160 + (i % 5) * 16, 169 + Math.floor(i / 5) * 19, 9, 10);
    displayTexture.needsUpdate = true;
  }
  function rebuildBoard() {
    const generation = ++boardVersion;
    host.dataset.model = 'pending';
    const sharedMaterials = new Set([graphite, silver, socket, bronze, screwMaterial, circuitMaterial]);
    board.traverse(object => {
      if (object.geometry) { object.geometry.dispose(); geometries.delete(object.geometry); }
      if (object.material && !sharedMaterials.has(object.material)) { object.material.dispose(); materials.delete(object.material); }
    });
    boardTextures.forEach(map => { map.dispose(); textures.delete(map); }); boardTextures.clear();
    board.clear(); tiles.length = 0; labels.replaceChildren();
    const columns = mobile ? 3 : 5, rows = Math.ceil(policies.length / columns);
    boardWidth = columns * 2.32 + .94;
    boardDepth = rows * 2.32 + (mobile ? 1.3 : 2.75);
    lowerPlate = mesh(roundedBox(boardWidth, boardDepth, .62, .48, .08), graphite, board, -.25);
    rimPlate = mesh(roundedBox(boardWidth - .05, boardDepth - .05, .035, .46, .025, [boardWidth - .8, boardDepth - .8]), silver, board, .13);
    upperPlate = mesh(roundedBox(boardWidth - .09, boardDepth - .09, .22, .45, .06), graphite, board, .31);
    // The PCB and switch mounts become visible in the exploded view.
    deck = new THREE.Group(); board.add(deck);
    mesh(roundedBox(boardWidth - .72, boardDepth - .72, .065, .22), circuitMaterial, deck, .35);
    const face = mesh(roundedBox(boardWidth - .19, boardDepth - .19, .07, .4, .025), graphite, upperPlate, .15);
    contactShadow.scale.set(boardWidth * 1.35, boardDepth * 1.35, 1);
    const socketGeometry = roundedBox(2.08, 2.08, .10, .24, .025, [1.6, 1.6]);
    const tileGeometry = sculptedKey();
    const ledGeometry = roundedBox(2.025, 2.025, .025, .24, .015, [1.70, 1.70]);
    const switchGeometry = roundedBox(.70, .70, .20, .10, .03);
    for (let i = 0; i < policies.length; i++) {
      const policy = policies[i], row = Math.floor(i / columns), col = i % columns;
      const x = (col - (columns - 1) / 2) * 2.32;
      const z = (row - (rows - 1) / 2) * 2.32 + (mobile ? 0 : .72);
      const well = mesh(socketGeometry, socket, upperPlate, .21); well.position.x = x; well.position.z = z;
      const ledMat = material({ color: '#9caeaa', metalness: .45, roughness: .28, emissive: '#91b19d', emissiveIntensity: .12 });
      const led = mesh(ledGeometry, ledMat, upperPlate, .285); led.position.x = x; led.position.z = z;
      const switchBody = mesh(switchGeometry, socket, deck, .68); switchBody.position.x = x; switchBody.position.z = z;
      const stem = mesh(roundedBox(.27, .27, .35, .03, .015), bronze, switchBody, .22);
      const node = new THREE.Group(); node.position.set(x, .60, z); board.add(node);
      const porcelain = material({ color: white.clone(), metalness: .03, roughness: .58, clearcoat: .04, clearcoatRoughness: .6, envMapIntensity: .22 });
      const body = mesh(tileGeometry, porcelain, node); body.userData.policyId = policy.id;
      const ink = new THREE.MeshBasicMaterial({ map: engraving(policy, i), color: '#e6e1d5', transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1 });
      materials.add(ink);
      const top = mesh(geometry(new THREE.PlaneGeometry(1.60, 1.60)), ink, node, .695);
      top.rotation.x = -Math.PI / 2; top.castShadow = false; top.userData.policyId = policy.id;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'scene-label'; button.dataset.scenePolicy = policy.id;
      button.setAttribute('aria-label', `${policy.policy} / ${policy.name} / ${policy.year} ${policy.stage} 선택`); button.setAttribute('aria-pressed', 'false');
      const index = document.createElement('span'); index.className = 'scene-label-index'; index.textContent = `${policy.year} · ${policy.stage}`;
      const name = document.createElement('span'); name.className = 'scene-label-title'; name.textContent = policy.policy; button.append(index, name);
      button.style.position = 'absolute'; button.style.transform = 'translate(-50%,-50%)';
      button.addEventListener('click', event => { if (event.detail === 0) api.select(policy.id); });
      button.addEventListener('pointerenter', () => setHover(policy.id)); button.addEventListener('pointerleave', () => setHover(null));
      button.addEventListener('focus', () => setHover(policy.id)); button.addEventListener('blur', () => setHover(null)); labels.append(button);
      tiles.push({ id: policy.id, node, body, top, porcelain, ledMat, button, x, z, index: i, pressedUntil: 0 });
    }
    // Recessed screws and horizontal cooling slots make the side wall legible.
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const recess = mesh(geometry(new THREE.CylinderGeometry(.14, .14, .018, 24)), socket, upperPlate, .213);
      recess.position.set(x * (boardWidth / 2 - .34), .213, z * (boardDepth / 2 - .34));
      const screw = mesh(geometry(new THREE.CylinderGeometry(.085, .085, .028, 24)), screwMaterial, recess, .016);
      mesh(geometry(new THREE.BoxGeometry(.11, .012, .025)), socket, screw, .016).rotation.y = Math.PI / 4;
    }
    for (let row = 0; row < 3; row++) {
      const rib = mesh(roundedBox(boardWidth - 1.0, .045, .045, .018, .008), socket, lowerPlate, -.20 + row * .13);
      rib.position.z = boardDepth / 2 + .06;
    }
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const foot = mesh(geometry(new THREE.CylinderGeometry(.31, .33, .18, 24)), socket, lowerPlate, -.43);
      foot.position.x = x * (boardWidth / 2 - .8); foot.position.z = z * (boardDepth / 2 - .8);
    }
    const displayWidth = mobile ? 2.55 : boardWidth - 3.45;
    const screenFrame = mesh(roundedBox(displayWidth, 1.31, .10, .12, .025), silver, upperPlate, .24);
    screenFrame.position.set(mobile ? .1 : -1.08, .24, mobile ? 3.48 : -boardDepth / 2 + 1.02);
    mesh(roundedBox(displayWidth - .06, 1.25, .055, .10, .02), socket, screenFrame, .065);
    displayTexture = canvasMap(() => {}, mobile ? 640 : 1280, 256);
    const screenMat = new THREE.MeshBasicMaterial({ map: displayTexture }); materials.add(screenMat);
    display = mesh(geometry(new THREE.PlaneGeometry(displayWidth - .23, 1.05)), screenMat, screenFrame, .132);
    display.rotation.x = -Math.PI / 2; display.castShadow = false;
    refreshDisplay();
    knob = new THREE.Group(); knob.position.set(boardWidth / 2 - 1.16, .22, mobile ? 3.48 : -boardDepth / 2 + 1.08); upperPlate.add(knob);
    mesh(geometry(new THREE.CylinderGeometry(.73, .75, .065, 64)), silver, knob, .02);
    const dial = mesh(geometry(new THREE.CylinderGeometry(.65, .69, .51, 64)), graphite, knob, .30);
    mesh(geometry(new THREE.CylinderGeometry(.62, .65, .055, 64)), graphite, knob, .57);
    for (let i = 0; i < 48; i++) {
      const angle = i / 48 * Math.PI * 2;
      const ridge = mesh(geometry(new THREE.BoxGeometry(.026, .39, .026)), screwMaterial, dial);
      ridge.position.set(Math.sin(angle) * .666, 0, Math.cos(angle) * .666);
      ridge.rotation.y = angle;
    }
    const mark = mesh(geometry(new THREE.BoxGeometry(.035, .008, .17)), bronze, knob, .602); mark.position.z = -.39;
    const currentKnob = knob;
    new GLTFLoader().load('./assets/console-knob.glb', gltf => {
      if (disposed || generation !== boardVersion) {
        gltf.scene.traverse(object => {object.geometry?.dispose(); if(object.material) object.material.dispose();});
        return;
      }
      currentKnob.traverse(object => {
        if (object.geometry) {object.geometry.dispose(); geometries.delete(object.geometry);}
      });
      currentKnob.clear();
      gltf.scene.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
        object.castShadow = true; object.receiveShadow = true;
      });
      currentKnob.add(gltf.scene);
      host.dataset.model = 'loaded'; requestFrame();
    }, undefined, () => {
      if (!disposed && generation === boardVersion) {host.dataset.model = 'fallback'; requestFrame();}
    });
    const badgeMap = canvasMap(ctx => {ctx.fillStyle='#b5b9b8';ctx.font='500 42px PolicySans, sans-serif';ctx.textAlign='center';ctx.fillText('모두의정책  ·  POLICY ARCHIVE',768,78);},1536,128);
    const badgeMat = material({ map: badgeMap, transparent: true, depthWrite: false });
    const badge = mesh(geometry(new THREE.PlaneGeometry(mobile ? 3.9 : 4.6, .39)), badgeMat, upperPlate, .206);
    badge.rotation.x = -Math.PI / 2; badge.position.z = boardDepth / 2 - .35; badge.castShadow = false;
  }

  function defaultPose() {
    const aspect = Math.max(.1, host.clientWidth / Math.max(1, host.clientHeight));
    const vertical = mobile ? Math.max(10.9, 9.5 / aspect) : Math.max(10.8, 15.4 / aspect);
    return {
      position: new THREE.Vector3(...(mobile ? [1.4, 25, 17] : [7.7, 13.8, 15.5])),
      target: new THREE.Vector3(0, expanded ? 1.1 : .1, 0),
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
      tile.node.getWorldPosition(projected);
      projected.y += .69;
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
    move(board.rotation, 'x', media.matches || mobile ? 0 : pointerLeanX);
    move(board.rotation, 'z', media.matches || mobile ? 0 : pointerLeanZ);
    move(lowerPlate.position, 'y', expanded ? -.55 : -.25);
    move(rimPlate.position, 'y', expanded ? .07 : .13);
    move(upperPlate.position, 'y', expanded ? 1.05 : .31);
    move(deck.position, 'y', expanded ? .35 : 0);
    if (knob) move(knob.rotation, 'y', evening ? .65 : 0);
    for (const tile of tiles) {
      const chosen = tile.id === selected, active = tile.id === hovered;
      const pressing = !media.matches && performance.now() < tile.pressedUntil;
      move(tile.node.position, 'x', tile.x * (expanded ? 1.03 : 1));
      move(tile.node.position, 'z', tile.z * (expanded ? 1.03 : 1));
      move(tile.node.position, 'y', .60 + (expanded ? 2.3 : 0) + (pressing ? -.18 : chosen ? -.09 : active ? .12 : 0));
      if (pressing) changing = true;
      const targetColor = chosen ? green : white;
      if (!tile.porcelain.color.equals(targetColor)) {
        tile.porcelain.color.lerp(targetColor, speed);
        if (Math.abs(tile.porcelain.color.r - targetColor.r) + Math.abs(tile.porcelain.color.g - targetColor.g) + Math.abs(tile.porcelain.color.b - targetColor.b) < .001) tile.porcelain.color.copy(targetColor);
        else changing = true;
      }
      tile.top.material.color.set(chosen ? '#283134' : '#e6e1d5');
      move(tile.ledMat, 'emissiveIntensity', chosen ? .85 : active ? .42 : .12);
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
    board.updateMatrixWorld(true);
    updateLabels();
    renderer.render(scene, camera);
    if (moving) requestFrame();
  }
  function hitTest(event) {
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...tiles.flatMap(tile => [tile.body, tile.top]), ...(knob ? [knob] : [])], true)[0]?.object;
    if (!hit) return null;
    if (hit.userData.policyId) return hit.userData.policyId;
    return '__lighting__';
  }
  let down = null;
  function pointerDown(event) { down = { x: event.clientX, y: event.clientY, id: event.pointerId, labelId: event.target.closest('[data-scene-policy]')?.dataset.scenePolicy }; }
  function pointerMove(event) {
    if (down?.id === event.pointerId && !down.dragged && Math.hypot(event.clientX - down.x, event.clientY - down.y) >= 7) down.dragged = true;
    if (event.pointerType === 'mouse' && !event.buttons) {
      setHover(hitTest(event));
      const bounds = host.getBoundingClientRect();
      pointerLeanX = ((event.clientY - bounds.top) / bounds.height - .5) * .035;
      pointerLeanZ = -((event.clientX - bounds.left) / bounds.width - .5) * .025;
      requestFrame();
    }
  }
  function pointerUp(event) {
    if (down?.id === event.pointerId && !down.dragged && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 7) {
      const id = down.labelId || hitTest(event);
      if (id === '__lighting__') api.setLighting(evening ? 'day' : 'evening');
      else if (id) api.select(id);
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
      tile.pressedUntil = performance.now() + 180;
      refreshDisplay();
      tiles.forEach(item => {
        item.button.classList.toggle('is-selected', item.id === id);
        item.button.setAttribute('aria-pressed', String(item.id === id));
      });
      const target = tile.node.position.clone();
      target.x *= .28;
      target.z *= .28;
      target.y = expanded ? 2.2 : .9;
      const offset = mobile ? camera.position.clone().sub(controls.target) : new THREE.Vector3(4.2, 18, 12.8);
      tweenCamera(target.clone().add(offset), target, mobile ? 1.12 : 1.16, emitSelection);
    },
    reset() {
      if (disposed) return;
      selected = null; pendingSelection = null;
      refreshDisplay();
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
        tweenCamera(pose.position, pose.target, expanded ? .88 : 1);
      }
      requestFrame();
    },
    setLighting(value) {
      if (disposed) return;
      evening = value === 'evening';
      host.dataset.lighting = evening ? 'evening' : 'day';
      document.dispatchEvent(new CustomEvent('policy-scene-lighting', {detail: {lighting: host.dataset.lighting}}));
      keyLight.color.set(evening ? '#ffc985' : '#fff2dc');
      keyLight.intensity = evening ? 2.4 : 2.8;
      fillLight.color.set(evening ? '#a8bfff' : '#d9e7ff');
      fillLight.intensity = evening ? 1.1 : .8;
      hemisphere.intensity = evening ? .4 : .7;
      renderer.toneMappingExposure = evening ? .86 : .92;
      ground.material.color.set('#000000');
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
  listen(host, 'pointerleave', () => { setHover(null); pointerLeanX = pointerLeanZ = 0; requestFrame(); });
  listen(canvas, 'webglcontextlost', unavailable);
  listen(document, 'visibilitychange', requestFrame);
  listen(media, 'change', () => { controls.enableDamping = !media.matches; requestFrame(); });
  const resize = new ResizeObserver(() => {
    if (disposed) return;
    if (mobile !== narrow.matches) {
      mobile = narrow.matches;
      cameraTween = null;
      selected = null; pendingSelection = null;
      rebuildBoard();
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
