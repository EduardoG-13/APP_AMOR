import { TtlCache } from './cache.js';
import { fetchJson } from './http.js';
import { getLyrics as getInnertubeLyrics } from './innertube.js';
import { normalizeArtist, normalizeTitle } from './match.js';

/**
 * Letra da música.
 *
 * O YouTube Music só devolve o texto corrido — não dá pra acompanhar
 * a música. Quem tem letra sincronizada (com marcação de tempo) é o
 * LRCLIB: aberto, sem chave e sem cadastro. Então tentamos ele
 * primeiro e caímos no texto do YouTube quando a faixa não estiver
 * catalogada lá.
 */

const LRCLIB = 'https://lrclib.net/api';
const USER_AGENT = 'NossaSessao/1.0 (app privado de casal)';

const cache = new TtlCache({ ttlMs: 24 * 60 * 60 * 1000, maxEntries: 300 });

/** "[01:23.45] verso" -> { timeSec, text } */
function parseLrc(lrc) {
  const lines = [];

  for (const rawLine of String(lrc).split('\n')) {
    const stamps = [...rawLine.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (stamps.length === 0) continue;

    const text = rawLine.replace(/\[[^\]]*\]/g, '').trim();

    for (const stamp of stamps) {
      const minutes = Number(stamp[1]);
      const seconds = Number(stamp[2]);
      const fraction = stamp[3] ? Number(`0.${stamp[3]}`) : 0;
      lines.push({ timeSec: minutes * 60 + seconds + fraction, text });
    }
  }

  lines.sort((a, b) => a.timeSec - b.timeSec);
  return lines;
}

function isCloseEnough(candidate, target) {
  const titleOk =
    normalizeTitle(candidate.trackName).includes(normalizeTitle(target.title)) ||
    normalizeTitle(target.title).includes(normalizeTitle(candidate.trackName));
  const artistOk =
    normalizeArtist(candidate.artistName).includes(normalizeArtist(target.artist)) ||
    normalizeArtist(target.artist).includes(normalizeArtist(candidate.artistName));

  return titleOk && artistOk;
}

async function fromLrclib({ title, artist, album, durationSec }) {
  const headers = { 'User-Agent': USER_AGENT };

  // Busca exata: é a que devolve a versão com o tempo certo.
  if (title && artist) {
    const params = new URLSearchParams({ track_name: title, artist_name: artist });
    if (album) params.set('album_name', album);
    if (durationSec) params.set('duration', String(Math.round(durationSec)));

    const exact = await fetchJson(`${LRCLIB}/get?${params.toString()}`, { headers });
    if (exact.ok && exact.body?.syncedLyrics) {
      return {
        synced: parseLrc(exact.body.syncedLyrics),
        text: exact.body.plainLyrics || null,
        source: 'LRCLIB',
      };
    }
  }

  // Sem match exato: procura e aceita o melhor parecido.
  const search = await fetchJson(
    `${LRCLIB}/search?${new URLSearchParams({ track_name: title || '', artist_name: artist || '' })}`,
    { headers }
  );

  if (search.ok && Array.isArray(search.body)) {
    const withSync = search.body.filter((item) => item.syncedLyrics);
    const best =
      withSync.find((item) => isCloseEnough(item, { title, artist })) || withSync[0] || null;

    if (best?.syncedLyrics) {
      return {
        synced: parseLrc(best.syncedLyrics),
        text: best.plainLyrics || null,
        source: 'LRCLIB',
      };
    }

    const plainOnly = search.body.find((item) => item.plainLyrics);
    if (plainOnly) {
      return { synced: null, text: plainOnly.plainLyrics, source: 'LRCLIB' };
    }
  }

  return null;
}

export async function getSongLyrics(sourceId, meta = {}) {
  return cache.remember(`${sourceId}:${meta.title || ''}`, async () => {
    try {
      const fromLrc = await fromLrclib(meta);
      if (fromLrc) return fromLrc;
    } catch {
      // LRCLIB fora do ar não pode derrubar a letra: segue pro YouTube.
    }

    const fallback = await getInnertubeLyrics(sourceId);
    return { synced: null, text: fallback.text, source: fallback.source };
  });
}
