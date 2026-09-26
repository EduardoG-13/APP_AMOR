import { useState } from 'react';
import { motion } from 'framer-motion';
import { Film, Music, Sparkles, Tv, Pencil } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useCoupleProfiles } from '../../hooks/useCoupleProfiles';
import { ProfileEditorModal } from './ProfileEditorModal';
import { cn } from '../../lib/utils';
import type { UserProfile } from '../../types';

const VIEWS = [
  { id: 'movies', label: 'Filmes', icon: Film },
  { id: 'music', label: 'Músicas', icon: Music },
  { id: 'tv', label: 'TV', icon: Tv },
] as const;

const ACCENT: Record<UserProfile, { ring: string; bg: string; text: string; glow: string }> = {
  eduardo: {
    ring: 'border-accent-blue',
    bg: 'bg-accent-blue/20',
    text: 'text-accent-blue',
    glow: 'shadow-glow-blue',
  },
  laura: {
    ring: 'border-accent-pink',
    bg: 'bg-accent-pink/20',
    text: 'text-accent-pink',
    glow: 'shadow-glow-pink',
  },
};

export const Header: React.FC = () => {
  const { activeProfile, setActiveProfile, mainView, setMainView } = useAppStore();
  const { byProfile } = useCoupleProfiles();
  const [editing, setEditing] = useState<UserProfile | null>(null);

  const renderProfile = (profile: UserProfile) => {
    const record = byProfile(profile);
    const isActive = activeProfile === profile;
    const accent = ACCENT[profile];
    const name = record?.display_name || (profile === 'eduardo' ? 'Eduardo' : 'Laura');

    return (
      <button
        key={profile}
        onClick={() => (isActive ? setEditing(profile) : setActiveProfile(profile))}
        title={isActive ? 'Trocar a foto e o nome' : `Mudar para ${name}`}
        className={cn(
          'relative flex items-center gap-1.5 pl-1 pr-1.5 sm:pr-3 py-1 rounded-xl text-xs sm:text-sm font-medium transition-all',
          isActive ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
        )}
      >
        {isActive && (
          <motion.div
            layoutId="activeProfileBubble"
            className={cn('absolute inset-0 rounded-xl border', accent.bg, accent.ring, accent.glow)}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          />
        )}

        <span
          className={cn(
            'relative z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border flex items-center justify-center text-[11px] font-bold flex-shrink-0',
            accent.ring,
            accent.bg,
            accent.text
          )}
        >
          {record?.avatar_url ? (
            <img src={record.avatar_url} alt={name} className="w-full h-full object-cover" />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </span>

        <span className="relative z-10 hidden sm:inline">{name}</span>

        {isActive && (
          <Pencil className="relative z-10 w-2.5 h-2.5 opacity-50 hidden sm:block" />
        )}
      </button>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-30 w-full bg-cinema-base/90 backdrop-blur-xl border-b border-cinema-border/60">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          {/* Marca */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center text-lg sm:text-xl shadow-glow-purple flex-shrink-0">
              🍿
            </div>
            <div className="hidden md:block min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white truncate">
                  NOSSA SESSÃO
                </span>
                <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple border border-accent-purple/30">
                  <Sparkles className="w-3 h-3" /> Edu &amp; Lau
                </span>
              </div>
            </div>
          </div>

          {/* Áreas */}
          <nav className="flex items-center bg-cinema-surface p-1 rounded-xl border border-cinema-border flex-shrink-0">
            {VIEWS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setMainView(id)}
                title={label}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all',
                  mainView === id
                    ? 'bg-accent-purple text-white shadow-glow-purple'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>

          {/* Perfis */}
          <div className="flex items-center gap-1 bg-cinema-surface/90 p-1 rounded-2xl border border-cinema-border flex-shrink-0">
            {(['eduardo', 'laura'] as const).map(renderProfile)}
          </div>
        </div>
      </header>

      {editing && <ProfileEditorModal profile={editing} onClose={() => setEditing(null)} />}
    </>
  );
};
