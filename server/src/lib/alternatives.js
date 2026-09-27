import { env, hasSpotify } from '../env.js';
import { TtlCache } from './cache.js';
import { fetchJson } from './http.js';
import { pickBestMatch } from './match.js';

/**
 * Onde mais dá pra ouvir a faixa.
 *
 * O áudio completo vem do YouTube, e de servidor em datacenter o
 * YouTube recusa. Em vez de deixar o player só dando erro, buscamos
 * a mesma música na Deezer e no Spotify: a Deezer entrega uma prévia
 * de 30s pública (sem token nenhum), o suficiente pra confirmar que é
 * a música certa enquanto monta a playlist, e os dois devolvem o link
 * pra ouvir inteira no app de cada um.
 */

const cache = new TtlCache({ ttlMs: 12 * 60 * 60 * 1000, maxEntries: 500 });

/** Token de aplicativo do Spotify: serve só pra buscar no catálogo. */
let appToken = { value: null, expiresAt: 0 };

async function getSpotifyAppToken() {
  if (!hasSpotify()) return null;
  if (appToken.value && appToken.expiresAt > Date.now() + 30_000) return appToken.value;

  const basic = Buffer.from(`${env.spotify.clientId}:${env.spotify.clientSecret}`).toString(
    'base64'
  );

  const { ok, body } = await fetchJson('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!ok || !body?.access_token) return null;

  appToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in || 3600) * 1000,
  };
  return appToken.value;
}

async function findOnDeezer(target) {
  const query = `${target.title} ${target.artist}`.trim();
  const { ok, body } = await fetchJson(
    `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=8`
  );
  if (!ok || !Array.isArray(body?.data) || body.data.length === 0) return null;

  const candidates = body.data.map((item) => ({
    title: item.title_short || item.title,
    artist: item.artist?.name || '',
    durationSec: item.duration ?? null,
    url: item.link || `https://www.deezer.com/track/${item.id}`,
    // MP3 de 30s servido pela própria Deezer, liberado e com CORS.
    previewUrl: item.preview || null,
    coverUrl: item.album?.cover_big || item.album?.cover_medium || null,
  }));

  const best = pickBestMatch(target, candidates, { threshold: 0.55 });
  return best ? { ...best.candidate, score: best.score } : null;
}

async function findOnSpotify(target) {
  const token = await getSpotifyAppToken();
  if (!token) return null;

  const query = `track:${target.title} artist:${target.artist}`;
  const { ok, body } = await fetchJson(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=8&market=BR`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!ok || !body?.tracks?.items?.length) return null;

  const candidates = body.tracks.items.map((item) => ({
    title: item.name,
    artist: (item.artists || []).map((artist) => artist.name).join(', '),
    durationSec: item.duration_ms ? Math.round(item.duration_ms / 1000) : null,
    url: item.external_urls?.spotify || null,
    // O Spotify deixou de servir preview pra muita faixa; quando vier,
    // aproveitamos, mas a Deezer é a fonte confiável disso.
    previewUrl: item.preview_url || null,
    coverUrl: item.album?.images?.[0]?.url || null,
  }));

  const best = pickBestMatch(target, candidates, { threshold: 0.55 });
  return best ? { ...best.candidate, score: best.score } : null;
}

export async function findAlternatives(sourceId, target) {
  const key = `${sourceId}:${target.title || ''}`;

  return cache.remember(key, async () => {
    const [deezer, spotify] = await Promise.all([
      findOnDeezer(target).catch(() => null),
      findOnSpotify(target).catch(() => null),
    ]);

    return {
      deezer,
      spotify,
      // Quem tiver prévia manda; a da Deezer é a que quase sempre existe.
      previewUrl: deezer?.previewUrl || spotify?.previewUrl || null,
    };
  });
}
