# Academia de Edição

Plataforma de busca e reprodução de conteúdo do YouTube sobre edição de vídeo.

## Setup no GitHub Codespace

### 1. Configure as variáveis de ambiente
```bash
cp .env.example .env
# Edite .env e adicione sua YOUTUBE_API_KEY
```

### 2. Como obter a YouTube API Key
1. Acesse https://console.developers.google.com
2. Crie um projeto
3. Ative **YouTube Data API v3**
4. Crie uma credencial → **Chave de API**
5. Cole no `.env`

### 3. Instale dependências e rode
```bash
npm install
npm start
```

O servidor sobe na porta `4000`. No Codespace, aparecerá um link para abrir no navegador.

## Funcionalidades

- **Busca real no YouTube** — pesquise qualquer tema de edição de vídeo
- **Autocomplete** — sugestões ao digitar
- **Chips de busca rápida** — tópicos populares com 1 clique
- **30 tópicos** carregados automaticamente (AE, Premiere, CapCut)
- **Player embutido** com auto-substituição de vídeos bloqueados
- **Barra de progresso** — marque aulas como concluídas (salvo localmente)
- **Filtros por software** — After Effects, Premiere Pro, CapCut
- **Vista lista / grade**

## Estrutura
```
├── server.js          # Backend Express + rotas API
├── public/
│   ├── index.html     # HTML principal
│   ├── app.js         # Frontend (sem framework)
│   └── styles.css     # Estilos neon dark
├── .env.example       # Template de variáveis
└── package.json
```
