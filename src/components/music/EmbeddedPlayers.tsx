import React, { useState } from 'react';
import { Settings, Play, Music, ExternalLink, Check, Save } from 'lucide-react';
import { PlaylistConfigRecord } from '../../types';

interface EmbeddedPlayersProps {
  playlists: PlaylistConfigRecord[];
  onSavePlaylist: (params: {
    owner: 'eduardo' | 'laura' | 'casal';
    platform: 'spotify' | 'deezer';
    embed_url: string;
    title: string;
  }) => Promise<any>;
}

export const EmbeddedPlayers: React.FC<EmbeddedPlayersProps> = ({
  playlists,
  onSavePlaylist,
}) => {
  const [activePlatform, setActivePlatform] = useState<'spotify' | 'deezer'>('spotify');
  const [isEditing, setIsEditing] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [deezerUrl, setDeezerUrl] = useState('');

  const spotifyConfig = playlists.find((p) => p.platform === 'spotify');
  const deezerConfig = playlists.find((p) => p.platform === 'deezer');

  // Convert raw spotify playlist URL to embed URL
  // Ex: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M -> https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator&theme=0
  const parseSpotifyEmbed = (url: string) => {
    if (!url) return '';
    if (url.includes('/embed/')) return url;
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return `https://open.spotify.com/embed/playlist/${match[1]}?utm_source=generator&theme=0`;
    }
    return url;
  };

  // Convert raw deezer playlist URL to widget URL
  // Ex: https://www.deezer.com/playlist/123456 -> https://widget.deezer.com/widget/dark/playlist/123456
  const parseDeezerEmbed = (url: string) => {
    if (!url) return '';
    if (url.includes('widget.deezer.com')) return url;
    const match = url.match(/playlist\/([0-9]+)/);
    if (match && match[1]) {
      return `https://widget.deezer.com/widget/dark/playlist/${match[1]}`;
    }
    return url;
  };

  const currentEmbedUrl =
    activePlatform === 'spotify'
      ? spotifyConfig?.embed_url
      : deezerConfig?.embed_url;

  const handleSaveConfigs = async () => {
    if (spotifyUrl.trim()) {
      await onSavePlaylist({
        owner: 'eduardo',
        platform: 'spotify',
        embed_url: parseSpotifyEmbed(spotifyUrl.trim()),
        title: 'Playlist do Edu no Spotify',
      });
    }
    if (deezerUrl.trim()) {
      await onSavePlaylist({
        owner: 'laura',
        platform: 'deezer',
        embed_url: parseDeezerEmbed(deezerUrl.trim()),
        title: 'Playlist da Lau no Deezer',
      });
    }
    setIsEditing(false);
  };

  return (
    <div className="bg-cinema-surface rounded-3xl border border-cinema-border p-5 sm:p-7 shadow-xl space-y-5">
      {/* Header with platform switcher & config toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cinema-border/60 pb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Music className="w-5 h-5 text-accent-purple" />
            Playlists Fixas do Casal
          </h3>
          <p className="text-xs text-slate-400">
            Ouça as seleções oficiais do Eduardo e da Laura diretamente aqui
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Switcher Buttons */}
          <div className="flex items-center bg-cinema-base p-1 rounded-xl border border-cinema-border">
            <button
              onClick={() => setActivePlatform('spotify')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activePlatform === 'spotify'
                  ? 'bg-[#1DB954] text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-black/60" />
              <span>Spotify (Edu)</span>
            </button>
            <button
              onClick={() => setActivePlatform('deezer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activePlatform === 'deezer'
                  ? 'bg-[#A238FF] text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-white/60" />
              <span>Deezer (Lau)</span>
            </button>
          </div>

          {/* Config Settings Button */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-2 rounded-xl bg-cinema-elevated hover:bg-cinema-border text-slate-400 hover:text-white transition-colors"
            title="Configurar links das playlists"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editing Form */}
      {isEditing && (
        <div className="p-4 rounded-2xl bg-cinema-elevated border border-accent-purple/30 space-y-3 animate-fadeIn">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            Configurar URLs das Playlists
          </h4>

          <div>
            <label className="text-xs text-slate-300 block mb-1">
              Link da Playlist do Spotify (Eduardo):
            </label>
            <input
              type="url"
              value={spotifyUrl}
              onChange={(e) => setSpotifyUrl(e.target.value)}
              placeholder={spotifyConfig?.embed_url || "https://open.spotify.com/playlist/..."}
              className="w-full bg-cinema-base border border-cinema-border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-purple"
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 block mb-1">
              Link da Playlist do Deezer (Laura):
            </label>
            <input
              type="url"
              value={deezerUrl}
              onChange={(e) => setDeezerUrl(e.target.value)}
              placeholder={deezerConfig?.embed_url || "https://www.deezer.com/playlist/..."}
              className="w-full bg-cinema-base border border-cinema-border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-purple"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveConfigs}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-accent-purple hover:bg-accent-purple/90 text-white text-xs font-bold shadow-glow-purple"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Links</span>
            </button>
          </div>
        </div>
      )}

      {/* Player Frame or Placeholder */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-cinema-base border border-cinema-border min-h-[350px] flex items-center justify-center">
        {currentEmbedUrl ? (
          <iframe
            src={currentEmbedUrl}
            width="100%"
            height="380"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="w-full h-[380px] rounded-2xl"
          />
        ) : (
          <div className="text-center p-8 max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-cinema-elevated flex items-center justify-center text-accent-purple mx-auto mb-3">
              <Play className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-white text-sm mb-1">
              Nenhuma playlist configurada para o{' '}
              {activePlatform === 'spotify' ? 'Spotify' : 'Deezer'}
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Quando vocês tiverem a playlist do casal pronta, basta colar o link clicando no botão abaixo para embutir o player!
            </p>
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cinema-elevated hover:bg-cinema-border border border-cinema-border text-white text-xs font-bold transition-all"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configurar Playlist</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
