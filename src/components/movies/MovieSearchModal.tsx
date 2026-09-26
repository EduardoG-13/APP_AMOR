import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Plus, Check, Loader2, Star, Calendar } from 'lucide-react';
import { useMovieSearch } from '../../hooks/useMovieSearch';
import { useAppStore } from '../../store/useAppStore';
import type { TMDBMovieResult, MovieWithDetails } from '../../types';
import { mapGenreIdsToNames, getTMDBImageUrl } from '../../lib/tmdb';

interface MovieSearchModalProps {
  onAddMovie: (movie: TMDBMovieResult) => Promise<void>;
  existingMovies: MovieWithDetails[];
}

export const MovieSearchModal: React.FC<MovieSearchModalProps> = ({
  onAddMovie,
  existingMovies,
}) => {
  const { isSearchModalOpen, closeSearchModal, activeProfile } = useAppStore();
  const [query, setQuery] = useState('');
  const [addingTmdbId, setAddingTmdbId] = useState<number | null>(null);

  const { data: results, isLoading } = useMovieSearch(query);

  if (!isSearchModalOpen) return null;

  const isAlreadyInWatchlist = (tmdbId: number) => {
    return existingMovies.some((m) => m.movie.tmdb_id === tmdbId);
  };

  const handleAdd = async (tmdbMovie: TMDBMovieResult) => {
    try {
      setAddingTmdbId(tmdbMovie.id);
      await onAddMovie(tmdbMovie);
    } catch (err) {
      console.error('Failed to add movie:', err);
      alert('Não foi possível adicionar o filme. Tente novamente.');
    } finally {
      setAddingTmdbId(null);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl max-h-[90vh] bg-cinema-surface rounded-3xl border border-cinema-border shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header & Search Input */}
          <div className="p-4 sm:p-6 border-b border-cinema-border bg-cinema-elevated/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔍</span>
                <h2 className="text-lg font-bold text-white">
                  Buscar no Catálogo de Cinema
                </h2>
              </div>
              <button
                onClick={closeSearchModal}
                className="p-1.5 rounded-xl bg-cinema-elevated hover:bg-cinema-border text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex: Interestelar, Gladiador 2, Duna..."
                className="w-full bg-cinema-base border border-cinema-border rounded-2xl pl-11 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple transition-all"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <p className="text-xs text-slate-400 mt-2">
              Adicionando pelo perfil de:{' '}
              <strong className={activeProfile === 'eduardo' ? 'text-accent-blue' : 'text-accent-pink'}>
                {activeProfile === 'eduardo' ? 'Eduardo 👤' : 'Laura 🌸'}
              </strong>
            </p>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 divide-y divide-cinema-border/40">
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-accent-purple mb-2" />
                <span className="text-sm">Buscando filmes no TMDB...</span>
              </div>
            )}

            {!isLoading && query.trim().length >= 2 && results?.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <p className="text-base font-semibold text-white mb-1">
                  Nenhum filme encontrado
                </p>
                <p className="text-xs">
                  Tente digitar o nome em português ou o título original.
                </p>
              </div>
            )}

            {!isLoading && query.trim().length < 2 && (
              <div className="text-center py-12 text-slate-500 text-xs">
                Digite ao menos 2 letras para iniciar a busca.
              </div>
            )}

            {!isLoading &&
              results?.map((movie) => {
                const inList = isAlreadyInWatchlist(movie.id);
                const isAdding = addingTmdbId === movie.id;
                const releaseYear = movie.release_date
                  ? movie.release_date.split('-')[0]
                  : null;
                const genres = mapGenreIdsToNames(movie.genre_ids);

                return (
                  <div
                    key={movie.id}
                    className="pt-3 first:pt-0 flex items-start gap-4 group"
                  >
                    {/* Poster thumbnail */}
                    <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl bg-cinema-elevated overflow-hidden flex-shrink-0 border border-cinema-border">
                      {movie.poster_path ? (
                        <img
                          src={getTMDBImageUrl(movie.poster_path, 'w200')!}
                          alt={movie.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl text-slate-600">
                          🎬
                        </div>
                      )}
                    </div>

                    {/* Movie Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-white text-sm sm:text-base line-clamp-1">
                          {movie.title}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                        {releaseYear && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {releaseYear}
                          </span>
                        )}
                        {movie.vote_average > 0 && (
                          <span className="flex items-center gap-1 text-amber-300">
                            <Star className="w-3 h-3 fill-amber-300" />{' '}
                            {movie.vote_average.toFixed(1)}
                          </span>
                        )}
                        {genres.length > 0 && (
                          <span className="text-slate-500 truncate max-w-[150px]">
                            {genres.slice(0, 2).join(', ')}
                          </span>
                        )}
                      </div>

                      {movie.overview && (
                        <p className="text-xs text-slate-400 line-clamp-2 mt-2 leading-relaxed">
                          {movie.overview}
                        </p>
                      )}

                      <div className="mt-3">
                        <button
                          onClick={() => handleAdd(movie)}
                          disabled={isAdding}
                          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            inList
                              ? 'bg-cinema-elevated text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-accent-purple hover:bg-accent-purple/90 text-white shadow-glow-purple'
                          }`}
                        >
                          {isAdding ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Salvando...</span>
                            </>
                          ) : inList ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Na Lista (Adicionar como Desejo)</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ Quero Assistir</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
