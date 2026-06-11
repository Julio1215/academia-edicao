// ═══════════════════════════════════════════════════════════════════
//  ACADEMIA DE EDIÇÃO — app.js
// ═══════════════════════════════════════════════════════════════════

const state = {
  filter: 'all', view: 'list', searchQuery: '', isSearchMode: false,
  cache: new Map(), suggestTimer: null,
  player: { vid:null, query:null, candidates:[], candidateIdx:0, retries:0, errorTimer:null },
};

const PROGRESS_KEY = 'academia_progress_v1';
function loadProgress() { try{return JSON.parse(localStorage.getItem(PROGRESS_KEY)||'{}');}catch{return{};} }
function saveProgress(p) { try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(p));}catch{} }
function isVideoDone(vid) { return !!loadProgress()[vid]; }
function toggleDone(vid) {
  const p=loadProgress();
  if(p[vid]) delete p[vid]; else p[vid]=Date.now();
  saveProgress(p); refreshProgress();
  document.querySelectorAll(`.card[data-vid="${CSS.escape(vid)}"]`).forEach(c=>c.classList.toggle('done',isVideoDone(vid)));
}
function refreshProgress() {
  const p=loadProgress(), done=Object.keys(p).length;
  const total=Math.max(document.querySelectorAll('.card[data-vid]').length,done,1);
  const pct=Math.min(Math.round((done/total)*100),100);
  el('pbFill').style.width=pct+'%'; el('pbPct').textContent=pct+'%';
  el('pbSub').textContent=done===0?'0 aulas concluídas':done===1?'1 aula concluída':`${done} aulas concluídas`;
  el('statDone').textContent=done;
}

const el  = id => document.getElementById(id);
const esc = s  => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const CACHE_TTL = 5*60*1000;

function toast(msg,dur=2800) {
  const t=el('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),dur);
}
async function apiGet(url) {
  const hit=state.cache.get(url);
  if(hit&&Date.now()-hit.ts<CACHE_TTL) return hit.data;
  try {
    const r=await fetch(url); if(!r.ok) throw new Error('HTTP '+r.status);
    const data=await r.json(); state.cache.set(url,{data,ts:Date.now()}); return data;
  } catch(e) { console.warn('[apiGet]',url,e.message); return null; }
}

const CATALOG = [
  {id:'ae-ini',   app:'ae',name:'AE · Primeiros Passos',       desc:'Interface, workspace, composições',        query:'after effects iniciante tutorial português 2024 2025'},
  {id:'ae-key',   app:'ae',name:'AE · Keyframes & Timing',     desc:'Easing, graph editor, spacing',            query:'after effects keyframes animação tutorial português'},
  {id:'ae-mask',  app:'ae',name:'AE · Máscaras & Track Matte', desc:'Recorte, revelação, transparência',         query:'after effects mascaras track matte tutorial português'},
  {id:'ae-shape', app:'ae',name:'AE · Shape Layers',           desc:'Trim paths, morphing, shapes animados',    query:'after effects shape layers trim paths tutorial português'},
  {id:'ae-type',  app:'ae',name:'AE · Tipografia Animada',     desc:'Kinetic type, text animators, reveal',     query:'after effects tipografia animada kinetic type português'},
  {id:'ae-expr',  app:'ae',name:'AE · Expressões',             desc:'Wiggle, loop, time, automação',            query:'after effects expressões wiggle loop tutorial português'},
  {id:'ae-chroma',app:'ae',name:'AE · Chroma Key',             desc:'Fundo verde, Keylight, keying pro',        query:'after effects chroma key fundo verde tutorial português'},
  {id:'ae-vfx',   app:'ae',name:'AE · VFX & Partículas',       desc:'Fogo, explosão, glitch, distorção',        query:'after effects vfx efeitos visuais particulas tutorial português'},
  {id:'ae-motion',app:'ae',name:'AE · Motion Graphics',        desc:'UI animation, explainer, infográficos',    query:'after effects motion graphics tutorial português 2024'},
  {id:'ae-comp',  app:'ae',name:'AE · Compositing 3D',         desc:'Camera, depth, 3D layers, parallax',       query:'after effects compositing 3d camera tutorial português'},
  {id:'ae-plugin',app:'ae',name:'AE · Plugins & Element 3D',   desc:'Element 3D, Trapcode, Video Copilot',      query:'after effects plugins element 3d trapcode tutorial português'},
  {id:'ae-render',app:'ae',name:'AE · Render & Export',        desc:'Media Encoder, codecs, output pro',        query:'after effects render exportar media encoder tutorial português'},
  {id:'pr-ini',   app:'pr',name:'Premiere · Primeiros Passos', desc:'Interface, bins, timeline, corte',         query:'premiere pro iniciante tutorial completo português 2024 2025'},
  {id:'pr-cut',   app:'pr',name:'Premiere · Técnicas de Corte',desc:'J-cut, L-cut, ripple, multicam',           query:'premiere pro tecnicas corte jcut lcut multicam português'},
  {id:'pr-color', app:'pr',name:'Premiere · Color Grading',    desc:'Lumetri, scopes, LUTs, looks',             query:'premiere pro lumetri color grading correção cor português'},
  {id:'pr-audio', app:'pr',name:'Premiere · Edição de Áudio',  desc:'Mix, EQ, noise, compressor, voz',          query:'premiere pro audio mix equalizer noise tutorial português'},
  {id:'pr-subs',  app:'pr',name:'Premiere · Legendas & Titles',desc:'Auto-caption, MOGRT, Essential Graphics',  query:'premiere pro legendas subtitles essential graphics tutorial português'},
  {id:'pr-trans', app:'pr',name:'Premiere · Transições',       desc:'Dissolve, zoom, warp, speed ramp',         query:'premiere pro transicoes transitions speed ramp tutorial português'},
  {id:'pr-stab',  app:'pr',name:'Premiere · Estabilização',    desc:'Warp Stabilizer, Optical Flow, slow-mo',   query:'premiere pro warp stabilizer optical flow slowmotion português'},
  {id:'pr-ae',    app:'pr',name:'Premiere + After Effects',    desc:'Dynamic Link, round-trip workflow',         query:'premiere after effects dynamic link tutorial português'},
  {id:'pr-export',app:'pr',name:'Premiere · Export & Codec',   desc:'H.264, 4K, YouTube, Instagram',            query:'premiere pro exportar render h264 youtube 4k português'},
  {id:'pr-adv',   app:'pr',name:'Premiere · Workflow Pro',     desc:'Proxies, auto-reframe, shortcuts',          query:'premiere pro workflow avancado proxies tutorial português 2024'},
  {id:'cc-ini',   app:'cc',name:'CapCut · Primeiros Passos',   desc:'Interface PC e mobile, cortes básicos',    query:'capcut tutorial iniciante completo português 2024 2025'},
  {id:'cc-cuts',  app:'cc',name:'CapCut · Cortes & Ritmo',     desc:'Beat sync, corte no beat, J-cut',          query:'capcut corte ritmo beat sync tutorial português'},
  {id:'cc-text',  app:'cc',name:'CapCut · Textos & Legendas',  desc:'Auto-legenda, fontes animadas, subtítulos',query:'capcut texto legenda automatica animado tutorial português'},
  {id:'cc-trans', app:'cc',name:'CapCut · Transições & Efeitos',desc:'Smooth, glitch, zoom, whip pan',          query:'capcut transicoes efeitos smooth glitch tutorial português'},
  {id:'cc-color', app:'cc',name:'CapCut · Cor & Filtros',      desc:'Color grading, filtros, LUTs virais',      query:'capcut color grading filtros luts tutorial português'},
  {id:'cc-vfx',   app:'cc',name:'CapCut · VFX & IA',           desc:'Tela verde, sky replace, AI effects',      query:'capcut vfx efeitos especiais tela verde ia tutorial português'},
  {id:'cc-reels', app:'cc',name:'CapCut · Reels & Shorts',     desc:'Formatos verticais, estratégia viral',     query:'capcut reels shorts tiktok viral tutorial português 2024 2025'},
  {id:'cc-tmpl',  app:'cc',name:'CapCut · Templates & Trends', desc:'Usar, editar e criar templates',           query:'capcut templates trend tutorial português 2024 2025'},
  {id:'cc-adv',   app:'cc',name:'CapCut · Avançado & Pro',     desc:'Keyframes, masking, blend mode',           query:'capcut avancado profissional keyframes masking tutorial português'},
];

const APP_COLOR={ae:'var(--ae)',pr:'var(--pr)',cc:'var(--cc)'};
const APP_LABEL={ae:'After Effects',pr:'Premiere Pro',cc:'CapCut'};
const APP_PIP  ={ae:'pip-ae',pr:'pip-pr',cc:'pip-cc'};

function skeletonHTML(n) {
  return `<div class="skeleton-wrap">`+
    Array.from({length:n},()=>`<div class="skeleton"><div class="sk-thumb"></div><div class="sk-body"><div class="sk-line w70"></div><div class="sk-line w45"></div></div></div>`).join('')+
    `</div>`;
}

function cardHTML(v,app) {
  const done=isVideoDone(v.id),pip=APP_PIP[app]||'pip-ae';
  return `<article class="card${done?' done':''}" data-vid="${esc(v.id)}" data-title="${esc(v.title)}" data-ch="${esc(v.channelTitle)}" data-app="${app}">
    <div class="card-thumb">
      <img loading="lazy" src="${esc(v.thumbnail)}" alt="" onerror="this.src='https://img.youtube.com/vi/${esc(v.id)}/mqdefault.jpg'">
      <div class="app-pip ${pip}">${APP_LABEL[app]||''}</div>
      <div class="play-ov"><div class="play-ring"><svg viewBox="0 0 12 12"><polygon points="2,1 11,6 2,11"/></svg></div></div>
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

async function renderCategories() {
  state.isSearchMode=false; el('searchLoading').classList.remove('visible');
  const cats=CATALOG.filter(c=>state.filter==='all'||c.app===state.filter);
  const mc=el('mainContent'); mc.innerHTML='';
  cats.forEach(cat=>{
    const sec=document.createElement('section');
    sec.className='cat-section'; sec.id='sec-'+cat.id;
    sec.innerHTML=`
      <div class="cat-header">
        <div class="cat-icon" style="background:rgba(180,78,255,.1);border:1px solid rgba(180,78,255,.22);color:${APP_COLOR[cat.app]}">${cat.app.toUpperCase()}</div>
        <div><div class="cat-name" style="color:${APP_COLOR[cat.app]}">${cat.name}</div><div class="cat-desc">${cat.desc}</div></div>
        <div class="cat-meta" id="ct-${cat.id}">carregando...</div>
      </div>
      <div class="cards-wrap ${state.view==='grid'?'g-view':'l-view'}" id="cw-${cat.id}">${skeletonHTML(6)}</div>`;
    mc.appendChild(sec);
  });
  el('ctrlCount').textContent=`${cats.length} tópicos`; el('statCats').textContent=cats.length;
  let total=0;
  const chunks=[]; for(let i=0;i<cats.length;i+=4) chunks.push(cats.slice(i,i+4));
  for(const chunk of chunks){
    await Promise.all(chunk.map(async cat=>{
      const data=await apiGet(`/api/youtube/search?q=${encodeURIComponent(cat.query)}&maxResults=10&lang=pt-BR`)||{items:[]};
      const items=data.items||[],wrap=el('cw-'+cat.id),ctEl=el('ct-'+cat.id);
      if(!wrap) return;
      wrap.className=`cards-wrap ${state.view==='grid'?'g-view':'l-view'}`;
      wrap.innerHTML=items.length
        ? items.map(v=>cardHTML(v,cat.app)).join('')
        : `<div class="empty-state"><div class="es-icon">📭</div><div class="es-title">nenhum vídeo encontrado</div><div class="es-sub">verifique a YOUTUBE_API_KEY no .env</div></div>`;
      if(ctEl) ctEl.textContent=`${items.length} aulas`;
      total+=items.length; el('statAulas').textContent=total+'+';
    }));
  }
  el('statAulas').textContent=total+'+'; refreshProgress();
}

async function doSearch(q) {
  q=q.trim(); if(!q){toast('Digite algo para buscar!');return;}
  state.searchQuery=q; state.isSearchMode=true;
  el('suggestions').classList.remove('open');
  el('searchBtn').disabled=true; el('searchLoading').classList.add('visible');
  el('searchLoadingText').textContent=`Buscando "${q}" no YouTube...`;
  el('ctrlCount').textContent='buscando...';
  try {
    const aiData=await apiGet(`/api/ai/search?q=${encodeURIComponent(q)}`)||{};
    const queries=[...new Set([q,...(aiData.queries||[])])].slice(0,4);
    el('searchLoadingText').textContent=`Encontrando vídeos (${queries.length} buscas)...`;
    const all=await Promise.all(queries.map(query=>
      apiGet(`/api/youtube/search?q=${encodeURIComponent(query+' tutorial português')}&maxResults=12&lang=pt-BR`)
        .then(d=>d?.items||[]).catch(()=>[])));
    const dedup=[...new Map(all.flat().map(v=>[v.id,v])).values()];
    const filterKw={ae:['after effects','ae ','motion'],pr:['premiere','timeline'],cc:['capcut','cap cut','reels','shorts']};
    const filtered=state.filter==='all'?dedup:dedup.filter(v=>{
      const hay=(v.title+' '+v.channelTitle).toLowerCase();
      return (filterKw[state.filter]||[]).some(kw=>hay.includes(kw));
    });
    const results=filtered.length>=4?filtered:dedup;
    el('mainContent').innerHTML=`
      <section class="cat-section">
        <div class="cat-header">
          <div class="cat-icon" style="background:rgba(180,78,255,.1);border:1px solid rgba(180,78,255,.22)">🔎</div>
          <div><div class="cat-name" style="color:var(--neon)">Resultados para "${esc(q)}"</div>
          <div class="cat-desc">${results.length} vídeos encontrados agora</div></div>
          <div class="cat-meta"><button onclick="clearSearch()" style="background:none;border:1px solid var(--bord3);color:var(--sub);border-radius:3px;padding:4px 10px;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:9px;">✕ limpar</button></div>
        </div>
        <div class="cards-wrap ${state.view==='grid'?'g-view':'l-view'}">
          ${results.length?results.map(v=>cardHTML(v,detectApp(v))).join('')
            :`<div class="empty-state"><div class="es-icon">🔍</div><div class="es-title">nenhum resultado</div></div>`}
        </div>
      </section>`;
    el('ctrlCount').textContent=`${results.length} resultados`;
    el('statAulas').textContent=results.length; el('statCats').textContent='1 busca';
    refreshProgress();
  } catch(e){console.error(e);toast('Erro na busca.');}
  finally{el('searchLoading').classList.remove('visible');el('searchBtn').disabled=false;}
}

function detectApp(v){
  const s=(v.title+' '+v.channelTitle).toLowerCase();
  if(s.includes('after effects')||s.includes(' ae ')) return 'ae';
  if(s.includes('premiere')) return 'pr';
  if(s.includes('capcut')||s.includes('cap cut')) return 'cc';
  return 'ae';
}
function clearSearch(){state.searchQuery='';state.isSearchMode=false;el('searchInput').value='';renderCategories();}

async function loadSuggestions(q){
  const box=el('suggestions');
  if(!q||q.length<2){box.classList.remove('open');return;}
  const data=await apiGet(`/api/suggest?q=${encodeURIComponent(q)}`)||{};
  const items=(data.items||[]).slice(0,7);
  if(!items.length){box.classList.remove('open');return;}
  box.innerHTML=items.map(s=>`<div class="suggest-item">${esc(s)}</div>`).join('');
  box.classList.add('open');
  box.querySelectorAll('.suggest-item').forEach(item=>{
    item.addEventListener('click',()=>{el('searchInput').value=item.textContent;box.classList.remove('open');doSearch(item.textContent);});
  });
}

// ══════════════════════════════════════════════════════════════════
//  PLAYER — sem silentSwap, sem checkEmbeddable, sem loop
//  Se o YouTube bloquear embed, mostra botão para abrir no YouTube
// ══════════════════════════════════════════════════════════════════

function openPlayer(vid,title,ch,app){
  clearTimeout(state.player.errorTimer);
  state.player.vid=vid;
  state.player.retries=0;

  el('modalTitle').textContent=title||'Vídeo';
  el('modalCh').textContent=ch||'';
  el('modalLink').href=`https://www.youtube.com/watch?v=${vid}`;

  const done=isVideoDone(vid);
  el('modalDoneBtn').classList.toggle('marked',done);
  el('modalDoneBtn').textContent=done?'✓ concluída':'✓ marcar como concluída';
  el('modalDoneBadge').classList.toggle('show',done);
  el('modalDoneBtn').dataset.vid=vid;

  el('modal').classList.add('open');
  loadVideo(vid);
}

function loadVideo(vid){
  // Mostra loading, esconde tudo
  el('playerLoading').style.display='flex';
  el('playerBlocked').style.display='none';
  el('playerFailed').style.display='none';
  const mount=el('playerMount');
  mount.style.display='none';
  mount.innerHTML='';

  const iframe=document.createElement('iframe');
  iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen=true;
  iframe.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:none;';
  // youtube-nocookie tem menos bloqueios de embed
  iframe.src=`https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;

  iframe.addEventListener('load',()=>{
    el('playerLoading').style.display='none';
    mount.innerHTML='';
    mount.appendChild(iframe);
    mount.style.display='block';
  });

  mount.appendChild(iframe);
}

// Captura erros reais do YT IFrame API
// Erros 101/150/153 = embed bloqueado pelo canal
// Nesse caso mostra estado "bloqueado" com botão para abrir no YouTube
// SEM tentar trocar vídeo em loop
window.addEventListener('message',e=>{
  if(!e.data) return;
  let d; try{d=typeof e.data==='string'?JSON.parse(e.data):e.data;}catch{return;}
  if(d.event==='onError'){
    const code=typeof d.info==='number'?d.info:d.info?.error;
    if(code===101||code===150||code===153){
      // Embed bloqueado — mostra estado bloqueado, NÃO faz loop
      el('playerMount').style.display='none';
      el('playerLoading').style.display='none';
      el('playerBlocked').style.display='flex';
    }
  }
  // onReady = carregou ok
  if(d.event==='onReady'){
    el('playerLoading').style.display='none';
    el('playerBlocked').style.display='none';
  }
});

function closeModal(){
  clearTimeout(state.player.errorTimer);
  el('modal').classList.remove('open');
  el('playerMount').innerHTML='';
  el('playerMount').style.display='none';
  el('playerLoading').style.display='none';
  el('playerBlocked').style.display='none';
  el('playerFailed').style.display='none';
  state.player.vid=null;
}

// ── EVENTOS ──────────────────────────────────────────────────────────
document.addEventListener('click',e=>{
  const card=e.target.closest('.card');
  if(card){openPlayer(card.dataset.vid,card.dataset.title,card.dataset.ch,card.dataset.app);return;}
  if(e.target===el('modal')) closeModal();
});
el('modalClose').addEventListener('click',closeModal);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&el('modal').classList.contains('open'))closeModal();});
el('modalDoneBtn').addEventListener('click',()=>{
  const vid=el('modalDoneBtn').dataset.vid; if(!vid) return;
  toggleDone(vid);
  const done=isVideoDone(vid);
  el('modalDoneBtn').classList.toggle('marked',done);
  el('modalDoneBtn').textContent=done?'✓ concluída':'✓ marcar como concluída';
  el('modalDoneBadge').classList.toggle('show',done);
  toast(done?'✓ Aula marcada como concluída!':'Aula desmarcada.');
});
el('pbReset').addEventListener('click',()=>{
  if(!confirm('Resetar todo o progresso?')) return;
  localStorage.removeItem(PROGRESS_KEY);
  document.querySelectorAll('.card.done').forEach(c=>c.classList.remove('done'));
  refreshProgress(); toast('Progresso resetado.');
});
el('tabs').addEventListener('click',e=>{
  const tab=e.target.closest('.tab'); if(!tab) return;
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  tab.classList.add('on'); state.filter=tab.dataset.filter;
  el('searchInput').value=''; state.searchQuery=''; renderCategories();
});
document.querySelector('.view-group').addEventListener('click',e=>{
  const btn=e.target.closest('.vbtn'); if(!btn) return;
  document.querySelectorAll('.vbtn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); state.view=btn.dataset.view;
  document.querySelectorAll('.cards-wrap').forEach(w=>{
    w.classList.toggle('g-view',state.view==='grid');
    w.classList.toggle('l-view',state.view==='list');
  });
});
el('searchBtn').addEventListener('click',()=>{const q=el('searchInput').value.trim();if(q)doSearch(q);else toast('Digite um tema.');});
el('searchInput').addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();el('suggestions').classList.remove('open');const q=el('searchInput').value.trim();if(q)doSearch(q);}
});
el('searchInput').addEventListener('input',()=>{
  clearTimeout(state.suggestTimer);
  state.suggestTimer=setTimeout(()=>loadSuggestions(el('searchInput').value.trim()),280);
});
document.addEventListener('click',e=>{if(!e.target.closest('.search-input-wrap'))el('suggestions').classList.remove('open');});
document.querySelectorAll('.schip').forEach(chip=>{
  chip.addEventListener('click',()=>{el('searchInput').value=chip.dataset.q;doSearch(chip.dataset.q);});
});

renderCategories();
