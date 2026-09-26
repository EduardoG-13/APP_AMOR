import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Moon, Tag, Tv, MessageSquare, Loader2, Award } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { WhoSlept } from '../../types';

const FUN_TAGS = [
  '😭 Desidratamos de Chorar',
  '🤯 Explodiu a Mente',
  '🍕 Filme de Conforto',
  '🍿 Pipocão Divertido',
  '💤 Deu um Soninho Gostoso',
  '🔥 Obra-prima Absoluta',
  '🤡 Esperávamos Mais',
  '😱 Dá Medo Real',
];

const PLATFORMS = [
  'Cinema',
  'Netflix',
  'Max',
  'Prime Video',
  'Disney+',
  'Apple TV+',
  'Outro',
];

interface MovieRatingModalProps {
  onSaveRating: (params: {
    movieId: string;
    watchlistId: string;
    ratingEduardo?: number | null;
    ratingLaura?: number | null;
    commentEduardo?: string | null;
    commentLaura?: string | null;
    funTags: string[];
    whoSlept: WhoSlept;
    platformWatched?: string | null;
  }) => Promise<void>;
}

export const MovieRatingModal: React.FC<MovieRatingModalProps> = ({ onSaveRating }) => {
  const { isRatingModalOpen, closeRatingModal, ratingMovie } = useAppStore();

  const [ratingEduardo, setRatingEduardo] = useState<number>(8.0);
  const [ratingLaura, setRatingLaura] = useState<number>(8.0);
  const [whoSlept, setWhoSlept] = useState<WhoSlept>('ninguem');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [platformWatched, setPlatformWatched] = useState<string>('Netflix');
  const [commentEduardo, setCommentEduardo] = useState('');
  const [commentLaura, setCommentLaura] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (ratingMovie?.rating) {
      const r = ratingMovie.rating;
      setRatingEduardo(r.rating_eduardo !== null ? Number(r.rating_eduardo) : 8.0);
      setRatingLaura(r.rating_laura !== null ? Number(r.rating_laura) : 8.0);
      setWhoSlept(r.who_slept || 'ninguem');
      setSelectedTags(r.fun_tags || []);
      setPlatformWatched(r.platform_watched || 'Netflix');
      setCommentEduardo(r.comment_eduardo || '');
      setCommentLaura(r.comment_laura || '');
    } else {
      setRatingEduardo(8.0);
      setRatingLaura(8.0);
      setWhoSlept('ninguem');
      setSelectedTags([]);
      setPlatformWatched('Netflix');
      setCommentEduardo('');
      setCommentLaura('');
    }
  }, [ratingMovie]);

  if (!isRatingModalOpen || !ratingMovie) return null;

  const averageRating = ((ratingEduardo + ratingLaura) / 2).toFixed(1);
  const avgNum = parseFloat(averageRating);

  const getVerdictLabel = (score: number) => {
    if (score >= 9.0) return '🏆 Obra-prima do Casal!';
    if (score >= 7.5) return '⭐ Excelente Sessão!';
    if (score >= 6.0) return '🍿 Bom Passatempo';
    return '😐 Esperávamos mais...';
  };

  const getScoreTheme = (score: number) => {
    if (score >= 9.0) return 'from-accent-gold/20 to-amber-500/10 border-accent-gold/40 text-accent-gold';
    if (score >= 7.5) return 'from-accent-purple/20 to-indigo-500/10 border-accent-purple/40 text-accent-purple';
    if (score >= 6.0) return 'from-amber-500/20 to-orange-500/10 border-amber-500/40 text-amber-300';
    return 'from-rose-500/20 to-red-500/10 border-rose-500/40 text-rose-300';
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await onSaveRating({
        movieId: ratingMovie.movie.id,
        watchlistId: ratingMovie.watchlist.id,
        ratingEduardo,
        ratingLaura,
        commentEduardo,
        commentLaura,
        funTags: selectedTags,
        whoSlept,
        platformWatched,
      });
      closeRatingModal();
    } catch (err) {
      console.error('Error saving rating:', err);
      alert('Erro ao salvar avaliação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl bg-cinema-surface rounded-3xl border border-cinema-border shadow-2xl overflow-hidden my-6"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-cinema-border flex items-center justify-between bg-cinema-elevated/40">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎬</span>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Avaliar Sessão do Casal
                </h2>
                <p className="text-xs text-slate-400 line-clamp-1">
                  {ratingMovie.movie.title}
                </p>
              </div>
            </div>
            <button
              onClick={closeRatingModal}
              className="p-1.5 rounded-xl bg-cinema-elevated text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Computed Average Badge */}
            <div
              className={`p-4 rounded-2xl bg-gradient-to-r border text-center flex flex-col items-center justify-center gap-1 ${getScoreTheme(
                avgNum
              )}`}
            >
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 fill-current" />
                <span className="text-2xl sm:text-3xl font-black">{averageRating}</span>
                <span className="text-xs font-semibold opacity-75">/ 10</span>
              </div>
              <div className="text-xs font-bold tracking-wide uppercase">
                {getVerdictLabel(avgNum)}
              </div>
            </div>

            {/* Individual Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Eduardo's Rating */}
              <div className="p-4 rounded-2xl bg-cinema-elevated/60 border border-cinema-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-accent-blue/20 text-accent-blue flex items-center justify-center text-xs font-bold border border-accent-blue/30">
                      E
                    </span>
                    <span className="text-sm font-bold text-white">Nota do Edu</span>
                  </div>
                  <span className="text-lg font-black text-accent-blue">
                    {ratingEduardo.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={ratingEduardo}
                  onChange={(e) => setRatingEduardo(parseFloat(e.target.value))}
                  className="w-full accent-accent-blue cursor-pointer"
                />
              </div>

              {/* Laura's Rating */}
              <div className="p-4 rounded-2xl bg-cinema-elevated/60 border border-cinema-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-accent-pink/20 text-accent-pink flex items-center justify-center text-xs font-bold border border-accent-pink/30">
                      L
                    </span>
                    <span className="text-sm font-bold text-white">Nota da Lau</span>
                  </div>
                  <span className="text-lg font-black text-accent-pink">
                    {ratingLaura.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={ratingLaura}
                  onChange={(e) => setRatingLaura(parseFloat(e.target.value))}
                  className="w-full accent-accent-pink cursor-pointer"
                />
              </div>
            </div>

            {/* Who Slept? */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                <Moon className="w-4 h-4 text-accent-purple" />
                Quem dormiu no meio do filme?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'ninguem', label: 'Ninguém 🦉' },
                  { id: 'eduardo', label: 'Eduardo 💤' },
                  { id: 'laura', label: 'Laura 💤' },
                  { id: 'ambos', label: 'Ambos 😴' },
                ].map((opt) => (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setWhoSlept(opt.id as WhoSlept)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      whoSlept === opt.id
                        ? 'bg-accent-purple text-white border-accent-purple shadow-glow-purple'
                        : 'bg-cinema-elevated text-slate-400 border-cinema-border hover:bg-cinema-border'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fun Tags */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                <Tag className="w-4 h-4 text-accent-pink" />
                Vibe da Sessão (Tags do Casal):
              </label>
              <div className="flex flex-wrap gap-2">
                {FUN_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`py-1.5 px-3 rounded-xl text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-accent-pink/20 text-accent-pink border-accent-pink/50 shadow-glow-pink'
                          : 'bg-cinema-elevated text-slate-400 border-cinema-border hover:text-slate-200'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Platform Watched */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                <Tv className="w-4 h-4 text-emerald-400" />
                Onde Assistiram?
              </label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((plat) => (
                  <button
                    type="button"
                    key={plat}
                    onClick={() => setPlatformWatched(plat)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-medium border transition-all ${
                      platformWatched === plat
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                        : 'bg-cinema-elevated text-slate-400 border-cinema-border hover:text-slate-200'
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-accent-blue mb-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Comentário do Edu:
                </label>
                <textarea
                  rows={2}
                  maxLength={280}
                  value={commentEduardo}
                  onChange={(e) => setCommentEduardo(e.target.value)}
                  placeholder="O que achou do filme, Edu? (opcional)"
                  className="w-full bg-cinema-base border border-cinema-border rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-blue resize-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-accent-pink mb-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Comentário da Lau:
                </label>
                <textarea
                  rows={2}
                  maxLength={280}
                  value={commentLaura}
                  onChange={(e) => setCommentLaura(e.target.value)}
                  placeholder="O que achou do filme, Lau? (opcional)"
                  className="w-full bg-cinema-base border border-cinema-border rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-pink resize-none"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-accent-purple to-indigo-600 hover:brightness-110 text-white font-bold text-sm shadow-glow-purple transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando Avaliação...</span>
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" />
                    <span>Salvar Avaliação da Sessão</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
