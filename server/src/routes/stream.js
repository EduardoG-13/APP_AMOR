import { Router } from 'express';
import { env } from '../env.js';
import { assertSafeUrl, pipeResponseBody } from '../lib/http.js';
import {
  cacheStats,
  decodeTarget,
  fetchSegmentOnce,
  looksLikeManifest,
  rewriteManifest,
} from '../lib/hls.js';
import { requireMediaToken } from '../middleware/auth.js';

export const streamRouter = Router();

function playerHeaders() {
  return {
    'User-Agent': env.iptvUserAgent,
    Accept: '*/*',
  };
}

streamRouter.get('/stats', (_req, res) => {
  res.json(cacheStats());
});

/**
 * Proxy único de mídia: serve tanto o videoclipe do YouTube quanto os
 * canais de IPTV. Manifesto é reescrito na hora; segmento passa pelo
 * cache compartilhado, pra dois espectadores do mesmo canal gerarem
 * uma conexão só no provedor.
 */
streamRouter.get('/', requireMediaToken, async (req, res, next) => {
  try {
    const target = decodeTarget(req.query.u);
    if (!target) return res.status(400).json({ error: 'Parâmetro "u" ausente.' });

    await assertSafeUrl(target);

    const headers = playerHeaders();
    const hasRange = Boolean(req.headers.range);
    if (hasRange) headers.range = req.headers.range;

    // Manifesto: precisa ser lido e reescrito, e nunca cacheado —
    // num canal ao vivo ele muda a cada poucos segundos.
    if (looksLikeManifest(target, '')) {
      const upstream = await fetch(target, {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
      });

      if (!upstream.ok) {
        return res
          .status(upstream.status === 404 ? 404 : 502)
          .json({ error: `A origem respondeu ${upstream.status}.` });
      }

      const text = await upstream.text();
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(
        rewriteManifest(text, upstream.url || target, req.query.t ? String(req.query.t) : '')
      );
    }

    // Requisição com Range (filme em VOD, seek) não passa pelo cache:
    // guardar pedaços parciais só confundiria.
    if (hasRange) {
      const upstream = await fetch(target, {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
      });
      return pipeResponseBody(res, upstream, { cacheControl: 'no-store' });
    }

    const result = await fetchSegmentOnce(target, headers);

    if (result.tooLarge) {
      if (result.response) {
        return pipeResponseBody(res, result.response, { cacheControl: 'no-store' });
      }
      res.setHeader('Content-Type', result.contentType || 'video/mp2t');
      return res.send(result.buffered);
    }

    // Se o manifesto for reencontrado por content-type (URL sem
    // extensão), ainda dá tempo de reescrever.
    if (looksLikeManifest(target, result.contentType)) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(
        rewriteManifest(result.body.toString('utf8'), target, req.query.t ? String(req.query.t) : '')
      );
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Length', String(result.body.byteLength));
    res.setHeader('Cache-Control', 'no-store');
    res.send(result.body);
  } catch (error) {
    next(error);
  }
});
