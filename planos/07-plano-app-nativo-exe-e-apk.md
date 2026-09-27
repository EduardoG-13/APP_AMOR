# 07 — Plano: transformar o Nossa Sessão em app nativo (.exe e .apk)

> **Para quem está lendo isto sem contexto nenhum.** Este documento é
> um repasse completo: o que o projeto é, o que já está construído, o
> que já quebrou e por quê, e o que precisa ser feito. Leia a seção
> **Armadilhas** antes de escrever qualquer linha — cada item ali
> custou horas de investigação e vai poupar o mesmo tanto.

---

## 1. O que é o projeto

App privado de um casal (Eduardo e Laura). Três áreas:

- **Filmes** — busca no TMDB, match do casal (só vira "match" quando os
  dois curtem), sorteador de roleta, avaliação pós-filme com notas de
  0 a 10, tags e "quem dormiu".
- **Música** — busca no catálogo do YouTube Music, player próprio
  (fila, videoclipe, letra sincronizada, download offline), playlists
  do casal, e export dessas playlists pro Spotify e pra Deezer.
- **TV (IPTV)** — lista do provedor do Eduardo, separada em ao vivo /
  filmes / séries, com séries agrupadas, favoritos e PIN no conteúdo
  adulto.

Atravessando tudo: **assistir e ouvir junto** (play, pausa e posição
sincronizados entre os dois aparelhos) e **continuar assistindo**
(volta no segundo onde pararam).

Não tem login. São duas pessoas; o "perfil ativo" é um botão no
cabeçalho, guardado no `localStorage`.

---

## 2. Por que virar app nativo

**Esta é a decisão que motivou o documento.** O backend existe quase
só para contornar limitações do navegador. Um app nativo não tem
essas limitações, então o backend deixa de ser necessário.

| Problema hoje | Causa medida | No app nativo |
|---|---|---|
| Música toca só 30s (prévia) | O YouTube recusa liberar o áudio para IP de datacenter. Testados **os 7 `player_client`** do yt-dlp a partir do Render: todos responderam `Failed to extract any player response`. Cookies de conta logada **também não resolveram** | Roda no IP residencial do usuário, que funciona (verificado) |
| Filme do IPTV não abre | O provedor responde **302** e redireciona pra outro host; o proxy devolve 500. Direto, o mesmo arquivo responde `206 video/mp4` | Toca direto do provedor, sem proxy |
| Lentidão no vídeo | Cada byte vai do provedor (Brasil) → Render (Oregon) → casa | Vai direto |
| Teto de 100 GB/mês | Vídeo atravessando o Render | Deixa de existir |

**O que continua precisando de servidor:** só o Supabase, que já
existe e é gratuito. A sincronia do "assistir junto" é Realtime
puro entre os clientes — não passa pelo backend. Os dados do casal
(filmes, notas, playlists, progresso) também são Supabase direto.

Conclusão: **o serviço do Render pode ser aposentado** depois que os
apps nativos existirem. Vale manter o site publicado como versão
reduzida para quando estiverem fora de casa.

---

## 3. Estado atual do código

### Stack

- **Frontend:** React 19 + TypeScript + Vite 8 + Tailwind 3 +
  TanStack Query + Zustand + framer-motion + hls.js + mpegts.js
- **Backend:** Node 22+ (ESM) + Express 4 + youtubei.js, com o
  binário do **yt-dlp** chamado por `spawn`
- **Banco:** Supabase (Postgres + Realtime + Storage)
- **Deploy atual:** Render (API `nossa-sessao-api`, site estático
  `nossa-sessao-web`), publicando da branch `main` do GitHub

### Árvore

```
src/
  components/
    common/    Header, ErrorBoundary, ProfileEditorModal
    hero/      HeroSection, ContinueWatching
    movies/    MovieCard, MovieList, MovieSearchModal,
               MovieRatingModal, MovieRouletteModal, MovieDetailsModal
    music/     MusicPlayer, MusicSection, PlaylistPanel,
               StreamSearchModal, ExportPlaylistModal,
               MusicTrackCard, AddMusicModal, EmbeddedPlayers
    iptv/      IPTVSection, IPTVPlayer, IptvGuide, IptvSourceForm
  hooks/       useMovies, useStreamPlaylists, useIptv, useParty,
               useWatchProgress, useCoupleProfiles, useMusic,
               useMovieSearch, useCoupleStats
  lib/         api.ts (cliente HTTP do backend), party.ts (sincronia),
               supabase.ts, tmdb.ts, songlink.ts, utils.ts
  store/       useAppStore (estado de UI), usePlayerStore (fila/player)
  types/       database.ts, streaming.ts, index.ts

server/src/
  index.js     Express, CORS, rotas, tratamento de erro
  env.js       lê server/.env e o .env da raiz (o da raiz como reserva)
  lib/
    innertube.js   busca no YouTube Music (funciona em qualquer IP)
    ytdlp.js       resolve o stream (é o que o datacenter barra)
    m3u.js         classificação de uma entrada da lista
    m3uStore.js    lista em fluxo → NDJSON em disco (ver Armadilha 5)
    hls.js         reescrita de manifesto + cache de segmentos
    lyrics.js      LRCLIB (letra sincronizada) + reserva no YT Music
    alternatives.js Deezer/Spotify pra prévia de 30s e links
    match.js       casamento de faixas entre plataformas
    platforms/     spotify.js, youtube.js, deezer.js
    supabase.js    cliente com service_role
    http.js        proxy com Range, guarda contra SSRF
  routes/      music, iptv, stream, oauth, export
  middleware/  auth.js (token compartilhado das rotas de mídia)
```

### Banco (15 tabelas, todas com RLS)

| Tabela | Para quê |
|---|---|
| `movies` | catálogo TMDB. Tem `media_type` ('movie'/'tv') — série e filme convivem. Único por `(tmdb_id, media_type)`. Guarda `iptv_stream_url` quando veio de um favorito da TV |
| `movie_watchlist` | quem quer ver o quê; `is_match` é coluna gerada |
| `movie_ratings` | notas, tags, "quem dormiu"; `average_rating` é gerada |
| `music_tracks`, `playlist_config` | módulo antigo de links Spotify/Deezer |
| `stream_playlists`, `stream_playlist_tracks` | playlists do casal |
| `playlist_exports` | **guarda o `remote_id` da playlist remota** — é o que permite *atualizar* em vez de criar cópia |
| `playlist_export_items` | faixa local → URI remota, evita duplicar |
| `oauth_accounts` | ⚠️ **tokens**. RLS ligado **sem nenhuma policy**: a chave anon não lê nada. Só o backend com service_role |
| `party_sessions` | último estado do assistir/ouvir junto |
| `iptv_sources`, `iptv_favorites` | listas do provedor e favoritos |
| `couple_profiles` | nome e foto de cada um (Storage: bucket `avatares`) |
| `watch_progress` | continuar assistindo |

Migrações aplicadas: a inicial (descrita em `02-banco-de-dados-supabase.md`),
`supabase/migrations/0002_*.sql`, mais três aplicadas direto via MCP —
`series_na_lista_e_perfis`, `continuar_assistindo`, `bucket_avatares`.
**O 0002 é o único com arquivo; as outras três não têm.** Vale gerar os
arquivos a partir do banco antes de mexer.

### Variáveis de ambiente

Nunca commitadas. `.env` (raiz, frontend `VITE_*` + as do backend como
reserva) e `server/.env`. Modelos em `.env.example` e
`server/.env.example`. Os valores reais estão no `.env` local do
Eduardo e no painel do Render.

```
VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_TMDB_API_KEY
VITE_RELATIONSHIP_START_DATE / VITE_API_URL / VITE_APP_TOKEN
SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET
APP_TOKEN / PUBLIC_BASE_URL / FRONTEND_URL / ALLOWED_ORIGINS
YTDLP_PATH / YTDLP_COOKIES / IPTV_USER_AGENT
```

---

## 4. Armadilhas já descobertas

**Leia tudo. Cada uma custou horas.**

### 1. O YouTube não é acessível de servidor

O endpoint `/player` do InnerTube exige **PoToken** e responde 400 pra
todos os clientes. Por isso o stream é resolvido pelo **yt-dlp**, que
acompanha essas mudanças. Mas de IP de datacenter nem o yt-dlp passa:
testados os 7 `player_client` e cookies de conta logada — nada.
**A busca funciona em qualquer IP** (endpoint diferente); só a
liberação do áudio é barrada. No app nativo isso desaparece.

### 2. O Spotify mudou a API em fevereiro de 2026

Desde 9 de março de 2026 os endpoints antigos de escrita respondem
**403** pra apps em modo de desenvolvimento:

```
POST /users/{id}/playlists   →  POST /me/playlists
POST /playlists/{id}/tracks  →  POST /playlists/{id}/items
GET  /playlists/{id}/tracks  →  GET  /playlists/{id}/items
```

E **a faixa agora vem no campo `item`, não `track`**. Pedir
`fields=items(track(uri))` devolve `{}` vazio — a playlist parece
vazia e o re-sync duplica tudo. Já corrigido em
`platforms/spotify.js`; não regrida.

### 3. A Deezer fechou o cadastro de apps

Não existe OAuth oficial para pedir. A integração usa a **API interna
`gw-light.php`** autenticada pelo cookie `arl` da conta, guardado em
`oauth_accounts`. É API não documentada e pode mudar. A busca de
faixa usa a API pública (`api.deezer.com`), que segue aberta e sem
token — é ela que dá a **prévia de 30s**.

### 4. Tailwind: o breakpoint `xs` não existe por padrão

Foi adicionado em `tailwind.config.ts` (`xs: '420px'`). Sem ele, todo
`hidden xs:block` fica **invisível em qualquer tela** — foi o que
sumiu com o nome da música no player por um bom tempo.

### 5. A lista de IPTV tem 218 mil entradas

Ler o arquivo como string, dar `split('\n')` e guardar 218 mil objetos
**estourou os 512 MB do Render** (`oomKilled`, três vezes), derrubando
junto tudo que passa pela API. A solução em `m3uStore.js`: baixar em
fluxo, gravar NDJSON em disco, manter na memória só contagem por
categoria e ficha das séries; as buscas varrem o arquivo.
**Processa 218.350 entradas em 24s.** No app nativo a memória é maior,
mas não volte ao array na memória — a abordagem em disco é melhor de
qualquer jeito.

Classificação atual dessa lista: 2.961 ao vivo · 17.301 filmes ·
198.088 episódios → **5.429 séries agrupadas** · 1.886 adultos.

### 6. Formatos de IPTV: cada um pede um player

- `.m3u8` → **hls.js**
- `.ts` puro → **mpegts.js** (o hls.js *não* lê, fica carregando pra
  sempre). Em URL no padrão Xtream `/live/user/senha/123.ts`, dá pra
  trocar a extensão pra `.m3u8` e usar HLS
- `.mp4` → direto no `<video>`
- `.mkv`/`.avi` → navegador nenhum toca. **No app nativo, resolve:**
  use um player que aguente (libVLC, ou ffmpeg remuxando)

Sempre tenha um **temporizador de desistência** (hoje 25s): sem ele o
player gira pra sempre e o usuário não sabe por quê.

### 7. Canal de Realtime com nome repetido derruba a tela

Dois componentes chamando `supabase.channel('mesmo-nome')` fazem o
segundo `.subscribe()` lançar, e sem error boundary a árvore React
inteira cai (tela preta). Todos os hooks usam `useId()` no nome do
canal. **Mantenha esse padrão.**

### 8. A sincronia do "junto" ignora o relógio dos aparelhos

De propósito. Dois celulares com horários diferentes gerariam um erro
fixo impossível de corrigir. Quem comanda reenvia a posição a cada 4s
e quem segue só corrige se passar de 1,2s de diferença
(`DRIFT_TOLERANCE_SEC`, `HEARTBEAT_MS` em `lib/party.ts`).
**Não "melhore" isso usando `Date.now()` dos dois lados.**

### 9. Camadas (z-index)

`header 30 < player 40 < modais 60 < editor de perfil 70`. Já houve o
caso do player cobrir o botão "Salvar" do modal de nota, e o sintoma
era "a avaliação não funciona".

### 10. Ler nota do banco é por `movie_id`

Houve um bug em que a leitura filtrava `movie_ratings` por `id` usando
ids de filme. Nunca casa, e como a consulta volta **vazia sem erro**, a
nota salvava e sumia na tela. Corrigido, mas é o tipo de coisa que
volta.

### 11. `verbatimModuleSyntax` está ligado

Importar tipo sem `import type` compila, mas **quebra em runtime**
(`does not provide an export named ...`).

---

## 5. Plano do `.exe` (fazer primeiro)

**Por quê primeiro:** maior ganho, menor esforço. O servidor já é Node
— ele passa a rodar *dentro* do app, na máquina do usuário.

### Abordagem

**Electron** (e não Tauri): o backend é Node e roda no processo main
sem reescrita. Tauri obrigaria a portar tudo pra Rust ou embarcar um
Node à parte.

### Passos

1. **Estrutura**
   - `electron/main.js` — cria a janela, sobe o Express numa porta
     livre (`0` e lê a porta atribuída), aponta o front pra ela
   - `electron/preload.js` — expõe o mínimo por `contextBridge`
   - Manter `nodeIntegration: false` e `contextIsolation: true`

2. **Servidor embutido**
   - Importar `server/src/index.js`, mas **exportando o `app`** em vez
     de chamar `listen` direto (refatorar: `createApp()` + `start()`)
   - Porta dinâmica, e o front recebe a URL via preload
   - `ALLOWED_ORIGINS` deixa de importar; use origem `file://` ou
     sirva o front pelo próprio Express

3. **yt-dlp embutido**
   - Baixar `yt-dlp.exe` no passo de build e empacotar em
     `extraResources`
   - Apontar `YTDLP_PATH` pro caminho dentro do pacote
     (`process.resourcesPath`)
   - **Atualização automática:** rodar `yt-dlp -U` na inicialização,
     em segundo plano. O YouTube muda as defesas com frequência e o
     yt-dlp desatualiza rápido

4. **IPTV sem proxy**
   - Em Electron não há CORS: o `<video>` pode apontar **direto** pra
     URL do provedor
   - Criar um sinalizador (ex.: `isNative`) em `lib/api.ts` e fazer
     `iptvStreamUrl()` devolver a URL crua quando nativo
   - Isso resolve o 302 dos filmes e acaba com o gargalo
   - Para `.mkv`, avaliar embarcar libVLC (`webchimera`) ou remuxar
     com ffmpeg. Decidir só se aparecer MKV na lista

5. **Variáveis de ambiente**
   - Não dá pra pedir `.env` pro usuário final. Ter uma **tela de
     configurações** que grava em `app.getPath('userData')`
   - Embutir só o que é público (URL e chave anon do Supabase, chave
     do TMDB). **Nunca** embutir a `service_role`

   > ⚠️ **Atenção de segurança.** Hoje o export de playlist usa a
   > `service_role` no backend porque `oauth_accounts` é trancada. Num
   > app distribuído, embutir essa chave entregaria o banco inteiro.
   > Duas saídas: (a) manter o export rodando no Render, que é leve e
   > não tem o problema de IP; ou (b) mover para uma **Edge Function**
   > do Supabase, que guarda o segredo do lado do servidor. **A (a) é
   > a mais simples e é a recomendada.**

6. **Empacotamento**
   - `electron-builder`, alvo NSIS, x64
   - Ícone a partir de `public/pwa-icon.svg`
   - Sem assinatura de código o Windows SmartScreen vai avisar; para
     dois usuários, tudo bem

7. **Verificação** — o app só está pronto quando:
   - [ ] Tocar uma música inteira (não 30s)
   - [ ] Abrir o videoclipe
   - [ ] Abrir um filme do IPTV que hoje dá 500
   - [ ] Assistir junto sincronizando com o celular/web do outro
   - [ ] Exportar playlist pro Spotify sem duplicar ao repetir

---

## 6. Plano do `.apk` (depois)

⚠️ **Confirmar antes:** se a Laura usar **iPhone**, o `.apk` não serve
e não dá pra instalar fora da App Store — o caminho dela continuaria
sendo o PWA. Essa pergunta ficou em aberto.

### Abordagem

**Capacitor**, que embrulha o mesmo app React.

### O que funciona bem

- **IPTV**: sozinho, sem servidor. Sem trava de CORS, e o Android toca
  HLS, TS e MP4 nativamente. Use `@capacitor/http` (ou `CapacitorHttp`)
  pra baixar a lista M3U sem CORS
- **Supabase**: idêntico ao web, inclusive o Realtime do assistir junto
- **Filmes/TMDB**: idêntico

### O ponto difícil: música

O yt-dlp é Python e **não roda em Android**. Três caminhos, do mais
barato ao mais caro:

1. **Falar com o PC** — o app do celular aponta pro `.exe` rodando na
   rede local. Zero código novo de extração; exige o PC ligado
2. **NewPipeExtractor** — biblioteca Java mantida exatamente pra isso.
   Vira um plugin Capacitor nativo. Funciona, é trabalho de verdade
3. **Chaquopy** (Python no Android rodando yt-dlp) — pesado, +50 MB no
   APK e lento. Não recomendado

**Sugestão:** entregar o APK com IPTV completo e música pelo caminho 1;
avaliar o 2 depois, com uso real na mão.

### Detalhes do Android

- Streams de IPTV costumam ser **HTTP puro**: precisa de
  `android:usesCleartextTraffic="true"` no manifesto
- Reprodução em segundo plano (música com a tela apagada) exige
  *foreground service* + `MediaSession`
- O player web atual já usa a Media Session API, então os controles na
  tela de bloqueio devem funcionar

---

## 7. O que não pode quebrar

1. **A sincronia do assistir/ouvir junto** — é o coração do app. Web,
   `.exe` e `.apk` têm que sincronizar **entre si**, e isso funciona
   porque todos falam com o mesmo Supabase. Não crie um protocolo
   paralelo
2. **A identidade do canal de IPTV é o NOME, não a URL** — cada um tem
   a própria lista, com credenciais próprias. A URL de um não funciona
   no outro. Quem recebe procura o nome na lista dele
3. **`playlist_exports.remote_id`** — é o que faz "atualizar" em vez de
   "criar outra playlist"
4. **`oauth_accounts` nunca no cliente**
5. **Mesmo banco entre as versões** — dá pra assistir junto com um no
   `.exe` e o outro no celular

---

## 8. Pendências conhecidas

- **Filme do IPTV dá 500 no proxy** (o 302 do provedor). Deixado de
  lado de propósito: some no app nativo, que não usa proxy. Se for
  consertar o web, investigue `routes/stream.js` no caminho com Range
- **Música publicada toca só 30s** (prévia da Deezer + links). É o
  comportamento esperado enquanto for servidor
- **Export pro YouTube Music** está pronto no backend
  (`platforms/youtube.js`) mas escondido na interface: exige projeto no
  Google Cloud e o dono não quis
- **Três migrações sem arquivo** (ver seção 3)
- **PWA só instala em HTTPS** — no acesso por IP local não aparece

---

## 9. Como rodar hoje

```bash
npm install
cd server && npm install && cd ..
pip install -U yt-dlp          # necessário pra música
cp .env.example .env            # preencher
cp server/.env.example server/.env

npm run dev                     # site (5173) + API (3001), com --host
```

Publicado: `https://nossa-sessao-web.onrender.com` (site) e
`https://nossa-sessao-api.onrender.com` (API), branch `main`,
deploy automático a cada push.

---

## 10. Ordem sugerida de trabalho

1. Gerar os arquivos das três migrações que faltam
2. Refatorar `server/src/index.js` em `createApp()` + `start()`
3. Electron: janela + servidor embutido + yt-dlp empacotado
4. Sinalizador `isNative` e IPTV direto, sem proxy
5. Tela de configurações gravando em `userData`
6. Empacotar com electron-builder e rodar a lista de verificação
7. Só então decidir o Android, sabendo se a Laura é Android ou iPhone
