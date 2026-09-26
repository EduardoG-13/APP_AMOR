import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Search, ListMusic, Link2 } from 'lucide-react';
import { useMusic } from '../../hooks/useMusic';
import { useAppStore } from '../../store/useAppStore';
import type { MovieWithDetails } from '../../types';
import { MusicTrackCard } from './MusicTrackCard';
import { AddMusicModal } from './AddMusicModal';
import { EmbeddedPlayers } from './EmbeddedPlayers';
import { PlaylistPanel } from './PlaylistPanel';
import { cn } from '../../lib/utils';

interface MusicSectionProps {
  movies: MovieWithDetails[];
}

type MusicTab = 'playlists' | 'links';

export const MusicSection: React.FC<MusicSectionProps> = ({ movies }) => {
  const { tracks, isLoading, addTrack, deleteTrack, playlists, updatePlaylist } = useMusic();
  const { openAddMusicModal, openStreamSearch } = useAppStore();
  const [tab, setTab] = useState<MusicTab>('playlists');

  return (
    <div className="space-y-6 animate-fadeIn pb-player">
      {/* Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-cinema-border bg-gradient-to-br from-cinema-surface via-cinema-surface/90 to-accent-purple/10 p-5 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-purple/20 text-accent-purple text-xs font-bold uppercase tracking-wider mb-2 border border-accent-purple/30">
              <Sparkles className="w-3.5 h-3.5" /> Nosso som
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              Nossa Trilha Sonora 🎵
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Procure e ouça qualquer música aqui dentro, monte as playlists de vocês e mande elas
              prontas pro Spotify, YouTube Music ou Deezer quando quiser.
            </p>
          </div>

          <button
            onClick={() => openStreamSearch()}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-accent-purple to-indigo-600 hover:brightness-110 text-white font-bold text-sm shadow-glow-purple transition-all self-start sm:self-auto active:scale-95"
          >
            <Search className="w-5 h-5" />
            <span>Buscar música</span>
          </button>
        </div>
      </section>

      {/* Abas */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-cinema-surface border border-cinema-border w-fit">
        {(
          [
            { id: 'playlists', label: 'Nossas playlists', icon: ListMusic },
            { id: 'links', label: 'Links do casal', icon: Link2 },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all',
              tab === id
                ? 'bg-accent-purple text-white shadow-glow-purple'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'playlists' ? (
        <PlaylistPanel />
      ) : (
        <div className="space-y-6">
          <EmbeddedPlayers playlists={playlists} onSavePlaylist={updatePlaylist} />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Músicas com link salvo</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cinema-elevated text-slate-300 border border-cinema-border">
                  {tracks.length}
                </span>
              </div>

              <button
                onClick={openAddMusicModal}
                className="flex items-center gap-1.5 text-xs font-semibold text-accent-purple hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Colar link
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                Carregando músicas do casal...
              </div>
            ) : tracks.length > 0 ? (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {tracks.map((track) => (
                    <MusicTrackCard key={track.id} track={track} onDelete={deleteTrack} />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="text-center py-12 bg-cinema-surface/50 rounded-2xl border border-dashed border-cinema-border p-8">
                <div className="w-12 h-12 rounded-2xl bg-cinema-elevated text-2xl flex items-center justify-center mx-auto mb-3">
                  🎶
                </div>
                <h4 className="font-bold text-white text-sm mb-1">Nenhum link salvo aqui</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                  Esta aba guarda músicas coladas do Spotify ou do Deezer, com o botão pra cada um
                  abrir no seu app. Pra ouvir direto aqui, use{' '}
                  <strong className="text-slate-300">Nossas playlists</strong>.
                </p>
                <button
                  onClick={openAddMusicModal}
                  className="px-4 py-2 rounded-xl bg-cinema-elevated hover:bg-cinema-border text-white text-xs font-bold border border-cinema-border transition-all"
                >
                  + Colar um link
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <AddMusicModal onAddTrack={addTrack} movies={movies} />
    </div>
  );
};
