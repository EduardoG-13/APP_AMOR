import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Dices, RotateCcw, Check, Sparkles, Star, Calendar } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../../store/useAppStore';
import { MovieWithDetails } from '../../types';
import { formatMinutes } from '../../lib/utils';

interface MovieRouletteModalProps {
  movies: MovieWithDetails[];
}

export const MovieRouletteModal: React.FC<MovieRouletteModalProps> = ({ movies }) => {
  const { isRouletteModalOpen, closeRouletteModal, openDetailsModal } = useAppStore();

  const matchMovies = movies.filter((m) => m.watchlist.is_match && !m.watchlist.is_watched);

  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<MovieWithDetails | null>(null);
  const [displayIndex, setDisplayIndex] = useState(0);

  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startSpin = () => {
    if (matchMovies.length === 0) return;

    setIsSpinning(true);
    setSelectedMovie(null);

    let speed = 60; // ms
    let elapsed = 0;
    const totalDuration = 2600; // ms
    let currentIndex = 0;

    const step = () => {
      currentIndex = (currentIndex + 1) % matchMovies.length;
      setDisplayIndex(currentIndex);
      elapsed += speed;

      if (elapsed < totalDuration) {
        // Gradually slow down
        if (elapsed > totalDuration * 0.6) {
          speed += 25;
        }
        spinTimerRef.current = setTimeout(step, speed);
      } else {
        // Finished! Pick final random item
        const randomIndex = Math.floor(Math.random() * matchMovies.length);
        const finalChoice = matchMovies[randomIndex];
        setDisplayIndex(randomIndex);
        setSelectedMovie(finalChoice);
        setIsSpinning(false);

        // Fire celebration confetti!
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#8B5CF6', '#38BDF8', '#F43F5E', '#FBBF24'],
        });
      }
    };

    spinTimerRef.current = setTimeout(step, speed);
  };

  useEffect(() => {
    if (isRouletteModalOpen && matchMovies.length > 0) {
      startSpin();
    }
    return () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    };
  }, [isRouletteModalOpen]);

  if (!isRouletteModalOpen) return null;

  const currentMovieToDisplay = selectedMovie || matchMovies[displayIndex] || matchMovies[0];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative w-full max-w-lg bg-cinema-surface rounded-3xl border border-accent-purple/30 shadow-glow-purple p-6 sm:p-8 flex flex-col items-center text-center overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={closeRouletteModal}
            className="absolute top-4 right-4 p-2 rounded-xl bg-cinema-elevated text-slate-400 hover:text-white border border-cinema-border"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Title */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-purple/20 text-accent-purple text-xs font-bold uppercase tracking-wider mb-2 border border-accent-purple/30">
            <Sparkles className="w-3.5 h-3.5" /> O que ver hoje?
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-6">
            Roleta de Filmes do Casal 🎲
          </h2>

          {matchMovies.length === 0 ? (
            <div className="py-8 text-slate-400 text-sm">
              Vocês não têm nenhum filme na lista de Match ainda. Adicionem filmes em comum primeiro!
            </div>
          ) : (
            <>
              {/* Spinning Card Container */}
              <div className="relative w-48 sm:w-56 aspect-[2/3] rounded-2xl overflow-hidden border-2 border-accent-purple/50 shadow-2xl mb-6 bg-cinema-elevated">
                {currentMovieToDisplay?.movie.poster_path ? (
                  <motion.img
                    key={currentMovieToDisplay.movie.id}
                    src={currentMovieToDisplay.movie.poster_path}
                    alt={currentMovieToDisplay.movie.title}
                    initial={{ opacity: 0.8, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15 }}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                    <span className="text-5xl mb-2">🎬</span>
                    <span className="text-xs font-bold text-white">
                      {currentMovieToDisplay?.movie.title}
                    </span>
                  </div>
                )}

                {/* Spinning animation overlay indicator */}
                {isSpinning && (
                  <div className="absolute inset-0 bg-accent-purple/10 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-accent-purple animate-spin" />
                  </div>
                )}

                {/* Match Ribbon */}
                <div className="absolute top-2 inset-x-2 flex justify-center">
                  <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-600 text-white shadow-lg">
                    🔥 Match Vencedor!
                  </span>
                </div>
              </div>

              {/* Title & metadata */}
              <div className="mb-6 max-w-sm">
                <h3 className="text-xl font-bold text-white line-clamp-1 mb-1">
                  {currentMovieToDisplay?.movie.title}
                </h3>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  {currentMovieToDisplay?.movie.release_year && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {currentMovieToDisplay.movie.release_year}
                    </span>
                  )}
                  {currentMovieToDisplay?.movie.runtime_minutes && (
                    <>
                      <span>•</span>
                      <span>{formatMinutes(currentMovieToDisplay.movie.runtime_minutes)}</span>
                    </>
                  )}
                  {currentMovieToDisplay?.movie.tmdb_vote_average && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 text-amber-300">
                        <Star className="w-3 h-3 fill-amber-300" />
                        {currentMovieToDisplay.movie.tmdb_vote_average}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                <button
                  onClick={() => {
                    closeRouletteModal();
                    if (selectedMovie) openDetailsModal(selectedMovie);
                  }}
                  disabled={isSpinning}
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-gradient-to-r from-accent-purple to-indigo-600 hover:brightness-110 text-white font-bold text-sm shadow-glow-purple transition-all active:scale-95 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>Vamos Assistir Esse! 🍿</span>
                </button>

                <button
                  onClick={startSpin}
                  disabled={isSpinning || matchMovies.length < 2}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-cinema-elevated hover:bg-cinema-border text-slate-300 hover:text-white border border-cinema-border text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
                >
                  <RotateCcw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
                  <span>Girar Novamente</span>
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
