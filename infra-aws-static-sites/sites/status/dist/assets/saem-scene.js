/* saem-scene.js — 샘(Saem) 3D 모션 배경
   브랜드 정본(BRAND.md): 이끼가 자라는 조약돌 정령. 점 눈 2개, 과장 금지.
   상태 문법: ok = 따뜻한 아침빛 + 잔잔한 물결 / warn·bad = 가라앉은 빛 + 고요한 수면.
   실패 시 아무것도 만지지 않고 null을 반환한다 — CSS 샘 fallback이 그대로 남는다. */

import * as THREE from "./vendor/three.module.min.js";

/* 정본: prompt-archive/assets/saem-character/reference/saem-canonical-*.png */
const CREAM = 0xf5f4f1;
const STONE = 0xd9d2c6;
const MOSS = 0x87975f;
const SPROUT = 0x7fa054;
const EYE = 0x3d3a33;
const WATER = 0xf1efea;
const MORNING = 0xfff8ee;
const DUSK = 0xeae6dd;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function makeSoftCircleTexture(inner, outer) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSpeckleTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#d9d2c6";
  ctx.fillRect(0, 0, size, size);
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 900; i += 1) {
    const shade = random();
    ctx.fillStyle = shade > 0.5 ? "rgba(168, 156, 138, 0.35)" : "rgba(243, 240, 233, 0.5)";
    const r = 0.5 + random() * 1.6;
    ctx.beginPath();
    ctx.arc(random() * size, random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

function buildSaem() {
  const saem = new THREE.Group();

  const stoneMaterial = new THREE.MeshStandardMaterial({
    map: makeSpeckleTexture(),
    roughness: 0.96,
    metalness: 0,
  });
  const pebble = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 40), stoneMaterial);
  pebble.scale.set(1, 0.82, 0.92);
  saem.add(pebble);

  /* 이끼: 정본처럼 우상단에 유기적으로 흘러내리는 패치 */
  const mossGroup = new THREE.Group();
  let seed = 21;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const mossColors = [0x87975f, 0x93a26b, 0x7c8c55];
  for (let i = 0; i < 22; i += 1) {
    const theta = 0.3 + random() * 0.58; /* 위도: 정수리 부근 */
    const phi = 0.08 + random() * 1.1; /* 경도: 우측~우상단 */
    const clump = new THREE.Mesh(
      new THREE.SphereGeometry(0.07 + random() * 0.09, 16, 12),
      new THREE.MeshStandardMaterial({ color: mossColors[i % 3], roughness: 1, metalness: 0 })
    );
    clump.position.setFromSphericalCoords(0.94, theta, phi);
    clump.position.y *= 0.82;
    clump.position.z *= 0.92;
    clump.scale.set(1.15, 0.42 + random() * 0.18, 1.15);
    clump.rotation.set(random() * 0.7, random() * 2, random() * 0.7);
    mossGroup.add(clump);
  }
  saem.add(mossGroup);

  /* 새싹: 이끼 패치에서 자란다 */
  const sproutMaterial = new THREE.MeshStandardMaterial({ color: SPROUT, roughness: 0.85 });
  const sprout = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.02, 0.2, 10), sproutMaterial);
  stem.position.y = 0.1;
  sprout.add(stem);
  [-1, 1].forEach((side) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), sproutMaterial);
    leaf.position.set(side * 0.065, 0.2 + (side > 0 ? 0.015 : -0.005), 0);
    leaf.scale.set(1, 0.38, 0.5);
    leaf.rotation.z = side * 0.75;
    sprout.add(leaf);
  });
  sprout.position.set(0.34, 0.86, 0.12);
  sprout.rotation.z = -0.18;
  saem.add(sprout);

  /* 점 눈: 작고 담담하게, 가운데 가깝게 */
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: EYE, roughness: 0.5 });
  saem.userData.eyes = [-0.18, 0.18].map((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 12), eyeMaterial);
    eye.position.set(x, 0.24, 0.85);
    saem.add(eye);
    return eye;
  });

  return saem;
}

export function initSaemScene({ canvas, mood = "ok" } = {}) {
  if (!canvas || !window.WebGLRenderingContext) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "low-power" });
  } catch (_error) {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CREAM);
  scene.fog = new THREE.Fog(CREAM, 6, 16);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  camera.position.set(0, 1.5, 5.4);

  const stage = new THREE.Group();
  scene.add(stage);

  const sun = new THREE.DirectionalLight(MORNING, 2.4);
  sun.position.set(-3.4, 4.6, 2.6);
  scene.add(sun);
  const fill = new THREE.AmbientLight(0xf7f5f1, 1.4);
  scene.add(fill);
  const bounce = new THREE.HemisphereLight(0xfdfcf9, 0xe2ddd3, 0.7);
  scene.add(bounce);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(24, 64),
    new THREE.MeshStandardMaterial({ color: WATER, roughness: 0.35, metalness: 0.05 })
  );
  water.rotation.x = -Math.PI / 2;
  stage.add(water);

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.1, 2.6),
    new THREE.MeshBasicMaterial({
      map: makeSoftCircleTexture("rgba(128, 118, 102, 0.26)", "rgba(128, 118, 102, 0)"),
      transparent: true,
      depthWrite: false,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.012;
  stage.add(contactShadow);

  const saem = buildSaem();
  saem.position.y = 0.62;
  stage.add(saem);

  const rippleMaterialBase = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const pokeRipple = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 72), rippleMaterialBase.clone());
  pokeRipple.rotation.x = -Math.PI / 2;
  pokeRipple.position.y = 0.025;
  stage.add(pokeRipple);

  const ripples = Array.from({ length: 4 }, (_, index) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 72), rippleMaterialBase.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.userData.phase = index / 4;
    stage.add(ring);
    return ring;
  });

  const moteTexture = makeSoftCircleTexture("rgba(255, 250, 240, 0.95)", "rgba(255, 250, 240, 0)");
  const moteCount = 26;
  const motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i += 1) {
    motePositions[i * 3] = (Math.random() - 0.5) * 8;
    motePositions[i * 3 + 1] = 0.3 + Math.random() * 3.4;
    motePositions[i * 3 + 2] = -1.5 + Math.random() * 3.4;
  }
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(
    moteGeometry,
    new THREE.PointsMaterial({
      map: moteTexture,
      size: 0.09,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      sizeAttenuation: true,
    })
  );
  stage.add(motes);

  const state = {
    mood: "ok",
    lightTarget: 2.4,
    rippleSpeed: 1,
    pointerX: 0,
    pointerY: 0,
    smoothX: 0,
    smoothY: 0,
    running: true,
    scale: 0.62,
    baseY: 0.62 * 0.62,
    poke: 0,
    pokeWave: 1,
    scrollVel: 0,
    lastTouchY: null,
  };

  function setMood(next) {
    const calmDown = next !== "ok";
    state.mood = next;
    state.lightTarget = calmDown ? 1.1 : 2.4;
    state.rippleSpeed = calmDown ? 0 : 1;
    sun.color.set(calmDown ? DUSK : MORNING);
  }
  setMood(mood);

  function layout() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (width >= 1120) {
      state.scale = 0.66;
      stage.position.set(1.7, 0, 0);
      camera.position.z = 5.2;
    } else if (width >= 740) {
      state.scale = 0.6;
      stage.position.set(1.25, 0, 0);
      camera.position.z = 5.6;
    } else {
      state.scale = 0.5;
      stage.position.set(0, 0.62, 0);
      camera.position.z = 7.2;
    }
    state.baseY = 0.62 * state.scale;
    saem.scale.setScalar(state.scale);
    contactShadow.scale.setScalar(state.scale);
  }
  layout();
  window.addEventListener("resize", layout);

  function onPointer(event) {
    const x = (event.touches ? event.touches[0]?.clientX : event.clientX) ?? 0;
    const y = (event.touches ? event.touches[0]?.clientY : event.clientY) ?? 0;
    state.pointerX = (x / window.innerWidth) * 2 - 1;
    state.pointerY = (y / window.innerHeight) * 2 - 1;
  }
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("touchmove", onPointer, { passive: true });

  /* 스크롤 반응: 휠/터치 스크롤 속도만큼 샘이 갸웃하고 물결이 잠깐 빨라진다 */
  const pushScroll = (delta) => {
    if (reduceMotion.matches) return;
    state.scrollVel = Math.max(-1, Math.min(1, state.scrollVel + delta));
  };
  window.addEventListener("wheel", (event) => pushScroll(event.deltaY * 0.0035), { passive: true });
  window.addEventListener(
    "touchstart",
    (event) => {
      state.lastTouchY = event.touches[0]?.clientY ?? null;
    },
    { passive: true }
  );
  window.addEventListener(
    "touchmove",
    (event) => {
      const y = event.touches[0]?.clientY;
      if (y == null || state.lastTouchY == null) return;
      pushScroll((state.lastTouchY - y) * 0.008);
      state.lastTouchY = y;
    },
    { passive: true }
  );

  /* 샘 만지기: 캔버스는 pointer-events:none이므로 문서 레벨에서 히트 판정 */
  function poke() {
    if (reduceMotion.matches) return;
    state.poke = 1;
    state.pokeWave = 0;
  }

  const projected = new THREE.Vector3();
  function onTap(event) {
    if (event.target.closest("button, a, .floating-nav, .detail-scroll")) return;
    saem.getWorldPosition(projected);
    projected.y += 0.2 * state.scale;
    projected.project(camera);
    const sx = ((projected.x + 1) / 2) * window.innerWidth;
    const sy = ((1 - projected.y) / 2) * window.innerHeight;
    const reach = Math.min(window.innerWidth, window.innerHeight) * 0.22;
    if (Math.hypot(event.clientX - sx, event.clientY - sy) < reach) poke();
  }
  document.addEventListener("pointerdown", onTap, { passive: true });

  canvas.addEventListener("webglcontextlost", () => {
    state.running = false;
    delete document.body.dataset.scene;
  });

  const clock = new THREE.Clock();
  let elapsed = 0;

  function frame() {
    if (!state.running) return;
    const delta = Math.min(clock.getDelta(), 0.05);
    if (!reduceMotion.matches) elapsed += delta;

    sun.intensity += (state.lightTarget - sun.intensity) * 0.04;

    saem.position.y = state.baseY + Math.sin(elapsed * 0.9) * 0.014 * state.scale;
    saem.rotation.y = Math.sin(elapsed * 0.22) * 0.05;

    /* 스크롤 갸웃: 속도에 비례해 앞뒤 기울고 스프링처럼 복귀 */
    state.scrollVel *= Math.max(0, 1 - delta * 3.2);
    if (Math.abs(state.scrollVel) < 0.001) state.scrollVel = 0;
    saem.rotation.x = state.scrollVel * 0.3;
    saem.rotation.z = state.scrollVel * -0.12;

    /* poke: 스쿼시&스트레치 움찔 + 눈 깜빡 + 물결 한 번 */
    if (state.poke > 0) {
      const wobble = Math.sin(state.poke * Math.PI * 3) * state.poke * 0.1;
      saem.scale.set(state.scale * (1 + wobble), state.scale * (1 - wobble * 1.5), state.scale * (1 + wobble));
      const blink = state.poke > 0.55 ? 0.15 : 1;
      saem.userData.eyes.forEach((eye) => eye.scale.setY(blink));
      state.poke = Math.max(0, state.poke - delta * 1.6);
      if (state.poke === 0) {
        saem.scale.setScalar(state.scale);
        saem.userData.eyes.forEach((eye) => eye.scale.setY(1));
      }
    }
    if (state.pokeWave < 1) {
      state.pokeWave = Math.min(1, state.pokeWave + delta * 0.9);
      pokeRipple.scale.setScalar(state.scale * (1.05 + state.pokeWave * 3.2));
      pokeRipple.material.opacity = 0.5 * (1 - state.pokeWave);
    } else {
      pokeRipple.material.opacity = 0;
    }

    ripples.forEach((ring) => {
      if (state.rippleSpeed === 0) {
        ring.material.opacity += (0 - ring.material.opacity) * 0.06;
        return;
      }
      const t = (elapsed * 0.14 * state.rippleSpeed + ring.userData.phase) % 1;
      const radius = state.scale * (1.05 + t * 3.4);
      ring.scale.setScalar(radius);
      ring.material.opacity = 0.34 * (1 - t);
    });

    motes.rotation.y = elapsed * 0.02;
    motes.position.y = Math.sin(elapsed * 0.4) * 0.08;

    if (!reduceMotion.matches) {
      state.smoothX += (state.pointerX - state.smoothX) * 0.05;
      state.smoothY += (state.pointerY - state.smoothY) * 0.05;
    }
    const driftX = Math.sin(elapsed * 0.1) * 0.24;
    const driftY = Math.cos(elapsed * 0.08) * 0.1;
    camera.position.x = driftX + state.smoothX * 0.5;
    camera.position.y = 1.5 + driftY + state.smoothY * -0.24;
    camera.lookAt(0, 0.78, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.body.dataset.scene = "webgl";
  const api = {
    ready: true,
    setMood,
    poke,
  };
  window.__SAEM_SCENE__ = api;
  return api;
}
