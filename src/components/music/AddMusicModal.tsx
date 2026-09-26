import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Music, Sparkles, Loader2, Heart, Film, Check } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { resolveMusicLink } from '../../lib/songlink';
import type { SonglinkResolvedTrack, MovieWithDetails } from '../../types';

interface AddMusicModalProps {
  onAddTrack: (track: {
    title: string;
    artist: string;
    album?: string | null;
    cover_url?: string | null;
    spotify_url?: string | null;
    deezer_url?: string | null;
    preview_url?: string | null;
    added_by: 'eduardo' | 'laura';
    memory_note?: string | null;
    movie_id?: string | null;
  }) => Promise<any>;
  movies: MovieWithDetails[];
}

export const AddMusicModal: React.FC<AddMusicModalProps> = ({ onAddTrack, movies }) => {
  const { isAddMusicModalOpen, closeAddMusicModal, activeProfile } = useAppStore();

  const [inputUrl, setInputUrl] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedTrack, setResolvedTrack] = useState<SonglinkResolvedTrack | null>(null);
  const [memoryNote, setMemoryNote] = useState('');
  const [selectedMovieId, setSelectedMovieId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isAddMusicModalOpen) return null;

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    try {
      setIsResolving(true);
      setErrorMsg(null);
      setResolvedTrack(null);
      const result = await resolveMusicLink(inputUrl.trim());
      setResolvedTrack(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível encontrar essa música.');
    } finally {
      setIsResolving(false);
    }
  };

  const handleSave = async () => {
    if (!resolvedTrack) return;

    try {
      setIsSaving(true);
      await onAddTrack({
        title: resolvedTrack.title,
        artist: resolvedTrack.artist,
        album: resolvedTrack.album,
        cover_url: resolvedTrack.cover_url,
        spotify_url: resolvedTrack.spotify_url,
        deezer_url: resolvedTrack.deezer_url,
        added_by: activeProfile,
        memory_note: memoryNote.trim() || null,
        movie_id: selectedMovieId || null,
      });

      // Reset & close
      setInputUrl('');
      setResolvedTrack(null);
      setMemoryNote('');
      setSelectedMovieId('');
      closeAddMusicModal();
    } catch (err: any) {
      console.error('Error saving music track:', err);
      alert('Erro ao salvar música. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl bg-cinema-surface rounded-3xl border border-cinema-border shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-cinema-border flex items-center justify-between bg-cinema-elevated/40">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎵</span>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Adicionar à Trilha do Casal
                </h2>
                <p className="text-xs text-slate-400">
                  Cole um link do Spotify ou Deezer para criar a ponte entre os dois apps
                </p>
              </div>
            </div>
            <button
              onClick={closeAddMusicModal}
              className="p-1.5 rounded-xl bg-cinema-elevated text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {/* Input URL Form */}
            <form onSubmit={handleResolve} className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Link da Música (Spotify ou Deezer):
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  required
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://open.spotify.com/track/... ou https://deezer.com/..."
                  className="flex-1 bg-cinema-base border border-cinema-border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-purple"
                />
                <button
                  type="submit"
                  disabled={isResolving || !inputUrl.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent-purple hover:bg-accent-purple/90 text-white text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isResolving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>Identificar</span>
                </button>
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                  {errorMsg}
                </p>
              )}
            </form>

            {/* Resolved Preview Card */}
            {resolvedTrack && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-cinema-elevated border border-accent-purple/30 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-cinema-base overflow-hidden flex-shrink-0 border border-cinema-border">
                    {resolvedTrack.cover_url ? (
                      <img
                        src={resolvedTrack.cover_url}
                        alt={resolvedTrack.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-accent-purple">
                        <Music className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-white text-sm truncate">
                      {resolvedTrack.title}
                    </h4>
                    <p className="text-xs text-slate-400 truncate">
                      {resolvedTrack.artist}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {resolvedTrack.spotify_url && (
                        <span className="text-[10px] text-[#1DB954] font-bold bg-[#1DB954]/10 px-2 py-0.5 rounded-full">
                          ✓ Spotify OK
                        </span>
                      )}
                      {resolvedTrack.deezer_url && (
                        <span className="text-[10px] text-[#C084FC] font-bold bg-[#A238FF]/10 px-2 py-0.5 rounded-full">
                          ✓ Deezer OK
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Memory note input */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-accent-pink mb-1.5">
                    <Heart className="w-3.5 h-3.5 fill-accent-pink" />
                    Memória Afetiva (Opcional):
                  </label>
                  <input
                    type="text"
                    value={memoryNote}
                    onChange={(e) => setMemoryNote(e.target.value)}
                    placeholder="Ex: Música do nosso primeiro beijo, viagem pra praia..."
                    className="w-full bg-cinema-base border border-cinema-border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-pink"
                  />
                </div>

                {/* Optional linked movie */}
                {movies.length > 0 && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
                      <Film className="w-3.5 h-3.5 text-accent-purple" />
                      Vincular a um Filme? (Opcional):
                    </label>
                    <select
                      value={selectedMovieId}
                      onChange={(e) => setSelectedMovieId(e.target.value)}
                      className="w-full bg-cinema-base border border-cinema-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-purple"
                    >
                      <option value="">Nenhum filme vinculado</option>
                      {movies.map((m) => (
                        <option key={m.movie.id} value={m.movie.id}>
                          {m.movie.title} ({m.movie.release_year || 'Ano n/d'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Save button */}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-accent-purple to-indigo-600 hover:brightness-110 text-white font-bold text-xs shadow-glow-purple transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Salvar na Trilha do Casal</span>
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
