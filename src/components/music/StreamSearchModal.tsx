import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Play, Plus, ListPlus, Loader2, Music2, Check } from 'lucide-react';
import { searchMusic } from '../../lib/api';
import { useAppStore } from '../../store/useAppStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useStreamPlaylists } from '../../hooks/useStreamPlaylists';
import { formatSeconds } from '../../lib/utils';
import type { StreamTrack } from '../../types';

export function StreamSearchModal() {
  const { isStreamSearchOpen, closeStreamSearch, streamSearchTargetPlaylistId, activeProfile } =
    useAppStore();
  const { playQueue, enqueue } = usePlayerStore();
  const { playlists, addTrack } = useStreamPlaylists(null);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [addedTo, setAddedTo] = useState<Record<string, string>>({});
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 450);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!isStreamSearchOpen) {
      setQuery('');
      setDebounced('');
      setAddedTo({});
      setPickerFor(null);
    }
  }, [isStreamSearchOpen]);

  const { data: results, isFetching, error } = useQuery({
    queryKey: ['music-search', debounced],
    queryFn: ({ signal }) => searchMusic(debounced, signal),
    enabled: debounced.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const targetPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === streamSearchTargetPlaylistId) || null,
    [playlists, streamSearchTargetPlaylistId]
  );

  if (!isStreamSearchOpen) return null;

  const handleAddToPlaylist = async (track: StreamTrack, playlistId: string) => {
    await addTrack({ playlistId, track, profile: activeProfile });
    const playlist = playlists.find((item) => item.id === playlistId);
    setAddedTo((current) => ({ ...current, [track.sourceId]: playlist?.name || 'playlist' }));
    setPickerFor(null);
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 pt-[8vh]"
      onClick={closeStreamSearch}
    >
      <div
        className="w-full max-w-2xl glass-modal rounded-3xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col max-h-[80vh]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-extrabold text-white">Buscar música 🎧</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {targetPlaylist
                  ? `Adicionando em "${targetPlaylist.name}"`
                  : 'Toque direto aqui, sem sair do app'}
              </p>
            </div>
            <button
              onClick={closeStreamSearch}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome da música, artista, álbum..."
              className="w-full pl-10 pr-10 py-3 rounded-xl bg-cinema-base/70 border border-cinema-border text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-purple transition-colors"
            />
            {isFetching && (
              <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent-purple animate-spin" />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <p className="p-6 text-center text-sm text-rose-400">
              {(error as Error).message}
              <span className="block text-xs text-slate-500 mt-1">
                O backend está rodando? (`npm run server`)
              </span>
            </p>
          )}

          {!error && debounced.length < 2 && (
            <div className="p-10 text-center text-slate-500">
              <Music2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Digite pra procurar no catálogo inteiro</p>
            </div>
          )}

          {!error && debounced.length >= 2 && results?.length === 0 && !isFetching && (
            <p className="p-10 text-center text-sm text-slate-500">
              Nada encontrado pra "{debounced}".
            </p>
          )}

          <ul className="divide-y divide-white/5">
            {(results || []).map((track, position) => (
              <li key={track.sourceId} className="relative">
                <div className="group flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-white/5 transition-colors">
                  <button
                    onClick={() => playQueue(results || [], position)}
                    className="relative w-12 h-12 rounded-lg overflow-hidden bg-cinema-elevated flex-shrink-0 border border-cinema-border"
                    aria-label={`Tocar ${track.title}`}
                  >
                    {track.coverUrl ? (
                      <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music2 className="w-5 h-5 text-slate-500 m-auto" />
                    )}
                    <span className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Play className="w-5 h-5 text-white" />
                    </span>
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{track.title}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {track.artist}
                      {track.album ? ` · ${track.album}` : ''}
                    </p>
                  </div>

                  {addedTo[track.sourceId] ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 whitespace-nowrap">
                      <Check className="w-3.5 h-3.5" /> {addedTo[track.sourceId]}
                    </span>
                  ) : (
                    <>
                      <span className="text-[11px] text-slate-500 tabular-nums hidden sm:block">
                        {formatSeconds(track.durationSec)}
                      </span>

                      <button
                        onClick={() => enqueue(track)}
                        className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                        title="Tocar depois"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() =>
                          targetPlaylist
                            ? handleAddToPlaylist(track, targetPlaylist.id)
                            : setPickerFor(pickerFor === track.sourceId ? null : track.sourceId)
                        }
                        className="p-2 rounded-lg text-slate-500 hover:text-accent-purple hover:bg-accent-purple/10 transition-colors"
                        title="Salvar numa playlist"
                      >
                        <ListPlus className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {pickerFor === track.sourceId && (
                  <div className="mx-4 sm:mx-5 mb-3 -mt-1 rounded-xl bg-cinema-base/80 border border-cinema-border p-1 animate-fadeIn">
                    {playlists.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">
                        Você ainda não criou nenhuma playlist.
                      </p>
                    ) : (
                      playlists.map((playlist) => (
                        <button
                          key={playlist.id}
                          onClick={() => handleAddToPlaylist(track, playlist.id)}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-accent-purple/20 hover:text-white transition-colors"
                        >
                          {playlist.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
