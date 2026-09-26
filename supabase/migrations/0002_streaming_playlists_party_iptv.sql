-- ====================================================================
-- Nossa Sessão 🍿 — Migração 0002
-- Streaming próprio de música, playlists com export/sync para
-- Spotify / YouTube Music / Deezer, IPTV e Watch & Listen Party.
--
-- Depende da migração inicial (planos/02-banco-de-dados-supabase.md):
-- movies, movie_watchlist, movie_ratings, music_tracks, playlist_config.
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 1. TABELA: STREAM_PLAYLISTS (as playlists criadas dentro do app)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.stream_playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    created_by TEXT NOT NULL CHECK (created_by IN ('eduardo', 'laura')),
    is_couple_playlist BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_stream_playlists_created_at
    ON public.stream_playlists (created_at DESC);

-- ====================================================================
-- 2. TABELA: STREAM_PLAYLIST_TRACKS (faixas, na ordem da playlist)
--    source_id = videoId do YouTube Music (nossa fonte canônica)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.stream_playlist_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id UUID NOT NULL REFERENCES public.stream_playlists(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'ytmusic' CHECK (source IN ('ytmusic', 'youtube')),
    source_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT,
    cover_url TEXT,
    duration_sec INTEGER,
    isrc TEXT,
    memory_note TEXT,
    added_by TEXT NOT NULL CHECK (added_by IN ('eduardo', 'laura')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_playlist_track UNIQUE (playlist_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_playlist_tracks_order
    ON public.stream_playlist_tracks (playlist_id, position);

-- ====================================================================
-- 3. TABELA: PLAYLIST_EXPORTS
--    Guarda o ID da playlist REMOTA. É isso que permite "atualizar"
--    uma playlist já exportada em vez de criar uma nova toda vez.
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.playlist_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id UUID NOT NULL REFERENCES public.stream_playlists(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('spotify', 'youtube', 'deezer')),
    profile TEXT NOT NULL CHECK (profile IN ('eduardo', 'laura')),
    remote_id TEXT NOT NULL,
    remote_url TEXT,
    remote_name TEXT,
    tracks_exported INTEGER NOT NULL DEFAULT 0,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_playlist_export UNIQUE (playlist_id, platform, profile)
);

-- ====================================================================
-- 4. TABELA: PLAYLIST_EXPORT_ITEMS
--    Faixa local -> URI remota. Evita duplicar faixa em re-sync e
--    registra o que não deu match em cada plataforma.
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.playlist_export_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    export_id UUID NOT NULL REFERENCES public.playlist_exports(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES public.stream_playlist_tracks(id) ON DELETE CASCADE,
    remote_uri TEXT,
    remote_title TEXT,
    match_score NUMERIC(4,3),
    status TEXT NOT NULL DEFAULT 'synced' CHECK (status IN ('synced', 'not_found', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_export_item UNIQUE (export_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_export_items_export
    ON public.playlist_export_items (export_id, status);

-- ====================================================================
-- 5. TABELA: OAUTH_ACCOUNTS  ⚠️  CONTÉM TOKENS — NUNCA EXPOR
--    RLS ligado SEM nenhuma policy: a chave anon (frontend) não lê
--    nada aqui. Só o backend, com a service_role key, acessa.
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.oauth_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider TEXT NOT NULL CHECK (provider IN ('spotify', 'google', 'deezer')),
    profile TEXT NOT NULL CHECK (profile IN ('eduardo', 'laura')),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    scope TEXT,
    remote_user_id TEXT,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_oauth_provider_profile UNIQUE (provider, profile)
);

-- ====================================================================
-- 6. TABELA: PARTY_SESSIONS (estado do "assistir/ouvir junto")
--    Uma linha por sala. O Realtime faz a sincronia fina (broadcast);
--    esta tabela guarda o último estado pra quem abre o app depois
--    cair já no ponto certo.
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.party_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room TEXT UNIQUE NOT NULL DEFAULT 'nossa-sessao',
    kind TEXT NOT NULL DEFAULT 'idle' CHECK (kind IN ('idle', 'music', 'iptv')),
    item_ref JSONB,
    position_sec NUMERIC(10,3) NOT NULL DEFAULT 0,
    is_playing BOOLEAN NOT NULL DEFAULT FALSE,
    controller TEXT CHECK (controller IN ('eduardo', 'laura')),
    started_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

INSERT INTO public.party_sessions (room)
VALUES ('nossa-sessao')
ON CONFLICT (room) DO NOTHING;

-- ====================================================================
-- 7. TABELA: IPTV_SOURCES (a lista do fornecedor)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.iptv_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'm3u' CHECK (kind IN ('m3u', 'xtream')),
    m3u_url TEXT,
    xtream_host TEXT,
    xtream_username TEXT,
    xtream_password TEXT,
    channel_count INTEGER,
    added_by TEXT NOT NULL CHECK (added_by IN ('eduardo', 'laura')),
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- ====================================================================
-- 8. TABELA: IPTV_FAVORITES (canais/filmes fixados pelo casal)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.iptv_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES public.iptv_sources(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    stream_url TEXT NOT NULL,
    logo_url TEXT,
    group_title TEXT,
    added_by TEXT NOT NULL CHECK (added_by IN ('eduardo', 'laura')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_iptv_favorite UNIQUE (stream_url)
);

CREATE INDEX IF NOT EXISTS idx_iptv_favorites_group
    ON public.iptv_favorites (group_title, name);

-- ====================================================================
-- 9. TRIGGERS DE updated_at
--    (a função update_timestamp_column vem da migração inicial)
-- ====================================================================
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stream_playlists_updated_at ON public.stream_playlists;
CREATE TRIGGER trg_stream_playlists_updated_at
    BEFORE UPDATE ON public.stream_playlists
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_oauth_accounts_updated_at ON public.oauth_accounts;
CREATE TRIGGER trg_oauth_accounts_updated_at
    BEFORE UPDATE ON public.oauth_accounts
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_party_sessions_updated_at ON public.party_sessions;
CREATE TRIGGER trg_party_sessions_updated_at
    BEFORE UPDATE ON public.party_sessions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- ====================================================================
-- 10. RPC: próxima posição livre na playlist (append sem race)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.next_playlist_position(p_playlist_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_next INTEGER;
BEGIN
    SELECT COALESCE(MAX(position), -1) + 1
      INTO v_next
      FROM public.stream_playlist_tracks
     WHERE playlist_id = p_playlist_id;
    RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 11. RLS
--     Mesmo padrão permissivo do resto do app (é um app privado de
--     duas pessoas, sem login) — EXCETO oauth_accounts, que fica
--     trancada porque guarda tokens de acesso às contas de verdade.
-- ====================================================================
ALTER TABLE public.stream_playlists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_exports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_export_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_sources           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_favorites         ENABLE ROW LEVEL SECURITY;

-- Tokens: RLS ligado e nenhuma policy = anon não lê nem escreve.
ALTER TABLE public.oauth_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso Total StreamPlaylists" ON public.stream_playlists;
CREATE POLICY "Acesso Total StreamPlaylists" ON public.stream_playlists
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total StreamPlaylistTracks" ON public.stream_playlist_tracks;
CREATE POLICY "Acesso Total StreamPlaylistTracks" ON public.stream_playlist_tracks
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total PlaylistExports" ON public.playlist_exports;
CREATE POLICY "Acesso Total PlaylistExports" ON public.playlist_exports
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total PlaylistExportItems" ON public.playlist_export_items;
CREATE POLICY "Acesso Total PlaylistExportItems" ON public.playlist_export_items
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total PartySessions" ON public.party_sessions;
CREATE POLICY "Acesso Total PartySessions" ON public.party_sessions
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total IptvSources" ON public.iptv_sources;
CREATE POLICY "Acesso Total IptvSources" ON public.iptv_sources
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total IptvFavorites" ON public.iptv_favorites;
CREATE POLICY "Acesso Total IptvFavorites" ON public.iptv_favorites
    FOR ALL USING (true) WITH CHECK (true);

-- ====================================================================
-- 12. REALTIME
--     Sem isso o "ouvir junto"/"assistir junto" e a playlist
--     compartilhada não atualizam sozinhos no celular do outro.
-- ====================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.party_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_playlists;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_playlist_tracks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.playlist_exports;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.iptv_favorites;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Posição do player muda muitas vezes por minuto: replica só a linha
-- nova, não a antiga, pra não encher a banda do Realtime.
ALTER TABLE public.party_sessions REPLICA IDENTITY DEFAULT;
