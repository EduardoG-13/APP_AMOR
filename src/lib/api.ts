import type {
  AlternativesResult,
  ConnectionStatus,
  ExportPlatform,
  ExportSyncResult,
  IptvChannel,
  IptvCounts,
  IptvGroup,
  IptvKind,
  IptvSeries,
  IptvSeriesDetail,
  LyricsResult,
  StreamTrack,
  UserProfile,
} from '../types';

/**
 * Em dev fica vazio: o Vite faz proxy de /api pro backend em :3001.
 * Em produção aponta pro serviço do Render (VITE_API_URL).
 */
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/**
 * Token compartilhado com o backend. As rotas de mídia recebem por
 * querystring porque <audio>/<video> não mandam header.
 */
const APP_TOKEN = import.meta.env.VITE_APP_TOKEN || '';

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

function withToken(url: string): string {
  if (!APP_TOKEN) return url;
  return `${url}${url.includes('?') ? '&' : '?'}t=${encodeURIComponent(APP_TOKEN)}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(APP_TOKEN ? { 'x-app-token': APP_TOKEN } : {}),
      ...(init?.headers || {}),
    },
  });

  const raw = await response.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }

  if (!response.ok) {
    const message =
      (body as { error?: string })?.error ||
      (typeof body === 'string' && body) ||
      `O servidor respondeu ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}

/* ------------------------------------------------------------------ */
/* Música                                                              */
/* ------------------------------------------------------------------ */

export function searchMusic(query: string, signal?: AbortSignal) {
  return request<{ tracks: StreamTrack[] }>(
    `/api/music/search?q=${encodeURIComponent(query)}`,
    { signal }
  ).then((data) => data.tracks);
}

export function getTrackDetails(sourceId: string) {
  return request<{ track: StreamTrack }>(`/api/music/track/${encodeURIComponent(sourceId)}`).then(
    (data) => data.track
  );
}

export function getLyrics(
  sourceId: string,
  meta?: { title?: string; artist?: string; album?: string | null; durationSec?: number | null }
) {
  const params = new URLSearchParams();
  if (meta?.title) params.set('title', meta.title);
  if (meta?.artist) params.set('artist', meta.artist);
  if (meta?.album) params.set('album', meta.album);
  if (meta?.durationSec) params.set('duration', String(Math.round(meta.durationSec)));

  const query = params.toString();
  return request<LyricsResult>(
    `/api/music/lyrics/${encodeURIComponent(sourceId)}${query ? `?${query}` : ''}`
  );
}

/** Faixas parecidas — alimenta o autoplay quando a fila acaba. */
export function getRadio(sourceId: string) {
  return request<{ tracks: StreamTrack[] }>(
    `/api/music/radio/${encodeURIComponent(sourceId)}`
  ).then((data) => data.tracks);
}

/**
 * Onde mais dá pra ouvir a faixa. O player recorre a isto quando o
 * áudio completo falha — em servidor de datacenter o YouTube recusa
 * liberar o stream.
 */
export function getAlternatives(
  sourceId: string,
  meta: { title: string; artist: string; durationSec?: number | null }
) {
  const params = new URLSearchParams({ title: meta.title, artist: meta.artist });
  if (meta.durationSec) params.set('duration', String(Math.round(meta.durationSec)));

  return request<AlternativesResult>(
    `/api/music/alternatives/${encodeURIComponent(sourceId)}?${params.toString()}`
  );
}

/** URL pro <audio src>. Passa pelo backend: as URLs do Google são travadas por IP. */
export function audioStreamUrl(sourceId: string): string {
  return withToken(apiUrl(`/api/music/audio/${encodeURIComponent(sourceId)}`));
}

/** Mesma faixa, mas com Content-Disposition: attachment. */
export function audioDownloadUrl(sourceId: string, filename: string): string {
  return withToken(
    apiUrl(
      `/api/music/audio/${encodeURIComponent(sourceId)}?download=1&filename=${encodeURIComponent(filename)}`
    )
  );
}

export function videoStreamUrl(sourceId: string): string {
  return withToken(apiUrl(`/api/music/video/${encodeURIComponent(sourceId)}`));
}

/* ------------------------------------------------------------------ */
/* IPTV                                                               */
/* ------------------------------------------------------------------ */

export interface IptvParseResult {
  sourceKey: string;
  totalChannels: number;
  totalSeries: number;
  counts: IptvCounts;
  /** Categorias separadas por tipo, pra cada aba mostrar só as suas. */
  groups: Record<IptvKind, IptvGroup[]>;
}

export function parseIptvSource(input: {
  m3uUrl?: string;
  xtream?: { host: string; username: string; password: string };
}) {
  return request<IptvParseResult>('/api/iptv/parse', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listIptvChannels(params: {
  sourceKey: string;
  kind?: IptvKind;
  group?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  /** Conteúdo adulto só vem quando destravado com o PIN. */
  includeAdult?: boolean;
}) {
  const search = new URLSearchParams({ src: params.sourceKey });
  if (params.kind) search.set('kind', params.kind);
  if (params.group) search.set('group', params.group);
  if (params.q) search.set('q', params.q);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  if (params.includeAdult) search.set('adult', '1');

  return request<{ channels: IptvChannel[]; total: number; page: number; pageSize: number }>(
    `/api/iptv/channels?${search.toString()}`
  );
}

/** Séries agrupadas — 30 séries em vez de 600 episódios soltos. */
export function listIptvSeries(params: {
  sourceKey: string;
  group?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  includeAdult?: boolean;
}) {
  const search = new URLSearchParams({ src: params.sourceKey });
  if (params.group) search.set('group', params.group);
  if (params.q) search.set('q', params.q);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  if (params.includeAdult) search.set('adult', '1');

  return request<{ series: IptvSeries[]; total: number; page: number; pageSize: number }>(
    `/api/iptv/series?${search.toString()}`
  );
}

export function getIptvSeriesEpisodes(sourceKey: string, seriesKey: string) {
  return request<IptvSeriesDetail>(
    `/api/iptv/series/${encodeURIComponent(seriesKey)}/episodes?src=${encodeURIComponent(sourceKey)}`
  );
}

/**
 * URL do canal passando pelo proxy compartilhado. Além de resolver
 * CORS e os headers que o provedor exige, é ele que faz o cache de
 * segmentos — dois assistindo o mesmo canal viram uma conexão só lá.
 */
export function iptvStreamUrl(channelUrl: string): string {
  return withToken(apiUrl(`/api/stream?u=${encodeURIComponent(btoa(channelUrl))}`));
}

/* ------------------------------------------------------------------ */
/* Contas e export de playlist                                         */
/* ------------------------------------------------------------------ */

export function getConnectionStatus(profile: UserProfile) {
  return request<ConnectionStatus>(`/api/oauth/status?profile=${profile}`);
}

export function oauthStartUrl(provider: 'spotify' | 'google', profile: UserProfile): string {
  return apiUrl(`/api/oauth/${provider}/start?profile=${profile}`);
}

export function disconnectAccount(provider: ExportPlatform | 'google', profile: UserProfile) {
  return request<{ ok: true }>('/api/oauth/disconnect', {
    method: 'POST',
    body: JSON.stringify({ provider, profile }),
  });
}

/** Deezer não tem OAuth aberto: liga com o token `arl` da própria conta. */
export function connectDeezer(profile: UserProfile, arl: string) {
  return request<{ ok: true; displayName: string | null }>('/api/oauth/deezer/connect', {
    method: 'POST',
    body: JSON.stringify({ profile, arl }),
  });
}

/**
 * Cria a playlist na plataforma na primeira vez e, nas seguintes,
 * adiciona só as faixas novas na mesma playlist.
 */
export function syncPlaylistToPlatform(input: {
  playlistId: string;
  platform: ExportPlatform;
  profile: UserProfile;
}) {
  return request<ExportSyncResult>('/api/export/playlist', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function playlistFileUrl(playlistId: string, format: 'm3u' | 'csv'): string {
  return withToken(apiUrl(`/api/export/playlist/${playlistId}/file.${format}`));
}

export function pingBackend() {
  return request<{ ok: boolean; services: Record<string, boolean> }>('/api/health');
}
