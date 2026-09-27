import assert from 'node:assert/strict';
import { test } from 'node:test';
process.env.NOSSA_SESSAO_NATIVE = '1';
const { parsePlaylistUrl, readYoutubePlaylist, readDeezerPlaylist } = await import('../server/src/lib/playlistImport.js');
const { importPlaylist: readSpotifyPlaylist } = await import('../server/src/lib/platforms/spotify.js');

test('links de playlist são normalizados e URLs arbitrárias não passam', () => {
  assert.equal(parsePlaylistUrl('https://music.youtube.com/playlist?list=PLabcdefghij&si=tracking').url, 'https://www.youtube.com/playlist?list=PLabcdefghij');
  assert.equal(parsePlaylistUrl('https://www.deezer.com/br/playlist/123?utm_source=x').platform, 'deezer');
  assert.equal(parsePlaylistUrl('https://open.spotify.com/intl-pt/playlist/1234567890123456789012').platform, 'spotify');
  for (const url of ['http://127.0.0.1/', 'https://youtube.com.evil.test/playlist?list=PLabcdefghij', 'https://x:y@youtube.com/playlist?list=PLabcdefghij', 'file:///private', 'https://open.spotify.com/track/1234567890123456789012']) assert.throws(() => parsePlaylistUrl(url));
});
const track = id => ({ id, title: 'Música', author: { name: 'Cantora - Topic' }, duration: { seconds: 180 } });
test('YouTube lê continuações e informa entradas indisponíveis sem perder a ordem', async () => {
  const result = await readYoutubePlaylist('PLabcdefghij', async () => ({ getPlaylist: async () => ({
    info: { title: 'Minha lista' }, items: [track('abcdefghijk'), { ...track('lmnopqrstuv'), is_playable: false }], has_continuation: true,
    getContinuation: async () => ({ items: [track('12345678901')], has_continuation: false }),
  }) }));
  assert.deepEqual(result.tracks.map(item => item.sourceId), ['abcdefghijk', '12345678901']);
  assert.equal(result.tracks[0].artist, 'Cantora'); assert.equal(result.skipped, 1); assert.equal(result.truncated, false);
});
test('limite do YouTube conta também faixas indisponíveis e detecta página cortada', async () => {
  const result = await readYoutubePlaylist('PLabcdefghij', async () => ({ getPlaylist: async () => ({
    items: Array.from({ length: 1001 }, () => ({ ...track('abcdefghijk'), is_playable: false })), has_continuation: false,
  }) }));
  assert.equal(result.skipped, 1000); assert.equal(result.truncated, true);
});
test('YouTube Music importa autores/capa e não confunde continuação com faixa removida', async () => {
  const result = await readYoutubePlaylist('PLabcdefghij', async () => ({ music: { getPlaylist: async () => ({
    header: { title: 'Favoritas' }, items: [{ id: 'abcdefghijk', title: 'Música', authors: [{ name: 'Cantora' }], thumbnail: { contents: [{ url: 'https://example.com/cover.jpg' }] } }, { type: 'ContinuationItem' }],
    has_continuation: false,
  }) } }));
  assert.equal(result.tracks[0].artist, 'Cantora'); assert.equal(result.tracks[0].coverUrl, 'https://example.com/cover.jpg');
  assert.equal(result.skipped, 0); assert.equal(result.name, 'Favoritas');
});
test('Deezer pagina somente no host fixo e preserva metadados para correspondência', async () => {
  const urls = [];
  const result = await readDeezerPlaylist('123', async url => {
    urls.push(url);
    return { ok: true, json: async () => url.endsWith('/123') ? { title: 'Favoritas', nb_tracks: 2 }
      : url.includes('index=0') ? { data: [{ title: 'Faixa A', artist: { name: 'Cantora' }, duration: 123 }], next: 'https://evil.test/' }
      : { data: [{ title: 'Faixa B', artist: { name: 'Cantor' } }] } };
  });
  assert.equal(urls.length, 3); assert.ok(urls.every(url => url.startsWith('https://api.deezer.com/playlist/123')));
  assert.deepEqual(result.tracks.map(item => item.title), ['Faixa A', 'Faixa B']); assert.equal(result.tracks[0].sourceId, null);
});
test('Spotify aceita os campos atuais item/items, ignora arquivos locais e rejeita playlist sem acesso', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async url => Response.json(String(url).includes('/items?') ? { items: [
      { item: { name: 'Música', artists: [{ name: 'Cantora' }], duration_ms: 180000 } },
      { is_local: true, item: { name: 'Arquivo local', artists: [{ name: 'Eu' }] } },
    ] } : { name: 'Minha playlist', items: { total: 2 } });
    const result = await readSpotifyPlaylist('fixture-token', 'fixture');
    assert.equal(result.tracks.length, 1); assert.equal(result.skipped, 1); assert.equal(result.tracks[0].durationSec, 180);
    globalThis.fetch = async () => Response.json({ name: 'Playlist sem acesso' });
    await assert.rejects(readSpotifyPlaylist('fixture-token', 'fixture'), { status: 403 });
  } finally { globalThis.fetch = originalFetch; }
});
