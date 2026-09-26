import { Play, X, History } from 'lucide-react';
import { useWatchProgress } from '../../hooks/useWatchProgress';
import { useAppStore } from '../../store/useAppStore';
import { formatSeconds } from '../../lib/utils';
import type { IptvChannel } from '../../types';

/**
 * "Vocês pararam aqui."
 *
 * A lista vem do banco e é compartilhada: se ele parou o episódio no
 * meio, ela abre o app e continua do mesmo ponto.
 */
export function ContinueWatching() {
  const { items, remove } = useWatchProgress();
  const requestResume = useAppStore((state) => state.requestResume);

  if (items.length === 0) return null;

  return (
    <section className="mb-6">
      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
        <History className="w-3.5 h-3.5 text-accent-blue" />
        Continuar assistindo
      </h3>

      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {items.map((item) => {
          const progress =
            item.duration_sec && item.duration_sec > 0
              ? Math.min((item.position_sec / item.duration_sec) * 100, 100)
              : 0;

          const episodeLabel =
            item.season != null && item.episode != null
              ? `T${item.season} · EP${item.episode}`
              : null;

          const channel: IptvChannel = {
            id: item.id,
            name: item.name,
            url: item.stream_url,
            logo: item.logo_url,
            group: item.group_title,
            kind: item.kind,
            adult: false,
            seriesName: item.series_name,
            seriesKey: item.series_key,
            season: item.season,
            episode: item.episode,
            episodeTitle: item.episode_title,
          };

          return (
            <div
              key={item.id}
              className="relative group w-52 sm:w-60 flex-shrink-0 rounded-2xl border border-cinema-border bg-cinema-surface/70 overflow-hidden hover:border-accent-blue/40 transition-colors"
            >
              <button
                onClick={() => requestResume({ channel, positionSec: item.position_sec })}
                className="w-full text-left"
              >
                <div className="relative aspect-video bg-cinema-elevated flex items-center justify-center overflow-hidden">
                  {item.logo_url ? (
                    <img src={item.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Play className="w-8 h-8 text-slate-700" />
                  )}

                  <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="w-11 h-11 rounded-full bg-accent-blue/90 flex items-center justify-center">
                      <Play className="w-5 h-5 text-white ml-0.5" />
                    </span>
                  </span>

                  {/* Quanto já foi visto */}
                  <span className="absolute bottom-0 inset-x-0 h-1 bg-black/50">
                    <span
                      className="block h-full bg-accent-blue"
                      style={{ width: `${progress}%` }}
                    />
                  </span>
                </div>

                <div className="p-2.5">
                  <p className="text-xs font-bold text-white truncate">
                    {item.series_name || item.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {episodeLabel ? `${episodeLabel} · ` : ''}
                    parou em {formatSeconds(item.position_sec)}
                    {item.duration_sec ? ` de ${formatSeconds(item.duration_sec)}` : ''}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    com {item.last_profile === 'eduardo' ? 'o Edu' : 'a Lau'}
                  </p>
                </div>
              </button>

              <button
                onClick={() => void remove(item.id)}
                className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/60 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                aria-label="Tirar da lista"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
