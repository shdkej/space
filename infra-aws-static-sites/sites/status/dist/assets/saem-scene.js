/* saem-scene.js — 샘(Saem) 3D 모션 배경
   브랜드 정본(BRAND.md): 이끼가 자라는 조약돌 정령. 점 눈 2개, 과장 금지.
   상태 문법: ok = 따뜻한 아침빛 + 잔잔한 물결 / warn·bad = 가라앉은 빛 + 고요한 수면.
   실패 시 아무것도 만지지 않고 null을 반환한다 — CSS 샘 fallback이 그대로 남는다. */

import * as THREE from "./vendor/three.module.min.js";

const CREAM = 0xf0eee9;
const STONE = 0xcfc4b6;
const MOSS = 0x8a9a6b;
const SPROUT = 0x7d8f5d;
const EYE = 0x4a4238;
const WATER = 0xe9e5da;
const MORNING = 0xffe9cf;
const DUSK = 0xe3d5c2;

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

function buildSaem() {
  const saem = new THREE.Group();

  const stoneMaterial = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.94, metalness: 0 });
  const pebble = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 40), stoneMaterial);
  pebble.scale.set(1, 0.76, 0.9);
  saem.add(pebble);

  const mossMaterial = new THREE.MeshStandardMaterial({ color: MOSS, roughness: 1, metalness: 0 });
  const mossSpecs = [
    [0, 0.66, 0.05, 0.46],
    [-0.3, 0.58, 0.14, 0.3],
    [0.28, 0.6, -0.08, 0.26],
    [0.05, 0.56, -0.3, 0.22],
  ];
  mossSpecs.forEach(([x, y, z, r]) => {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 22), mossMaterial);
    patch.position.set(x, y, z);
    patch.scale.y = 0.55;
    saem.add(patch);
  });

  const sproutMaterial = new THREE.MeshStandardMaterial({ color: SPROUT, roughness: 0.9 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.24, 10), sproutMaterial);
  stem.position.set(-0.06, 0.92, 0.02);
  stem.rotation.z = 0.08;
  saem.add(stem);
  [-1, 1].forEach((side) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), sproutMaterial);
    leaf.position.set(-0.06 + side * 0.075, 1.02 + (side > 0 ? 0.02 : -0.01), 0.02);
    leaf.scale.set(1, 0.42, 0.55);
    leaf.rotation.z = side * 0.7;
    saem.add(leaf);
  });

  const eyeMaterial = new THREE.MeshStandardMaterial({ color: EYE, roughness: 0.55 });
  [-0.26, 0.26].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 12), eyeMaterial);
    eye.position.set(x, 0.22, 0.86);
    saem.add(eye);
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
  const fill = new THREE.AmbientLight(0xf4efe6, 1.35);
  scene.add(fill);
  const bounce = new THREE.HemisphereLight(0xfffaf1, 0xd9cfc0, 0.7);
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
      map: makeSoftCircleTexture("rgba(120, 104, 86, 0.34)", "rgba(120, 104, 86, 0)"),
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
  };
  window.__SAEM_SCENE__ = api;
  return api;
}
