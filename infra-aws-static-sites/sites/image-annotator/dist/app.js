const CACHE_KEY = "image-annotator:gallery:v2";
const KEEP_KEY = "image-annotator:kept:v1";
const state = { images: [], annotations: new Map(), topics: new Map(), kept: new Set(), selected: null, query: "", view: "gallery", keptOnly: false };
const gallery = document.querySelector("#gallery");
const mapView = document.querySelector("#map-view");
const status = document.querySelector("#status");
const search = document.querySelector("#search");
const noteDialog = document.querySelector("#note-dialog");
const noteForm = document.querySelector("#note-form");
const noteInput = document.querySelector("#note-input");
const noteTitle = document.querySelector("#note-title");
const noteImage = document.querySelector("#note-image");
const noteSaveMessage = document.querySelector("#note-save-message");
const toast = document.querySelector("#toast");
let toastTimer;

document.querySelector("#refresh").addEventListener("click", load);
search.addEventListener("input", (event) => { state.query = event.target.value.trim().toLowerCase(); if (state.view === "map") renderMap(); else renderGallery(); });
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
document.querySelector("#dialog-close").addEventListener("click", () => noteDialog.close());
noteDialog.addEventListener("click", (event) => { if (event.target === noteDialog) noteDialog.close(); });
noteForm.addEventListener("submit", (event) => { event.preventDefault(); saveNote(); });
window.addEventListener("pageshow", (event) => { if (event.persisted) load(); });
load();

async function load() {
  state.kept = readKept();
  const cached = readCache();
  if (cached?.images?.length) {
    state.images = sortImages(cached.images);
    state.annotations = new Map(cached.annotations || []);
    state.topics = new Map(cached.topics || []);
    status.textContent = `${state.images.length}장의 이미지 · 캐시에서 먼저 표시했어요`;
    renderGallery();
  } else {
    status.textContent = "이미지를 불러오는 중";
  }

  try {
    const payload = await getJSON("/api/images?limit=100", { cache: "no-store" });
    state.images = sortImages(payload.images || []);
    if (state.images.length) {
      const keys = state.images.map((image) => encodeURIComponent(image.key)).join(",");
      const notePayload = await getJSON(`/api/annotations?keys=${keys}`, { cache: "no-store" });
      state.annotations = new Map((notePayload.annotations || []).map((item) => [item.image_key, item]));
      try {
        const topicPayload = await getJSON(`/api/topics?keys=${keys}`, { cache: "no-store" });
        state.topics = new Map((topicPayload.topics || []).map((item) => [item.image_key, item]));
      } catch (topicError) {
        state.topics = new Map();
        console.warn("image_topics_unavailable", topicError);
      }
    } else {
      state.annotations = new Map();
      state.topics = new Map();
    }
    writeCache();
    status.textContent = `${state.images.length}장의 이미지 · 최신 상태`;
    renderGallery();
  } catch (error) {
    if (!cached?.images?.length) {
      status.textContent = "불러오지 못했어요";
      gallery.innerHTML = `<p class="empty">이미지를 가져오지 못했어요. 잠시 후 다시 시도해보세요.</p>`;
    } else {
      status.textContent = `${state.images.length}장의 이미지 · 캐시 상태`;
    }
    console.error(error);
  }
}

function renderGallery() {
  const images = state.images.filter((image) => {
    const note = state.annotations.get(image.key)?.note || "";
    return !state.query || `${image.key} ${note}`.toLowerCase().includes(state.query);
  });
  if (!images.length) { gallery.innerHTML = `<p class="empty">조건에 맞는 이미지가 없어요.</p>`; return; }
  const groups = new Map();
  images.forEach((image) => {
    const month = formatMonth(image.uploaded);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(image);
  });
  gallery.innerHTML = [...groups.entries()].map(([month, monthImages]) => `<section class="month-group" aria-labelledby="month-${month.replace(/[^0-9]/g, "")}"><h2 class="month-heading" id="month-${month.replace(/[^0-9]/g, "")}">${month}</h2><div class="month-items">${monthImages.map(renderCard).join("")}</div></section>`).join("");
  bindImageInteractions(gallery);
  updateSelectedUI(gallery);
  if (state.view === "map") renderMap();
}

function renderCard(image) {
    const note = state.annotations.get(image.key)?.note || "";
    const topic = state.topics.get(image.key);
    const selected = state.selected?.key === image.key ? " selected" : "";
    const noteMarkup = note.trim() ? `<div class="image-meta"><div class="annotation-preview">${escapeHTML(note)}</div></div>` : "";
    const subjectTags = topic?.subject_tags || topic?.tags || [];
    const judgmentTags = topic?.judgment_tags || [];
    const topicMarkup = topic ? `<div class="image-topics"><span>주제 · ${escapeHTML(topic.topic)}</span>${subjectTags.length ? `<span>내용 · ${subjectTags.map(escapeHTML).join(" · ")}</span>` : ""}${judgmentTags.length ? `<span>판단 · ${judgmentTags.map(escapeHTML).join(" · ")}</span>` : ""}</div>` : "";
    return `<article class="image-object${selected}" data-key="${escapeHTML(image.key)}" tabindex="0" role="button" aria-label="${escapeHTML(image.key)} 이미지 · 한 번 눌러 링크 복사, 두 번 눌러 주석 편집">
      <div class="image-frame"><img src="${escapeHTML(image.url)}" alt="${escapeHTML(image.key)}" loading="lazy" />
        <div class="image-overlay"><time class="image-date" datetime="${escapeHTML(image.uploaded || "")}">${formatDate(image.uploaded)}</time></div>
      </div>
      ${topicMarkup}
      ${noteMarkup}
    </article>`;
}

function bindImageInteractions(root) {
  root.querySelectorAll(".image-object").forEach((node) => {
    const image = state.images.find((item) => item.key === node.dataset.key);
    let clickTimer;
    node.addEventListener("click", () => {
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => selectImage(image), 220);
    });
    node.addEventListener("dblclick", (event) => { event.preventDefault(); clearTimeout(clickTimer); openEditor(image); });
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); openEditor(image); }
      if (event.key === " ") { event.preventDefault(); selectImage(image); }
    });
  });
}

function renderMap() {
  const images = filteredImages();
  if (!images.length) { mapView.innerHTML = `<p class="empty">조건에 맞는 이미지가 없어요.</p>`; return; }
  const groups = new Map();
  images.forEach((image) => {
    const topic = state.topics.get(image.key)?.topic || "분류 대기";
    if (!groups.has(topic)) groups.set(topic, []);
    groups.get(topic).push(image);
  });
  const clusters = [...groups.entries()].map(([topic, topicImages], clusterIndex) => {
    const left = 7 + (clusterIndex % 3) * 31;
    const top = 7 + Math.floor(clusterIndex / 3) * 43;
    const firstTopic = topicImages[0] ? state.topics.get(topicImages[0].key) : null;
    const subjectTags = (firstTopic?.subject_tags || firstTopic?.tags || []).slice(0, 3);
    const judgmentTags = (firstTopic?.judgment_tags || []).slice(0, 3);
    return `<section class="map-cluster" style="--cluster-left:${left}%;--cluster-top:${top}" aria-labelledby="map-${clusterIndex}">
      <div class="cluster-heading"><span class="cluster-dot"></span><div><h2 id="map-${clusterIndex}">${escapeHTML(topic)}</h2>${subjectTags.length ? `<p>내용 · ${subjectTags.map(escapeHTML).join(" · ")}</p>` : ""}${judgmentTags.length ? `<p>판단 · ${judgmentTags.map(escapeHTML).join(" · ")}</p>` : ""}</div><span>${topicImages.length}장</span></div>
      <div class="cluster-items">${topicImages.map(renderMapNode).join("")}</div>
    </section>`;
  }).join("");
  mapView.innerHTML = `<div class="map-toolbar"><div><p class="map-kicker">IMAGE MAP</p><h2>사진 사이의 방향을 한눈에 보세요.</h2><p class="map-description">이미지 내용을 읽어 만든 주제별 클러스터입니다. 아직 분석하지 않은 사진은 분류 대기 영역에 모입니다.</p></div><button class="quiet-button kept-filter${state.keptOnly ? " is-on" : ""}" id="kept-filter" type="button" aria-pressed="${state.keptOnly}">${state.keptOnly ? "전체 보기" : `남긴 사진 ${state.kept.size}장`}</button></div><div class="map-surface"><div class="map-route" aria-hidden="true"></div>${clusters}</div>`;
  mapView.querySelector("#kept-filter").addEventListener("click", () => { state.keptOnly = !state.keptOnly; renderMap(); });
  bindImageInteractions(mapView);
  mapView.querySelectorAll(".keep-toggle").forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault(); event.stopPropagation();
    toggleKept(button.dataset.key);
  }));
  updateSelectedUI(mapView);
}

function renderMapNode(image) {
  const tilt = ((hashKey(image.key) % 7) - 3) * 0.8;
  const kept = state.kept.has(image.key);
  return `<article class="image-object map-node${state.selected?.key === image.key ? " selected" : ""}" style="--tilt:${tilt}deg" data-key="${escapeHTML(image.key)}" tabindex="0" role="button" aria-label="${escapeHTML(image.key)} 이미지 · 한 번 눌러 링크 복사, 두 번 눌러 주석 편집">
    <div class="image-frame"><img src="${escapeHTML(image.url)}" alt="${escapeHTML(image.key)}" loading="lazy" /><button class="keep-toggle${kept ? " is-kept" : ""}" type="button" data-key="${escapeHTML(image.key)}" aria-label="${kept ? "남기기 해제" : "사진 남기기"}" aria-pressed="${kept}">${kept ? "남김" : "남기기"}</button></div>
    ${state.annotations.get(image.key)?.note?.trim() ? `<div class="map-note">${escapeHTML(state.annotations.get(image.key).note)}</div>` : ""}
  </article>`;
}

function filteredImages() {
  return state.images.filter((image) => {
    const note = state.annotations.get(image.key)?.note || "";
    const topic = state.topics.get(image.key)?.topic || "분류 대기";
    const classification = state.topics.get(image.key);
    const tags = [...(classification?.subject_tags || classification?.tags || []), ...(classification?.judgment_tags || [])].join(" ");
    const matchesQuery = !state.query || `${image.key} ${note} ${topic} ${tags}`.toLowerCase().includes(state.query);
    return matchesQuery && (!state.keptOnly || state.kept.has(image.key));
  });
}

function setView(view) {
  state.view = view === "map" ? "map" : "gallery";
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  gallery.hidden = state.view !== "gallery";
  mapView.hidden = state.view !== "map";
  if (state.view === "map") renderMap();
}

function selectImage(image) {
  if (!image) return;
  const x = window.scrollX;
  const y = window.scrollY;
  state.selected = image;
  updateSelectedUI(document);
  requestAnimationFrame(() => window.scrollTo({ left: x, top: y, behavior: "auto" }));
  copyImageLink(image);
}

function openEditor(image) {
  if (!image) return;
  state.selected = image;
  updateSelectedUI(document);
  const note = state.annotations.get(image.key)?.note || "";
  noteTitle.textContent = "주석 수정";
  noteImage.src = image.url;
  noteImage.alt = image.key;
  noteInput.value = note;
  noteSaveMessage.textContent = "";
  if (!noteDialog.open) noteDialog.showModal();
  requestAnimationFrame(() => noteInput.focus({ preventScroll: true }));
}

async function copyImageLink(image) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(image.url);
    } else {
      const helper = document.createElement("textarea");
      helper.value = image.url;
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.select();
      if (!document.execCommand("copy")) throw new Error("Clipboard copy was rejected");
      helper.remove();
    }
    showToast("이미지 링크를 복사했어요.");
  } catch (error) {
    showToast("링크를 복사하지 못했어요. 브라우저 권한을 확인해보세요.", true);
    console.error(error);
  }
}

function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

async function saveNote() {
  const image = state.selected;
  if (!image) return;
  const button = noteForm.querySelector("button[type=submit]");
  const note = noteInput.value;
  button.disabled = true; noteSaveMessage.textContent = "저장하는 중";
  try {
    const payload = await getJSON("/api/annotations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_key: image.key, note }) });
    state.annotations.set(image.key, payload.annotation);
    writeCache();
    noteSaveMessage.textContent = "저장했어요";
    renderGalleryPreservingScroll();
    noteDialog.close();
  } catch (error) { noteSaveMessage.textContent = "저장하지 못했어요"; console.error(error); }
  finally { button.disabled = false; }
}

function sortImages(images) { return [...images].sort((a, b) => dateValue(b.uploaded) - dateValue(a.uploaded)); }
function dateValue(value) { const time = Date.parse(value || ""); return Number.isFinite(time) ? time : 0; }
function formatMonth(value) { return value ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(new Date(value)) : "날짜 없음"; }
function formatDate(value) { return value ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)).replaceAll(". ", ".").replace(/\.$/, "") : ""; }
function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; } }
function writeCache() { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ images: state.images, annotations: [...state.annotations.entries()], topics: [...state.topics.entries()], savedAt: Date.now() })); } catch { /* private browsing or quota limits */ } }
function readKept() { try { return new Set(JSON.parse(localStorage.getItem(KEEP_KEY) || "[]")); } catch { return new Set(); } }
function writeKept() { try { localStorage.setItem(KEEP_KEY, JSON.stringify([...state.kept])); } catch { /* private browsing or quota limits */ } }
function toggleKept(key) { if (state.kept.has(key)) state.kept.delete(key); else state.kept.add(key); writeKept(); renderMap(); }
function renderGalleryPreservingScroll() { const x = window.scrollX; const y = window.scrollY; renderGallery(); requestAnimationFrame(() => window.scrollTo({ left: x, top: y, behavior: "auto" })); }
function updateSelectedUI(root) { root.querySelectorAll?.(".image-object").forEach((node) => node.classList.toggle("selected", node.dataset.key === state.selected?.key)); }
function hashKey(value) { return [...String(value)].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0) >>> 0; }
async function getJSON(url, options) { const response = await fetch(url, options); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`); return payload; }
function escapeHTML(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char])); }
