import { SonglinkResolvedTrack } from '../types';

interface OdesliResponse {
  entityUniqueId: string;
  userCountry: string;
  entitiesByUniqueId: Record<
    string,
    {
      id: string;
      type: string;
      title?: string;
      artistName?: string;
      thumbnailUrl?: string;
      platforms?: string[];
    }
  >;
  linksByPlatform: {
    spotify?: {
      url: string;
      nativeAppUriMobile?: string;
      nativeAppUriDesktop?: string;
      entityUniqueId: string;
    };
    deezer?: {
      url: string;
      nativeAppUriMobile?: string;
      nativeAppUriDesktop?: string;
      entityUniqueId: string;
    };
  };
}

export async function resolveMusicLink(inputUrl: string): Promise<SonglinkResolvedTrack> {
  const cleanUrl = inputUrl.trim();
  if (!cleanUrl) {
    throw new Error('Insira uma URL de música válida');
  }

  const endpoint = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(cleanUrl)}&userCountry=BR`;
  const response = await fetch(endpoint);

  if (!response.ok) {
    // If Songlink doesn't find it, provide fallback based on URL structure
    if (cleanUrl.includes('spotify.com')) {
      return {
        title: 'Música do Spotify',
        artist: 'Artista',
        album: null,
        cover_url: null,
        spotify_url: cleanUrl,
        deezer_url: null,
        spotify_native: cleanUrl.replace('https://open.spotify.com/track/', 'spotify:track:'),
        deezer_native: null,
      };
    }
    if (cleanUrl.includes('deezer.com')) {
      return {
        title: 'Música do Deezer',
        artist: 'Artista',
        album: null,
        cover_url: null,
        spotify_url: null,
        deezer_url: cleanUrl,
        spotify_native: null,
        deezer_native: cleanUrl,
      };
    }
    throw new Error('Não foi possível identificar a música com o link fornecido.');
  }

  const data: OdesliResponse = await response.json();
  const mainEntity = data.entitiesByUniqueId[data.entityUniqueId];

  return {
    title: mainEntity?.title || 'Título desconhecido',
    artist: mainEntity?.artistName || 'Artista desconhecido',
    album: null,
    cover_url: mainEntity?.thumbnailUrl || null,
    spotify_url: data.linksByPlatform.spotify?.url || (cleanUrl.includes('spotify') ? cleanUrl : null),
    deezer_url: data.linksByPlatform.deezer?.url || (cleanUrl.includes('deezer') ? cleanUrl : null),
    spotify_native: data.linksByPlatform.spotify?.nativeAppUriMobile || null,
    deezer_native: data.linksByPlatform.deezer?.nativeAppUriMobile || null,
  };
}
