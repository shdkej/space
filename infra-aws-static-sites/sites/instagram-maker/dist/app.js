const canvas = document.querySelector('#previewCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const els = {
  assetInput: document.querySelector('#assetInput'),
  headline: document.querySelector('#headline'),
  caption: document.querySelector('#caption'),
  fontSelect: document.querySelector('#fontSelect'),
  positionSelect: document.querySelector('#positionSelect'),
  exportPng: document.querySelector('#exportPng'),
  exportVideo: document.querySelector('#exportVideo'),
  assetStatus: document.querySelector('#assetStatus'),
  templateLabel: document.querySelector('#templateLabel'),
  emptyState: document.querySelector('#emptyState'),
};

const state = { template: 'photo', source: null, sourceType: 'sample', objectUrl: null, video: null, animationFrame: null };
const templates = {
  photo: { label: 'Photo Hook', overlay: 'none', titleColor: '#fffdf1', titleSize: 104, stroke: 8, subtitleColor: '#fffdf1' },
  shade: { label: 'Soft Shade', overlay: 'shade', titleColor: '#fff9d8', titleSize: 100, stroke: 3, subtitleColor: '#fff9d8' },
  editorial: { label: 'Editorial', overlay: 'editorial', titleColor: '#f7f4e9', titleSize: 86, stroke: 0, subtitleColor: '#d8ff59' },
};
const fonts = {
  a2z: { family: 'A2Z', style: 'italic', weight: 900 },
  chosun: { family: 'ChosunGu', style: 'normal', weight: 400 },
  nanum: { family: 'NanumSquareNeo', style: 'normal', weight: 400 },
};

function makeSample() {
  const sample = document.createElement('canvas');
  sample.width = W; sample.height = H;
  const c = sample.getContext('2d');
  const sky = c.createLinearGradient(0, 0, W, H);
  sky.addColorStop(0, '#e1b98c'); sky.addColorStop(.28, '#7c665e'); sky.addColorStop(.63, '#273943'); sky.addColorStop(1, '#101716');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,225,163,.42)'; c.beginPath(); c.arc(770, 460, 240, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(18,26,28,.88)';
  c.beginPath(); c.moveTo(0, 1120); c.lineTo(230, 820); c.lineTo(385, 1040); c.lineTo(560, 710); c.lineTo(880, 1100); c.lineTo(1080, 870); c.lineTo(1080, H); c.lineTo(0, H); c.closePath(); c.fill();
  c.fillStyle = 'rgba(246,210,153,.26)'; c.fillRect(0, 1230, W, 90);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '700 20px ui-sans-serif'; c.fillText('DROP YOUR PHOTO HERE', 54, H - 70);
  return sample;
}

function getSource() { return state.source || makeSample(); }
function resetPosition() { els.positionSelect.value = 'center'; render(); }
function fitCover(source) {
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;
  const scale = Math.max(W / sw, H / sh);
  const dw = sw * scale, dh = sh * scale;
  ctx.drawImage(source, (W - dw) / 2, (H - dh) / 2, dw, dh);
}
function splitLines(text, maxLines = 3) {
  return text.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, maxLines);
}
function drawOverlay(template) {
  if (template.overlay === 'shade') {
    const g = ctx.createLinearGradient(0, H * .42, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.55, 'rgba(0,0,0,.18)'); g.addColorStop(1, 'rgba(0,0,0,.78)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (template.overlay === 'editorial') {
    ctx.fillStyle = 'rgba(7,10,9,.66)'; ctx.fillRect(58, 78, W - 116, H - 156);
    ctx.fillStyle = '#d8ff59'; ctx.fillRect(86, 118, 7, 120);
  }
}
function drawText(text, x, y, options) {
  const lines = splitLines(text, options.maxLines || 3);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${options.style || 'normal'} ${options.weight || 400} ${options.size}px ${options.family}`;
  ctx.letterSpacing = options.letterSpacing || '0px';
  if (options.stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.88)'; ctx.lineWidth = options.stroke * 2; }
  const lineHeight = options.size * (options.lineHeight || 1.05);
  const start = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    const ly = start + i * lineHeight;
    if (options.stroke) ctx.strokeText(line, x, ly);
    ctx.fillStyle = options.color; ctx.fillText(line, x, ly);
  });
  ctx.restore();
}
function drawCaption(text, y, template) {
  const lines = splitLines(text, 2); if (!lines.length) return;
  const f = fonts[els.fontSelect.value];
  drawText(lines.join('\n'), W / 2, y, { ...f, size: template === templates.editorial ? 30 : 32, color: template.subtitleColor, stroke: template === templates.photo ? 3 : 0, maxLines: 2, lineHeight: 1.35 });
}
function render() {
  const template = templates[state.template];
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#090a09'; ctx.fillRect(0, 0, W, H);
  fitCover(getSource());
  drawOverlay(template);
  const pos = els.positionSelect.value;
  const titleY = pos === 'top' ? H * .21 : pos === 'bottom' ? H * .73 : H * .5;
  const captionY = pos === 'top' ? H * .38 : pos === 'bottom' ? H * .89 : H * .7;
  const f = fonts[els.fontSelect.value];
  const size = state.template === 'editorial' ? 86 : template.titleSize;
  drawText(els.headline.value, W / 2, titleY, { ...f, size, color: template.titleColor, stroke: template.stroke, maxLines: 3, lineHeight: 1.03 });
  drawCaption(els.caption.value, captionY, template);
  els.templateLabel.textContent = template.label;
}
function startVideoLoop() {
  cancelAnimationFrame(state.animationFrame);
  const loop = () => { render(); state.animationFrame = requestAnimationFrame(loop); };
  loop();
}
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function exportPng() { render(); canvas.toBlob((blob) => downloadBlob(blob, 'frame-instagram.png'), 'image/png'); }
async function exportVideo() {
  if (!('MediaRecorder' in window) || !canvas.captureStream) { alert('이 브라우저는 WebM 영상 내보내기를 지원하지 않습니다. 최신 Chrome 또는 Edge를 사용해 주세요.'); return; }
  els.exportVideo.disabled = true; els.exportVideo.textContent = '렌더링 중…';
  const stream = canvas.captureStream(30);
  const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) { alert('이 브라우저에서 WebM 코덱을 찾을 수 없습니다.'); els.exportVideo.disabled = false; els.exportVideo.innerHTML = 'WebM 영상 <span>↗</span>'; return; }
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = []; recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.start();
  const started = performance.now();
  await new Promise((resolve) => {
    const tick = (now) => { render(); if (now - started < 5000) requestAnimationFrame(tick); else resolve(); };
    requestAnimationFrame(tick);
  });
  recorder.stop();
  await new Promise((resolve) => { recorder.onstop = resolve; });
  downloadBlob(new Blob(chunks, { type: 'video/webm' }), 'frame-instagram.webm');
  els.exportVideo.disabled = false; els.exportVideo.innerHTML = 'WebM 영상 <span>↗</span>';
}
function loadAsset(file) {
  if (!file) return;
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(file); state.sourceType = file.type.startsWith('video/') ? 'video' : 'image';
  if (state.sourceType === 'video') {
    const video = document.createElement('video'); video.src = state.objectUrl; video.muted = true; video.loop = true; video.playsInline = true;
    video.addEventListener('loadeddata', () => { state.video = video; state.source = video; video.play(); startVideoLoop(); });
  } else {
    const image = new Image(); image.onload = () => { state.video = null; state.source = image; cancelAnimationFrame(state.animationFrame); render(); }; image.src = state.objectUrl;
  }
  els.assetStatus.textContent = `${file.name} · 로컬 소스`;
}

document.querySelectorAll('.template-card').forEach((button) => button.addEventListener('click', () => {
  state.template = button.dataset.template;
  document.querySelectorAll('.template-card').forEach((b) => { const active = b === button; b.classList.toggle('is-selected', active); b.setAttribute('aria-checked', String(active)); });
  render();
}));
els.assetInput.addEventListener('change', (e) => loadAsset(e.target.files[0]));
[els.headline, els.caption, els.fontSelect, els.positionSelect].forEach((el) => el.addEventListener('input', render));
els.exportPng.addEventListener('click', exportPng); els.exportVideo.addEventListener('click', exportVideo);
document.addEventListener('keydown', (e) => { if (e.key === '1' || e.key === '2' || e.key === '3') document.querySelector(`[data-template="${['photo','shade','editorial'][Number(e.key) - 1]}"]`)?.click(); if (e.key.toLowerCase() === 'r') resetPosition(); });
window.addEventListener('beforeunload', () => state.objectUrl && URL.revokeObjectURL(state.objectUrl));
render();
