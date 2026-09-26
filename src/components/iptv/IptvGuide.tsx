import { useEffect, useState } from 'react';
import {
  Search,
  Star,
  Tv,
  Clapperboard,
  MonitorPlay,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Lock,
  Loader2,
  Play,
  Check,
} from 'lucide-react';
import { useIptvChannels, useIptvSeriesList, useSeriesEpisodes } from '../../hooks/useIptv';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../lib/utils';
import type { IptvChannel, IptvGroup, IptvKind, IptvSeries } from '../../types';

interface IptvGuideProps {
  sourceKey: string | null;
  groups: Record<IptvKind, IptvGroup[]> | null;
  counts: { live: number; movie: number; series: number; adult: number } | null;
  currentUrl: string | null;
  favoriteUrls: Set<string>;
  onPlay: (channel: IptvChannel) => void;
  onToggleFavorite: (channel: IptvChannel) => void;
  /** Manda o filme/série pra lista do casal (busca no TMDB). */
  onSendToList: (input: {
    title: string;
    year: number | null;
    type: 'movie' | 'tv';
    streamUrl?: string | null;
    seriesKey?: string | null;
  }) => void;
  sendingTitle: string | null;
}

const TABS: Array<{ id: IptvKind; label: string; icon: typeof Tv }> = [
  { id: 'live', label: 'Ao vivo', icon: Tv },
  { id: 'movie', label: 'Filmes', icon: Clapperboard },
  { id: 'series', label: 'Séries', icon: MonitorPlay },
];

/** Tira ano e sujeira de qualidade pro TMDB achar a obra. */
function splitYear(value: string): { title: string; year: number | null } {
  const match = value.match(/^(.*?)[\s([]*((?:19|20)\d{2})[\s)\]]*$/);
  if (match && match[1].trim().length >= 2) {
    return { title: match[1].trim(), year: Number(match[2]) };
  }
  return { title: value.trim(), year: null };
}

export function IptvGuide({
  sourceKey,
  groups,
  counts,
  currentUrl,
  favoriteUrls,
  onPlay,
  onToggleFavorite,
  onSendToList,
  sendingTitle,
}: IptvGuideProps) {
  const { isAdultUnlocked, unlockAdult } = useAppStore();

  const [kind, setKind] = useState<IptvKind>('live');
  const [group, setGroup] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [openSeries, setOpenSeries] = useState<IptvSeries | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Trocar de aba reinicia filtro e paginação.
  useEffect(() => {
    setGroup(null);
    setPage(1);
    setOpenSeries(null);
  }, [kind]);

  const channelsQuery = useIptvChannels({
    sourceKey,
    kind,
    group,
    query: debounced,
    page,
    includeAdult: isAdultUnlocked,
  });

  const seriesQuery = useIptvSeriesList({
    sourceKey,
    group,
    query: debounced,
    page,
    includeAdult: isAdultUnlocked,
    enabled: kind === 'series' && !openSeries,
  });

  const episodesQuery = useSeriesEpisodes(sourceKey, openSeries?.key || null);

  const activeGroups = groups?.[kind] || [];
  const visibleGroups = isAdultUnlocked
    ? activeGroups
    : activeGroups.filter((item) => !item.adult);

  const listData = kind === 'series' ? seriesQuery.data : channelsQuery.data;
  const totalPages = listData
    ? Math.max(Math.ceil(listData.total / (listData.pageSize || 60)), 1)
    : 1;

  const handleUnlock = () => {
    if (unlockAdult(pinInput)) {
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  if (!sourceKey) {
    return (
      <div className="rounded-2xl border border-dashed border-cinema-border p-8 text-center">
        <Tv className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-400">Cadastre a lista do seu provedor pra começar.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cinema-border bg-cinema-surface/60 flex flex-col overflow-hidden">
      {/* Abas por tipo */}
      <div className="flex items-center gap-1 p-2 border-b border-cinema-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setKind(id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold transition-all',
              kind === id
                ? 'bg-accent-blue/20 text-accent-blue'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{label}</span>
            {counts && (
              <span className="hidden sm:inline text-[10px] font-medium opacity-60">
                {counts[id].toLocaleString('pt-BR')}
              </span>
            )}
          </button>
        ))}
      </div>

      {openSeries ? (
        /* ---------------- Episódios de uma série ---------------- */
        <div className="flex flex-col max-h-[60vh] xl:max-h-[62vh]">
          <div className="flex items-start gap-3 p-3 border-b border-cinema-border">
            <button
              onClick={() => setOpenSeries(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">{openSeries.name}</p>
              <p className="text-[11px] text-slate-500">
                {openSeries.seasonCount} {openSeries.seasonCount === 1 ? 'temporada' : 'temporadas'}{' '}
                · {openSeries.episodeCount} episódios
              </p>
            </div>
            <button
              onClick={() =>
                onSendToList({
                  title: openSeries.searchTitle,
                  year: openSeries.year,
                  type: 'tv',
                  seriesKey: openSeries.key,
                })
              }
              disabled={sendingTitle === openSeries.searchTitle}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent-purple/20 text-accent-purple border border-accent-purple/30 text-[11px] font-bold hover:bg-accent-purple/30 transition-colors disabled:opacity-50 flex-shrink-0"
              title="Mandar pra nossa lista, pra dar nota depois"
            >
              {sendingTitle === openSeries.searchTitle ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Star className="w-3 h-3" />
              )}
              <span className="hidden xs:inline">Nossa lista</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {episodesQuery.isLoading ? (
              <p className="p-6 text-center text-xs text-slate-500">Carregando episódios...</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {episodesQuery.data?.episodes.map((episode) => (
                  <li key={episode.id}>
                    <button
                      onClick={() => onPlay(episode)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors',
                        currentUrl === episode.url && 'bg-accent-blue/10'
                      )}
                    >
                      <span className="w-12 flex-shrink-0 text-[11px] font-bold text-slate-500 tabular-nums">
                        {episode.season != null && episode.episode != null
                          ? `S${String(episode.season).padStart(2, '0')}E${String(episode.episode).padStart(2, '0')}`
                          : '—'}
                      </span>
                      <span className="flex-1 min-w-0 text-xs text-white truncate">
                        {episode.episodeTitle || episode.name}
                      </span>
                      <Play className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Busca e categorias */}
          <div className="p-3 border-b border-cinema-border space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  kind === 'series' ? 'Buscar série' : kind === 'movie' ? 'Buscar filme' : 'Buscar canal'
                }
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-cinema-base border border-cinema-border text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-blue"
              />
            </div>

            {visibleGroups.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                <button
                  onClick={() => {
                    setGroup(null);
                    setPage(1);
                  }}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors',
                    group === null
                      ? 'bg-accent-blue/20 text-accent-blue'
                      : 'text-slate-500 hover:text-slate-300'
                  )}
                >
                  Tudo
                </button>
                {visibleGroups.slice(0, 60).map((item) => (
                  <button
                    key={item.title}
                    onClick={() => {
                      setGroup(item.title);
                      setPage(1);
                    }}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors',
                      group === item.title
                        ? 'bg-accent-blue/20 text-accent-blue'
                        : 'text-slate-500 hover:text-slate-300'
                    )}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            )}

            {/* Conteúdo adulto atrás de PIN, pra não abrir sem querer */}
            {!isAdultUnlocked && (counts?.adult ?? 0) > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <Lock className="w-3 h-3 text-slate-600 flex-shrink-0" />
                <input
                  value={pinInput}
                  onChange={(event) => {
                    setPinInput(event.target.value);
                    setPinError(false);
                  }}
                  onKeyDown={(event) => event.key === 'Enter' && handleUnlock()}
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="PIN pra mostrar +18"
                  className={cn(
                    'flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-cinema-base border text-[11px] text-white placeholder:text-slate-600 focus:outline-none',
                    pinError ? 'border-rose-500/60' : 'border-cinema-border focus:border-accent-blue'
                  )}
                />
                <button
                  onClick={handleUnlock}
                  className="px-2.5 py-1.5 rounded-lg bg-cinema-elevated border border-cinema-border text-[11px] font-bold text-slate-300 hover:text-white transition-colors"
                >
                  Destravar
                </button>
              </div>
            )}
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto max-h-[52vh] xl:max-h-[55vh]">
            {kind === 'series' ? (
              seriesQuery.isFetching && !seriesQuery.data ? (
                <p className="p-8 text-center text-xs text-slate-500">Agrupando séries...</p>
              ) : seriesQuery.data?.series.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-500">Nenhuma série aqui.</p>
              ) : (
                <ul className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 gap-2 p-2">
                  {seriesQuery.data?.series.map((item) => (
                    <li key={item.key}>
                      <button
                        onClick={() => setOpenSeries(item)}
                        className="w-full text-left rounded-xl border border-cinema-border bg-cinema-base/60 overflow-hidden hover:border-accent-blue/40 transition-colors group"
                      >
                        <div className="aspect-[2/3] bg-cinema-elevated flex items-center justify-center overflow-hidden">
                          {item.logo ? (
                            <img
                              src={item.logo}
                              alt=""
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <MonitorPlay className="w-8 h-8 text-slate-700" />
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-[11px] font-bold text-white line-clamp-2 leading-tight">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {item.seasonCount}T · {item.episodeCount} eps
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : channelsQuery.isFetching && !channelsQuery.data ? (
              <p className="p-8 text-center text-xs text-slate-500">Carregando...</p>
            ) : channelsQuery.data?.channels.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">Nada encontrado.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {channelsQuery.data?.channels.map((item) => {
                  const isFavorite = favoriteUrls.has(item.url);
                  const { title, year } = splitYear(item.name);

                  return (
                    <li
                      key={item.id}
                      className={cn(
                        'group flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors',
                        currentUrl === item.url && 'bg-accent-blue/10'
                      )}
                    >
                      <button
                        onClick={() => onPlay(item)}
                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                      >
                        <span className="w-9 h-9 rounded-lg bg-cinema-elevated border border-cinema-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {item.logo ? (
                            <img
                              src={item.logo}
                              alt=""
                              loading="lazy"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Tv className="w-3.5 h-3.5 text-slate-600" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-white truncate">
                            {item.name}
                          </span>
                          {item.group && (
                            <span className="block text-[10px] text-slate-500 truncate">
                              {item.group}
                            </span>
                          )}
                        </span>
                      </button>

                      {/* Filme favoritado vai pra lista do casal, pra dar nota */}
                      {kind === 'movie' && (
                        <button
                          onClick={() =>
                            onSendToList({ title, year, type: 'movie', streamUrl: item.url })
                          }
                          disabled={sendingTitle === title}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-accent-purple transition-colors disabled:opacity-50"
                          title="Mandar pra nossa lista de filmes"
                        >
                          {sendingTitle === title ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => onToggleFavorite(item)}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          isFavorite ? 'text-accent-gold' : 'text-slate-600 hover:text-accent-gold'
                        )}
                        aria-label="Favoritar"
                      >
                        <Star className={cn('w-3.5 h-3.5', isFavorite && 'fill-current')} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {listData && totalPages > 1 && (
            <div className="flex items-center justify-between p-2 border-t border-cinema-border text-[11px] text-slate-400">
              <button
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:text-white disabled:opacity-30"
                aria-label="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:text-white disabled:opacity-30"
                aria-label="Próxima página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
