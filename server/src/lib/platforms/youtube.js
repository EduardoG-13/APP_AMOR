import { env, hasGoogle } from '../../env.js';
import { fetchJson } from '../http.js';
import { getOAuthAccount, saveOAuthAccount } from '../supabase.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/youtube/v3';

export const SCOPES = ['https://www.googleapis.com/auth/youtube'];

export function redirectUri() {
  return `${env.publicBaseUrl}/api/oauth/google/callback`;
}

export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: env.google.clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SCOPES.join(' '),
    state,
    // Sem estes dois o Google não devolve refresh_token e a conexão
    // morre em 1 hora.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function tokenRequest(body) {
  const { ok, status, body: payload } = await fetchJson(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      ...body,
    }).toString(),
  });

  if (!ok) {
    throw Object.assign(
      new Error(
        `Google recusou o token: ${payload?.error_description || payload?.error || status}`
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
    const reason = body?.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      throw Object.assign(
        new Error(
          'A cota diária da API do YouTube acabou (10.000 pontos/dia ≈ 200 faixas). Tenta de novo amanhã.'
        ),
        { status: 429 }
      );
    }
    throw Object.assign(
      new Error(`YouTube respondeu ${status}: ${body?.error?.message || 'erro desconhecido'}`),
      { status: status === 404 ? 404 : 502 }
    );
  }

  return body;
}

export async function getProfileInfo(token) {
  const data = await apiRequest(token, '/channels?part=snippet&mine=true');
  const channel = data?.items?.[0];
  return {
    id: channel?.id || null,
    display_name: channel?.snippet?.title || null,
  };
}

export async function getValidToken(profile) {
  if (!hasGoogle()) {
    throw Object.assign(new Error('YouTube não configurado no backend.'), { status: 503 });
  }

  const account = await getOAuthAccount('google', profile);
  if (!account) {
    throw Object.assign(new Error(`${profile} ainda não conectou a conta do YouTube.`), {
      status: 409,
      code: 'NOT_CONNECTED',
    });
  }

  const expiresAt = account.expires_at ? new Date(account.expires_at).getTime() : 0;
  if (expiresAt - Date.now() > 60_000) return account.access_token;

  if (!account.refresh_token) {
    throw Object.assign(new Error('Token do YouTube expirou. Reconecte a conta.'), { status: 409 });
  }

  const refreshed = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: account.refresh_token,
  });

  await saveOAuthAccount({
    provider: 'google',
    profile,
    access_token: refreshed.access_token,
    refresh_token: account.refresh_token,
    expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
    scope: refreshed.scope || account.scope,
    remote_user_id: account.remote_user_id,
    display_name: account.display_name,
  });

  return refreshed.access_token;
}

export async function createPlaylist(token, { name, description }) {
  const playlist = await apiRequest(token, '/playlists?part=snippet,status', {
    method: 'POST',
    body: JSON.stringify({
      snippet: {
        title: name,
        description: description || 'Playlist do casal, criada pelo Nossa Sessão 🍿',
      },
      status: { privacyStatus: 'private' },
    }),
  });

  return {
    id: playlist.id,
    url: `https://music.youtube.com/playlist?list=${playlist.id}`,
    name: playlist.snippet?.title || name,
  };
}

export async function getPlaylist(token, playlistId) {
  const data = await apiRequest(
    token,
    `/playlists?part=snippet,contentDetails&id=${encodeURIComponent(playlistId)}`
  );
  const playlist = data?.items?.[0];
  if (!playlist) return null;

  return {
    id: playlist.id,
    url: `https://music.youtube.com/playlist?list=${playlist.id}`,
    name: playlist.snippet?.title || null,
    total: playlist.contentDetails?.itemCount ?? 0,
  };
}

export async function listPlaylistVideoIds(token, playlistId) {
  const ids = new Set();
  let pageToken = '';

  do {
    const page = await apiRequest(
      token,
      `/playlistItems?part=contentDetails&maxResults=50&playlistId=${encodeURIComponent(
        playlistId
      )}${pageToken ? `&pageToken=${pageToken}` : ''}`
    );

    for (const item of page?.items || []) {
      if (item?.contentDetails?.videoId) ids.add(item.contentDetails.videoId);
    }
    pageToken = page?.nextPageToken || '';
  } while (pageToken);

  return ids;
}

/**
 * Aqui não existe "procurar equivalente": as faixas já nasceram do
 * YouTube Music, então o videoId é o mesmo. Match perfeito.
 */
export async function addVideo(token, playlistId, videoId) {
  await apiRequest(token, '/playlistItems?part=snippet', {
    method: 'POST',
    body: JSON.stringify({
      snippet: {
        playlistId,
        resourceId: { kind: 'youtube#video', videoId },
      },
    }),
  });
}
