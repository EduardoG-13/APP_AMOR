import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, Star, Moon, Tag, Tv, MessageSquare, CheckCircle, ExternalLink } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatMinutes, formatDatePtBr } from '../../lib/utils';

export const MovieDetailsModal: React.FC = () => {
  const { isDetailsModalOpen, closeDetailsModal, detailsMovie, openRatingModal } = useAppStore();

  if (!isDetailsModalOpen || !detailsMovie) return null;

  const { movie, watchlist, rating } = detailsMovie;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl bg-cinema-surface rounded-3xl border border-cinema-border shadow-2xl overflow-hidden my-6"
        >
          {/* Backdrop Header */}
          <div className="relative h-48 sm:h-64 w-full bg-cinema-elevated overflow-hidden">
            {movie.backdrop_path ? (
              <img
                src={movie.backdrop_path}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
            ) : movie.poster_path ? (
              <img
                src={movie.poster_path}
                alt={movie.title}
                className="w-full h-full object-cover filter blur-md"
              />
            ) : null}

            <div className="absolute inset-0 bg-gradient-to-t from-cinema-surface via-cinema-surface/60 to-black/40" />

            {/* Close Button */}
            <button
              onClick={closeDetailsModal}
              className="absolute top-4 right-4 p-2 rounded-xl bg-black/50 hover:bg-black/80 text-white backdrop-blur-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Title & tags over backdrop */}
            <div className="absolute bottom-4 inset-x-4 sm:inset-x-6">
              <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
                {movie.title}
              </h2>
              {movie.original_title && movie.original_title !== movie.title && (
                <p className="text-xs text-slate-300 italic mt-0.5">
                  Título original: {movie.original_title}
                </p>
              )}
            </div>
          </div>

          {/* Details Content */}
          <div className="p-5 sm:p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Metadata Pills */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              {movie.release_year && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cinema-elevated text-slate-300 border border-cinema-border">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {movie.release_year}
                </span>
              )}
              {movie.runtime_minutes && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cinema-elevated text-slate-300 border border-cinema-border">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {formatMinutes(movie.runtime_minutes)}
                </span>
              )}
              {movie.tmdb_vote_average && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-300" />
                  TMDB: {movie.tmdb_vote_average}
                </span>
              )}
              {movie.genres?.map((genre, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-xl bg-accent-purple/10 text-accent-purple border border-accent-purple/20 font-medium"
                >
                  {genre}
                </span>
              ))}
            </div>

            {/* Synopsis */}
            {movie.overview && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Sinopse
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {movie.overview}
                </p>
              </div>
            )}

            {/* Watched / Couple Review Section */}
            {watchlist.is_watched && rating ? (
              <div className="p-4 rounded-2xl bg-cinema-elevated border border-cinema-border space-y-4">
                <div className="flex items-center justify-between border-b border-cinema-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏆</span>
                    <div>
                      <div className="text-xs text-slate-400">Avaliação do Casal</div>
                      <div className="text-lg font-black text-accent-gold">
                        Média: {rating.average_rating || '-'} / 10
                      </div>
                    </div>
                  </div>
                  {watchlist.watched_date && (
                    <div className="text-xs text-slate-400 text-right">
                      <div>Assistido em</div>
                      <div className="font-semibold text-slate-200">
                        {formatDatePtBr(watchlist.watched_date)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Individual ratings */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-cinema-base/60 border border-cinema-border">
                    <div className="text-accent-blue font-bold">Nota do Edu</div>
                    <div className="text-base font-extrabold text-white mt-0.5">
                      {rating.rating_eduardo !== null ? `${rating.rating_eduardo} / 10` : '-'}
                    </div>
                    {rating.comment_eduardo && (
                      <p className="text-slate-400 text-[11px] mt-1 italic">
                        "{rating.comment_eduardo}"
                      </p>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-cinema-base/60 border border-cinema-border">
                    <div className="text-accent-pink font-bold">Nota da Lau</div>
                    <div className="text-base font-extrabold text-white mt-0.5">
                      {rating.rating_laura !== null ? `${rating.rating_laura} / 10` : '-'}
                    </div>
                    {rating.comment_laura && (
                      <p className="text-slate-400 text-[11px] mt-1 italic">
                        "{rating.comment_laura}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Extra stats */}
                <div className="flex flex-wrap gap-2 text-xs pt-1">
                  {rating.who_slept !== 'ninguem' && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300">
                      <Moon className="w-3.5 h-3.5" />
                      {rating.who_slept === 'ambos'
                        ? 'Ambos dormiram'
                        : rating.who_slept === 'eduardo'
                        ? 'Eduardo dormiu'
                        : 'Laura dormiu'}
                    </span>
                  )}
                  {rating.platform_watched && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <Tv className="w-3.5 h-3.5" />
                      {rating.platform_watched}
                    </span>
                  )}
                  {rating.fun_tags?.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-cinema-base text-slate-300 border border-cinema-border"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-cinema-elevated/40 border border-cinema-border flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider mb-0.5">
                    {watchlist.is_match ? '🔥 Match do Casal' : 'Ainda na Lista de Desejos'}
                  </div>
                  <div className="text-xs text-slate-400">
                    Vocês ainda não marcaram este filme como assistido.
                  </div>
                </div>
                <button
                  onClick={() => {
                    closeDetailsModal();
                    openRatingModal(detailsMovie);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Marcar como Visto</span>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
