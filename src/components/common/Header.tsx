import React from 'react';
import { motion } from 'framer-motion';
import { Film, Music, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { UserProfile, MainView } from '../../types';

export const Header: React.FC = () => {
  const { activeProfile, setActiveProfile, mainView, setMainView } = useAppStore();

  return (
    <header className="sticky top-0 z-40 w-full bg-cinema-base/80 backdrop-blur-xl border-b border-cinema-border/60 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center text-xl shadow-glow-purple flex-shrink-0">
            🍿
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white font-sans">
                NOSSA SESSÃO
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple border border-accent-purple/30">
                <Sparkles className="w-3 h-3" /> Edu &amp; Lau
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden xs:block">
              {activeProfile === 'eduardo'
                ? '💙 Perfil de Eduardo ativo'
                : '🌸 Perfil de Laura ativo'}
            </p>
          </div>
        </div>

        {/* View Switcher: Filmes vs Músicas */}
        <div className="flex items-center bg-cinema-surface p-1 rounded-xl border border-cinema-border">
          <button
            onClick={() => setMainView('movies')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              mainView === 'movies'
                ? 'bg-accent-purple text-white shadow-glow-purple'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Filmes</span>
          </button>
          <button
            onClick={() => setMainView('music')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              mainView === 'music'
                ? 'bg-accent-purple text-white shadow-glow-purple'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>Músicas</span>
          </button>
        </div>

        {/* Profile Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-cinema-surface/90 p-1.5 rounded-2xl border border-cinema-border">
          <button
            onClick={() => setActiveProfile('eduardo')}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              activeProfile === 'eduardo'
                ? 'text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {activeProfile === 'eduardo' && (
              <motion.div
                layoutId="activeProfileBubble"
                className="absolute inset-0 rounded-xl bg-accent-blue/20 border border-accent-blue shadow-glow-blue"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10 w-5 h-5 rounded-full bg-accent-blue/30 text-accent-blue border border-accent-blue/40 flex items-center justify-center text-xs font-bold">
              E
            </span>
            <span className="relative z-10 hidden sm:inline">Eduardo</span>
          </button>

          <button
            onClick={() => setActiveProfile('laura')}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              activeProfile === 'laura'
                ? 'text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {activeProfile === 'laura' && (
              <motion.div
                layoutId="activeProfileBubble"
                className="absolute inset-0 rounded-xl bg-accent-pink/20 border border-accent-pink shadow-glow-pink"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10 w-5 h-5 rounded-full bg-accent-pink/30 text-accent-pink border border-accent-pink/40 flex items-center justify-center text-xs font-bold">
              L
            </span>
            <span className="relative z-10 hidden sm:inline">Laura</span>
          </button>
        </div>
      </div>
    </header>
  );
};
