import { getClient } from './innertube.js';
import { getValidToken, importPlaylist as spotifyPlaylist } from './platforms/spotify.js';

export const IMPORT_LIMIT = 1000;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

/** Extrai IDs apenas de hosts conhecidos; nunca requisita a URL arbitrária enviada. */
export function parsePlaylistUrl(raw) {
  let url;
  try { url = new URL(String(raw).trim()); } catch { throw fail('Cole o link completo de uma playlist.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw fail('Use o link HTTPS original da playlist.');
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (['youtube.com', 'music.youtube.com'].includes(host)) {
    const id = url.searchParams.get('list');
    if (id && /^[A-Za-z0-9_-]{10,100}$/.test(id)) return { platform: 'youtube', id, url: `https://www.youtube.com/playlist?list=${id}` };
  }
  if (host === 'open.spotify.com') {
    const id = url.pathname.match(/^\/(?:intl-[a-z]{2}\/)?playlist\/([A-Za-z0-9]{22})\/?$/)?.[1];
    if (id) return { platform: 'spotify', id, url: `https://open.spotify.com/playlist/${id}` };
  }
  if (host === 'deezer.com') {
    const id = url.pathname.match(/^\/(?:[a-z]{2}\/)?playlist\/(\d+)\/?$/)?.[1];
    if (id) return { platform: 'deezer', id, url: `https://www.deezer.com/playlist/${id}` };
  }
  throw fail('Use um link de playlist do YouTube, Deezer ou Spotify. Abra links encurtados no navegador e copie o endereço completo.');
}

export async function readDeezerPlaylist(id, fetcher = fetch) {
  const request = async (suffix) => {
    const response = await fetcher(`https://api.deezer.com/playlist/${id}${suffix}`, { redirect: 'error', signal: AbortSignal.timeout(25_000) });
    const data = await response.json();
    if (!response.ok || data.error) throw fail('A Deezer não liberou esta playlist. Confira o link e se ela é pública.', 422);
    return data;
  };
  const playlist = await request('');
  const tracks = []; let skipped = 0, index = 0, hasMore = true;
  while (hasMore && tracks.length + skipped < IMPORT_LIMIT) {
    const page = await request(`/tracks?index=${index}&limit=100`);
    for (const track of page.data || []) {
      if (tracks.length + skipped >= IMPORT_LIMIT) break;
      if (!track?.title || !track.artist?.name) { skipped++; continue; }
      tracks.push({ title: track.title.slice(0, 300), artist: track.artist.name.slice(0, 300),
        album: track.album?.title || null, coverUrl: track.album?.cover_medium || null,
        durationSec: Number(track.duration) || null, sourceId: null });
      if (tracks.length + skipped >= IMPORT_LIMIT) break;
    }
    index += page.data?.length || 0; hasMore = Boolean(page.next) && Boolean(page.data?.length);
  }
  return { name: playlist.title || 'Playlist da Deezer', description: playlist.description || '',
    coverUrl: playlist.picture_medium || null, tracks, skipped,
    total: playlist.nb_tracks ?? tracks.length + skipped, truncated: hasMore || Number(playlist.nb_tracks) > tracks.length + skipped };
}

export async function readYoutubePlaylist(id, getYoutube = getClient) {
  const yt = await getYoutube();
  let page;
  // O cliente WEB pode receber 400 enquanto o catálogo Music continua acessível.
  // Ambos aceitam IDs de playlists; o segundo caminho também cobre listas de vídeos.
  try { page = await yt.music.getPlaylist(id); }
  catch {
    try { page = await yt.getPlaylist(id); }
    catch { throw fail('O YouTube não liberou esta playlist. Use uma playlist pública ou não listada.', 422); }
  }
  if (!page.header && !page.info && !page.items?.length) throw fail('Playlist vazia ou indisponível no YouTube.', 422);
  const meta = page.info || page.header;
  const cover = meta?.thumbnails?.at(-1)?.url || meta?.thumbnail?.contents?.at(-1)?.url;
  const tracks = []; let skipped = 0, visited = 0, truncated = false;
  while (page && visited < IMPORT_LIMIT) {
    let consumed = 0;
    const items = (page.items || []).filter(item => item.type !== 'ContinuationItem');
    for (const item of items) {
      if (visited >= IMPORT_LIMIT) break;
      visited++; consumed++;
      const sourceId = item.id || item.video_id;
      if (!sourceId || !/^[A-Za-z0-9_-]{11}$/.test(sourceId) || item.is_playable === false) { skipped++; continue; }
      tracks.push({ sourceId, source: 'youtube', title: String(item.title || 'Sem título').slice(0, 300),
        artist: String(item.author?.name || (item.artists || item.authors || []).map(artist => artist.name).join(', ')).replace(/ - Topic$/i, '').slice(0, 300), album: item.album?.name || null,
        coverUrl: item.thumbnails?.at(-1)?.url || item.thumbnail?.contents?.at(-1)?.url || `https://i.ytimg.com/vi/${sourceId}/hqdefault.jpg`, durationSec: item.duration?.seconds ?? null });
      if (visited >= IMPORT_LIMIT) break;
    }
    if (visited >= IMPORT_LIMIT) { truncated = consumed < items.length || Boolean(page.has_continuation); break; }
    if (!page.has_continuation) break;
    page = await page.getContinuation();
  }
  return { name: String(meta?.title || 'Playlist do YouTube'), description: String(meta?.description || ''),
    coverUrl: cover || tracks[0]?.coverUrl || null,
    tracks, skipped, total: visited, truncated };
}

export async function readPlaylist(input, profile) {
  const result = input.platform === 'youtube' ? await readYoutubePlaylist(input.id)
    : input.platform === 'deezer' ? await readDeezerPlaylist(input.id)
    : await spotifyPlaylist(await getValidToken(profile), input.id, IMPORT_LIMIT);
  return { ...result, platform: input.platform, sourceUrl: input.url };
}
