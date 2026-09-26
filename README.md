# Nossa Sessão 🍿

App privado do Eduardo e da Laura: filmes com match do casal, música com player
próprio e playlists que vão pro Spotify / YouTube Music / Deezer, e IPTV pra
assistir junto.

## O que tem

**Filmes** — busca no TMDB, as 4 abas (Match, Sugeridos por cada um, Já
assistidos), sorteador com roleta, avaliação pós-filme com notas, tags e "quem
dormiu".

**Música** — busca no catálogo do YouTube Music e toca **dentro do app**:
áudio, videoclipe, letra, fila, download pra ouvir offline. As playlists são do
casal (sincronizam em tempo real entre os celulares) e podem ser mandadas
prontas pras plataformas.

**Exportar playlist** — na primeira vez a playlist é **criada** na plataforma;
depois, o mesmo botão só **acrescenta as músicas novas** na que já existe. O
`remote_id` fica guardado em `playlist_exports`, é isso que permite atualizar em
vez de criar cópias.

**TV** — carrega a lista do provedor (M3U ou Xtream), guia com busca e grupos,
player HLS e favoritos do casal.

**Ouvir/Assistir junto** — o play, a pausa e o ponto da música ou do filme ficam
iguais nos dois celulares.

## Rodando localmente

```bash
npm install
cd server && npm install && cd ..

cp .env.example .env              # frontend
cp server/.env.example server/.env # backend

npm run dev      # sobe o site (5173) e a API (3001) juntos
```

O `yt-dlp` precisa estar disponível pra tocar música:

```bash
pip install -U yt-dlp
```

## Como a música funciona por baixo

A busca usa o **InnerTube** (a API interna do próprio YouTube Music) — é rápida
e devolve capa, álbum e duração.

O stream é resolvido pelo **yt-dlp**. Motivo: o endpoint `/player` do YouTube
hoje exige PoToken e devolve 400 pra todos os clientes do InnerTube. O yt-dlp
acompanha essas mudanças semana a semana, então vale a dependência.

A URL que sai de lá é assinada e **amarrada ao IP de quem pediu**, e não tem
CORS. Por isso o áudio passa por um proxy no backend (`/api/music/audio/:id`),
que repassa o header `Range` — é o que faz o seek funcionar e o que permite o
PWA guardar a faixa pra ouvir offline.

> Baixar e tocar áudio do YouTube fora do app deles contraria os termos de uso
> do YouTube. Isso aqui é um app privado de duas pessoas; fica o registro.

## Contas das plataformas

| Plataforma | Como conecta | Onde cadastrar |
|---|---|---|
| Spotify | OAuth normal | [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) — Redirect URI: `<PUBLIC_BASE_URL>/api/oauth/spotify/callback` |
| YouTube Music | OAuth do Google | [console.cloud.google.com](https://console.cloud.google.com) — ative a *YouTube Data API v3*, OAuth Client tipo *Web*, redirect: `<PUBLIC_BASE_URL>/api/oauth/google/callback` |
| Deezer | Cookie `arl` da conta | Não tem cadastro: a Deezer fechou o registro de apps novos |

**Sobre a Deezer.** Eles desativaram a criação de novas credenciais de API e não
deram previsão de reabrir, então o OAuth oficial não é uma opção — não existe
`client_id` pra pedir. O caminho que funciona é a API interna deles
(`gw-light.php`), autenticada pelo cookie `arl` da própria conta: dá pra criar e
atualizar playlist normalmente. Duas ressalvas: é API não documentada e pode
mudar sem aviso, e o `arl` vale como senha da conta — ele fica no Supabase, na
tabela `oauth_accounts`, que tem RLS ligado **sem nenhuma policy**, ou seja, o
app com a chave anon não lê nada de lá. Só o backend, com a service_role.

Cota do YouTube: 10.000 pontos/dia e cada faixa adicionada custa 50 → cerca de
200 músicas por dia. De sobra pro uso de vocês.

## Deploy

**Backend no Render** — `New > Blueprint`, aponta pro repositório: o
[render.yaml](render.yaml) cria os serviços. O build baixa o binário estático do
yt-dlp (já vem com Python embutido, não precisa de runtime Python).

Depois do primeiro deploy, preencha na API `PUBLIC_BASE_URL` e `FRONTEND_URL`
com as URLs reais, e no frontend `VITE_API_URL` apontando pra API. O
`VITE_APP_TOKEN` tem que ser **igual** ao `APP_TOKEN` da API.

**Frontend** — pode ficar no Render (já está no blueprint) ou na Vercel. Se for
Vercel, apague o segundo serviço do `render.yaml`.

## Banco

As migrações estão em [supabase/migrations/](supabase/migrations/). A primeira
(filmes e música por link) está descrita em
[planos/02-banco-de-dados-supabase.md](planos/02-banco-de-dados-supabase.md); a
segunda (playlists, export, IPTV e party) é o arquivo `0002_*.sql`.

## Estrutura

```
src/
  components/{movies,music,iptv,hero,common}/
  hooks/          useMovies, useStreamPlaylists, useIptv, useParty
  lib/            api.ts (cliente do backend), party.ts (sincronia), supabase, tmdb
  store/          useAppStore (UI), usePlayerStore (fila e player)
server/
  src/lib/        innertube (busca), ytdlp (stream), platforms/{spotify,youtube,deezer}
  src/routes/     music, iptv, oauth, export
```
