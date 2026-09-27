import type { UserProfile } from './database';

/** Faixa como vem da busca do backend (YouTube Music via InnerTube). */
export interface StreamTrack {
  sourceId: string;
  source: 'ytmusic' | 'youtube';
  title: string;
  artist: string;
  album: string | null;
  coverUrl: string | null;
  durationSec: number | null;
  isExplicit?: boolean;
  hasVideo?: boolean;
}

export interface StreamPlaylistRecord {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  created_by: UserProfile;
  is_couple_playlist: boolean;
  created_at: string;
  updated_at: string;
}

export interface StreamPlaylistTrackRecord {
  id: string;
  playlist_id: string;
  position: number;
  source: 'ytmusic' | 'youtube';
  source_id: string;
  title: string;
  artist: string;
  album: string | null;
  cover_url: string | null;
  duration_sec: number | null;
  isrc: string | null;
  memory_note: string | null;
  added_by: UserProfile;
  created_at: string;
}

export type ExportPlatform = 'spotify' | 'youtube' | 'deezer';

export interface PlaylistExportRecord {
  id: string;
  playlist_id: string;
  platform: ExportPlatform;
  profile: UserProfile;
  remote_id: string;
  remote_url: string | null;
  remote_name: string | null;
  tracks_exported: number;
  last_synced_at: string;
  created_at: string;
}

export interface ExportSyncResult {
  platform: ExportPlatform;
  action: 'created' | 'updated';
  remoteUrl: string | null;
  remoteName: string | null;
  added: number;
  alreadyThere: number;
  notFound: Array<{ title: string; artist: string }>;
  totalOnPlatform: number;
}

export interface ConnectionStatus {
  spotify: { connected: boolean; displayName: string | null; configured: boolean };
  youtube: { connected: boolean; displayName: string | null; configured: boolean };
  deezer: { connected: boolean; displayName: string | null; configured: boolean };
}

export type IptvKind = 'live' | 'movie' | 'series';

/** Uma linha da lista do fornecedor: canal, filme ou episódio. */
export interface IptvChannel {
  id: string;
  name: string;
  url: string;
  logo: string | null;
  group: string | null;
  kind: IptvKind;
  adult: boolean;
  seriesName: string | null;
  seriesKey: string | null;
  season: number | null;
  episode: number | null;
  episodeTitle: string | null;
}

/** Série já agrupada: é ela que aparece na lista, não os episódios. */
export interface IptvSeries {
  key: string;
  name: string;
  /** Nome limpo, sem ano e sem marcação de qualidade — pro TMDB. */
  searchTitle: string;
  year: number | null;
  group: string | null;
  logo: string | null;
  adult: boolean;
  seasonCount: number;
  episodeCount: number;
}

export interface IptvSeriesDetail {
  name: string;
  searchTitle: string;
  year: number | null;
  logo: string | null;
  group: string | null;
  seasons: number[];
  episodes: IptvChannel[];
}

export interface IptvGroup {
  title: string;
  count: number;
  adult: boolean;
}

export interface IptvCounts {
  live: number;
  movie: number;
  series: number;
  adult: number;
}

export interface IptvSourceRecord {
  id: string;
  label: string;
  kind: 'm3u' | 'xtream';
  m3u_url: string | null;
  xtream_host: string | null;
  xtream_username: string | null;
  xtream_password: string | null;
  channel_count: number | null;
  added_by: UserProfile;
  last_used_at: string | null;
  created_at: string;
}

export interface IptvFavoriteRecord {
  id: string;
  source_id: string | null;
  name: string;
  stream_url: string;
  logo_url: string | null;
  group_title: string | null;
  added_by: UserProfile;
  created_at: string;
}

/** O que está tocando/passando na sessão compartilhada do casal. */
export type PartyKind = 'idle' | 'music' | 'iptv';

export interface PartyItemRef {
  kind: PartyKind;
  /** videoId (música) ou URL do canal (IPTV). */
  ref: string;
  title: string;
  subtitle?: string | null;
  coverUrl?: string | null;
  durationSec?: number | null;
}

export interface PartyState {
  kind: PartyKind;
  item: PartyItemRef | null;
  positionSec: number;
  isPlaying: boolean;
  controller: UserProfile | null;
  /** Epoch ms no relógio de quem emitiu — base pro cálculo de drift. */
  emittedAt: number;
}

export interface LyricsLine {
  timeSec: number;
  text: string;
}

export interface LyricsResult {
  /** Com marcação de tempo, pra acompanhar a música. Nem toda faixa tem. */
  synced: LyricsLine[] | null;
  text: string | null;
  source: string | null;
}

export interface CoupleProfileRecord {
  id: string;
  profile: UserProfile;
  display_name: string;
  avatar_url: string | null;
  updated_at: string;
}

/** A mesma faixa em outra plataforma, pra ouvir quando o áudio falha. */
export interface TrackAlternative {
  title: string;
  artist: string;
  durationSec: number | null;
  url: string | null;
  /** MP3 de 30s liberado publicamente (a Deezer quase sempre tem). */
  previewUrl: string | null;
  coverUrl: string | null;
  score: number;
}

export interface AlternativesResult {
  deezer: TrackAlternative | null;
  spotify: TrackAlternative | null;
  previewUrl: string | null;
}
