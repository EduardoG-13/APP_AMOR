# 06 - Roteiro de Implementação e Checklist de Produção

## 1. Visão Geral das Fases de Desenvolvimento

Este roteiro detalha a execução prática do projeto em **7 fases sequenciais e testáveis**. Cada fase possui comandos prontos para terminal, arquivos a serem criados e critérios claros de aceitação.

```
Fase 1: Setup do Ambiente & Chaves de API
   │
   ▼
Fase 2: Inicialização do Projeto React + Vite + Tailwind + PWA
   │
   ▼
Fase 3: Execução do Banco de Dados no Supabase & Client SDK
   │
   ▼
Fase 4: Motor de Filmes, TMDB e Sistema de Listas
   │
   ▼
Fase 5: Lógica de Match, Sorteador Animado & Avaliações
   │
   ▼
Fase 6: Integração de Música (Spotify + Deezer via Odesli)
   │
   ▼
Fase 7: Deploy em Produção (Vercel/Netlify) & Teste no Celular (PWA)
```

---

## 2. Passo a Passo Detalhado por Fase

### Fase 1: Setup do Ambiente e Credenciais Externas
- [ ] **Supabase**:
  - Acessar [supabase.com](https://supabase.com), criar um novo projeto (ex: `nossa-sessao`).
  - Copiar `Project URL` e `anon public API Key` em *Settings > API*.
- [ ] **TMDB (The Movie Database)**:
  - Criar conta gratuita em [themoviedb.org](https://www.themoviedb.org/signup).
  - Ir em *Configurações > API* e solicitar chave de API de desenvolvedor (gratuita e liberada na hora).
  - Copiar a **API Key (v3 auth)**.
- [ ] Criar o arquivo `.env` na raiz do projeto:
  ```env
  VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  VITE_TMDB_API_KEY=sua_chave_tmdb_aqui
  ```

---

### Fase 2: Inicialização do Frontend e Dependências

Comandos de terminal para criar a estrutura pronta para produção:

```bash
# 1. Criar aplicação com Vite e template React + TypeScript
npm create vite@latest . -- --template react-ts

# 2. Instalar dependências principais do projeto
npm install @supabase/supabase-js @tanstack/react-query zustand lucide-react framer-motion canvas-confetti clsx tailwind-merge

# 3. Instalar tipagens de desenvolvimento
npm install -D @types/canvas-confetti @types/node

# 4. Configurar Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 5. Instalar plugin PWA (para instalar no celular como app)
npm install -D vite-plugin-pwa
```

---

### Fase 3: Execução do Banco no Supabase & Conexão

1. Abrir o **SQL Editor** do Supabase.
2. Copiar todo o conteúdo do arquivo **`planos/02-banco-de-dados-supabase.md`** e clicar em **Run**.
3. **Critério de Aceitação da Fase 3**:
   - As tabelas `movies`, `movie_watchlist`, `movie_ratings`, `music_tracks` e `playlist_config` aparecem listadas no *Table Editor*.
   - A função RPC `get_random_match_movie` aparece em *Database > Functions*.
   - A publicação `supabase_realtime` possui as tabelas ativas em *Database > Publications*.

---

### Fase 4: Implementação do Catálogo de Filmes e TMDB

1. **Cliente TMDB (`src/lib/tmdb.ts`)**:
   - Função `searchMovies(query: string)`
   - Função `getMovieDetails(tmdbId: number)`
2. **Hook de Busca com Debounce (`src/hooks/useMovieSearch.ts`)**:
   - Delay de 300ms entre as teclas.
3. **Modal de Pesquisa (`src/components/movies/MovieSearchModal.tsx`)**:
   - Exibição de pôster, título, ano e botão `[ + Quero Assistir ]`.
4. **Inserção no Supabase**:
   - Gravação simultânea na tabela `movies` e na `movie_watchlist` vinculada ao perfil ativo (`wanted_by_eduardo` ou `wanted_by_laura`).

---

### Fase 5: O "Match do Casal", Sorteador e Avaliação

1. **Detecção do Match**:
   - Quando o parceiro clica em `[ Quero também! ]`, atualiza o registro existente no Supabase.
   - A coluna computada `is_match` passa para `true`.
   - Disparo do efeito de confetes na tela via `canvas-confetti`.
2. **Sorteador "O que ver hoje? 🎲"**:
   - Componente `MovieRouletteModal.tsx` com animação via `framer-motion`.
   - Consulta apenas os itens onde `is_match = true` e `is_watched = false`.
3. **Modal de Avaliação (`RatingModal.tsx`)**:
   - Sliders de 0 a 10 com preview da média do casal.
   - Seletor de "Quem Dormiu?" e nuvem de tags de humor.
   - Atualiza `is_watched = true` e registra data e comentários.

---

### Fase 6: Módulo de Música (Spotify + Deezer)

1. **Cliente Songlink (`src/lib/songlink.ts`)**:
   - Função que recebe o link colado e resolve os metadados via API `api.song.link`.
2. **Card de Música (`MusicTrackCard.tsx`)**:
   - Renderiza a capa do álbum, título, artista e os botões duplos:
     - `[ 🟢 Ouvir no Spotify ]`
     - `[ 🟣 Ouvir no Deezer ]`
3. **Aba de Playlists Fixas (`EmbeddedPlayers.tsx`)**:
   - Iframes embutidos do Spotify e Deezer com alternador limpo.

---

### Fase 7: Publicação em Produção & Instalação no Celular (PWA)

1. **Configuração PWA no `vite.config.ts`**:
   - Ativar `VitePWA` com manifesto que define nome ("Nossa Sessão"), cores de fundo e tema escuro.
2. **Subida para o GitHub**:
   ```bash
   git init
   git add .
   git commit -m "feat: app filmes e musicas do casal"
   git branch -M main
   # Vincular ao repositório remoto criado no GitHub
   ```
3. **Deploy Gratuito na Vercel**:
   - Importar o repositório no painel da [Vercel](https://vercel.com).
   - Cadastrar as variáveis de ambiente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TMDB_API_KEY`).
   - Clicar em **Deploy**.
4. **Instalação no Celular**:
   - **No iPhone (Safari)**: Abrir o link, clicar no botão de compartilhar e selecionar **"Adicionar à Tela de Início"**.
   - **No Android (Chrome)**: Tocar nos três pontos e selecionar **"Instalar Aplicativo"**.
   - O app abre em tela cheia, sem barra de navegador, exatamente como um aplicativo nativo da App Store ou Play Store.

