/**
 * Leitura e organização da lista do provedor.
 *
 * Uma lista de IPTV chega como uma pilha única de dezenas de milhares
 * de linhas, misturando canal ao vivo, filme e episódio de série. Sem
 * classificar, a tela de séries mostraria os 600 episódios soltos em
 * vez das 30 séries. É isso que este módulo resolve.
 */

const ADULT_PATTERNS =
  /\b(adult[oa]s?|xxx|porn|erotic[oa]?|sexy|\+\s?18|18\+|hot\s*tv|playboy|brasileirinhas|privacy)\b/i;

const MOVIE_GROUP_PATTERNS = /\b(filmes?|movies?|vod|cinema|lançamentos|lancamentos)\b/i;
const SERIES_GROUP_PATTERNS = /\b(s[ée]ries?|series|novelas?|animes?|doramas?|temporadas?)\b/i;

/** A vírgula do nome fica fora das aspas dos atributos (logos podem ter vírgulas). */
export function parseExtinf(line) {
  let quote = null, comma = -1;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quote) { if (char === quote) quote = null; }
    else if (char === '"' || char === "'") quote = char;
    else if (char === ',') { comma = i; break; }
  }
  const attrs = comma < 0 ? line : line.slice(0, comma);
  const attr = (name) => attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`))?.[2] || null;
  return { name: (comma < 0 ? '' : line.slice(comma + 1)).trim() || 'Sem nome',
    logo: attr('tvg-logo'), group: attr('group-title') };
}

export function resolveMediaUrl(value, base) {
  if (!value) return null;
  try { const url = new URL(value, base); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

/**
 * Padrões de episódio: "S01E09", "S01 E09", "1x09".
 * O que vem antes é o nome da série; o que vem depois costuma ser
 * o título do episódio.
 */
const EPISODE_PATTERNS = [
  /^(.*?)[\s._-]+S(\d{1,2})\s*E(\d{1,3})\b(.*)$/i,
  /^(.*?)[\s._-]+(\d{1,2})x(\d{1,3})\b(.*)$/i,
];

/** Sujeira de qualidade que atrapalha agrupar e buscar no TMDB. */
const QUALITY_NOISE =
  /\b(4k|uhd|fhd|hd|sd|h265|h264|x265|x264|dublado|legendado|dual[\s-]?[aá]udio|leg|dub|multi|\[l\]|\[4k\]|\[fhd\]|\[hd\])\b/gi;

export function cleanTitle(value) {
  return String(value || '')
    .replace(QUALITY_NOISE, ' ')
    .replace(/\s*[\[(]\s*[\])]\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–|]+|[\s\-–|]+$/g, '')
    .trim();
}

/** Tira o ano do fim do nome e devolve os dois separados. */
export function splitYear(value) {
  const match = String(value || '').match(/^(.*?)[\s([]*((?:19|20)\d{2})[\s)\]]*$/);
  if (match && match[1].trim().length >= 2) {
    return { title: match[1].trim(), year: Number(match[2]) };
  }
  return { title: String(value || '').trim(), year: null };
}

export function parseEpisode(name) {
  for (const pattern of EPISODE_PATTERNS) {
    const match = String(name || '').match(pattern);
    if (!match) continue;

    return {
      seriesName: cleanTitle(match[1]),
      season: Number(match[2]),
      episode: Number(match[3]),
      episodeTitle: cleanTitle(match[4] || ''),
    };
  }
  return null;
}

export function isAdultContent(name, group) {
  return ADULT_PATTERNS.test(`${name || ''} ${group || ''}`);
}

/**
 * Descobre se a entrada é canal ao vivo, filme ou episódio de série.
 * A URL é a pista mais confiável (o Xtream separa em /live/, /movie/
 * e /series/); grupo e nome entram como desempate.
 */
export function classifyEntry({ name, group, url }) {
  let path = '';
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    path = String(url || '').toLowerCase();
  }

  if (path.includes('/series/')) return 'series';
  if (path.includes('/movie/')) return 'movie';
  if (path.includes('/live/')) {
    // Alguns provedores jogam tudo em /live/, então o nome ainda vale.
    return parseEpisode(name) ? 'series' : 'live';
  }

  if (parseEpisode(name)) return 'series';
  if (SERIES_GROUP_PATTERNS.test(group || '')) return 'series';
  if (MOVIE_GROUP_PATTERNS.test(group || '')) return 'movie';

  // Extensão de arquivo indica conteúdo sob demanda.
  if (/\.(mp4|mkv|avi|m4v)$/i.test(path)) return 'movie';

  return 'live';
}

function normalizeSeriesKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

export function parseM3u(content) {
  const lines = content.split(/\r?\n/);
  const entries = [];
  let pending = null;
  let index = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      pending = parseExtinf(line);
      continue;
    }

    if (line.startsWith('#EXTGRP:') && pending) {
      pending.group = line.slice('#EXTGRP:'.length).trim() || pending.group;
      continue;
    }

    if (line.startsWith('#')) continue;
    if (!pending) continue;

    index += 1;
    const group = pending.group || 'Sem categoria';
    const kind = classifyEntry({ name: pending.name, group, url: line });
    const episode = kind === 'series' ? parseEpisode(pending.name) : null;

    entries.push({
      id: `ch-${index}`,
      name: pending.name,
      url: normalizeStreamUrl(line),
      logo: pending.logo,
      group,
      kind,
      adult: isAdultContent(pending.name, group),
      seriesName: episode?.seriesName || null,
      seriesKey: episode ? normalizeSeriesKey(episode.seriesName) : null,
      season: episode?.season ?? null,
      episode: episode?.episode ?? null,
      episodeTitle: episode?.episodeTitle || null,
    });

    pending = null;
  }

  return entries;
}

/**
 * Mesmo pedindo m3u8 ao provedor, muita lista devolve canal ao vivo
 * em `.ts`. No padrão Xtream o mesmo canal existe em `.m3u8` — é só
 * trocar a extensão. Sem isso o player recebe um fluxo que não sabe
 * ler e fica carregando pra sempre.
 */
export function normalizeStreamUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (/^\/live\/[^/]+\/[^/]+\/\d+\.ts$/i.test(url.pathname)) {
      url.pathname = url.pathname.replace(/\.ts$/i, '.m3u8');
      return url.href;
    }
  } catch {
    // URL fora do padrão: deixa como veio.
  }
  return rawUrl;
}

/** Junta os episódios soltos nas séries a que pertencem. */
export function buildSeriesIndex(entries) {
  const series = new Map();

  for (const entry of entries) {
    if (entry.kind !== 'series' || !entry.seriesKey) continue;

    let record = series.get(entry.seriesKey);
    if (!record) {
      record = {
        key: entry.seriesKey,
        name: entry.seriesName,
        group: entry.group,
        logo: entry.logo,
        adult: entry.adult,
        seasons: new Set(),
        episodes: [],
      };
      series.set(entry.seriesKey, record);
    }

    if (!record.logo && entry.logo) record.logo = entry.logo;
    if (entry.season != null) record.seasons.add(entry.season);
    record.episodes.push(entry);
  }

  for (const record of series.values()) {
    record.episodes.sort(
      (a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0)
    );
  }

  return series;
}

export function summarizeGroups(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const key = entry.group || 'Sem categoria';
    const current = counts.get(key) || { count: 0, adult: false };
    current.count += 1;
    current.adult = current.adult || entry.adult;
    counts.set(key, current);
  }

  return [...counts.entries()]
    .map(([title, data]) => ({ title, count: data.count, adult: data.adult }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'pt-BR'));
}
