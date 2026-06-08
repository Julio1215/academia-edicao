# Academia de Edição — Do Zero ao Profissional em Vídeo

Plataforma de busca e reprodução de conteúdos do YouTube sobre edição de vídeo, com foco em **After Effects**, **Premiere Pro** e **CapCut**.

## Funcionalidades

- **Busca inteligente** com YouTube em tempo real
- **Autocomplete** de sugestões enquanto digita
- **Carregamento incremental** de vídeos
- **Player embutido** — assiste sem sair da página
- **Fallback automático** se o vídeo bloquear incorporação
- **Modo gratuito** sem necessidade de Claude ou APIs caras

## Tecnologias

- **Node.js** com Express (servidor)
- **YouTube Data API v3** (busca de vídeos)
- **Google Suggest API** (autocomplete)
- **HTML5 + CSS3 + JavaScript (ES2020)**
- **CORS, Helmet, Morgan, dotenv**

## Instalação

1. Clone o repositório:

   ```bash
   git clone https://github.com/Julio1215/academia-edicao.git
   cd academia-edicao
   ```

2. Instale as dependências:

   ```bash
   npm install
   ```

3. Configure o `.env`:

   ```env
   PORT=4000
   YOUTUBE_API_KEY=sua_chave_youtube
   ```

   Substitua `sua_chave_youtube` pela chave real da YouTube Data API.

4. Rodar o servidor:

   ```bash
   node server.js
   ```

5. Acesse no navegador:

   ```text
   http://localhost:4000
   ```

## Estrutura do Projeto

```bash
academia-edicao/
  package.json
  server.js
  .env
  public/
    index.html
    styles.css
    app.js
```

## Uso

- Digite termos como:
  - `intro glitch After Effects`
  - `corte rápido no Premiere`
  - `transição CapCut`
- Navegue pelas categorias:
  - **Todos**
  - **After Effects**
  - **Premiere Pro**
  - **CapCut**
- Altere visualização:
  - **Lista**
  - **Grade**

## Autor

Julio1215

## Licença

Projeto pessoal para estudo e prática.