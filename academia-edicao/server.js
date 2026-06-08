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
  const has = (...terms) => terms.some(t => q.includes(t));
  const queries = new Set();

  // Sempre inclui a busca original do usuário como primeira query
  queries.add(q + ' tutorial português');

  // After Effects
  if (has('after effects','ae ','after effect','motion design','motion graphics','vinheta','intro'))
    queries.add('after effects tutorial português 2024');
  if (has('keyframe','keyframes','animação','animar','easing','timing','spacing'))
    queries.add('after effects keyframes animação tutorial português');
  if (has('mascara','máscara','mask','track matte','matte'))
    queries.add('after effects mascaras track matte tutorial português');
  if (has('shape','forma','morphing','trim path','trim paths'))
    queries.add('after effects shape layers trim paths tutorial português');
  if (has('tipografia','texto','text','kinetic','type'))
    queries.add('after effects tipografia animada kinetic type português');
  if (has('expressão','expressões','wiggle','loop','código','expression'))
    queries.add('after effects expressões wiggle loop tutorial português');
  if (has('chroma','fundo verde','tela verde','keying','keylight'))
    queries.add('after effects chroma key fundo verde tutorial português');
  if (has('vfx','particula','partícula','explosão','fogo','glitch','distorção'))
    queries.add('after effects vfx efeitos visuais partículas tutorial português');
  if (has('3d','camera','parallax','compositing','profundidade'))
    queries.add('after effects compositing 3d camera tutorial português');
  if (has('plugin','element 3d','trapcode','video copilot','optical flares'))
    queries.add('after effects plugins element 3d trapcode tutorial português');
  if (has('render','exportar','media encoder','codec','output'))
    queries.add('after effects render exportar tutorial português');

  // Premiere Pro
  if (has('premiere','pr ','premiere pro','edição de vídeo','editor','editar vídeo'))
    queries.add('premiere pro tutorial completo português 2024');
  if (has('corte','j-cut','l-cut','ripple','multicam','montagem'))
    queries.add('premiere pro tecnicas corte tutorial português');
  if (has('color','cor','lumetri','lut','gradação','look','grade'))
    queries.add('premiere pro lumetri color grading correção cor português');
  if (has('audio','áudio','som','mix','equaliz','noise','narração','voz'))
    queries.add('premiere pro audio mix equalizer tutorial português');
  if (has('legenda','subtitle','caption','srt','closed caption'))
    queries.add('premiere pro legendas subtitles tutorial português');
  if (has('transição','dissolve','warp','speed ramp','smooth','zoom'))
    queries.add('premiere pro transicoes transitions tutorial português');
  if (has('stabiliz','estabiliz','optical flow','slow motion','slow-mo'))
    queries.add('premiere pro warp stabilizer slowmotion tutorial português');
  if (has('dynamic link','round trip','integr'))
    queries.add('premiere after effects dynamic link tutorial português');
  if (has('exportar','export','h264','4k','youtube','instagram'))
    queries.add('premiere pro exportar render h264 youtube 4k português');

  // CapCut
  if (has('capcut','cap cut','celular','mobile','tiktok','reels','shorts'))
    queries.add('capcut tutorial completo português 2024 2025');
  if (has('beat','ritmo','sincroniz','música'))
    queries.add('capcut corte ritmo beat sync tutorial português');
  if (has('filtro','cor capcut','lut capcut'))
    queries.add('capcut color grading filtros luts tutorial português');
  if (has('ia','inteligência artificial','ai','tela verde capcut','sky replace'))
    queries.add('capcut ferramentas ia inteligencia artificial tutorial português');
  if (has('viral','viralizar','views','engajamento','algoritmo'))
    queries.add('capcut reels shorts viral tutorial português 2025');
  if (has('template','trend','tendência'))
    queries.add('capcut templates trend tutorial português 2025');

  // Genérico edição
  if (has('edição','editar','editor de vídeo','edit'))
    queries.add('edição de vídeo tutorial completo português 2024');
  if (has('youtube','canal','youtuber','monetiz'))
    queries.add('como editar vídeo para youtube tutorial português');

  // Fallback se nenhuma keyword bateu: usa a própria query ampliada
  if (queries.size === 1) {
    queries.add(q + ' after effects tutorial português');
    queries.add(q + ' premiere pro tutorial português');
    queries.add(q + ' capcut tutorial português');
  }

  return [...queries].slice(0, 6);
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
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
      `&q=${encodeURIComponent(q)}` +
      `&maxResults=${maxResults}` +
      `&relevanceLanguage=${encodeURIComponent(relevanceLanguage)}` +
      `&regionCode=BR&safeSearch=moderate&videoEmbeddable=true&order=relevance` +
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
