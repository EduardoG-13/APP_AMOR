import { env, hasSpotify } from '../../env.js';
import { fetchJson } from '../http.js';
import { getOAuthAccount, saveOAuthAccount } from '../supabase.js';
import { chunk, pickBestMatch } from '../match.js';

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

/** Só o necessário pra criar e atualizar playlist. Nada de ler dados pessoais. */
export const SCOPES = ['playlist-modify-private', 'playlist-modify-public', 'playlist-read-private'];

export function redirectUri() {
  return `${env.publicBaseUrl}/api/oauth/spotify/callback`;
}

export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: env.spotify.clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SCOPES.join(' '),
    state,
    show_dialog: 'true',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

function basicAuthHeader() {
  const raw = `${env.spotify.clientId}:${env.spotify.clientSecret}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

async function tokenRequest(body) {
  const { ok, status, body: payload } = await fetchJson(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });

  if (!ok) {
    throw Object.assign(
      new Error(
        `Spotify recusou o token: ${payload?.error_description || payload?.error || status}`
      ),
      { status: 502 }
    );
  }

  return payload;
}

export async function exchangeCode(code) {
  return tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
  });
}

async function apiRequest(token, path, options = {}) {
  const { ok, status, body } = await fetchJson(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!ok) {
    throw Object.assign(
      new Error(`Spotify respondeu ${status}: ${body?.error?.message || 'erro desconhecido'}`),
      { status: status === 404 ? 404 : 502 }
    );
  }

  return body;
}

export async function getProfileInfo(token) {
  return apiRequest(token, '/me');
}

/**
 * Devolve um token válido, renovando com o refresh_token quando o
 * atual já expirou (o do Spotify dura 1h).
 */
export async function getValidToken(profile) {
  if (!hasSpotify()) {
    throw Object.assign(new Error('Spotify não configurado no backend.'), { status: 503 });
  }

  const account = await getOAuthAccount('spotify', profile);
  if (!account) {
    throw Object.assign(new Error(`${profile} ainda não conectou a conta do Spotify.`), {
      status: 409,
      code: 'NOT_CONNECTED',
    });
  }

  const expiresAt = account.expires_at ? new Date(account.expires_at).getTime() : 0;
  if (expiresAt - Date.now() > 60_000) return account.access_token;

  if (!account.refresh_token) {
    throw Object.assign(new Error('Token do Spotify expirou. Reconecte a conta.'), { status: 409 });
  }

  const refreshed = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: account.refresh_token,
  });

  await saveOAuthAccount({
    provider: 'spotify',
    profile,
    access_token: refreshed.access_token,
    // O Spotify nem sempre devolve um refresh_token novo.
    refresh_token: refreshed.refresh_token || account.refresh_token,
    expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
    scope: refreshed.scope || account.scope,
    remote_user_id: account.remote_user_id,
    display_name: account.display_name,
  });

  return refreshed.access_token;
}

function toCandidate(item) {
  return {
    uri: item.uri,
    id: item.id,
    title: item.name,
    artist: (item.artists || []).map((artist) => artist.name).join(', '),
    durationSec: item.duration_ms ? Math.round(item.duration_ms / 1000) : null,
  };
}

/** Procura a faixa no catálogo do Spotify e devolve a melhor equivalente. */
export async function findTrack(token, target) {
  const attempts = [
    `track:${target.title} artist:${target.artist}`,
    `${target.title} ${target.artist}`,
    target.title,
  ];

  for (const query of attempts) {
    const data = await apiRequest(
      token,
      `/search?q=${encodeURIComponent(query)}&type=track&limit=8&market=BR`
    );

    const candidates = (data?.tracks?.items || []).map(toCandidate);
    const best = pickBestMatch(target, candidates);
    if (best) return best;
  }

  return null;
}

/**
 * Na migracao de fevereiro de 2026 o Spotify aposentou os endpoints
 * antigos de escrita para apps em modo de desenvolvimento: desde 9 de
 * marco eles respondem 403 pra qualquer chamada. Os substitutos sao
 * /me/playlists e /playlists/{id}/items.
 */
export async function createPlaylist(token, { name, description }) {
  const playlist = await apiRequest(token, '/me/playlists', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description: description || 'Playlist do casal, criada pelo Nossa Sessão 🍿',
      public: false,
    }),
  });

  return {
    id: playlist.id,
    url: playlist.external_urls?.spotify || null,
    name: playlist.name,
  };
}

export async function getPlaylist(token, playlistId) {
  try {
    const playlist = await apiRequest(
      token,
      `/playlists/${playlistId}?fields=id,name,external_urls,tracks(total),items(total)`
    );
    return {
      id: playlist.id,
      url: playlist.external_urls?.spotify || null,
      name: playlist.name,
      total: playlist.tracks?.total ?? playlist.items?.total ?? 0,
    };
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

/** A API atual só libera os itens ao dono/colaborador da playlist. */
export async function importPlaylist(token, playlistId, limit = 1000) {
  const playlist = await apiRequest(token, `/playlists/${playlistId}`);
  const available = playlist.items || playlist.tracks;
  if (!available) throw Object.assign(new Error('O Spotify só permite importar playlists da conta conectada ou das quais ela é colaboradora.'), { status: 403 });
  const tracks = []; let skipped = 0, offset = 0, more = true;
  while (more && offset < limit) {
    const page = await apiRequest(token, `/playlists/${playlistId}/items?limit=100&offset=${offset}`);
    for (const row of page.items || []) {
      if (tracks.length + skipped >= limit) break;
      const item = row.item || row.track;
      if (!item?.name || !item.artists?.length || row.is_local || item.type === 'episode') { skipped++; continue; }
      tracks.push({ title: item.name.slice(0, 300), artist: item.artists.map(artist => artist.name).join(', ').slice(0, 300),
        album: item.album?.name || null, coverUrl: item.album?.images?.[0]?.url || null,
        durationSec: Math.round((item.duration_ms || 0) / 1000) || null, sourceId: null });
      if (tracks.length + skipped >= limit) break;
    }
    offset += page.items?.length || 0; more = Boolean(page.next) && Boolean(page.items?.length);
  }
  return { name: playlist.name || 'Playlist do Spotify', description: '', coverUrl: playlist.images?.[0]?.url || null,
    tracks, skipped, total: available.total ?? tracks.length + skipped, truncated: more || Number(available.total) > tracks.length + skipped };
}

/** URIs já presentes na playlist remota — evita duplicar em re-sync. */
export async function listPlaylistTrackUris(token, playlistId) {
  const uris = new Set();
  // No endpoint novo a faixa vem em `item`, nao em `track`. Pedir
  // fields=items(track(uri)) devolve objetos vazios, e a playlist
  // parecia sempre vazia -- por isso o re-sync duplicava tudo.
  let url = `/playlists/${playlistId}/items?fields=items(item(uri),track(uri)),next&limit=100`;

  while (url) {
    const page = await apiRequest(token, url);
    for (const entry of page?.items || []) {
      const uri = entry?.item?.uri || entry?.track?.uri;
      if (uri) uris.add(uri);
    }
    url = page?.next ? page.next.replace(API, '') : null;
  }

  return uris;
}

export async function addTracks(token, playlistId, uris) {
  for (const batch of chunk(uris, 100)) {
    await apiRequest(token, `/playlists/${playlistId}/items`, {
      method: 'POST',
      body: JSON.stringify({ uris: batch }),
    });
  }
}
