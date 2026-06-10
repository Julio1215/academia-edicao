import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// ── CSP ──────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:    ["'self'"],
        scriptSrc:     ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.youtube.com", "https://www.youtube-nocookie.com", "https://s.ytimg.com"],
        styleSrc:      ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc:       ["'self'", "data:", "https://fonts.gstatic.com"],
        imgSrc:        ["'self'", "data:", "blob:", "https://img.youtube.com", "https://i.ytimg.com", "https://*.ytimg.com"],
        frameSrc:      ["'self'", "https://www.youtube.com", "https://youtube.com", "https://www.youtube-nocookie.com"],
        frameAncestors:["'self'"],
        connectSrc:    ["'self'", "https://www.googleapis.com", "https://www.youtube.com", "https://*.youtube.com", "https://suggestqueries.google.com"],
        mediaSrc:      ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com", "blob:"],
        workerSrc:     ["'self'", "blob:"],
        objectSrc:     ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy:   false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(express.static("public"));

// ══════════════════════════════════════════════════════════════════════
//  CACHE EM DISCO — salva resultados em cache.json por 24h
//  As 31 categorias gastam cota só UMA vez por dia.
//  Se a cota esgotar, serve o cache expirado em vez de tela vazia.
// ══════════════════════════════════════════════════════════════════════
const CACHE_FILE     = path.join(__dirname, "cache.json");
const CACHE_TTL_MEM  = 1000 * 60 * 5;           // memória: 5 min
const CACHE_TTL_DISK = 1000 * 60 * 60 * 24;     // disco:   24h

const memCache = new Map();
let diskCache  = {};

// Carrega cache do disco ao iniciar
try {
  if (fs.existsSync(CACHE_FILE)) {
    diskCache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    const total = Object.keys(diskCache).length;
    const valid = Object.values(diskCache).filter(v => Date.now() < v.expiresAt).length;
    console.log(`📦 Cache carregado: ${total} entradas (${valid} válidas)`);
  }
} catch (e) {
  console.warn("⚠ Cache corrompido, reiniciando:", e.message);
  diskCache = {};
}

function saveDiskCache() {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(diskCache), "utf8"); }
  catch (e) { console.warn("⚠ Erro ao salvar cache:", e.message); }
}

function getCache(key) {
  // 1. Memória (mais rápido)
  const mem = memCache.get(key);
  if (mem && Date.now() < mem.expiresAt) return mem.value;
  // 2. Disco
  const disk = diskCache[key];
  if (disk && Date.now() < disk.expiresAt) {
    memCache.set(key, { value: disk.value, expiresAt: Date.now() + CACHE_TTL_MEM });
    return disk.value;
  }
  return null;
}

function setCache(key, value, ttl = CACHE_TTL_DISK) {
  memCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MEM });
  diskCache[key] = { value, expiresAt: Date.now() + ttl };
  saveDiskCache();
}

// ── HELPERS ──────────────────────────────────────────────────────────
function normalizeQuery(q = "") { return String(q).trim().slice(0, 200); }

async function fetchJson(url, options = {}) {
  const res  = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}

// ── QUERIES DE BUSCA ─────────────────────────────────────────────────
function buildSearchQueries(prompt) {
  const q   = normalizeQuery(prompt).toLowerCase();
  const has = (...terms) => terms.some(t => q.includes(t));
  const queries = new Set();

  queries.add(q + " tutorial português");

  if (has("after effects","ae ","motion design","motion graphics","vinheta","intro"))
    queries.add("after effects tutorial português 2024");
  if (has("keyframe","animação","animar","easing","timing"))
    queries.add("after effects keyframes animação tutorial português");
  if (has("mascara","máscara","mask","track matte","matte"))
    queries.add("after effects mascaras track matte tutorial português");
  if (has("shape","morphing","trim path"))
    queries.add("after effects shape layers trim paths tutorial português");
  if (has("tipografia","texto","kinetic","type"))
    queries.add("after effects tipografia animada kinetic type português");
  if (has("expressão","expressões","wiggle","loop","expression"))
    queries.add("after effects expressões wiggle loop tutorial português");
  if (has("chroma","fundo verde","tela verde","keying","keylight"))
    queries.add("after effects chroma key fundo verde tutorial português");
  if (has("vfx","particula","partícula","explosão","fogo","glitch"))
    queries.add("after effects vfx efeitos visuais partículas tutorial português");
  if (has("3d","camera","parallax","compositing"))
    queries.add("after effects compositing 3d camera tutorial português");
  if (has("plugin","element 3d","trapcode"))
    queries.add("after effects plugins element 3d trapcode tutorial português");
  if (has("render","exportar","media encoder","codec"))
    queries.add("after effects render exportar tutorial português");
  if (has("premiere","edição de vídeo","editar vídeo"))
    queries.add("premiere pro tutorial completo português 2024");
  if (has("corte","j-cut","l-cut","ripple","multicam"))
    queries.add("premiere pro tecnicas corte tutorial português");
  if (has("color","cor","lumetri","lut","gradação"))
    queries.add("premiere pro lumetri color grading correção cor português");
  if (has("audio","áudio","som","mix","equaliz","narração"))
    queries.add("premiere pro audio mix equalizer tutorial português");
  if (has("legenda","subtitle","caption","srt"))
    queries.add("premiere pro legendas subtitles tutorial português");
  if (has("transição","dissolve","warp","speed ramp"))
    queries.add("premiere pro transicoes transitions tutorial português");
  if (has("stabiliz","estabiliz","optical flow","slow motion"))
    queries.add("premiere pro warp stabilizer slowmotion tutorial português");
  if (has("exportar","export","h264","4k"))
    queries.add("premiere pro exportar render h264 youtube 4k português");
  if (has("capcut","cap cut","tiktok","reels","shorts"))
    queries.add("capcut tutorial completo português 2024 2025");
  if (has("beat","ritmo","sincroniz","música"))
    queries.add("capcut corte ritmo beat sync tutorial português");
  if (has("viral","viralizar","views","engajamento"))
    queries.add("capcut reels shorts viral tutorial português 2025");
  if (has("template","trend","tendência"))
    queries.add("capcut templates trend tutorial português 2025");
  if (has("edição","editar","editor de vídeo"))
    queries.add("edição de vídeo tutorial completo português 2024");

  if (queries.size === 1) {
    queries.add(q + " after effects tutorial português");
    queries.add(q + " premiere pro tutorial português");
    queries.add(q + " capcut tutorial português");
  }

  return [...queries].slice(0, 6);
}

// ── ROTAS ────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  const total = Object.keys(diskCache).length;
  const valid = Object.values(diskCache).filter(v => Date.now() < v.expiresAt).length;
  res.json({
    ok: true,
    time: new Date().toISOString(),
    cache: { total, valid, file: CACHE_FILE },
    apiKey: YOUTUBE_API_KEY ? "configurada ✓" : "NÃO configurada ✗",
  });
});

// Limpa cache (força rebusca de tudo)
app.post("/api/cache/clear", (_req, res) => {
  memCache.clear();
  diskCache = {};
  saveDiskCache();
  console.log("🗑 Cache limpo");
  res.json({ ok: true, message: "Cache limpo. Próximas buscas irão ao YouTube." });
});

// Status do cache
app.get("/api/cache/status", (_req, res) => {
  const entries = Object.entries(diskCache).map(([key, val]) => ({
    key:       key.slice(0, 60),
    valid:     Date.now() < val.expiresAt,
    expiresIn: Math.round((val.expiresAt - Date.now()) / 1000 / 60) + " min",
    items:     val.value?.items?.length ?? "—",
  }));
  res.json({ total: entries.length, entries });
});

// Sugestões autocomplete
app.get("/api/suggest", async (req, res) => {
  try {
    const q = normalizeQuery(req.query.q);
    if (!q) return res.json({ items: [] });
    const key    = `suggest:${q}`;
    const cached = getCache(key);
    if (cached) return res.json(cached);
    const url  = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`;
    const data = await fetchJson(url);
    const items = Array.isArray(data?.[1]) ? data[1].slice(0, 8) : [];
    const payload = { items };
    setCache(key, payload, 1000 * 60 * 60 * 6); // cache 6h
    res.json(payload);
  } catch {
    res.json({ items: [] });
  }
});

// ── BUSCA YOUTUBE — cache 24h ─────────────────────────────────────────
app.get("/api/youtube/search", async (req, res) => {
  const q          = normalizeQuery(req.query.q);
  const pageToken  = normalizeQuery(req.query.pageToken);
  const maxResults = Math.min(parseInt(req.query.maxResults || "12", 10), 25);
  const lang       = normalizeQuery(req.query.lang || "pt-BR");

  if (!q) return res.json({ items: [], nextPageToken: null });

  const cacheKey = `yt:${q}:${pageToken}:${maxResults}:${lang}`;

  // Cache válido → responde sem gastar cota
  const cached = getCache(cacheKey);
  if (cached) {
    console.log(`💾 Cache: ${q.slice(0, 50)}`);
    return res.json(cached);
  }

  if (!YOUTUBE_API_KEY)
    return res.status(500).json({ error: "YOUTUBE_API_KEY não configurada no .env" });

  try {
    console.log(`🔍 YouTube API: ${q.slice(0, 60)}`);

    const url =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
      `&q=${encodeURIComponent(q)}` +
      `&maxResults=${maxResults}` +
      `&relevanceLanguage=${encodeURIComponent(lang)}` +
      `&regionCode=BR&safeSearch=moderate&videoEmbeddable=true&order=relevance` +
      `${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}` +
      `&key=${YOUTUBE_API_KEY}`;

    const data  = await fetchJson(url);
    const items = (data.items || []).map(it => ({
      id:           it.id.videoId,
      title:        it.snippet.title,
      channelTitle: it.snippet.channelTitle,
      description:  it.snippet.description,
      publishedAt:  it.snippet.publishedAt,
      thumbnail:    it.snippet.thumbnails?.medium?.url ||
                    `https://img.youtube.com/vi/${it.id.videoId}/mqdefault.jpg`,
    }));

    const payload = { items, nextPageToken: data.nextPageToken || null };
    setCache(cacheKey, payload, CACHE_TTL_DISK); // salva 24h
    console.log(`✓ ${items.length} vídeos cacheados: ${q.slice(0, 40)}`);
    res.json(payload);

  } catch (err) {
    console.error("Erro YouTube:", err.message);

    // Cota esgotada → serve cache expirado se existir (melhor que vazio)
    if (err.message.includes("Quota exceeded")) {
      const stale = diskCache[cacheKey];
      if (stale) {
        console.log(`⚡ Cota esgotada, servindo cache expirado: ${q.slice(0, 40)}`);
        return res.json({ ...stale.value, stale: true });
      }
      return res.json({
        items: [],
        nextPageToken: null,
        error: "Cota da API esgotada. Os vídeos voltam amanhã automaticamente.",
      });
    }

    res.json({ items: [], nextPageToken: null, error: err.message });
  }
});

// Verificação de embed
app.get("/api/youtube/embeddable", async (req, res) => {
  try {
    if (!YOUTUBE_API_KEY) return res.json({ embeddable: true });
    const id  = normalizeQuery(req.query.id);
    if (!id)   return res.json({ embeddable: false });
    const key  = `embed:${id}`;
    const cached = getCache(key);
    if (cached !== null) return res.json(cached);
    const url  = `https://www.googleapis.com/youtube/v3/videos?part=status&id=${encodeURIComponent(id)}&key=${YOUTUBE_API_KEY}`;
    const data = await fetchJson(url);
    const embeddable = data.items?.[0]?.status?.embeddable !== false;
    const payload = { embeddable };
    setCache(key, payload, 1000 * 60 * 60 * 24 * 7); // 7 dias
    res.json(payload);
  } catch {
    res.json({ embeddable: true });
  }
});

// Detalhes em batch
app.get("/api/youtube/details", async (req, res) => {
  try {
    if (!YOUTUBE_API_KEY) return res.json({ items: [] });
    const ids = String(req.query.ids || "").split(",").map(x => x.trim()).filter(Boolean).slice(0, 25);
    if (!ids.length) return res.json({ items: [] });
    const key    = `yt-details:${ids.join(",")}`;
    const cached = getCache(key);
    if (cached) return res.json(cached);
    const url  = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${ids.join(",")}&key=${YOUTUBE_API_KEY}`;
    const data = await fetchJson(url);
    const items = (data.items || []).map(it => ({
      id:            it.id,
      title:         it.snippet?.title,
      channelTitle:  it.snippet?.channelTitle,
      thumbnail:     it.snippet?.thumbnails?.medium?.url,
      embeddable:    it.status?.embeddable !== false,
      privacyStatus: it.status?.privacyStatus || "public",
    }));
    const payload = { items };
    setCache(key, payload);
    res.json(payload);
  } catch {
    res.json({ items: [] });
  }
});

// Busca IA
function routeSearch(req, res, prompt) {
  const q = normalizeQuery(prompt || req.query.q || "");
  if (!q) return res.json({ queries: [] });
  return res.json({ queries: buildSearchQueries(q) });
}
app.get("/api/ai/search",  (req, res) => routeSearch(req, res, req.query.q));
app.post("/api/ai/search", (req, res) => routeSearch(req, res, req.body?.prompt));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno." });
});

app.listen(PORT, () => {
  console.log(`\n✓ Academia de Edição → http://localhost:${PORT}`);
  console.log(`📦 Cache: ${CACHE_FILE}`);
  console.log(`🔑 API Key: ${YOUTUBE_API_KEY ? "configurada ✓" : "NÃO configurada ✗"}\n`);
});
