import { Router } from 'express';
import { parsePlaylistUrl, readPlaylist } from '../lib/playlistImport.js';

export function createImportRouter({ native = false } = {}) {
  const router = Router();
  router.post('/playlist', async (req, res, next) => {
    try {
      const { url, profile } = req.body || {};
      if (!['eduardo', 'laura'].includes(profile)) return res.status(400).json({ error: 'Perfil inválido.' });
      const source = parsePlaylistUrl(url);
      // Tokens Spotify ficam exclusivamente na API remota.
      if (native && source.platform === 'spotify') return next();
      res.json(await readPlaylist(source, profile));
    } catch (error) { next(error); }
  });
  return router;
}
