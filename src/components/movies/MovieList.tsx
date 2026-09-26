import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, User, CheckCircle2, Plus, Sparkles, Filter } from 'lucide-react';
import type { MovieWithDetails, MovieListTab } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { MovieCard } from './MovieCard';

interface MovieListProps {
  movies: MovieWithDetails[];
  onToggleInterest: (watchlistId: string, currentVal: boolean, partnerVal: boolean) => void;
  onDelete: (watchlistId: string) => void;
}

export const MovieList: React.FC<MovieListProps> = ({
  movies,
  onToggleInterest,
  onDelete,
}) => {
  const { activeTab, setActiveTab, openSearchModal } = useAppStore();
  const [watchedSortBy, setWatchedSortBy] = useState<'recent' | 'rating' | 'divergence'>('recent');

  // Filter movies by tab
  const matchMovies = movies.filter((m) => m.watchlist.is_match && !m.watchlist.is_watched);
  const eduardoMovies = movies.filter(
    (m) => m.watchlist.wanted_by_eduardo && !m.watchlist.is_match && !m.watchlist.is_watched
  );
  const lauraMovies = movies.filter(
    (m) => m.watchlist.wanted_by_laura && !m.watchlist.is_match && !m.watchlist.is_watched
  );
  let watchedMovies = movies.filter((m) => m.watchlist.is_watched);

  // Sorting for watched movies
  if (watchedSortBy === 'rating') {
    watchedMovies = [...watchedMovies].sort((a, b) => {
      const rateA = Number(a.rating?.average_rating || 0);
      const rateB = Number(b.rating?.average_rating || 0);
      return rateB - rateA;
    });
  } else if (watchedSortBy === 'divergence') {
    watchedMovies = [...watchedMovies].sort((a, b) => {
      const diffA = Math.abs(
        Number(a.rating?.rating_eduardo || 0) - Number(a.rating?.rating_laura || 0)
      );
      const diffB = Math.abs(
        Number(b.rating?.rating_eduardo || 0) - Number(b.rating?.rating_laura || 0)
      );
      return diffB - diffA;
    });
  } else {
    // Recent
    watchedMovies = [...watchedMovies].sort((a, b) => {
      const dateA = a.watchlist.watched_date || a.watchlist.updated_at;
      const dateB = b.watchlist.watched_date || b.watchlist.updated_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }

  const getActiveList = () => {
    switch (activeTab) {
      case 'match':
        return matchMovies;
      case 'eduardo':
        return eduardoMovies;
      case 'laura':
        return lauraMovies;
      case 'watched':
        return watchedMovies;
      default:
        return matchMovies;
    }
  };

  const currentList = getActiveList();

  const tabs: Array<{ id: MovieListTab; label: string; count: number; icon: React.ReactNode }> = [
    {
      id: 'match',
      label: 'Match do Casal',
      count: matchMovies.length,
      icon: <Flame className="w-4 h-4 text-rose-500 fill-rose-500" />,
    },
    {
      id: 'eduardo',
      label: 'Do Edu',
      count: eduardoMovies.length,
      icon: <User className="w-4 h-4 text-accent-blue" />,
    },
    {
      id: 'laura',
      label: 'Da Lau',
      count: lauraMovies.length,
      icon: <User className="w-4 h-4 text-accent-pink" />,
    },
    {
      id: 'watched',
      label: 'Já Vistos',
      count: watchedMovies.length,
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Navigation Tabs Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cinema-border/70 pb-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-cinema-surface/50'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeMovieTab"
                    className="absolute inset-0 bg-cinema-elevated border border-cinema-border rounded-2xl shadow-lg"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.icon}</span>
                <span className="relative z-10">{tab.label}</span>
                <span
                  className={`relative z-10 ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                    isActive
                      ? 'bg-accent-purple/30 text-accent-purple border border-accent-purple/40'
                      : 'bg-cinema-elevated text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right tools: Sort on watched or Suggest button */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {activeTab === 'watched' && watchedMovies.length > 0 && (
            <div className="flex items-center gap-1.5 bg-cinema-surface border border-cinema-border rounded-xl px-3 py-1.5 text-xs text-slate-300">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={watchedSortBy}
                onChange={(e) => setWatchedSortBy(e.target.value as any)}
                className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="recent" className="bg-cinema-surface">Mais Recentes</option>
                <option value="rating" className="bg-cinema-surface">Melhores Avaliados</option>
                <option value="divergence" className="bg-cinema-surface">Maior Divergência</option>
              </select>
            </div>
          )}

          <button
            onClick={openSearchModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent-purple/20 hover:bg-accent-purple/30 text-accent-purple border border-accent-purple/40 text-xs sm:text-sm font-bold transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Filme</span>
          </button>
        </div>
      </div>

      {/* Movies Grid or Empty State */}
      <AnimatePresence mode="popLayout">
        {currentList.length > 0 ? (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6"
          >
            {currentList.map((movieItem) => (
              <MovieCard
                key={movieItem.watchlist.id}
                movieItem={movieItem}
                onToggleInterest={onToggleInterest}
                onDelete={onDelete}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center p-12 text-center bg-cinema-surface/40 rounded-3xl border border-dashed border-cinema-border my-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-cinema-elevated flex items-center justify-center text-3xl mb-4 text-slate-400 shadow-inner">
              {activeTab === 'match' ? '🔥' : activeTab === 'watched' ? '🎬' : '✨'}
            </div>

            <h3 className="text-lg font-bold text-white mb-1.5">
              {activeTab === 'match'
                ? 'Nenhum match por enquanto!'
                : activeTab === 'eduardo'
                ? 'Eduardo ainda não sugeriu nenhum filme individual.'
                : activeTab === 'laura'
                ? 'Laura ainda não sugeriu nenhum filme individual.'
                : 'Nenhum filme assistido ainda.'}
            </h3>

            <p className="text-sm text-slate-400 max-w-md mb-6">
              {activeTab === 'match'
                ? 'Quando você e seu amor curtirem o mesmo filme, ele vai aparecer automaticamente aqui com direito a confetes!'
                : 'Use a busca para pesquisar no catálogo mundial de filmes e adicionar à lista de desejos.'}
            </p>

            <button
              onClick={openSearchModal}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-purple hover:bg-accent-purple/90 text-white text-sm font-semibold shadow-glow-purple transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Explorar e Adicionar Filme</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
