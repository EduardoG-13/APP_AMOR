import React from 'react';
import { motion } from 'framer-motion';
import { Dices, Plus, Flame, CheckCircle2, User, Heart, Clock } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useCoupleStats } from '../../hooks/useCoupleStats';
import { MovieWithDetails } from '../../types';

interface HeroSectionProps {
  movies: MovieWithDetails[];
}

export const HeroSection: React.FC<HeroSectionProps> = ({ movies }) => {
  const { activeProfile, openSearchModal, openRouletteModal, setActiveTab } = useAppStore();
  const stats = useCoupleStats(movies);

  // Pick backdrop from the most recent match or movie
  const latestMatchWithBackdrop = movies.find(
    (m) => (m.watchlist.is_match || m.watchlist.wanted_by_eduardo || m.watchlist.wanted_by_laura) && m.movie.backdrop_path
  );
  const backdropUrl = latestMatchWithBackdrop?.movie.backdrop_path;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-cinema-border bg-cinema-surface/70 shadow-2xl mb-8">
      {/* Background Image with Cinematic Gradient & Blur */}
      {backdropUrl && (
        <div className="absolute inset-0 pointer-events-none">
          <img
            src={backdropUrl}
            alt="Hero Backdrop"
            className="w-full h-full object-cover object-center opacity-20 filter blur-sm scale-105 transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-cinema-base via-cinema-base/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-cinema-base via-cinema-base/70 to-transparent" />
        </div>
      )}

      {/* Decorative Glow */}
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-accent-purple/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-accent-blue/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-12 flex flex-col justify-between gap-8">
        {/* Top Greeting & Relationship pill */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Sessão do Casal
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              {activeProfile === 'eduardo' ? (
                <>
                  Bem-vindo de volta, <span className="text-accent-blue text-glow-blue">Edu!</span> 🍿
                </>
              ) : (
                <>
                  Bem-vinda de volta, <span className="text-accent-pink text-glow-pink">Lau!</span> 🌸
                </>
              )}
            </h1>
          </motion.div>

          {/* Days Together Pill */}
          <div className="flex items-center gap-3 bg-cinema-elevated/80 border border-cinema-border px-4 py-2.5 rounded-2xl backdrop-blur-md self-start sm:self-auto">
            <div className="w-8 h-8 rounded-xl bg-accent-pink/20 text-accent-pink flex items-center justify-center">
              <Heart className="w-4 h-4 fill-accent-pink" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Juntos há</div>
              <div className="text-sm font-bold text-white">
                {stats.daysTogether} dias de amor
              </div>
            </div>
          </div>
        </div>

        {/* Center Prompt & Actions */}
        <div className="max-w-2xl">
          <p className="text-base sm:text-lg text-slate-300 mb-6 font-normal leading-relaxed">
            {stats.matchCount > 0 ? (
              <>
                💖 Vocês têm{' '}
                <strong className="text-accent-purple font-semibold">
                  {stats.matchCount} {stats.matchCount === 1 ? 'filme' : 'filmes'} em comum
                </strong>{' '}
                na lista de Match! Que tal deixar a sorte decidir a sessão de hoje à noite?
              </>
            ) : (
              <>
                Nenhum match ativo no momento! Adicionem filmes que gostariam de assistir para dar match!
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-3.5">
            <button
              onClick={openRouletteModal}
              disabled={stats.matchCount === 0}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-sm transition-all transform active:scale-95 ${
                stats.matchCount > 0
                  ? 'bg-gradient-to-r from-accent-purple to-indigo-600 text-white shadow-glow-purple hover:brightness-110'
                  : 'bg-cinema-elevated text-slate-500 cursor-not-allowed border border-cinema-border'
              }`}
            >
              <Dices className="w-5 h-5" />
              <span>Sortear Filme de Hoje 🎲</span>
            </button>

            <button
              onClick={openSearchModal}
              className="flex items-center gap-2.5 px-5 py-3 rounded-2xl font-semibold text-sm bg-cinema-elevated hover:bg-cinema-border text-white border border-cinema-border transition-all active:scale-95"
            >
              <Plus className="w-5 h-5 text-accent-blue" />
              <span>Sugerir Novo Filme</span>
            </button>
          </div>
        </div>

        {/* Bottom Quick Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-cinema-border/50">
          <button
            onClick={() => setActiveTab('match')}
            className="flex items-center gap-3 p-3 rounded-2xl bg-cinema-elevated/40 hover:bg-cinema-elevated/80 border border-cinema-border/60 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-accent-purple/20 text-accent-purple flex items-center justify-center flex-shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Matches</div>
              <div className="text-lg font-bold text-white">{stats.matchCount}</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('eduardo')}
            className="flex items-center gap-3 p-3 rounded-2xl bg-cinema-elevated/40 hover:bg-cinema-elevated/80 border border-cinema-border/60 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-accent-blue/20 text-accent-blue flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Do Edu</div>
              <div className="text-lg font-bold text-white">{stats.eduardoOnlyCount}</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('laura')}
            className="flex items-center gap-3 p-3 rounded-2xl bg-cinema-elevated/40 hover:bg-cinema-elevated/80 border border-cinema-border/60 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-accent-pink/20 text-accent-pink flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Da Lau</div>
              <div className="text-lg font-bold text-white">{stats.lauraOnlyCount}</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('watched')}
            className="flex items-center gap-3 p-3 rounded-2xl bg-cinema-elevated/40 hover:bg-cinema-elevated/80 border border-cinema-border/60 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Já Vistos</div>
              <div className="text-lg font-bold text-white">{stats.watchedCount}</div>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
};
