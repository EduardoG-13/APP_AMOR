# 04 - Módulo de Música (Spotify + Deezer Bridge)

## 1. O Desafio Técnico de Plataformas Concorrentes
- **Eduardo**: Usuário e assinante do **Spotify**.
- **Laura**: Usuária e assinante do **Deezer**.
- **Problema comum**: Quando um envia uma música pelo WhatsApp, o outro precisa abrir manualmente o outro app de streaming e digitar o nome da música para conseguir ouvir.
- **Solução no App do Casal**: Uma ponte de dados que unifica os links através da API universal **Odesli (Songlink)**, gerando cards com links diretos para ambos os aplicativos e players embutidos na própria página.

---

## 2. A Integração com a API Odesli / Songlink

A API pública da Odesli (`song.link`) aceita qualquer URL de streaming e devolve os IDs correspondentes em todas as principais plataformas mundiais (Spotify, Deezer, Apple Music, YouTube Music, etc.).

### 2.1 Especificação da Requisição
```http
GET https://api.song.link/v1-alpha.1/links?url={URL_ENCODED}&userCountry=BR
```

### 2.2 Exemplo de Entrada:
- Eduardo cola: `https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT`
- OU Laura cola: `https://www.deezer.com/track/1109731`

### 2.3 Algoritmo de Extração de Metadados (TypeScript):
```typescript
interface OdesliResponse {
  entityUniqueId: string;
  userCountry: string;
  entitiesByUniqueId: Record<string, {
    id: string;
    type: string;
    title: string;
    artistName: string;
    thumbnailUrl: string;
    platforms: string[];
  }>;
  linksByPlatform: {
    spotify?: {
      url: string;
      nativeAppUriMobile?: string;
      nativeAppUriDesktop?: string;
      entityUniqueId: string;
    };
    deezer?: {
      url: string;
      nativeAppUriMobile?: string;
      nativeAppUriDesktop?: string;
      entityUniqueId: string;
    };
  };
}

export async function resolveMusicLink(inputUrl: string) {
  const endpoint = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(inputUrl)}&userCountry=BR`;
  const response = await fetch(endpoint);
  
  if (!response.ok) {
    throw new Error('Não foi possível identificar a música nesta URL.');
  }

  const data: OdesliResponse = await response.json();
  const mainEntity = data.entitiesByUniqueId[data.entityUniqueId];

  return {
    title: mainEntity?.title || 'Título desconhecido',
    artist: mainEntity?.artistName || 'Artista desconhecido',
    cover_url: mainEntity?.thumbnailUrl || null,
    spotify_url: data.linksByPlatform.spotify?.url || null,
    deezer_url: data.linksByPlatform.deezer?.url || null,
    spotify_native: data.linksByPlatform.spotify?.nativeAppUriMobile || null,
    deezer_native: data.linksByPlatform.deezer?.nativeAppUriMobile || null,
  };
}
```

---

## 3. Experiência de Uso (UX) e Deep Linking no Celular

Ao abrir o card de uma música no celular:
- **Para o Eduardo**:
  - O botão primário **"Ouvir no Spotify"** usa o esquema de deep link `spotify:track:...` ou a URL web que abre o app nativo do Spotify diretamente sem passar pelo navegador.
- **Para a Laura**:
  - O botão primário **"Ouvir no Deezer"** utiliza a URL com protocolo `deezer://...` ou fallback web que abre diretamente o aplicativo do Deezer no celular dela.

### Estrutura Visual do Card de Música:
```
+─────────────────────────────────────────────────────────────+
| [Capa 80x80]  A Thousand Years                              |
|               Christina Perri                               |
|               💬 "Música do nosso primeiro encontro"        |
|               👤 Adicionado por: Laura                      |
|                                                             |
|  [ 🟢 Spotify (Edu) ]          [ 🟣 Deezer (Laura) ]        |
+─────────────────────────────────────────────────────────────+
```

---

## 4. Players Oficiais Embutidos (Widgets)

Além dos links individuais, o app oferece uma aba dedicada a **Playlists Fixas do Casal**:

### A) Player Embutido do Spotify (Playlist do Eduardo)
- Utiliza o Iframe oficial do Spotify Embed:
  ```html
  <iframe 
    src="https://open.spotify.com/embed/playlist/{PLAYLIST_ID}?utm_source=generator&theme=0" 
    width="100%" 
    height="380" 
    frameBorder="0" 
    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
    loading="lazy"
    class="rounded-2xl shadow-xl border border-white/10"
  ></iframe>
  ```

### B) Player Embutido do Deezer (Playlist da Laura)
- Utiliza o Widget oficial do Deezer:
  ```html
  <iframe 
    src="https://widget.deezer.com/widget/dark/playlist/{PLAYLIST_ID}" 
    width="100%" 
    height="380" 
    frameBorder="0" 
    allow="encrypted-media; clipboard-write" 
    loading="lazy"
    class="rounded-2xl shadow-xl border border-white/10"
  ></iframe>
  ```

### C) Seletor de Player:
- Dois botões no topo da seção de playlists:
  - `[ 🟢 Tocar Playlist do Edu (Spotify) ]`
  - `[ 🟣 Tocar Playlist da Lau (Deezer) ]`
- O player ativo ocupa a área principal com bordas arredondadas e efeito neon suave nas bordas.

---

## 5. Associação de Músicas a Filmes (Soundtrack Afetiva)
- No formulário de adicionar música, há um seletor opcional:
  - **"Vincular a um filme assistido?"**
- Se selecionado (ex: *Interestelar*), a música fica visível:
  1. Na lista geral de músicas do casal;
  2. Dentro da ficha do filme *Interestelar* na aba de assistidos como a **"Trilha Sonora Marcante"**.
