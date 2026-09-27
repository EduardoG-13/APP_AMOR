import { Innertube } from 'youtubei.js';
import { TtlCache } from './cache.js';

/**
 * Camada sobre o InnerTube (a API interna que o próprio YouTube Music
 * usa). É daqui que sai busca, capa, duração, letra e a URL do áudio.
 *
 * A biblioteca muda o formato dos objetos entre versões, então tudo
 * aqui lê de forma defensiva e cai num fallback em vez de quebrar.
 */

let clientPromise = null;

export function getClient() {
  if (!clientPromise) {
    clientPromise = Innertube.create({
      lang: 'pt',
      location: 'BR',
      retrieve_player: true,
      generate_session_locally: true,
    }).catch((error) => {
      // Sem isso um erro de rede na primeira chamada deixaria a
      // promise rejeitada em cache pra sempre.
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

const searchCache = new TtlCache({ ttlMs: 10 * 60 * 1000, maxEntries: 200 });
const lyricsCache = new TtlCache({ ttlMs: 24 * 60 * 60 * 1000, maxEntries: 200 });

function readText(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.text === 'string') return value.text;
  if (typeof value.toString === 'function') {
    const asString = value.toString();
    return asString === '[object Object]' ? null : asString;
  }
  return null;
}

/** As thumbs do YT Music vêm em 60x60; dá pra pedir a versão grande. */
function upscaleThumbnail(url, size = 544) {
  if (!url) return null;
  return url
    .replace(/=w\d+-h\d+/, `=w${size}-h${size}`)
    .replace(/\/(?:default|mqdefault|hqdefault)\.jpg/, '/maxresdefault.jpg');
}

function pickThumbnail(item) {
  const candidates =
    item?.thumbnail?.contents ||
    item?.thumbnails ||
    item?.thumbnail?.thumbnails ||
    item?.author?.thumbnails ||
    [];

  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const largest = [...candidates].sort((a, b) => (b?.width || 0) - (a?.width || 0))[0];
  return upscaleThumbnail(largest?.url || null);
}

function readArtists(item) {
  if (Array.isArray(item?.artists) && item.artists.length) {
    return item.artists
      .map((artist) => readText(artist?.name) || readText(artist))
      .filter(Boolean)
      .join(', ');
  }

  const author = readText(item?.author?.name) || readText(item?.author);
  if (author) return author.replace(/\s*-\s*Topic$/i, '');

  // Último recurso: as "flex columns" cruas da resposta.
  const flex = item?.flex_columns;
  if (Array.isArray(flex) && flex[1]) {
    const runs = flex[1]?.title?.runs || flex[1]?.text?.runs;
    if (Array.isArray(runs)) {
      const text = runs.map((run) => run?.text).filter(Boolean).join('');
      if (text) return text.split('•')[0].trim();
    }
  }

  return 'Artista desconhecido';
}

function readDuration(item) {
  const seconds =
    item?.duration?.seconds ??
    item?.duration_seconds ??
    item?.duration?.seconds_total ??
    null;
  if (typeof seconds === 'number' && Number.isFinite(seconds)) return seconds;

  const text = readText(item?.duration?.text) || readText(item?.duration);
  if (text && /^\d+:\d{2}/.test(text)) {
    const parts = text.split(':').map(Number).reverse();
    return parts.reduce((total, part, index) => total + part * 60 ** index, 0);
  }

  return null;
}

function toStreamTrack(item) {
  const sourceId = item?.id || item?.video_id || item?.videoId;
  const title = readText(item?.title) || readText(item?.name);
  if (!sourceId || !title) return null;

  return {
    sourceId,
    source: 'ytmusic',
    title: title.trim(),
    artist: readArtists(item),
    album: readText(item?.album?.name) || readText(item?.album) || null,
    coverUrl: pickThumbnail(item),
    durationSec: readDuration(item),
    isExplicit: Boolean(item?.badges?.some?.((badge) => /explicit/i.test(readText(badge) || ''))),
  };
}

/** Acha itens de música em qualquer formato de resposta que venha. */
function collectItems(node, found = [], depth = 0) {
  if (!node || depth > 6 || found.length > 120) return found;

  if (Array.isArray(node)) {
    for (const child of node) collectItems(child, found, depth + 1);
    return found;
  }

  if (typeof node !== 'object') return found;

  const isTrackLike =
    (node.id || node.video_id) &&
    node.title &&
    (node.item_type === 'song' ||
      node.item_type === 'video' ||
      node.type === 'MusicResponsiveListItem' ||
      node.type === 'PlaylistPanelVideo' ||
      node.duration);

  if (isTrackLike) {
    found.push(node);
    return found;
  }

  for (const key of ['contents', 'content', 'primary', 'items', 'results', 'songs', 'videos', 'sections']) {
    if (node[key]) collectItems(node[key], found, depth + 1);
  }

  return found;
}

export async function searchMusic(query, limit = 25) {
  const key = `${query.toLowerCase()}::${limit}`;

  return searchCache.remember(key, async () => {
    const yt = await getClient();

    let raw;
    try {
      raw = await yt.music.search(query, { type: 'song' });
    } catch {
      // Se o YT Music recusar a query, cai na busca normal do YouTube.
      raw = await yt.search(query, { type: 'video' });
    }

    const pool = raw?.songs?.contents?.length ? raw.songs.contents : collectItems(raw);

    const seen = new Set();
    const tracks = [];
    for (const item of pool) {
      const track = toStreamTrack(item);
      if (!track || seen.has(track.sourceId)) continue;
      seen.add(track.sourceId);
      tracks.push(track);
      if (tracks.length >= limit) break;
    }

    return tracks;
  });
}

export async function getLyrics(sourceId) {
  return lyricsCache.remember(sourceId, async () => {
    const yt = await getClient();

    try {
      const lyrics = await yt.music.getLyrics(sourceId);
      const text =
        readText(lyrics?.description) ||
        readText(lyrics?.text) ||
        readText(lyrics?.contents?.description);

      if (text) {
        return { text, source: readText(lyrics?.footer) || 'YouTube Music' };
      }
    } catch {
      // Muita faixa simplesmente não tem letra cadastrada.
    }

    return { text: null, source: null };
  });
}

/** Rádio da faixa: alimenta o autoplay quando a fila termina. */
export async function getRadio(sourceId, limit = 20) {
  const yt = await getClient();

  let raw;
  try {
    raw = await yt.music.getUpNext(sourceId, true);
    if (collectItems(raw).length < 2) raw = await yt.music.getRelated(sourceId);
  } catch {
    try {
      raw = await yt.music.getRelated(sourceId);
    } catch {
      return [];
    }
  }

  const seen = new Set([sourceId]);
  const tracks = [];
  for (const item of collectItems(raw)) {
    const track = toStreamTrack(item);
    if (!track || seen.has(track.sourceId)) continue;
    seen.add(track.sourceId);
    tracks.push(track);
    if (tracks.length >= limit) break;
  }

  return tracks;
}
