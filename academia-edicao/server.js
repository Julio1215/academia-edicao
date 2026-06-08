import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Helmet com CSP customizado (sintaxe compatível)
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "https://www.youtube.com", "https://www.googletagmanager.com"],
  scriptSrcElem: ["'self'", "'unsafe-inline'", "https://www.youtube.com"],
  imgSrc: ["'self'", "data:", "https://img.youtube.com", "https://i.ytimg.com", "https://www.youtube.com"],
  frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com"],
  frameAncestors: ["'self'", "https://www.youtube.com"],
  connectSrc: ["'self'", "https://www.googleapis.com", "https://www.youtube.com"]
};

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: cspDirectives
    }
  })
);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined"));
app.use(express.static("public"));

const cache = new Map();
const CACHE_TTL = 1000 * 60 * 5;

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCache(key, value, ttl = CACHE_TTL) {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

function normalizeQuery(q = "") {
  return String(q).trim().slice(0, 200);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function buildSearchQueries(prompt) {
  const q = normalizeQuery(prompt).toLowerCase();
  const has = (...terms) => terms.some((t) => q.includes(t));
  const base = [];

  if (has("after effects", "ae", "motion", "glitch", "texto", "intro", "vinheta")) {
    base.push("after effects tutorial curso gratuito");
  }
  if (has("premiere", "pr", "corte", "timeline", "legenda", "color", "edição")) {
    base.push("premiere pro tutorial curso gratuito");
  }
  if (has("capcut", "mobile", "celular", "reels", "shorts", "legenda")) {
    base.push("capcut tutorial curso gratuito");
  }
  if (has("transição", "transition", "efeito", "glow", "shake", "zoom")) {
    base.push("transição vídeo tutorial curso gratuito");
  }
  if (has("color", "cor", "lut", "gradação", "correção")) {
    base.push("correção de cor tutorial curso gratuito");
  }
  if (has("legenda", "subtitle", "caption", "srt", "texto animado")) {
    base.push("legenda vídeo tutorial curso gratuito");
  }
  if (has("thumbnail", "thumb", "miniatura")) {
    base.push("thumbnail tutorial curso gratuito");
  }
  if (has("exportar", "render", "codec", "mp4", "qualidade")) {
    base.push("exportar vídeo tutorial curso gratuito");
  }

  if (!base.length) {
    base.push(
      "edição de vídeo tutorial curso gratuito",
      "motion design tutorial curso gratuito",
      "after effects premiere capcut tutorial curso gratuito"
    );
  }

  return [...new Set(base)].slice(0, 5);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/api/suggest", async (req, res) => {
  try {
    const q = normalizeQuery(req.query.q);
    if (!q) return res.json({ items: [] });

    const cacheKey = `suggest:${q}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const url =
      `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`;
    const data = await fetchJson(url);
    const items = Array.isArray(data?.[1]) ? data[1].slice(0, 8) : [];

    const payload = { items };
    setCache(cacheKey, payload, 1000 * 60 * 10);
    res.json(payload);
  } catch {
    res.status(200).json({ items: [], error: "Sugestões indisponíveis no momento." });
  }
});

app.get("/api/youtube/search", async (req, res) => {
  try {
    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({ error: "YOUTUBE_API_KEY não configurada." });
    }

    const q = normalizeQuery(req.query.q);
    const pageToken = normalizeQuery(req.query.pageToken);
    const maxResults = Math.min(parseInt(req.query.maxResults || "12", 10), 25);
    const relevanceLanguage = normalizeQuery(req.query.lang || "pt-BR");

    if (!q) return res.json({ items: [], nextPageToken: null });

    const cacheKey = `yt:${q}:${pageToken}:${maxResults}:${relevanceLanguage}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const url =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=26` +
      `&q=${encodeURIComponent(q)}` +
      `&maxResults=${maxResults}` +
      `&relevanceLanguage=${encodeURIComponent(relevanceLanguage)}` +
      `&regionCode=BR&safeSearch=moderate&videoEmbeddable=true` +
      `${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}` +
      `&key=${YOUTUBE_API_KEY}`;

    const data = await fetchJson(url);

    const items = (data.items || []).map((it) => ({
      id: it.id.videoId,
      title: it.snippet.title,
      channelTitle: it.snippet.channelTitle,
      description: it.snippet.description,
      publishedAt: it.snippet.publishedAt,
      thumbnail:
        it.snippet.thumbnails?.medium?.url ||
        it.snippet.thumbnails?.high?.url ||
        `https://img.youtube.com/vi/${it.id.videoId}/mqdefault.jpg`
    }));

    const payload = {
      items,
      nextPageToken: data.nextPageToken || null
    };

    setCache(cacheKey, payload, CACHE_TTL);
    res.json(payload);
  } catch (err) {
    console.error("Erro na busca YouTube:", err);
    res.status(200).json({
      items: [],
      nextPageToken: null,
      error: "Não foi possível buscar vídeos agora."
    });
  }
});

app.get("/api/youtube/details", async (req, res) => {
  try {
    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({ error: "YOUTUBE_API_KEY não configurada." });
    }

    const ids = String(req.query.ids || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 25);

    if (!ids.length) return res.json({ items: [] });

    const cacheKey = `yt-details:${ids.join(",")}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${ids.join(",")}&key=${YOUTUBE_API_KEY}`;

    const data = await fetchJson(url);
    const items = (data.items || []).map((it) => ({
      id: it.id,
      title: it.snippet?.title,
      channelTitle: it.snippet?.channelTitle,
      thumbnail: it.snippet?.thumbnails?.medium?.url,
      embeddable: it.status?.embeddable !== false,
      privacyStatus: it.status?.privacyStatus || "public"
    }));

    const payload = { items };
    setCache(cacheKey, payload, CACHE_TTL);
    res.json(payload);
  } catch {
    res.status(200).json({ items: [] });
  }
});

function routeSearch(req, res, prompt) {
  const q = normalizeQuery(prompt || req.query.q || "");
  if (!q) return res.json({ queries: [] });
  return res.json({ queries: buildSearchQueries(q) });
}

app.get("/api/ai/search", (req, res) => routeSearch(req, res, req.query.q));
app.post("/api/ai/search", (req, res) => routeSearch(req, res, req.body?.prompt));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno no servidor." });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
