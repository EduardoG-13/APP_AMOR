import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Star, CheckCircle, Info, Trash2, Heart, Moon } from 'lucide-react';
import type { MovieWithDetails } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { formatMinutes, formatDatePtBr } from '../../lib/utils';

interface MovieCardProps {
  movieItem: MovieWithDetails;
  onToggleInterest: (watchlistId: string, currentVal: boolean, partnerVal: boolean) => void;
  onDelete: (watchlistId: string) => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({
  movieItem,
  onToggleInterest,
  onDelete,
}) => {
  const { movie, watchlist, rating } = movieItem;
  const { activeProfile, openRatingModal, openDetailsModal } = useAppStore();

  const isEduardo = activeProfile === 'eduardo';
  const myInterest = isEduardo ? watchlist.wanted_by_eduardo : watchlist.wanted_by_laura;
  const partnerInterest = isEduardo ? watchlist.wanted_by_laura : watchlist.wanted_by_eduardo;
  // (nome do parceiro fica no texto do botão de match, abaixo)

  const canMatchTogether = !watchlist.is_watched && !myInterest && partnerInterest;

  const getScoreColor = (score?: number | null) => {
    if (!score) return 'bg-slate-800 text-slate-300';
    if (score >= 9.0) return 'bg-accent-gold/20 text-accent-gold border-accent-gold/40 shadow-glow-gold';
    if (score >= 7.0) return 'bg-accent-purple/20 text-accent-purple border-accent-purple/40';
    if (score >= 5.0) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.2 }}
      className="group relative flex flex-col bg-cinema-surface rounded-2xl border border-cinema-border overflow-hidden hover:border-cinema-border/90 hover:shadow-2xl transition-all"
    >
      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] w-full bg-cinema-elevated overflow-hidden cursor-pointer" onClick={() => openDetailsModal(movieItem)}>
        {movie.poster_path ? (
          <img
            src={movie.poster_path}
            alt={movie.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-slate-500">
            <span className="text-4xl mb-2">🎬</span>
            <span className="text-xs font-semibold">{movie.title}</span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-cinema-surface via-transparent to-black/30 pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1 pointer-events-none">
          {watchlist.is_match && !watchlist.is_watched && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase bg-rose-500/90 text-white shadow-lg backdrop-blur-md animate-pulse">
              <Flame className="w-3.5 h-3.5 fill-white" /> Match!
            </span>
          )}

          {!watchlist.is_match && !watchlist.is_watched && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase backdrop-blur-md border ${
                watchlist.wanted_by_eduardo
                  ? 'bg-accent-blue/30 text-accent-blue border-accent-blue/40'
                  : 'bg-accent-pink/30 text-accent-pink border-accent-pink/40'
              }`}
            >
              Por {watchlist.wanted_by_eduardo ? 'Edu' : 'Lau'}
            </span>
          )}

          {watchlist.is_watched && rating?.average_rating && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border backdrop-blur-md ${getScoreColor(
                rating.average_rating
              )}`}
            >
              <Star className="w-3.5 h-3.5 fill-current" /> {rating.average_rating}
            </span>
          )}

          {movie.tmdb_vote_average && !watchlist.is_watched && (
            <span className="ml-auto inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-black/60 text-amber-300 border border-amber-300/20 backdrop-blur-md">
              ★ {movie.tmdb_vote_average}
            </span>
          )}
        </div>
      </div>

      {/* Content Info */}
      <div className="p-3.5 flex flex-col flex-grow justify-between gap-3">
        <div>
          <h3
            onClick={() => openDetailsModal(movieItem)}
            className="font-bold text-white text-sm sm:text-base line-clamp-1 hover:text-accent-purple cursor-pointer transition-colors"
            title={movie.title}
          >
            {movie.title}
          </h3>

          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            {movie.release_year && <span>{movie.release_year}</span>}
            {movie.runtime_minutes && (
              <>
                <span>•</span>
                <span>{formatMinutes(movie.runtime_minutes)}</span>
              </>
            )}
            {movie.genres && movie.genres.length > 0 && (
              <>
                <span>•</span>
                <span className="truncate max-w-[100px]">{movie.genres[0]}</span>
              </>
            )}
          </div>

          {/* Watched details snippet */}
          {watchlist.is_watched && rating && (
            <div className="mt-2.5 pt-2.5 border-t border-cinema-border/50 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-400">
                <span>Assistido em:</span>
                <span className="text-slate-200 font-medium">
                  {formatDatePtBr(watchlist.watched_date)}
                </span>
              </div>

              {rating.who_slept !== 'ninguem' && (
                <div className="flex items-center gap-1 text-accent-purple text-[11px] font-medium bg-accent-purple/10 px-2 py-0.5 rounded-md">
                  <Moon className="w-3 h-3" />
                  <span>
                    {rating.who_slept === 'ambos'
                      ? 'Ambos dormiram'
                      : rating.who_slept === 'eduardo'
                      ? 'Eduardo dormiu'
                      : 'Laura dormiu'}
                  </span>
                </div>
              )}

              {rating.fun_tags && rating.fun_tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {rating.fun_tags.slice(0, 2).map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded bg-cinema-elevated text-[10px] text-slate-300 border border-cinema-border"
                    >
                      {tag}
                    </span>
                  ))}
                  {rating.fun_tags.length > 2 && (
                    <span className="text-[10px] text-slate-500 self-center">
                      +{rating.fun_tags.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-cinema-border/50 flex flex-col gap-2">
          {/* Match Button if partner suggested and active user hasn't liked */}
          {canMatchTogether && (
            <button
              onClick={() => onToggleInterest(watchlist.id, myInterest, partnerInterest)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-accent-pink to-rose-600 hover:brightness-110 text-white text-xs font-bold shadow-glow-pink transition-all active:scale-95"
            >
              <Heart className="w-3.5 h-3.5 fill-white" />
              <span>Quero ver também! 💖</span>
            </button>
          )}

          <div className="flex items-center justify-between gap-1.5">
            {!watchlist.is_watched ? (
              <button
                onClick={() => openRatingModal(movieItem)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all active:scale-95"
                title="Avaliar e marcar como assistido"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Já Vimos</span>
              </button>
            ) : (
              <button
                onClick={() => openRatingModal(movieItem)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-cinema-elevated hover:bg-cinema-border text-slate-300 text-xs font-semibold transition-all active:scale-95"
              >
                <Star className="w-3.5 h-3.5 text-accent-gold" />
                <span>Editar Nota</span>
              </button>
            )}

            <button
              onClick={() => openDetailsModal(movieItem)}
              className="p-1.5 rounded-lg bg-cinema-elevated hover:bg-cinema-border text-slate-400 hover:text-white transition-colors"
              title="Ver detalhes completos"
            >
              <Info className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                if (confirm(`Remover "${movie.title}" da lista?`)) {
                  onDelete(watchlist.id);
                }
              }}
              className="p-1.5 rounded-lg bg-cinema-elevated hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
              title="Remover filme"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
