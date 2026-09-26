import { Router } from 'express';
import { getRadio, searchMusic } from '../lib/innertube.js';
import { getSongLyrics } from '../lib/lyrics.js';
import { checkAvailable, getTrackInfo, resolveMedia, warmUp } from '../lib/ytdlp.js';
import { pipeUpstream } from '../lib/http.js';
import { looksLikeManifest, rewriteManifest } from '../lib/hls.js';
import { requireMediaToken } from '../middleware/auth.js';

export const musicRouter = Router();

musicRouter.get('/search', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Informe o que procurar em "q".' });
    }

    const limit = Math.min(Number(req.query.limit) || 25, 40);
    const tracks = await searchMusic(query, limit);
    res.json({ tracks });
  } catch (error) {
    next(error);
  }
});

musicRouter.get('/track/:id', async (req, res, next) => {
  try {
    res.json({ track: await getTrackInfo(req.params.id) });
  } catch (error) {
    next(error);
  }
});

musicRouter.get('/lyrics/:id', async (req, res, next) => {
  try {
    // Título, artista e duração melhoram muito o acerto no LRCLIB —
    // o player manda o que já tem em mãos.
    res.json(
      await getSongLyrics(req.params.id, {
        title: req.query.title ? String(req.query.title) : undefined,
        artist: req.query.artist ? String(req.query.artist) : undefined,
        album: req.query.album ? String(req.query.album) : undefined,
        durationSec: req.query.duration ? Number(req.query.duration) : undefined,
      })
    );
  } catch (error) {
    next(error);
  }
});

musicRouter.get('/radio/:id', async (req, res, next) => {
  try {
    res.json({ tracks: await getRadio(req.params.id) });
  } catch (error) {
    next(error);
  }
});

/**
 * Resolver o stream leva 1-3s. O player chama isto pra próxima faixa
 * da fila enquanto a atual toca, então a troca sai instantânea.
 */
musicRouter.post('/warm', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 5) : [];
  for (const id of ids) warmUp(String(id), req.body?.type === 'video' ? 'video' : 'audio');
  res.json({ ok: true, warming: ids.length });
});

musicRouter.get('/status', async (_req, res, next) => {
  try {
    res.json({ ytdlp: await checkAvailable() });
  } catch (error) {
    next(error);
  }
});

function extensionFor(mimeType) {
  if (!mimeType) return 'm4a';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mpeg')) return 'mp3';
  return 'm4a';
}

function sanitizeFilename(value) {
  return String(value || 'musica')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

/**
 * O navegador não pode puxar o áudio direto do Google: a URL é
 * assinada, amarrada ao IP de quem pediu e sem CORS. Então o stream
 * passa por aqui, preservando Range pro seek funcionar.
 */
async function streamMedia(req, res, next, type) {
  try {
    const media = await resolveMedia(req.params.id, { type });

    // Videoclipe vem como manifesto HLS (o YouTube não serve mais
    // áudio e vídeo no mesmo arquivo). Reescreve apontando os
    // segmentos pro proxy e entrega pro hls.js montar.
    if (media.isManifest) {
      const upstream = await fetch(media.url, { signal: AbortSignal.timeout(30_000) });
      if (!upstream.ok) {
        return res
          .status(502)
          .json({ error: `O YouTube respondeu ${upstream.status} ao pedir o videoclipe.` });
      }

      const text = await upstream.text();
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(
        rewriteManifest(text, upstream.url || media.url, req.query.t ? String(req.query.t) : '')
      );
    }

    if (looksLikeManifest(media.url, media.mimeType)) {
      return res.status(502).json({
        error: 'Essa faixa só existe em formato segmentado e não dá pra tocar direto.',
      });
    }

    res.setHeader('Content-Type', media.mimeType);
    if (req.query.download) {
      const name = sanitizeFilename(req.query.filename || req.params.id);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${name}.${extensionFor(media.mimeType)}"`
      );
    }

    await pipeUpstream(req, res, media.url, { cacheControl: 'private, max-age=3600' });
  } catch (error) {
    next(error);
  }
}

musicRouter.get('/audio/:id', requireMediaToken, (req, res, next) =>
  streamMedia(req, res, next, 'audio')
);

musicRouter.get('/video/:id', requireMediaToken, (req, res, next) =>
  streamMedia(req, res, next, 'video')
);
