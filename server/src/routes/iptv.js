import { Router } from 'express';
import { env } from '../env.js';
import { assertSafeUrl } from '../lib/http.js';
import { ingest, getIndex, listSeries, queryChannels, seriesEpisodes } from '../lib/m3uStore.js';

export const iptvRouter = Router();

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

    // Baixa e processa em fluxo: listas de 200 mil canais não cabem
    // na memória do servidor.
    const index = await ingest(sourceUrl, playerHeaders());

    res.json({
      sourceKey: index.sourceKey,
      totalChannels: index.total,
      counts: index.counts,
      totalSeries: index.series.length,
      groups: index.groups,
    });
  } catch (error) {
    next(error);
  }
});

const EXPIRED = {
  error: 'A lista expirou no servidor. Carregue a lista de novo.',
  code: 'SOURCE_EXPIRED',
};

function readPaging(req) {
  return {
    page: Math.max(Number(req.query.page) || 1, 1),
    pageSize: Math.min(Math.max(Number(req.query.pageSize) || 60, 1), 200),
  };
}

/** Canais ao vivo e filmes. Episódios vêm agrupados em /series. */
iptvRouter.get('/channels', async (req, res, next) => {
  try {
    const result = await queryChannels(String(req.query.src || ''), {
      kind: req.query.kind ? String(req.query.kind) : null,
      group: req.query.group ? String(req.query.group) : null,
      q: req.query.q ? String(req.query.q) : '',
      // Conteúdo adulto só aparece destravado com o PIN.
      includeAdult: req.query.adult === '1',
      ...readPaging(req),
    });

    if (!result) return res.status(410).json(EXPIRED);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * As séries, agrupadas. É o que evita a tela mostrar 600 episódios
 * quando o que existe ali são 30 séries.
 */
iptvRouter.get('/series', (req, res) => {
  const { page, pageSize } = readPaging(req);
  const result = listSeries(String(req.query.src || ''), {
    group: req.query.group ? String(req.query.group) : null,
    q: req.query.q ? String(req.query.q) : '',
    includeAdult: req.query.adult === '1',
    page,
    pageSize: Math.min(pageSize, 48),
  });

  if (!result) return res.status(410).json(EXPIRED);
  res.json(result);
});

iptvRouter.get('/series/:key/episodes', async (req, res, next) => {
  try {
    if (!getIndex(String(req.query.src || ''))) return res.status(410).json(EXPIRED);

    const detail = await seriesEpisodes(String(req.query.src || ''), req.params.key);
    if (!detail) return res.status(404).json({ error: 'Série não encontrada nesta lista.' });

    res.json(detail);
  } catch (error) {
    next(error);
  }
});
