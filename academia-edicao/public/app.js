import { useState, useEffect } from 'react';

function App() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // COLOQUE A SUA CHAVE E TERMO DE PESQUISA AQUI
  const API_KEY = "A_SUA_CHAVE_API_AQUI"; 
  const SEARCH_QUERY = "Programação React"; 

  // 1. Isolamos a função que faz o pedido à API do YouTube
  const fetchYouTubeVideos = async () => {
    // Evita fazer pedidos se a chave não estiver preenchida
    if (!API_KEY || API_KEY === "A_SUA_CHAVE_API_AQUI") return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=6&q=${encodeURIComponent(SEARCH_QUERY)}&type=video&key=${API_KEY}`
      );

      if (!response.ok) {
        throw new Error(`Erro na API do YouTube: ${response.status}`);
      }

      const data = await response.json();
      
      // Atualiza o estado APENAS quando a API responde com sucesso
      setVideos(data.items || []);
    } catch (err) {
      console.error("Erro ao carregar vídeos:", err);
      setError("Não foi possível carregar os vídeos do YouTube.");
    } finally {
      setLoading(false);
    }
  };

  // 2. O SEGREDO: O useEffect com o array vazio [] garante que a API
  // só é consultada UMA VEZ quando a página carrega.
  useEffect(() => {
    fetchYouTubeVideos();
  }, []); // <--- NUNCA remova estes colchetes vazios, eles param o loop!

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', minHeight: '100vh' }}>
      <h1 style={{ textAlign: 'center', color: '#ff0000' }}>Vídeos do YouTube</h1>

      {/* Estados de feedback ao utilizador */}
      {loading && <p style={{ textAlign: 'center' }}>A carregar vídeos...</p>}
      {error && <p style={{ textAlign: 'center', color: 'red' }}>{error}</p>}

      {/* Grid de renderização dos vídeos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '20px',
        marginTop: '20px'
      }}>
        {videos.map((video) => {
          const videoId = video.id.videoId;
          const { title, thumbnails } = video.snippet;

          // Se por algum motivo o id do vídeo não existir, ignora
          if (!videoId) return null;

          return (
            <div key={videoId} style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              padding: '10px'
            }}>
              {/* Container responsivo para o iframe não quebrar a proporção */}
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '6px' }}>
                <iframe
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                  src={`https://www.youtube.com/embed/${videoId}`}
                  title={title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              
              <h3 style={{ fontSize: '14px', marginTop: '10px', color: '#333', lineHeight: '1.4' }}>
                {title}
              </h3>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
