# 01 - Visão Geral, Arquitetura e Engenharia do Sistema

## 1. Escopo e Propósito do Produto
O **CineLove / Nossa Sessão** é uma Single Page Application (SPA) progressiva (PWA) de uso exclusivo para o casal **Eduardo & Laura**. O objetivo é transformar a rotina de entretenimento a dois em uma experiência fluida, eliminando atritos de escolha e unificando gostos cinematográficos e musicais.

### Objetivos Chave:
1. **Fim da Indecisão**: Sistema de Match automático e sorteador ponderado ("O que ver hoje?").
2. **Memória Afetiva**: Diário de filmes assistidos com notas de cada um, média calculada, tags de humor (*"Quem dormiu?"*) e comentários.
3. **Ponte Musical Spotify x Deezer**: Conversão automática de links para que ambos possam ouvir as músicas em suas respectivas plataformas nativas ou através de players embutidos.
4. **Sem Fricção de Acesso**: Zero telas de login diárias. Acesso direto com chave no app e seletor de perfil no topo.

---

## 2. Diagrama de Arquitetura e Fluxo de Dados

```
                             [ USUÁRIO: EDUARDO / LAURA ]
                                          │
                                          ▼
                   +─────────────────────────────────────────────+
                   |                 FRONTEND                    |
                   |   React 18 + Vite 5 + TypeScript            |
                   |   Tailwind CSS v3 + Framer Motion           |
                   |   TanStack Query v5 (Cache & Estado Servidor)|
                   |   Zustand (Estado Local & Perfil Ativo)     |
                   +─────────────────────────────────────────────+
                            │                 │              │
        Chamadas HTTP / API │                 │              │ Embeds / iframes
                            ▼                 ▼              ▼
     +──────────────────────────+     +──────────────+  +──────────────+
     |   API do TMDB v3         |     | Odesli API   |  | Spotify &    |
     | - Busca de filmes (pt-BR)|     | - Conversão  |  | Deezer       |
     | - Pôsteres, sinopse, ano |     |   Spotify <->|  | Widgets      |
     | - Duração e gêneros      |     |   Deezer     |  +──────────────+
     +──────────────────────────+     +──────────────+
                            │                 │
                            └────────┬────────┘
                                     │ Salva Metadados
                                     ▼
                   +─────────────────────────────────────────────+
                   |              BACKEND (Supabase)             |
                   |  - PostgreSQL Database (Tabelas e Views)    |
                   |  - PostgREST (API RESTful automática)       |
                   |  - Supabase Realtime (WebSockets)           |
                   |  - RPC Stored Procedures (Sorteador Seguro) |
                   +─────────────────────────────────────────────+
```

---

## 3. Stack Tecnológica e Racional Técnico

| Camada | Tecnologia | Justificativa Técnica |
| :--- | :--- | :--- |
| **Framework Base** | `React 18` + `Vite 5` | Build ultrarrápido com Hot Module Replacement (HMR) e renderização client-side ideal para SPA. |
| **Linguagem** | `TypeScript` | Tipagem estrita de entidades (Filme, Avaliação, Música, Perfil), evitando erros em tempo de execução. |
| **Estilização** | `Tailwind CSS 3` | Sistema de tokens utilitários de alta velocidade com suporte a temas escuros customizados e transições nativas. |
| **Animações** | `Framer Motion` | Microinterações de streaming (cards saltando, roleta girando, badges pulsando, troca de abas fluida). |
| **Gerenciamento de Estado** | `Zustand` + `TanStack Query` | `Zustand` para estado de sessão (perfil ativo persistido em `localStorage`) e `TanStack Query` para cache de consultas ao Supabase e TMDB com invalidação automática. |
| **Ícones** | `Lucide React` | Conjunto leve e consistente de ícones para cinema, música e controles de mídia. |
| **Banco & Realtime** | `Supabase (PostgreSQL 15)` | Banco relacional robusto com canal WebSocket nativo que atualiza a tela do parceiro em milissegundos. |
| **PWA Engine** | `vite-plugin-pwa` | Permite instalar o site como app nativo na tela inicial do iPhone e Android, com funcionamento offline básico. |

---

## 4. Gestão de Perfis e Segurança

### Mecânica do Seletor de Perfil
- Não há autenticação com senha a cada carregamento para não estragar a experiência de uso casual no sofá.
- O perfil ativo (`activeProfile: 'eduardo' | 'laura'`) fica armazenado em:
  1. Store Zustand sincronizada com `localStorage` (`cine-profile`).
  2. Cada requisição de mutação (`INSERT`, `UPDATE`) envia explicitamente o identificador do perfil ativo.
- Opcionalmente, pode ser adicionado um código PIN de 4 dígitos do casal armazenado na primeira visita para impedir que curiosos acessem o link caso compartilhado acidentalmente.

---

## 5. Estrutura Detalhada de Diretórios do Projeto

```
app-filmes/
├── planos/                               # Especificações e planos de engenharia
├── public/
│   ├── favicon.svg                       # Ícone do app
│   ├── apple-touch-icon.png              # Ícone para tela inicial iOS
│   ├── manifest.webmanifest              # Manifesto PWA
│   └── sounds/                           # Efeitos sonoros sutis (click, match, roleta)
├── src/
│   ├── @types/                           # Tipos TypeScript globais
│   │   ├── movie.ts                      # Interfaces Movie, Watchlist, Rating
│   │   ├── music.ts                      # Interfaces Track, PlaylistConfig
│   │   └── user.ts                       # Tipos Profile ('eduardo' | 'laura')
│   ├── components/
│   │   ├── common/                       # Componentes reutilizáveis
│   │   │   ├── Header.tsx                # Barra superior com logo e perfis
│   │   │   ├── ProfileSwitcher.tsx       # Alternador visual Eduardo / Laura
│   │   │   ├── Navigation.tsx            # Menu de navegação (desktop e mobile bar)
│   │   │   ├── Modal.tsx                 # Modal base com backdrop blur
│   │   │   ├── Button.tsx                # Botões primários, secundários e gradientes
│   │   │   ├── Badge.tsx                 # Tags de gênero e status
│   │   │   └── Toast.tsx                 # Alertas flutuantes de sucesso/erro
│   │   ├── movies/                       # Componentes do Módulo de Cinema
│   │   │   ├── MovieCard.tsx             # Card individual do filme com pôster e hover
│   │   │   ├── MovieGrid.tsx             # Grid responsivo de cartazes
│   │   │   ├── MovieSearchModal.tsx      # Modal de busca integrada ao TMDB
│   │   │   ├── MovieDetailModal.tsx      # Detalhes, trailer e ações rápidas
│   │   │   ├── RatingModal.tsx           # Modal de atribuição de notas e tags
│   │   │   ├── CoupleMatchBanner.tsx     # Banner de destaque de filmes em comum
│   │   │   └── MovieRouletteModal.tsx    # Sorteador animado "O que ver hoje?"
│   │   ├── music/                        # Componentes do Módulo de Música
│   │   │   ├── MusicTrackCard.tsx        # Card da música com botões Spotify/Deezer
│   │   │   ├── AddTrackModal.tsx         # Input inteligente de link com conversão
│   │   │   ├── EmbeddedPlayers.tsx       # Iframes do Spotify e Deezer lado a lado
│   │   │   └── AudioPreviewPlayer.tsx    # Mini player de áudio direto no card
│   │   └── stats/                        # Estatísticas do Casal
│   │       ├── StatsOverview.tsx         # Total de horas, filmes assistidos
│   │       └── RatingComparison.tsx      # Gráfico comparativo de exigência
│   ├── hooks/                            # Custom Hooks
│   │   ├── useProfile.ts                 # Acesso e troca de perfil ativo
│   │   ├── useMovies.ts                  # Query/Mutations de filmes e listas
│   │   ├── useMovieSearch.ts             # Busca com debounce no TMDB
│   │   ├── useMusicTracks.ts             # Query/Mutations de músicas
│   │   ├── useRealtimeSubscription.ts    # Listener dos canais WebSocket Supabase
│   │   └── useRoulette.ts                # Lógica e animação do sorteador
│   ├── lib/                              # Clientes de Serviços Externos
│   │   ├── supabase.ts                   # Instância do cliente Supabase
│   │   ├── tmdb.ts                       # Métodos de busca e detalhes no TMDB
│   │   └── songlink.ts                   # Métodos de resolução de links de música
│   ├── store/                            # Estado Global
│   │   └── useAppStore.ts                # Store Zustand com persistência
│   ├── styles/                           # Estilos Globais
│   │   └── index.css                     # Tailwind directives e custom utilities
│   ├── App.tsx                           # Rotas e layout principal
│   └── main.tsx                          # Ponto de entrada
├── .env.example                          # Modelo de variáveis de ambiente
├── tailwind.config.ts                    # Tokens de cor e animações
├── tsconfig.json                         # Configuração estrita do TypeScript
├── vite.config.ts                        # Configuração do Vite e plugins PWA
└── package.json                          # Dependências do projeto
```

---

## 6. Variáveis de Ambiente Necessárias (`.env.example`)

```env
# Conexão com o Supabase (Projeto do Casal)
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API do TMDB (The Movie Database) - Gratuito
VITE_TMDB_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Configuração de Playlists Fixas (Opcional - IDs padrão)
VITE_DEFAULT_SPOTIFY_PLAYLIST_ID=37i9dQZF1DXcBWIGoYBM5M
VITE_DEFAULT_DEEZER_PLAYLIST_ID=1963240362
```
