const state = {
  filter: "all",
  view: "list",
  query: "",
  cache: new Map(),
  currentPlayer: null,
  suggestionsTimer: null,
  searchTimer: null
};

const APPLABEL = { ae: "AE", pr: "PR", cc: "CC" };
const APPPIP = { ae: "pip-ae", pr: "pip-pr", cc: "pip-cc" };

const BASE_CATALOG = [
  { id: "ae-ini", app: "ae", icon: "AE", name: "AE Primeiros Passos", desc: "Interface, composições, atalhos e workflow inicial.", query: "after effects tutorial curso gratuito" },
  { id: "pr-ini", app: "pr", icon: "PR", name: "Premiere Primeiros Passos", desc: "Interface, bins, sequência e corte básico.", query: "premiere pro tutorial curso gratuito" },
  { id: "cc-ini", app: "cc", icon: "CC", name: "CapCut Primeiros Passos", desc: "Interface, corte, legenda e exportação.", query: "capcut tutorial curso gratuito" }
];

const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

async function apiJson(url, options = {}) {
  const res = await fetch(url, options);
  return res.json();
}

function renderShell() {
  $("#mainContent").innerHTML = BASE_CATALOG.map(
    (cat) => `
    <section class="cat-section" data-cat="${cat.id}">
      <div class="cat-header">
        <div class="cat-icon" style="background:rgba(180,78,255,.12);border:1px solid rgba(180,78,255,.35)">${cat.icon}</div>
        <div style="flex:1">
          <div class="cat-name" style="color:var(--${cat.app})">${cat.name}</div>
          <div class="cat-desc">${cat.desc}</div>
        </div>
        <div class="cat-meta"><span id="ct-${cat.id}">carregando...</span></div>
      </div>
      <div class="cards-wrap ${state.view === "grid" ? "g-view" : "l-view"}" id="cw-${cat.id}">
        <div style="padding:14px;color:var(--sub);font-family:'JetBrains Mono',monospace">carregando vídeos...</div>
      </div>
    </section>`
  ).join("");
  $("#ctrlCount").textContent = "busca pronta";
}

function cardHTML(v, app) {
  return `
    <article class="card" data-vid="${esc(v.id)}" data-title="${esc(v.title)}" data-ch="${esc(v.channelTitle)}">
      <div class="card-thumb">
        <img loading="lazy" src="${esc(v.thumbnail)}" alt="">
        <div class="app-pip ${APPPIP[app]}">${APPLABEL[app]}</div>
      </div>
      <div class="card-body">
        <div class="card-title">${esc(v.title)}</div>
        <div class="card-meta"><span class="card-ch">${esc(v.channelTitle)}</span></div>
      </div>
    </article>`;
}

async function loadCategory(cat) {
  const key = `${cat.query}:${state.filter}:${state.view}`;
  if (state.cache.has(key)) return state.cache.get(key);

  const data = await apiJson(
    `/api/youtube/search?q=${encodeURIComponent(cat.query)}&maxResults=8&lang=pt-BR`
  ).catch(() => ({ items: [] }));

  state.cache.set(key, data);
  return data;
}

async function renderCategories() {
  renderShell();
  // FILTRA categorias pela seleção
  const cats = BASE_CATALOG.filter((c) => state.filter === "all" || c.app === state.filter);

  for (const cat of cats) {
    const data = await loadCategory(cat);
    const items = data.items || [];
    $("#cw-" + cat.id).innerHTML = items.length
      ? items.map((v) => cardHTML(v, cat.app)).join("")
      : `<div style="padding:14px;color:var(--sub);font-family:'JetBrains Mono',monospace">nenhum vídeo encontrado</div>`;
    $("#ct-" + cat.id).textContent = `${items.length} aulas`;
  }
  
  // Se filtrar e não mostrar nada, avisa
  if (cats.length === 0) {
    $("#mainContent").innerHTML = `<div style="padding:14px;color:var(--sub);font-family:'JetBrains Mono',monospace">Nenhuma categoria encontrada.</div>`;
  }
}

async function doSearch(q) {
  state.query = q;
  $("#ctrlCount").textContent = "buscando...";
  
  // LIMPA cache da busca para não usar dados antigos
  const cacheKeys = Array.from(state.cache.keys()).filter(k => k.includes("busca"));
  cacheKeys.forEach(k => state.cache.delete(k));

  const ai = await apiJson(`/api/ai/search?q=${encodeURIComponent(q)}`).catch(() => ({ queries: [q] }));
  const searchQueries = (ai.queries && ai.queries.length ? ai.queries : [q]).slice(0, 5);
  const results = [];

  for (const query of searchQueries) {
    const data = await apiJson(
      `/api/youtube/search?q=${encodeURIComponent(query)}&maxResults=12&lang=pt-BR`
    ).catch(() => ({ items: [] }));
    results.push(...(data.items || []));
  }

  const dedup = [...new Map(results.map((v) => [v.id, v])).values()];

  $("#mainContent").innerHTML = `
    <section class="cat-section">
      <div class="cat-header">
        <div class="cat-icon" style="background:rgba(180,78,255,.12);border:1px solid rgba(180,78,255,.35)">🔎</div>
        <div style="flex:1">
          <div class="cat-name" style="color:var(--neon)">Resultados para "${esc(q)}"</div>
          <div class="cat-desc">vídeos atualizados diretamente do YouTube</div>
        </div>
        <div class="cat-meta"><span>${dedup.length} resultados</span></div>
      </div>
      <div class="cards-wrap ${state.view === "grid" ? "g-view" : "l-view"}" id="searchResults">
        ${dedup.length ? dedup.map((v) => cardHTML(v, "ae")).join("") : `<div style="padding:14px;color:var(--sub);font-family:'JetBrains Mono',monospace">Nenhum resultado encontrado.</div>`}
      </div>
    </section>`;

  $("#ctrlCount").textContent = `${dedup.length} resultados`;
}

async function loadSuggestions(q) {
  if (!q.trim()) {
    $("#suggestions").classList.remove("open");
    return;
  }

  const data = await apiJson(`/api/suggest?q=${encodeURIComponent(q)}`).catch(() => ({ items: [] }));
  const items = (data.items || []).slice(0, 6);
  const box = $("#suggestions");

  box.innerHTML = items.map((s) => `<div class="suggest-item">${esc(s)}</div>`).join("");
  box.classList.toggle("open", items.length > 0);

  box.querySelectorAll(".suggest-item").forEach((el) =>
    el.addEventListener("click", () => {
      $("#searchInput").value = el.textContent;
      box.classList.remove("open");
      doSearch(el.textContent);
    })
  );
}

function openPlayer(id, title, ch) {
  $("#modalTitle").textContent = title || "Vídeo";
  $("#modalCh").textContent = ch || "";
  $("#modalLink").href = `https://www.youtube.com/watch?v=${id}`;
  $("#modal").classList.add("open");
  
  const ytUrl = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  
  const iframe = document.createElement("iframe");
  iframe.id = "videoFrame";
  iframe.src = ytUrl;
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.style = "position:absolute;inset:0;width:100%;height:100%;border:none;";
  
  $("#playerMount").innerHTML = "";
  $("#playerMount").appendChild(iframe);

  // Detecta bloqueio após 3 segundos
  setTimeout(() => {
    const frame = document.getElementById("videoFrame");
    if (!frame) return;
    
    let blocked = false;
    try {
      if (!frame.contentWindow) {
        blocked = true;
      }
    } catch {
      blocked = true;
    }
    
    if (blocked) {
      showBlockedAndOpen(id, title);
    }
  }, 3000);
}

function showBlockedAndOpen(id, title) {
  const msg = `
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000;color:#ede8ff;font-family:'JetBrains Mono',monospace;text-align:center;padding:24px;flex-direction:column;gap:12px">
      <div style="font-size:16px;color:#b44eff">Este vídeo bloqueou incorporação.</div>
      <div style="font-size:12px;color:#8a7aaa">Abrindo automaticamente no YouTube...</div>
    </div>
  `;
  $("#playerMount").innerHTML = msg;
  toast("Vídeo bloqueado — abrindo no YouTube");
  
  setTimeout(() => {
    window.open(`https://www.youtube.com/watch?v=${id}`, "_blank");
  }, 500);
}

function closeModal() {
  $("#modal").classList.remove("open");
  $("#playerMount").innerHTML = "";
  if (state.currentPlayer && state.currentPlayer.destroy) {
    try {
      state.currentPlayer.destroy();
    } catch {}
  }
}

document.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (card) openPlayer(card.dataset.vid, card.dataset.title, card.dataset.ch);
});

$("#modalClose").addEventListener("click", closeModal);
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) closeModal();
});

// FILTRO de categorias
$("#tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  const vbtn = e.target.closest(".vbtn");

  if (tab) {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("on"));
    tab.classList.add("on");
    state.filter = tab.dataset.filter;
    state.query = ""; // LIMPA busca quando muda filtro
    $("#searchInput").value = "";
    renderCategories(); // Recarrega categorias
  }

  if (vbtn) {
    document.querySelectorAll(".vbtn").forEach((x) => x.classList.remove("on"));
    vbtn.classList.add("on");
    state.view = vbtn.dataset.view;
    // Se tem busca, recarrega busca; se não, recarrega categorias
    state.query ? doSearch(state.query) : renderCategories();
  }
});

$("#searchBtn").addEventListener("click", () => {
  const q = $("#searchInput").value.trim();
  if (q) doSearch(q);
  else toast("Digite um tema para buscar.");
});

$("#searchInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    $("#searchBtn").click();
  }
});

// Autocomplete e busca incremental
$("#searchInput").addEventListener("input", () => {
  clearTimeout(state.suggestionsTimer);
  clearTimeout(state.searchTimer);

  const q = $("#searchInput").value.trim();

  state.suggestionsTimer = setTimeout(() => loadSuggestions(q), 220);
  state.searchTimer = setTimeout(() => {
    if (q.length >= 3) doSearch(q);
  }, 600);
});

window.onYouTubeIframeAPIReady = () => {};

// CARREGA categorias inicialmente
renderCategories();
