import { useEffect, useState } from 'react';
import {
  Plus,
  Play,
  Trash2,
  ListMusic,
  Share2,
  Music2,
  Loader2,
  ArrowUp,
  ArrowDown,
  Search,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useStreamPlaylists, toStreamTrack } from '../../hooks/useStreamPlaylists';
import { formatSeconds, cn } from '../../lib/utils';

const PLATFORM_LABEL: Record<string, string> = {
  spotify: 'Spotify',
  youtube: 'YT Music',
  deezer: 'Deezer',
};

export function PlaylistPanel() {
  const { activeProfile, selectedPlaylistId, setSelectedPlaylistId, openStreamSearch, openExportModal } =
    useAppStore();
  const { playQueue, enqueue } = usePlayerStore();

  const {
    playlists,
    isLoadingPlaylists,
    playlistsError,
    tracks,
    isLoadingTracks,
    exports,
    createPlaylist,
    isCreating,
    deletePlaylist,
    removeTrack,
    moveTrack,
  } = useStreamPlaylists(selectedPlaylistId);

  const [newName, setNewName] = useState('');
  const [isCreatingOpen, setIsCreatingOpen] = useState(false);

  // Abre a primeira playlist sozinho pra tela não nascer vazia.
  useEffect(() => {
    if (!selectedPlaylistId && playlists.length > 0) {
      setSelectedPlaylistId(playlists[0].id);
    }
  }, [playlists, selectedPlaylistId, setSelectedPlaylistId]);

  const selected = playlists.find((playlist) => playlist.id === selectedPlaylistId) || null;
  const totalSeconds = tracks.reduce((sum, track) => sum + (track.duration_sec || 0), 0);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const playlist = await createPlaylist({ name: newName, profile: activeProfile });
    setNewName('');
    setIsCreatingOpen(false);
    setSelectedPlaylistId(playlist.id);
  };

  if (playlistsError) {
    return (
      <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">
        <p className="font-bold">Não consegui carregar as playlists</p>
        <p className="text-xs text-rose-400/80 mt-1">{playlistsError.message}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
      {/* Coluna das playlists */}
      <aside className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-accent-purple" />
            Playlists
          </h3>
          <button
            onClick={() => setIsCreatingOpen((value) => !value)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Nova playlist"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {isCreatingOpen && (
          <div className="flex gap-2 animate-fadeIn">
            <input
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleCreate()}
              placeholder="Nome da playlist"
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-cinema-base border border-cinema-border text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-purple"
            />
            <button
              onClick={handleCreate}
              disabled={isCreating || !newName.trim()}
              className="px-3 py-2 rounded-xl bg-accent-purple text-white text-xs font-bold disabled:opacity-40 transition-opacity"
            >
              {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Criar'}
            </button>
          </div>
        )}

        {isLoadingPlaylists ? (
          <p className="px-1 py-4 text-xs text-slate-500">Carregando...</p>
        ) : playlists.length === 0 ? (
          <div className="p-4 rounded-2xl border border-dashed border-cinema-border text-center">
            <p className="text-xs text-slate-400 mb-2">Nenhuma playlist ainda</p>
            <button
              onClick={() => setIsCreatingOpen(true)}
              className="text-xs font-bold text-accent-purple hover:underline"
            >
              Criar a primeira
            </button>
          </div>
        ) : (
          <ul className="space-y-1">
            {playlists.map((playlist) => (
              <li key={playlist.id}>
                <button
                  onClick={() => setSelectedPlaylistId(playlist.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border',
                    playlist.id === selectedPlaylistId
                      ? 'bg-accent-purple/15 border-accent-purple/40 text-white'
                      : 'bg-cinema-surface/60 border-transparent text-slate-400 hover:text-white hover:bg-cinema-surface'
                  )}
                >
                  <span className="block truncate">{playlist.name}</span>
                  <span className="block text-[10px] font-medium text-slate-500 mt-0.5">
                    por {playlist.created_by === 'eduardo' ? 'Edu' : 'Lau'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Faixas da playlist aberta */}
      <section className="min-w-0">
        {!selected ? (
          <div className="h-full min-h-[240px] flex flex-col items-center justify-center rounded-2xl border border-dashed border-cinema-border text-center p-8">
            <Music2 className="w-10 h-10 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">Escolha ou crie uma playlist</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-cinema-surface/60 border border-cinema-border overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-cinema-border">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold text-white truncate">{selected.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {tracks.length} {tracks.length === 1 ? 'música' : 'músicas'}
                    {totalSeconds > 0 && ` · ${formatSeconds(totalSeconds)}`}
                  </p>

                  {exports.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {exports.map((item) => (
                        <a
                          key={item.id}
                          href={item.remote_url || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
                        >
                          {PLATFORM_LABEL[item.platform]} · {item.tracks_exported}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => playQueue(tracks.map(toStreamTrack), 0)}
                    disabled={tracks.length === 0}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-purple text-white text-xs font-bold shadow-glow-purple disabled:opacity-40 hover:brightness-110 transition-all active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5" /> Tocar
                  </button>

                  <button
                    onClick={() => openStreamSearch(selected.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cinema-elevated border border-cinema-border text-white text-xs font-bold hover:bg-cinema-border transition-colors"
                  >
                    <Search className="w-3.5 h-3.5" /> Adicionar
                  </button>

                  <button
                    onClick={() => openExportModal(selected)}
                    disabled={tracks.length === 0}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cinema-elevated border border-cinema-border text-white text-xs font-bold hover:bg-cinema-border disabled:opacity-40 transition-colors"
                    title="Mandar pro Spotify, YouTube Music ou Deezer"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Exportar
                  </button>

                  <button
                    onClick={() => {
                      if (window.confirm(`Apagar a playlist "${selected.name}"?`)) {
                        void deletePlaylist(selected.id);
                        setSelectedPlaylistId(null);
                      }
                    }}
                    className="p-2 rounded-xl text-slate-500 hover:text-accent-pink hover:bg-accent-pink/10 transition-colors"
                    aria-label="Apagar playlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {isLoadingTracks ? (
              <p className="p-8 text-center text-xs text-slate-500">Carregando músicas...</p>
            ) : tracks.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm text-slate-400 mb-3">Playlist vazia</p>
                <button
                  onClick={() => openStreamSearch(selected.id)}
                  className="px-4 py-2 rounded-xl bg-accent-purple/20 text-accent-purple border border-accent-purple/30 text-xs font-bold hover:bg-accent-purple/30 transition-colors"
                >
                  Buscar a primeira música
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {tracks.map((track, position) => (
                  <li
                    key={track.id}
                    className="group flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-white/5 transition-colors"
                  >
                    <span className="w-5 text-[11px] text-slate-600 tabular-nums text-right">
                      {position + 1}
                    </span>

                    <button
                      onClick={() => playQueue(tracks.map(toStreamTrack), position)}
                      className="relative w-10 h-10 rounded-lg overflow-hidden bg-cinema-elevated flex-shrink-0 border border-cinema-border"
                      aria-label={`Tocar ${track.title}`}
                    >
                      {track.cover_url ? (
                        <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Music2 className="w-4 h-4 text-slate-500 m-auto" />
                      )}
                      <span className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-4 h-4 text-white" />
                      </span>
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">{track.artist}</p>
                    </div>

                    <span className="text-[11px] text-slate-500 tabular-nums hidden sm:block">
                      {formatSeconds(track.duration_sec)}
                    </span>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => moveTrack({ tracks, from: position, to: position - 1 })}
                        disabled={position === 0}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white disabled:opacity-20"
                        aria-label="Subir"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveTrack({ tracks, from: position, to: position + 1 })}
                        disabled={position === tracks.length - 1}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white disabled:opacity-20"
                        aria-label="Descer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => enqueue(toStreamTrack(track))}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white"
                        aria-label="Tocar depois"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeTrack(track.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-accent-pink"
                        aria-label="Tirar da playlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
