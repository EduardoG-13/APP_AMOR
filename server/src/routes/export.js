import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';
import * as spotify from '../lib/platforms/spotify.js';
import * as youtube from '../lib/platforms/youtube.js';
import * as deezer from '../lib/platforms/deezer.js';
import { requireMediaToken } from '../middleware/auth.js';

export const exportRouter = Router();

const PROFILES = new Set(['eduardo', 'laura']);
const PLATFORMS = new Set(['spotify', 'youtube', 'deezer']);

async function loadPlaylist(playlistId) {
  const db = getSupabase();

  const { data: playlist, error: playlistError } = await db
    .from('stream_playlists')
    .select('*')
    .eq('id', playlistId)
    .maybeSingle();

  if (playlistError) throw Object.assign(new Error(playlistError.message), { status: 500 });
  if (!playlist) throw Object.assign(new Error('Playlist não encontrada.'), { status: 404 });

  const { data: tracks, error: tracksError } = await db
    .from('stream_playlist_tracks')
    .select('*')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: true });

  if (tracksError) throw Object.assign(new Error(tracksError.message), { status: 500 });

  return { playlist, tracks: tracks || [] };
}

async function loadExportRow(playlistId, platform, profile) {
  const { data, error } = await getSupabase()
    .from('playlist_exports')
    .select('*')
    .eq('playlist_id', playlistId)
    .eq('platform', platform)
    .eq('profile', profile)
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

async function saveExportRow(row) {
  const { data, error } = await getSupabase()
    .from('playlist_exports')
    .upsert(row, { onConflict: 'playlist_id,platform,profile' })
    .select()
    .single();

  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

async function saveExportItems(items) {
  if (items.length === 0) return;

  const { error } = await getSupabase()
    .from('playlist_export_items')
    .upsert(items, { onConflict: 'export_id,track_id' });

  if (error) throw Object.assign(new Error(error.message), { status: 500 });
}

function asTarget(track) {
  return {
    title: track.title,
    artist: track.artist,
    durationSec: track.duration_sec,
  };
}

/* ------------------------------------------------------------------ */
/* Um adaptador por plataforma, com a mesma interface                  */
/* ------------------------------------------------------------------ */

const adapters = {
  async spotify(profile) {
    const token = await spotify.getValidToken(profile);
    const me = await spotify.getProfileInfo(token);

    return {
      getRemote: (id) => spotify.getPlaylist(token, id),
      create: (meta) => spotify.createPlaylist(token, me.id, meta),
      listRemoteIds: (id) => spotify.listPlaylistTrackUris(token, id),
      // No Spotify o catálogo é outro: precisa procurar a equivalente.
      resolve: async (track) => {
        const match = await spotify.findTrack(token, asTarget(track));
        if (!match) return null;
        return {
          remoteId: match.candidate.uri,
          remoteTitle: `${match.candidate.title} — ${match.candidate.artist}`,
          score: match.score,
        };
      },
      add: (id, remoteIds) => spotify.addTracks(token, id, remoteIds),
    };
  },

  async youtube(profile) {
    const token = await youtube.getValidToken(profile);

    return {
      getRemote: (id) => youtube.getPlaylist(token, id),
      create: (meta) => youtube.createPlaylist(token, meta),
      listRemoteIds: (id) => youtube.listPlaylistVideoIds(token, id),
      // As faixas vieram do YouTube Music: o id já é o certo.
      resolve: async (track) => ({
        remoteId: track.source_id,
        remoteTitle: `${track.title} — ${track.artist}`,
        score: 1,
      }),
      add: async (id, remoteIds) => {
        // A API do YouTube só aceita um item por requisição.
        for (const videoId of remoteIds) {
          await youtube.addVideo(token, id, videoId);
        }
      },
    };
  },

  async deezer(profile) {
    const session = await deezer.getSessionForProfile(profile);

    return {
      getRemote: (id) => deezer.getPlaylist(session, id),
      create: (meta) => deezer.createPlaylist(session, meta),
      listRemoteIds: (id) => deezer.listPlaylistTrackIds(session, id),
      resolve: async (track) => {
        const match = await deezer.findTrack(asTarget(track));
        if (!match) return null;
        return {
          remoteId: match.candidate.id,
          remoteTitle: `${match.candidate.title} — ${match.candidate.artist}`,
          score: match.score,
        };
      },
      add: (id, remoteIds) => deezer.addTracks(session, id, remoteIds),
    };
  },
};

/**
 * Cria a playlist na primeira vez e, nas próximas, só acrescenta o
 * que faltava na MESMA playlist — que é o ponto todo de guardar o
 * remote_id em playlist_exports.
 */
exportRouter.post('/playlist', async (req, res, next) => {
  try {
    const { playlistId, platform, profile } = req.body || {};

    if (!playlistId) return res.status(400).json({ error: 'Informe a playlist.' });
    if (!PLATFORMS.has(platform)) return res.status(400).json({ error: 'Plataforma inválida.' });
    if (!PROFILES.has(profile)) return res.status(400).json({ error: 'Perfil inválido.' });

    const { playlist, tracks } = await loadPlaylist(playlistId);
    if (tracks.length === 0) {
      return res.status(422).json({ error: 'Essa playlist ainda não tem nenhuma música.' });
    }

    const adapter = await adapters[platform](profile);
    const existingExport = await loadExportRow(playlistId, platform, profile);

    // A playlist pode ter sido apagada na plataforma: confere antes.
    let remote = existingExport ? await adapter.getRemote(existingExport.remote_id) : null;
    const action = remote ? 'updated' : 'created';
    if (!remote) {
      remote = await adapter.create({
        name: playlist.name,
        description: playlist.description,
      });
    }

    const alreadyOnPlatform = await adapter.listRemoteIds(remote.id);

    const exportRow = await saveExportRow({
      ...(existingExport ? { id: existingExport.id } : {}),
      playlist_id: playlistId,
      platform,
      profile,
      remote_id: remote.id,
      remote_url: remote.url,
      remote_name: remote.name,
      tracks_exported: existingExport?.tracks_exported || 0,
      last_synced_at: new Date().toISOString(),
    });

    const toAdd = [];
    const items = [];
    const notFound = [];
    let alreadyThere = 0;

    for (const track of tracks) {
      const resolved = await adapter.resolve(track);

      if (!resolved) {
        notFound.push({ title: track.title, artist: track.artist });
        items.push({
          export_id: exportRow.id,
          track_id: track.id,
          remote_uri: null,
          remote_title: null,
          match_score: null,
          status: 'not_found',
        });
        continue;
      }

      items.push({
        export_id: exportRow.id,
        track_id: track.id,
        remote_uri: String(resolved.remoteId),
        remote_title: resolved.remoteTitle,
        match_score: resolved.score,
        status: 'synced',
      });

      if (alreadyOnPlatform.has(String(resolved.remoteId))) {
        alreadyThere += 1;
        continue;
      }

      toAdd.push(String(resolved.remoteId));
      alreadyOnPlatform.add(String(resolved.remoteId));
    }

    if (toAdd.length > 0) {
      await adapter.add(remote.id, toAdd);
    }

    await saveExportItems(items);

    const totalSynced = items.filter((item) => item.status === 'synced').length;
    await saveExportRow({
      id: exportRow.id,
      playlist_id: playlistId,
      platform,
      profile,
      remote_id: remote.id,
      remote_url: remote.url,
      remote_name: remote.name,
      tracks_exported: totalSynced,
      last_synced_at: new Date().toISOString(),
    });

    res.json({
      platform,
      action,
      remoteUrl: remote.url,
      remoteName: remote.name,
      added: toAdd.length,
      alreadyThere,
      notFound,
      totalOnPlatform: totalSynced,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Saída em arquivo: serve de plano B pra qualquer plataforma e é o
 * formato que Soundiiz e TuneMyMusic importam.
 */
exportRouter.get('/playlist/:id/file.:format', requireMediaToken, async (req, res, next) => {
  try {
    const { format } = req.params;
    if (!['m3u', 'csv'].includes(format)) {
      return res.status(400).json({ error: 'Formato deve ser m3u ou csv.' });
    }

    const { playlist, tracks } = await loadPlaylist(req.params.id);
    const safeName = playlist.name.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);

    if (format === 'csv') {
      const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const rows = [
        ['Track Name', 'Artist Name', 'Album', 'Duration (s)', 'YouTube URL'].join(','),
        ...tracks.map((track) =>
          [
            escape(track.title),
            escape(track.artist),
            escape(track.album),
            track.duration_sec ?? '',
            escape(`https://music.youtube.com/watch?v=${track.source_id}`),
          ].join(',')
        ),
      ];

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.csv"`);
      return res.send(`﻿${rows.join('\n')}`);
    }

    const lines = ['#EXTM3U'];
    for (const track of tracks) {
      lines.push(`#EXTINF:${track.duration_sec ?? -1},${track.artist} - ${track.title}`);
      lines.push(`https://music.youtube.com/watch?v=${track.source_id}`);
    }

    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.m3u"`);
    res.send(lines.join('\n'));
  } catch (error) {
    next(error);
  }
});
