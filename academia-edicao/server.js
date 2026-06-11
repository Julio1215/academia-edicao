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

// â”€â”€ CSP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  CACHE EM DISCO â€” salva resultados em cache.json por 24h
//  As 31 categorias gastam cota sÃ³ UMA vez por dia.
//  Se a cota esgotar, serve o cache expirado em vez de tela vazia.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const CACHE_FILE     = path.join(__dirname, "cache.json");
const CACHE_TTL_MEM  = 1000 * 60 * 5;           // memÃ³ria: 5 min
const CACHE_TTL_DISK = 1000 * 60 * 60 * 24;     // disco:   24h

const memCache = new Map();
const pendingRequests = new Map();
let diskCache  = {};

// Carrega cache do disco ao iniciar
try {
  if (fs.existsSync(CACHE_FILE)) {
    diskCache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    const total = Object.keys(diskCache).length;
    const valid = Object.values(diskCache).filter(v => Date.now() < v.expiresAt).length;
    console.log(`ðŸ“¦ Cache carregado: ${total} entradas (${valid} vÃ¡lidas)`);
  }
} catch (e) {
  console.warn("âš  Cache corrompido, reiniciando:", e.message);
  diskCache = {};
}

function saveDiskCache() {
  try {
    const tmp = `${CACHE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(diskCache), "utf8");
    fs.renameSync(tmp, CACHE_FILE);
  }
  catch (e) { console.warn("âš  Erro ao salvar cache:", e.message); }
}

function getCache(key) {
  // 1. MemÃ³ria (mais rÃ¡pido)
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

async function cachedRequest(key, ttl, loader) {
  const cached = getCache(key);
  if (cached !== null) return { value: cached, hit: true };

  if (pendingRequests.has(key)) {
    return { value: await pendingRequests.get(key), hit: true };
  }

  const request = loader().then(value => {
    setCache(key, value, ttl);
    return value;
  }).finally(() => pendingRequests.delete(key));

  pendingRequests.set(key, request);
  return { value: await request, hit: false };
}

// â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function normalizeQuery(q = "") { return String(q).trim().replace(/\s+/g, " ").slice(0, 200); }
function cachePart(q = "") { return normalizeQuery(q).toLowerCase(); }

async function fetchJson(url, options = {}) {
  const res  = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}

// â”€â”€ QUERIES DE BUSCA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildSearchQueries(prompt) {
  const q   = normalizeQuery(prompt).toLowerCase();
  const has = (...terms) => terms.some(t => q.includes(t));
  const queries = new Set();

  queries.add(q + " tutorial portuguÃªs");

  if (has("after effects","ae ","motion design","motion graphics","vinheta","intro"))
    queries.add("after effects tutorial portuguÃªs 2024");
  if (has("keyframe","animaÃ§Ã£o","animar","easing","timing"))
    queries.add("after effects keyframes animaÃ§Ã£o tutorial portuguÃªs");
  if (has("mascara","mÃ¡scara","mask","track matte","matte"))
    queries.add("after effects mascaras track matte tutorial portuguÃªs");
  if (has("shape","morphing","trim path"))
    queries.add("after effects shape layers trim paths tutorial portuguÃªs");
  if (has("tipografia","texto","kinetic","type"))
    queries.add("after effects tipografia animada kinetic type portuguÃªs");
  if (has("expressÃ£o","expressÃµes","wiggle","loop","expression"))
    queries.add("after effects expressÃµes wiggle loop tutorial portuguÃªs");
  if (has("chroma","fundo verde","tela verde","keying","keylight"))
    queries.add("after effects chroma key fundo verde tutorial portuguÃªs");
  if (has("vfx","particula","partÃ­cula","explosÃ£o","fogo","glitch"))
    queries.add("after effects vfx efeitos visuais partÃ­culas tutorial portuguÃªs");
  if (has("3d","camera","parallax","compositing"))
    queries.add("after effects compositing 3d camera tutorial portuguÃªs");
  if (has("plugin","element 3d","trapcode"))
    queries.add("after effects plugins element 3d trapcode tutorial portuguÃªs");
  if (has("render","exportar","media encoder","codec"))
    queries.add("after effects render exportar tutorial portuguÃªs");
  if (has("premiere","ediÃ§Ã£o de vÃ­deo","editar vÃ­deo"))
    queries.add("premiere pro tutorial completo portuguÃªs 2024");
  if (has("corte","j-cut","l-cut","ripple","multicam"))
    queries.add("premiere pro tecnicas corte tutorial portuguÃªs");
  if (has("color","cor","lumetri","lut","gradaÃ§Ã£o"))
    queries.add("premiere pro lumetri color grading correÃ§Ã£o cor portuguÃªs");
  if (has("audio","Ã¡udio","som","mix","equaliz","narraÃ§Ã£o"))
    queries.add("premiere pro audio mix equalizer tutorial portuguÃªs");
  if (has("legenda","subtitle","caption","srt"))
    queries.add("premiere pro legendas subtitles tutorial portuguÃªs");
  if (has("transiÃ§Ã£o","dissolve","warp","speed ramp"))
    queries.add("premiere pro transicoes transitions tutorial portuguÃªs");
  if (has("stabiliz","estabiliz","optical flow","slow motion"))
    queries.add("premiere pro warp stabilizer slowmotion tutorial portuguÃªs");
  if (has("exportar","export","h264","4k"))
    queries.add("premiere pro exportar render h264 youtube 4k portuguÃªs");
  if (has("capcut","cap cut","tiktok","reels","shorts"))
    queries.add("capcut tutorial completo portuguÃªs 2024 2025");
  if (has("beat","ritmo","sincroniz","mÃºsica"))
    queries.add("capcut corte ritmo beat sync tutorial portuguÃªs");
  if (has("viral","viralizar","views","engajamento"))
    queries.add("capcut reels shorts viral tutorial portuguÃªs 2025");
  if (has("template","trend","tendÃªncia"))
    queries.add("capcut templates trend tutorial portuguÃªs 2025");
  if (has("ediÃ§Ã£o","editar","editor de vÃ­deo"))
    queries.add("ediÃ§Ã£o de vÃ­deo tutorial completo portuguÃªs 2024");

  if (queries.size === 1) {
    queries.add(q + " after effects tutorial portuguÃªs");
    queries.add(q + " premiere pro tutorial portuguÃªs");
    queries.add(q + " capcut tutorial portuguÃªs");
  }

  return [...queries].slice(0, 6);
}

// â”€â”€ ROTAS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get("/health", (_req, res) => {
  const total = Object.keys(diskCache).length;
  const valid = Object.values(diskCache).filter(v => Date.now() < v.expiresAt).length;
  res.json({
    ok: true,
    time: new Date().toISOString(),
    cache: { total, valid, file: CACHE_FILE },
    apiKey: YOUTUBE_API_KEY ? "configurada âœ“" : "NÃƒO configurada âœ—",
  });
});

// Limpa cache (forÃ§a rebusca de tudo)
app.post("/api/cache/clear", (_req, res) => {
  memCache.clear();
  diskCache = {};
  saveDiskCache();
  console.log("ðŸ—‘ Cache limpo");
  res.json({ ok: true, message: "Cache limpo. PrÃ³ximas buscas irÃ£o ao YouTube." });
});

// Status do cache
app.get("/api/cache/status", (_req, res) => {
  const entries = Object.entries(diskCache).map(([key, val]) => ({
    key:       key.slice(0, 60),
    valid:     Date.now() < val.expiresAt,
    expiresIn: Math.round((val.expiresAt - Date.now()) / 1000 / 60) + " min",
    items:     val.value?.items?.length ?? "â€”",
  }));
  res.json({ total: entries.length, entries });
});

// SugestÃµes autocomplete
app.get("/api/suggest", async (req, res) => {
  try {
    const q = normalizeQuery(req.query.q);
    if (!q) return res.json({ items: [] });
    const key = `suggest:${cachePart(q)}`;
    const { value } = await cachedRequest(key, 1000 * 60 * 60 * 6, async () => {
      const url  = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`;
      const data = await fetchJson(url);
      const items = Array.isArray(data?.[1]) ? data[1].slice(0, 8) : [];
      return { items };
    });
    res.json(value);
  } catch {
    res.json({ items: [] });
  }
});

// â”€â”€ BUSCA YOUTUBE â€” cache 24h â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/youtube/search", async (req, res) => {
  const q          = normalizeQuery(req.query.q);
  const pageToken  = normalizeQuery(req.query.pageToken);
  const maxResults = Math.min(parseInt(req.query.maxResults || "12", 10), 25);
  const lang       = normalizeQuery(req.query.lang || "pt-BR");

  if (!q) return res.json({ items: [], nextPageToken: null });

  const cacheKey = `yt:${cachePart(q)}:${cachePart(pageToken)}:${maxResults}:${cachePart(lang)}`;

  // Cache vÃ¡lido â†’ responde sem gastar cota
  const cached = getCache(cacheKey);
  if (cached) {
    console.log(`ðŸ’¾ Cache: ${q.slice(0, 50)}`);
    return res.json(cached);
  }

  if (!YOUTUBE_API_KEY)
    return res.status(500).json({ error: "YOUTUBE_API_KEY nÃ£o configurada no .env" });

  try {
    console.log(`ðŸ” YouTube API: ${q.slice(0, 60)}`);

    const url =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
      `&q=${encodeURIComponent(q)}` +
      `&maxResults=${maxResults}` +
      `&relevanceLanguage=${encodeURIComponent(lang)}` +
      `&regionCode=BR&safeSearch=moderate&videoEmbeddable=true&order=relevance` +
      `${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}` +
      `&key=${YOUTUBE_API_KEY}`;

    const { value: payload, hit } = await cachedRequest(cacheKey, CACHE_TTL_DISK, async () => {
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

      return { items, nextPageToken: data.nextPageToken || null };
    });
    if (!hit) console.log(`✓ ${payload.items.length} vídeos cacheados: ${q.slice(0, 40)}`);
    res.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.json(payload);

  } catch (err) {
    console.error("Erro YouTube:", err.message);

    const stale = diskCache[cacheKey];
    if (stale) {
      console.log(`⚡ Erro na API, servindo cache expirado: ${q.slice(0, 40)}`);
      return res.json({ ...stale.value, stale: true });
    }

    if (err.message.includes("Quota exceeded")) {
      return res.json({
        items: [],
        nextPageToken: null,
        error: "Cota da API esgotada. Os vídeos voltam amanhã automaticamente.",
      });
    }

    res.json({ items: [], nextPageToken: null, error: err.message });
  }
});

// VerificaÃ§Ã£o de embed
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
  console.log(`\nâœ“ Academia de EdiÃ§Ã£o â†’ http://localhost:${PORT}`);
  console.log(`ðŸ“¦ Cache: ${CACHE_FILE}`);
  console.log(`ðŸ”‘ API Key: ${YOUTUBE_API_KEY ? "configurada âœ“" : "NÃƒO configurada âœ—"}\n`);
});


