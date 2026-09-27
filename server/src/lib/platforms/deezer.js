import { fetchJson } from '../http.js';
import { getOAuthAccount, saveOAuthAccount } from '../supabase.js';
import { pickBestMatch } from '../match.js';

/**
 * Deezer.
 *
 * A Deezer fechou o cadastro de novos apps de API e não dá previsão
 * de reabrir, então o OAuth oficial não é uma opção: não existe
 * client_id pra pedir. O caminho que funciona é o mesmo que o site
 * deles usa — a API interna `gw-light.php`, autenticada pelo cookie
 * `arl` da própria conta.
 *
 * Na prática: a Laura entra na conta dela no navegador, copia o
 * cookie `arl` e cola no app uma vez. Daí em diante dá pra criar e
 * atualizar playlist na conta dela normalmente.
 *
 * Duas ressalvas honestas:
 *  - é API não documentada, então pode mudar sem aviso;
 *  - o `arl` é credencial de sessão: vale como senha e expira se ela
 *    sair de todos os dispositivos. Fica só no Supabase, numa tabela
 *    que o frontend não consegue ler.
 *
 * Busca de faixa usa a API pública (api.deezer.com), que segue aberta
 * e não pede token nenhum.
 */

const GW_URL = 'https://www.deezer.com/ajax/gw-light.php';
const PUBLIC_API = 'https://api.deezer.com';
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

class DeezerSession {
  constructor(arl) {
    this.arl = arl;
    this.apiToken = '';
    this.sid = '';
    this.userId = null;
    this.displayName = null;
  }

  cookieHeader() {
    const parts = [`arl=${this.arl}`];
    if (this.sid) parts.push(`sid=${this.sid}`);
    return parts.join('; ');
  }

  async call(method, payload = {}) {
    const params = new URLSearchParams({
      method,
      input: '3',
      api_version: '1.0',
      api_token: method === 'deezer.getUserData' ? '' : this.apiToken,
    });

    const response = await fetch(`${GW_URL}?${params.toString()}`, {
      method: 'POST',
      headers: {
        Cookie: this.cookieHeader(),
        'User-Agent': BROWSER_UA,
        'Content-Type': 'text/plain;charset=UTF-8',
        Accept: '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });

    // O primeiro retorno traz o `sid`, que precisa acompanhar as
    // chamadas seguintes.
    const setCookie = response.headers.getSetCookie?.() || [];
    for (const cookie of setCookie) {
      const match = cookie.match(/^sid=([^;]+)/);
      if (match) this.sid = match[1];
    }

    if (!response.ok) {
      throw Object.assign(new Error(`Deezer respondeu ${response.status}.`), { status: 502 });
    }

    const data = await response.json();
    const errors = data?.error;
    const hasError = Array.isArray(errors) ? errors.length > 0 : errors && Object.keys(errors).length > 0;

    if (hasError) {
      const description = Array.isArray(errors) ? errors.join(', ') : Object.values(errors).join(', ');
      if (/token|VALID_TOKEN_REQUIRED|invalid/i.test(description)) {
        throw Object.assign(
          new Error('O cookie arl da Deezer expirou ou é inválido. Reconecte a conta.'),
          { status: 409, code: 'DEEZER_ARL_INVALID' }
        );
      }
      throw Object.assign(new Error(`Deezer recusou "${method}": ${description}`), { status: 502 });
    }

    return data?.results;
  }

  async login() {
    const results = await this.call('deezer.getUserData');
    this.apiToken = results?.checkForm || '';
    this.userId = results?.USER?.USER_ID || null;
    this.displayName = results?.USER?.BLOG_NAME || results?.USER?.FIRSTNAME || null;

    // Conta deslogada volta com USER_ID 0 em vez de dar erro.
    if (!this.apiToken || !this.userId || String(this.userId) === '0') {
      throw Object.assign(
        new Error('Cookie arl inválido — a Deezer não reconheceu a sessão.'),
        { status: 401, code: 'DEEZER_ARL_INVALID' }
      );
    }

    return this;
  }
}

export async function openSession(arl) {
  return new DeezerSession(arl).login();
}

export async function getSessionForProfile(profile) {
  const account = await getOAuthAccount('deezer', profile);
  const arl = account?.access_token;

  if (!arl) {
    throw Object.assign(
      new Error(
        `${profile} ainda não conectou a Deezer. Cole o cookie "arl" da conta nas configurações de música.`
      ),
      { status: 409, code: 'NOT_CONNECTED' }
    );
  }

  const session = await openSession(arl);

  // Guarda o nome só pra UI mostrar quem está conectado.
  if (account && session.displayName && account.display_name !== session.displayName) {
    await saveOAuthAccount({
      ...account,
      display_name: session.displayName,
      remote_user_id: String(session.userId),
    });
  }

  return session;
}

function toCandidate(item) {
  return {
    id: String(item.id),
    uri: `deezer:track:${item.id}`,
    title: item.title_short || item.title,
    artist: item.artist?.name || '',
    durationSec: item.duration ?? null,
    url: item.link || `https://www.deezer.com/track/${item.id}`,
  };
}

/** Busca na API pública — não precisa de token e é bem tolerante. */
export async function findTrack(target) {
  const attempts = [
    `track:"${target.title}" artist:"${target.artist}"`,
    `${target.title} ${target.artist}`,
    target.title,
  ];

  for (const query of attempts) {
    const { ok, body } = await fetchJson(
      `${PUBLIC_API}/search?q=${encodeURIComponent(query)}&limit=8`
    );
    if (!ok || !Array.isArray(body?.data)) continue;

    const candidates = body.data.map(toCandidate);
    const best = pickBestMatch(target, candidates);
    if (best) return best;
  }

  return null;
}

export async function createPlaylist(session, { name, description }) {
  const playlistId = await session.call('playlist.create', {
    title: name,
    description: description || 'Playlist do casal, criada pelo Nossa Sessão 🍿',
    songs: [],
    status: 0,
  });

  const id = String(playlistId);
  return {
    id,
    url: `https://www.deezer.com/playlist/${id}`,
    name,
  };
}

export async function getPlaylist(session, playlistId) {
  try {
    const results = await session.call('deezer.pagePlaylist', {
      playlist_id: String(playlistId),
      lang: 'pt',
      nb: 0,
      start: 0,
      tab: 0,
      tags: true,
      header: true,
    });

    const data = results?.DATA;
    if (!data) return null;

    return {
      id: String(playlistId),
      url: `https://www.deezer.com/playlist/${playlistId}`,
      name: data.TITLE || null,
      total: Number(data.NB_SONG) || 0,
    };
  } catch (error) {
    if (error.code === 'DEEZER_ARL_INVALID') throw error;
    return null;
  }
}

/** IDs já na playlist remota — sem isso o re-sync duplicaria tudo. */
export async function listPlaylistTrackIds(session, playlistId) {
  const ids = new Set();
  const results = await session.call('playlist.getSongs', {
    playlist_id: String(playlistId),
    nb: 2000,
    start: 0,
  });

  for (const song of results?.data || []) {
    if (song?.SNG_ID) ids.add(String(song.SNG_ID));
  }

  return ids;
}

export async function addTracks(session, playlistId, trackIds) {
  if (trackIds.length === 0) return;

  await session.call('playlist.addSongs', {
    playlist_id: String(playlistId),
    songs: trackIds.map((id) => [String(id), 0]),
    offset: -1,
  });
}
