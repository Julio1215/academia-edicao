// ═══════════════════════════════════════════════════════════════════
//  ACADEMIA DE EDIÇÃO — app.js
//  Busca real YouTube via backend · Progresso local · Player estável
// ═══════════════════════════════════════════════════════════════════

// ── ESTADO GLOBAL ──────────────────────────────────────────────────
const state = {
  filter: 'all',
  view: 'list',
  searchQuery: '',
  isSearchMode: false,
  cache: new Map(),          // {key: {data, ts}}
  suggestTimer: null,
  player: {
    vid: null,
    query: null,
    candidates: [],
    candidateIdx: 0,
    retries: 0,
    errorTimer: null,
  },
};

// ── PROGRESSO ──────────────────────────────────────────────────────
const PROGRESS_KEY = 'academia_progress_v1';

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); }
  catch { return {}; }
}
function saveProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch {}
}
function isVideoDone(vid) { return !!loadProgress()[vid]; }
function toggleDone(vid) {
  const p = loadProgress();
  if (p[vid]) delete p[vid]; else p[vid] = Date.now();
  saveProgress(p);
  refreshProgress();
  refreshCardDoneState(vid);
}

function refreshProgress() {
  const p = loadProgress();
  const done = Object.keys(p).length;
  // conta total visível
  const total = document.querySelectorAll('.card[data-vid]').length || 1;
  const pct = total > 0 ? Math.round((done / Math.max(total, done)) * 100) : 0;
  const clampedPct = Math.min(pct, 100);
  el('pbFill').style.width = clampedPct + '%';
  el('pbPct').textContent = clampedPct + '%';
  el('pbSub').textContent = done === 0 ? '0 aulas concluídas'
    : done === 1 ? '1 aula concluída'
    : `${done} aulas concluídas`;
  el('statDone').textContent = done;
}

function refreshCardDoneState(vid) {
  document.querySelectorAll(`.card[data-vid="${CSS.escape(vid)}"]`).forEach(card => {
    const done = isVideoDone(vid);
    card.classList.toggle('done', done);
  });
}

// ── HELPERS ────────────────────────────────────────────────────────
const el = id => document.getElementById(id);
const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function toast(msg, dur = 2500) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), dur);
}

async function apiGet(url) {
  const cached = state.cache.get(url);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL) return cached.data;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    state.cache.set(url, { data, ts: Date.now() });
    return data;
  } catch (e) {
    console.warn('apiGet error', url, e.message);
    return null;
  }
}

// ── CATÁLOGO — 36 tópicos ──────────────────────────────────────────
const CATALOG = [
  // AFTER EFFECTS
  { id:'ae-ini',    app:'ae', name:'AE · Primeiros Passos',     desc:'Interface, workspace, composições',
    query:'after effects iniciante tutorial português 2024 2025' },
  { id:'ae-key',    app:'ae', name:'AE · Keyframes & Timing',   desc:'Easing, graph editor, spacing',
    query:'after effects keyframes animação tutorial português' },
  { id:'ae-mask',   app:'ae', name:'AE · Máscaras & Track Matte', desc:'Recorte, revelação, transparência',
    query:'after effects mascaras track matte tutorial português' },
  { id:'ae-shape',  app:'ae', name:'AE · Shape Layers',         desc:'Trim paths, morphing, shapes',
    query:'after effects shape layers trim paths tutorial português' },
  { id:'ae-type',   app:'ae', name:'AE · Tipografia Animada',   desc:'Kinetic type, text animators',
    query:'after effects tipografia animada kinetic type português' },
  { id:'ae-expr',   app:'ae', name:'AE · Expressões',           desc:'Wiggle, loop, time, código',
    query:'after effects expressões wiggle loop tutorial português' },
  { id:'ae-chroma', app:'ae', name:'AE · Chroma Key',           desc:'Fundo verde, Keylight, keying',
    query:'after effects chroma key fundo verde tutorial português' },
  { id:'ae-vfx',    app:'ae', name:'AE · VFX & Partículas',     desc:'Fogo, explosão, glitch, distorção',
    query:'after effects vfx efeitos visuais particulas tutorial português' },
  { id:'ae-motion', app:'ae', name:'AE · Motion Graphics',      desc:'UI animation, explainer, infográficos',
    query:'after effects motion graphics tutorial português 2024' },
  { id:'ae-comp',   app:'ae', name:'AE · Compositing 3D',       desc:'Camera, depth, 3D layers, parallax',
    query:'after effects compositing 3d camera tutorial português' },
  { id:'ae-plugin', app:'ae', name:'AE · Plugins & Element 3D', desc:'Element 3D, Trapcode, Video Copilot',
    query:'after effects plugins element 3d trapcode tutorial português' },
  { id:'ae-render', app:'ae', name:'AE · Render & Export',      desc:'Media Encoder, codecs, output',
    query:'after effects render exportar media encoder tutorial português' },

  // PREMIERE PRO
  { id:'pr-ini',    app:'pr', name:'Premiere · Primeiros Passos', desc:'Interface, bins, timeline, corte',
    query:'premiere pro iniciante tutorial completo português 2024 2025' },
  { id:'pr-cut',    app:'pr', name:'Premiere · Técnicas de Corte', desc:'J-cut, L-cut, ripple, multicam',
    query:'premiere pro tecnicas corte jcut lcut multicam português' },
  { id:'pr-color',  app:'pr', name:'Premiere · Color Grading',  desc:'Lumetri, scopes, LUTs, looks',
    query:'premiere pro lumetri color grading correção cor português' },
  { id:'pr-audio',  app:'pr', name:'Premiere · Edição de Áudio', desc:'Mix, EQ, noise, compressor',
    query:'premiere pro audio mix equalizer noise tutorial português' },
  { id:'pr-subs',   app:'pr', name:'Premiere · Legendas & Titles', desc:'Auto-caption, MOGRT, Essential Graphics',
    query:'premiere pro legendas subtitles essential graphics tutorial português' },
  { id:'pr-trans',  app:'pr', name:'Premiere · Transições',     desc:'Dissolve, zoom, warp, speed ramp',
    query:'premiere pro transicoes transitions speed ramp tutorial português' },
  { id:'pr-stab',   app:'pr', name:'Premiere · Estabilização',  desc:'Warp Stabilizer, Optical Flow, slow-mo',
    query:'premiere pro warp stabilizer optical flow slowmotion português' },
  { id:'pr-ae',     app:'pr', name:'Premiere + After Effects',  desc:'Dynamic Link, round-trip workflow',
    query:'premiere after effects dynamic link tutorial português' },
  { id:'pr-export', app:'pr', name:'Premiere · Export & Codec', desc:'H.264, 4K, YouTube, Instagram',
    query:'premiere pro exportar render h264 youtube 4k português' },
  { id:'pr-adv',    app:'pr', name:'Premiere · Workflow Pro',   desc:'Proxies, auto-reframe, shortcuts',
    query:'premiere pro workflow avancado proxies tutorial português 2024' },

  // CAPCUT
  { id:'cc-ini',    app:'cc', name:'CapCut · Primeiros Passos', desc:'Interface PC e mobile, cortes básicos',
    query:'capcut tutorial iniciante completo português 2024 2025' },
  { id:'cc-cuts',   app:'cc', name:'CapCut · Cortes & Ritmo',   desc:'Beat sync, corte no ritmo, J-cut',
    query:'capcut corte ritmo beat sync tutorial português' },
  { id:'cc-text',   app:'cc', name:'CapCut · Textos & Legendas', desc:'Auto-legenda, fontes animadas',
    query:'capcut texto legenda automatica animado tutorial português' },
  { id:'cc-trans',  app:'cc', name:'CapCut · Transições & Efeitos', desc:'Smooth, glitch, zoom, whip pan',
    query:'capcut transicoes efeitos smooth glitch tutorial português' },
  { id:'cc-color',  app:'cc', name:'CapCut · Cor & Filtros',    desc:'Color grading, filtros, LUTs',
    query:'capcut color grading filtros luts tutorial português' },
  { id:'cc-vfx',    app:'cc', name:'CapCut · VFX & IA',         desc:'Tela verde, sky replace, AI effects',
    query:'capcut vfx efeitos especiais tela verde ia tutorial português' },
  { id:'cc-reels',  app:'cc', name:'CapCut · Reels & Shorts',   desc:'Formatos verticais, estratégia viral',
    query:'capcut reels shorts tiktok viral tutorial português 2024 2025' },
  { id:'cc-tmpl',   app:'cc', name:'CapCut · Templates & Trends', desc:'Usar, editar e criar templates',
    query:'capcut templates trend tutorial português 2024 2025' },
  { id:'cc-adv',    app:'cc', name:'CapCut · Avançado & Pro',   desc:'Keyframes, masking, blend mode',
    query:'capcut avancado profissional keyframes masking tutorial português' },
];

const APP_COLOR = { ae:'var(--ae)', pr:'var(--pr)', cc:'var(--cc)' };
const APP_LABEL = { ae:'After Effects', pr:'Premiere Pro', cc:'CapCut' };
const APP_PIP   = { ae:'pip-ae', pr:'pip-pr', cc:'pip-cc' };

// ── SKELETON ────────────────────────────────────────────────────────
function skeletonHTML(n) {
  return `<div class="skeleton-wrap">` +
    Array.from({length:n}, () => `
      <div class="skeleton">
        <div class="sk-thumb"></div>
        <div class="sk-body">
          <div class="sk-line w70"></div>
          <div class="sk-line w45"></div>
        </div>
      </div>`).join('') +
    `</div>`;
}

// ── CARD HTML ────────────────────────────────────────────────────────
function cardHTML(v, app) {
  const done = isVideoDone(v.id);
  const pip  = APP_PIP[app] || 'pip-ae';
  const appL = APP_LABEL[app] || '';
  return `
    <article class="card${done ? ' done' : ''}"
      data-vid="${esc(v.id)}"
      data-title="${esc(v.title)}"
      data-ch="${esc(v.channelTitle)}"
      data-app="${app}">
      <div class="card-thumb">
        <img loading="lazy" src="${esc(v.thumbnail)}" alt=""
          onerror="this.src='https://img.youtube.com/vi/${esc(v.id)}/mqdefault.jpg'">
        <div class="app-pip ${pip}">${appL}</div>
        <div class="play-ov">
          <div class="play-ring">
            <svg viewBox="0 0 12 12"><polygon points="2,1 11,6 2,11"/></svg>
          </div>
        </div>
        <div class="card-done-overlay"><span class="card-done-check">✓</span></div>
        <div class="card-prog"><div class="card-prog-fill" style="width:${done?'100':'0'}%"></div></div>
      </div>
      <div class="card-body">
        <div class="card-title">${esc(v.title)}</div>
        <div class="card-meta-row">
          <span class="card-ch">${esc(v.channelTitle)}</span>
          <span class="card-flag">🇧🇷</span>
          <span class="card-done-tag">✓ feita</span>
        </div>
      </div>
    </article>`;
}

// ── RENDERIZA CATEGORIAS ─────────────────────────────────────────────
async function renderCategories() {
  state.isSearchMode = false;
  el('searchLoading').classList.remove('visible');

  const cats = CATALOG.filter(c => state.filter === 'all' || c.app === state.filter);
  const mc = el('mainContent');
  mc.innerHTML = '';

  // cria shells com skeleton simultaneamente
  cats.forEach(cat => {
    const sec = document.createElement('section');
    sec.className = 'cat-section';
    sec.id = 'sec-' + cat.id;
    sec.innerHTML = `
      <div class="cat-header">
        <div class="cat-icon" style="background:rgba(180,78,255,.1);border:1px solid rgba(180,78,255,.25);color:${APP_COLOR[cat.app]}">${cat.app.toUpperCase()}</div>
        <div>
          <div class="cat-name" style="color:${APP_COLOR[cat.app]}">${cat.name}</div>
          <div class="cat-desc">${cat.desc}</div>
        </div>
        <div class="cat-meta" id="ct-${cat.id}">carregando...</div>
      </div>
      <div class="cards-wrap ${state.view === 'grid' ? 'g-view' : 'l-view'}" id="cw-${cat.id}">
        ${skeletonHTML(6)}
      </div>`;
    mc.appendChild(sec);
  });

  el('ctrlCount').textContent = `${cats.length} tópicos`;
  el('statCats').textContent = cats.length;

  // busca em paralelo (grupos de 4 para não saturar)
  let totalLoaded = 0;
  const chunks = [];
  for (let i = 0; i < cats.length; i += 4) chunks.push(cats.slice(i, i + 4));

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async cat => {
      const url = `/api/youtube/search?q=${encodeURIComponent(cat.query)}&maxResults=10&lang=pt-BR`;
      const data = await apiGet(url) || { items: [] };
      const items = data.items || [];
      const wrap = el('cw-' + cat.id);
      const countEl = el('ct-' + cat.id);
      if (!wrap) return;
      wrap.className = `cards-wrap ${state.view === 'grid' ? 'g-view' : 'l-view'}`;
      if (items.length) {
        wrap.innerHTML = items.map(v => cardHTML(v, cat.app)).join('');
        totalLoaded += items.length;
        el('statAulas').textContent = totalLoaded + '+';
      } else {
        wrap.innerHTML = `<div class="empty-state">
          <div class="es-icon">📭</div>
          <div class="es-title">nenhum vídeo encontrado</div>
          <div class="es-sub">verifique a conexão ou a chave da API</div>
        </div>`;
      }
      if (countEl) countEl.textContent = `${items.length} aulas`;
    }));
  }

  el('statAulas').textContent = totalLoaded + '+';
  refreshProgress();
}

// ── BUSCA REAL ────────────────────────────────────────────────────────
async function doSearch(q) {
  q = q.trim();
  if (!q) { toast('Digite algo para buscar!'); return; }

  state.searchQuery = q;
  state.isSearchMode = true;
  el('suggestions').classList.remove('open');
  el('searchBtn').disabled = true;
  el('searchLoading').classList.add('visible');
  el('searchLoadingText').textContent = `Buscando "${q}" no YouTube...`;
  el('ctrlCount').textContent = 'buscando...';

  try {
    // 1. Pede ao backend as queries de busca geradas por IA/keywords
    const aiData = await apiGet(`/api/ai/search?q=${encodeURIComponent(q)}`) || {};
    // as queries geradas + a própria busca do usuário
    const rawQueries = [q, ...(aiData.queries || [])];
    // deduplica e filtra pela preferência de software se selecionado
    const queries = [...new Set(rawQueries)].slice(0, 4);

    el('searchLoadingText').textContent = `Encontrando vídeos (${queries.length} buscas)...`;

    // 2. Busca paralela no YouTube para cada query
    const fetches = queries.map(query =>
      apiGet(`/api/youtube/search?q=${encodeURIComponent(query + ' tutorial português')}&maxResults=12&lang=pt-BR`)
        .then(d => d?.items || [])
        .catch(() => [])
    );
    const allResults = await Promise.all(fetches);
    const flat = allResults.flat();

    // 3. Deduplica por id
    const dedup = [...new Map(flat.map(v => [v.id, v])).values()];

    // 4. Filtra por software se selecionado
    // (heurística: checa título/canal por palavras-chave)
    const filterMap = {
      ae: ['after effects','ae ','motion','vinheta','composição'],
      pr: ['premiere','pr ','timeline','edição','edit'],
      cc: ['capcut','cap cut','reels','shorts','tiktok'],
    };
    const filtered = state.filter === 'all' ? dedup : dedup.filter(v => {
      const haystack = (v.title + ' ' + v.channelTitle).toLowerCase();
      return (filterMap[state.filter] || []).some(kw => haystack.includes(kw));
    });

    // 5. Se filtrou demais, mostra todos mesmo
    const results = filtered.length >= 4 ? filtered : dedup;

    // 6. Renderiza
    const mc = el('mainContent');
    mc.innerHTML = `
      <section class="cat-section">
        <div class="cat-header">
          <div class="cat-icon" style="background:rgba(180,78,255,.1);border:1px solid rgba(180,78,255,.25)">🔎</div>
          <div>
            <div class="cat-name" style="color:var(--neon)">Resultados para "${esc(q)}"</div>
            <div class="cat-desc">vídeos buscados agora no YouTube · ${results.length} resultados</div>
          </div>
          <div class="cat-meta">
            <button onclick="clearSearch()" style="background:none;border:1px solid var(--bord3);color:var(--sub);border-radius:3px;padding:4px 10px;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:9px;">
              ✕ limpar busca
            </button>
          </div>
        </div>
        <div class="cards-wrap ${state.view === 'grid' ? 'g-view' : 'l-view'}">
          ${results.length
            ? results.map(v => cardHTML(v, detectApp(v))).join('')
            : `<div class="empty-state">
                <div class="es-icon">🔍</div>
                <div class="es-title">nenhum resultado encontrado</div>
                <div class="es-sub">tente termos diferentes ou verifique a chave da API</div>
               </div>`}
        </div>
      </section>`;

    el('ctrlCount').textContent = `${results.length} resultados`;
    el('statAulas').textContent = results.length;
    el('statCats').textContent = '1 busca';
    refreshProgress();

  } catch(e) {
    console.error('Search error:', e);
    toast('Erro na busca. Tente novamente.');
  } finally {
    el('searchLoading').classList.remove('visible');
    el('searchBtn').disabled = false;
  }
}

function detectApp(v) {
  const s = (v.title + ' ' + v.channelTitle).toLowerCase();
  if (s.includes('after effects') || s.includes(' ae ')) return 'ae';
  if (s.includes('premiere')) return 'pr';
  if (s.includes('capcut') || s.includes('cap cut')) return 'cc';
  return 'ae';
}

function clearSearch() {
  state.searchQuery = '';
  state.isSearchMode = false;
  el('searchInput').value = '';
  renderCategories();
}

// ── AUTOCOMPLETE ─────────────────────────────────────────────────────
async function loadSuggestions(q) {
  const box = el('suggestions');
  if (!q.trim() || q.length < 2) { box.classList.remove('open'); return; }
  const data = await apiGet(`/api/suggest?q=${encodeURIComponent(q)}`) || {};
  const items = (data.items || []).slice(0, 7);
  if (!items.length) { box.classList.remove('open'); return; }
  box.innerHTML = items.map(s => `<div class="suggest-item">${esc(s)}</div>`).join('');
  box.classList.add('open');
  box.querySelectorAll('.suggest-item').forEach(item => {
    item.addEventListener('click', () => {
      el('searchInput').value = item.textContent;
      box.classList.remove('open');
      doSearch(item.textContent);
    });
  });
}

// ── PLAYER ───────────────────────────────────────────────────────────
function openPlayer(vid, title, ch, app) {
  // reseta estado
  const p = state.player;
  clearTimeout(p.errorTimer);
  p.vid = vid;
  p.query = CATALOG.find(c => c.app === app)?.query || (app + ' tutorial português');
  p.candidates = [];
  p.candidateIdx = 0;
  p.retries = 0;

  // pré-carrega candidatos em background
  prefetchCandidates(p.query, vid);

  // UI
  el('modalTitle').textContent = title || 'Vídeo';
  el('modalCh').textContent = ch || '';
  el('modalLink').href = `https://www.youtube.com/watch?v=${vid}`;

  const done = isVideoDone(vid);
  el('modalDoneBtn').classList.toggle('marked', done);
  el('modalDoneBtn').textContent = done ? '✓ concluída' : '✓ marcar como concluída';
  el('modalDoneBadge').classList.toggle('show', done);
  el('modalDoneBtn').dataset.vid = vid;

  el('modal').classList.add('open');
  loadVideo(vid);
}

async function prefetchCandidates(query, excludeVid) {
  const url = `/api/youtube/search?q=${encodeURIComponent(query)}&maxResults=12&lang=pt-BR`;
  const data = await apiGet(url) || {};
  state.player.candidates = (data.items || []).filter(v => v.id !== excludeVid);
}

function loadVideo(vid) {
  // mostra loading, esconde outros estados
  showPlayerState('loading');

  const mount = el('playerMount');
  mount.style.display = 'none';
  mount.innerHTML = '';

  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${vid}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;';

  iframe.addEventListener('load', () => {
    // iframe carregou — mostra player (ainda pode ter erro interno)
    mount.innerHTML = '';
    mount.appendChild(iframe);
    mount.style.display = 'block';
    el('playerLoading').style.display = 'none';
    // agenda verificação de erro interno após 4s
    state.player.errorTimer = setTimeout(() => checkIframeError(vid), 4000);
  });

  mount.appendChild(iframe);
}

async function checkIframeError(vid) {
  if (state.player.vid !== vid) return;
  // verifica via noembed se o vídeo permite embed
  try {
    const r = await fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${vid}`,
      { signal: AbortSignal.timeout(4000) }
    );
    const d = await r.json();
    if (d.error || !d.html) {
      silentSwap();
      return;
    }
  } catch {
    // noembed falhou, não necessariamente erro no vídeo — deixa rolar
  }
}

// postMessage do YT IFrame API — captura erros 101/150/153
window.addEventListener('message', e => {
  if (!e.data) return;
  let d;
  try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
  if (d.event === 'onError') {
    const code = typeof d.info === 'number' ? d.info : d.info?.error;
    if (code === 101 || code === 150 || code === 153) {
      clearTimeout(state.player.errorTimer);
      silentSwap();
    }
  }
  if (d.event === 'onReady') {
    // vídeo carregou OK — cancela timer de erro
    clearTimeout(state.player.errorTimer);
  }
});

async function silentSwap() {
  const p = state.player;
  if (p.retries >= 5) { showPlayerState('failed'); return; }
  p.retries++;
  showPlayerState('blocked');

  let next = p.candidates[p.candidateIdx++];

  if (!next) {
    // busca mais candidatos
    const url = `/api/youtube/search?q=${encodeURIComponent(p.query)}&maxResults=12&lang=pt-BR`;
    const data = await apiGet(url) || {};
    const fresh = (data.items || []).filter(v =>
      v.id !== p.vid && !p.candidates.some(c => c.id === v.id)
    );
    p.candidates.push(...fresh);
    next = fresh[0];
  }

  if (!next) { showPlayerState('failed'); return; }

  // pequeno delay para o usuário ver o aviso
  await new Promise(r => setTimeout(r, 800));

  // atualiza UI com novo vídeo
  p.vid = next.id;
  el('modalTitle').textContent = next.title;
  el('modalCh').textContent = next.channelTitle;
  el('modalLink').href = `https://www.youtube.com/watch?v=${next.id}`;
  loadVideo(next.id);
}

function showPlayerState(state) {
  el('playerLoading').style.display  = state === 'loading'  ? 'flex' : 'none';
  el('playerBlocked').style.display  = state === 'blocked'  ? 'flex' : 'none';
  el('playerFailed').style.display   = state === 'failed'   ? 'flex' : 'none';
}

function closeModal() {
  clearTimeout(state.player.errorTimer);
  el('modal').classList.remove('open');
  el('playerMount').innerHTML = '';
  el('playerMount').style.display = 'none';
  state.player.vid = null;
}

// ── EVENTOS ──────────────────────────────────────────────────────────

// click em card → abre player
document.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (card) {
    openPlayer(card.dataset.vid, card.dataset.title, card.dataset.ch, card.dataset.app);
    return;
  }
  // fechar modal clicando fora
  if (e.target === el('modal')) closeModal();
});

// botão fechar modal
el('modalClose').addEventListener('click', closeModal);

// ESC fecha modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && el('modal').classList.contains('open')) closeModal();
});

// marcar como concluída
el('modalDoneBtn').addEventListener('click', () => {
  const vid = el('modalDoneBtn').dataset.vid;
  if (!vid) return;
  toggleDone(vid);
  const done = isVideoDone(vid);
  el('modalDoneBtn').classList.toggle('marked', done);
  el('modalDoneBtn').textContent = done ? '✓ concluída' : '✓ marcar como concluída';
  el('modalDoneBadge').classList.toggle('show', done);
  toast(done ? '✓ Aula marcada como concluída!' : 'Aula desmarcada.');
});

// reset progresso
el('pbReset').addEventListener('click', () => {
  if (!confirm('Resetar todo o progresso?')) return;
  localStorage.removeItem(PROGRESS_KEY);
  document.querySelectorAll('.card.done').forEach(c => c.classList.remove('done'));
  refreshProgress();
  toast('Progresso resetado.');
});

// filtros de software
el('tabs').addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  tab.classList.add('on');
  state.filter = tab.dataset.filter;
  el('searchInput').value = '';
  state.searchQuery = '';
  renderCategories();
});

// view: lista / grade
document.querySelector('.view-group').addEventListener('click', e => {
  const btn = e.target.closest('.vbtn');
  if (!btn) return;
  document.querySelectorAll('.vbtn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  state.view = btn.dataset.view;
  // atualiza view sem rebuscar
  document.querySelectorAll('.cards-wrap').forEach(wrap => {
    wrap.classList.toggle('g-view', state.view === 'grid');
    wrap.classList.toggle('l-view', state.view === 'list');
  });
  document.querySelectorAll('.l-view .skeleton-wrap, .g-view .skeleton-wrap').forEach(s => {
    s.className = 'skeleton-wrap';
  });
});

// busca → botão
el('searchBtn').addEventListener('click', () => {
  const q = el('searchInput').value.trim();
  if (q) doSearch(q); else toast('Digite um tema para buscar.');
});

// busca → Enter
el('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    el('suggestions').classList.remove('open');
    const q = el('searchInput').value.trim();
    if (q) doSearch(q);
  }
});

// autocomplete
el('searchInput').addEventListener('input', () => {
  clearTimeout(state.suggestTimer);
  const q = el('searchInput').value.trim();
  state.suggestTimer = setTimeout(() => loadSuggestions(q), 250);
});

// fechar sugestões ao clicar fora
document.addEventListener('click', e => {
  if (!e.target.closest('.search-input-wrap')) {
    el('suggestions').classList.remove('open');
  }
});

// chips de busca rápida
document.querySelectorAll('.schip').forEach(chip => {
  chip.addEventListener('click', () => {
    el('searchInput').value = chip.dataset.q;
    doSearch(chip.dataset.q);
  });
});

// ── INIT ─────────────────────────────────────────────────────────────
renderCategories();
