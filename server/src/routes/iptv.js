import { Router } from 'express';
import crypto from 'node:crypto';
import { env } from '../env.js';
import { TtlCache } from '../lib/cache.js';
import { assertSafeUrl, fetchText } from '../lib/http.js';
import { buildSeriesIndex, parseM3u, splitYear, summarizeGroups } from '../lib/m3u.js';

export const iptvRouter = Router();

/**
 * Listas de IPTV costumam ter dezenas de milhares de entradas, então
 * a lista inteira fica aqui no servidor, já classificada, e o
 * frontend pede por tipo, categoria e página. Mandar tudo de uma vez
 * trava o celular.
 */
const sourceCache = new TtlCache({ ttlMs: 60 * 60 * 1000, maxEntries: 8 });

function playerHeaders() {
  return { 'User-Agent': env.iptvUserAgent, Accept: '*/*' };
}

function buildXtreamM3uUrl({ host, username, password }) {
  const base = /^https?:\/\//i.test(host) ? host : `http://${host}`;
  const url = new URL(base.replace(/\/+$/, ''));
  url.pathname = '/get.php';
  url.search = new URLSearchParams({
    username,
    password,
    type: 'm3u_plus',
    // hls, não ts: navegador nenhum toca MPEG-TS puro.
    output: 'm3u8',
  }).toString();
  return url.href;
}

function kindSummary(entries) {
  return {
    live: entries.filter((entry) => entry.kind === 'live').length,
    movie: entries.filter((entry) => entry.kind === 'movie').length,
    series: entries.filter((entry) => entry.kind === 'series').length,
    adult: entries.filter((entry) => entry.adult).length,
  };
}

iptvRouter.post('/parse', async (req, res, next) => {
  try {
    const { m3uUrl, xtream } = req.body || {};

    let sourceUrl;
    if (m3uUrl) {
      sourceUrl = String(m3uUrl).trim();
    } else if (xtream?.host && xtream?.username && xtream?.password) {
      sourceUrl = buildXtreamM3uUrl(xtream);
    } else {
      return res
        .status(400)
        .json({ error: 'Informe a URL da lista M3U ou os dados do Xtream (host, usuário e senha).' });
    }

    await assertSafeUrl(sourceUrl);

    const { text } = await fetchText(sourceUrl, {
      headers: playerHeaders(),
      timeoutMs: 120_000, // listas grandes demoram
    });

    if (!text.includes('#EXTM3U') && !text.includes('#EXTINF')) {
      return res.status(422).json({
        error:
          'O endereço respondeu, mas não parece uma lista M3U. Confira a URL ou os dados do Xtream.',
      });
    }

    const entries = parseM3u(text);
    if (entries.length === 0) {
      return res.status(422).json({ error: 'A lista veio vazia — nenhum canal encontrado.' });
    }

    const series = buildSeriesIndex(entries);
    const sourceKey = crypto.createHash('sha1').update(sourceUrl).digest('hex').slice(0, 16);
    sourceCache.set(sourceKey, { entries, series });

    res.json({
      sourceKey,
      totalChannels: entries.length,
      counts: kindSummary(entries),
      totalSeries: series.size,
      groups: {
        live: summarizeGroups(entries.filter((entry) => entry.kind === 'live')),
        movie: summarizeGroups(entries.filter((entry) => entry.kind === 'movie')),
        series: summarizeGroups(entries.filter((entry) => entry.kind === 'series')),
      },
    });
  } catch (error) {
    next(error);
  }
});

function loadSource(req, res) {
  const source = sourceCache.get(String(req.query.src || ''));
  if (!source) {
    res.status(410).json({
      error: 'A lista expirou no servidor. Carregue a lista de novo.',
      code: 'SOURCE_EXPIRED',
    });
    return null;
  }
  return source;
}

function paginate(items, req) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 60, 1), 200);
  const start = (page - 1) * pageSize;
  return { slice: items.slice(start, start + pageSize), total: items.length, page, pageSize };
}

/** Canais ao vivo e filmes. Episódios soltos ficam de fora — eles vêm agrupados em /series. */
iptvRouter.get('/channels', (req, res) => {
  const source = loadSource(req, res);
  if (!source) return;

  const kind = req.query.kind ? String(req.query.kind) : null;
  const group = req.query.group ? String(req.query.group) : null;
  const query = String(req.query.q || '').trim().toLowerCase();
  // Conteúdo adulto só aparece quando destravado com o PIN.
  const includeAdult = req.query.adult === '1';

  let filtered = source.entries;
  if (kind) filtered = filtered.filter((entry) => entry.kind === kind);
  if (!includeAdult) filtered = filtered.filter((entry) => !entry.adult);
  if (group) filtered = filtered.filter((entry) => entry.group === group);
  if (query) filtered = filtered.filter((entry) => entry.name.toLowerCase().includes(query));

  const { slice, total, page, pageSize } = paginate(filtered, req);
  res.json({ channels: slice, total, page, pageSize });
});

/**
 * As séries, agrupadas. É o que evita a tela mostrar 600 episódios
 * quando o que existe ali são 30 séries.
 */
iptvRouter.get('/series', (req, res) => {
  const source = loadSource(req, res);
  if (!source) return;

  const group = req.query.group ? String(req.query.group) : null;
  const query = String(req.query.q || '').trim().toLowerCase();
  const includeAdult = req.query.adult === '1';

  let list = [...source.series.values()].map((record) => {
    const { title, year } = splitYear(record.name);
    return {
      key: record.key,
      name: record.name,
      searchTitle: title,
      year,
      group: record.group,
      logo: record.logo,
      adult: record.adult,
      seasonCount: record.seasons.size,
      episodeCount: record.episodes.length,
    };
  });

  if (!includeAdult) list = list.filter((item) => !item.adult);
  if (group) list = list.filter((item) => item.group === group);
  if (query) list = list.filter((item) => item.name.toLowerCase().includes(query));

  list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const { slice, total, page, pageSize } = paginate(list, req);
  res.json({ series: slice, total, page, pageSize });
});

/** Os episódios de uma série, já em ordem de temporada e número. */
iptvRouter.get('/series/:key/episodes', (req, res) => {
  const source = loadSource(req, res);
  if (!source) return;

  const record = source.series.get(req.params.key);
  if (!record) return res.status(404).json({ error: 'Série não encontrada nesta lista.' });

  const { title, year } = splitYear(record.name);
  res.json({
    name: record.name,
    searchTitle: title,
    year,
    logo: record.logo,
    group: record.group,
    seasons: [...record.seasons].sort((a, b) => a - b),
    episodes: record.episodes,
  });
});
