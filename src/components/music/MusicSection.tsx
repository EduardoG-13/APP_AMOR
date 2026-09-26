import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Plus, Sparkles, Heart } from 'lucide-react';
import { useMusic } from '../../hooks/useMusic';
import { useAppStore } from '../../store/useAppStore';
import { MovieWithDetails } from '../../types';
import { MusicTrackCard } from './MusicTrackCard';
import { AddMusicModal } from './AddMusicModal';
import { EmbeddedPlayers } from './EmbeddedPlayers';

interface MusicSectionProps {
  movies: MovieWithDetails[];
}

export const MusicSection: React.FC<MusicSectionProps> = ({ movies }) => {
  const { tracks, isLoading, addTrack, deleteTrack, playlists, updatePlaylist } = useMusic();
  const { openAddMusicModal } = useAppStore();

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Music Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-cinema-border bg-gradient-to-br from-cinema-surface via-cinema-surface/90 to-accent-purple/10 p-6 sm:p-10 shadow-2xl">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-purple/20 text-accent-purple text-xs font-bold uppercase tracking-wider mb-2 border border-accent-purple/30">
              <Sparkles className="w-3.5 h-3.5" /> Ponte Spotify + Deezer
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              Nossa Trilha Sonora 🎵
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              O Eduardo ouve no Spotify, a Laura no Deezer. Cole o link de qualquer uma das plataformas e o app cria os botões para vocês dois ouvirem na hora!
            </p>
          </div>

          <button
            onClick={openAddMusicModal}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-accent-purple to-indigo-600 hover:brightness-110 text-white font-bold text-sm shadow-glow-purple transition-all self-start sm:self-auto active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Adicionar Música</span>
          </button>
        </div>
      </section>

      {/* Embedded Playlists Widget */}
      <EmbeddedPlayers
        playlists={playlists}
        onSavePlaylist={updatePlaylist}
      />

      {/* Tracks List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white">Músicas Salvas</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cinema-elevated text-slate-300 border border-cinema-border">
              {tracks.length}
            </span>
          </div>

          <button
            onClick={openAddMusicModal}
            className="text-xs font-semibold text-accent-purple hover:underline"
          >
            + Nova Música
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
                <MusicTrackCard
                  key={track.id}
                  track={track}
                  onDelete={deleteTrack}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-12 bg-cinema-surface/50 rounded-2xl border border-dashed border-cinema-border p-8">
            <div className="w-12 h-12 rounded-2xl bg-cinema-elevated text-2xl flex items-center justify-center mx-auto mb-3">
              🎶
            </div>
            <h4 className="font-bold text-white text-sm mb-1">
              Nenhuma música salva ainda
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              Cole um link de uma música especial para vocês e ela ficará guardada aqui com links para os dois streamings.
            </p>
            <button
              onClick={openAddMusicModal}
              className="px-4 py-2 rounded-xl bg-cinema-elevated hover:bg-cinema-border text-white text-xs font-bold border border-cinema-border transition-all"
            >
              + Adicionar Primeira Música
            </button>
          </div>
        )}
      </div>

      {/* Modal to add music */}
      <AddMusicModal
        onAddTrack={addTrack}
        movies={movies}
      />
    </div>
  );
};
