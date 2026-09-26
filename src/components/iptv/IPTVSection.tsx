import { useEffect, useMemo, useState } from 'react';
import { Tv, Star, AlertTriangle, Check } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useIptv, useSendToWatchlist } from '../../hooks/useIptv';
import { useProgressReporter } from '../../hooks/useWatchProgress';
import { useMovies } from '../../hooks/useMovies';
import { listIptvChannels } from '../../lib/api';
import { IPTVPlayer } from './IPTVPlayer';
import { IptvGuide } from './IptvGuide';
import { IptvSourceForm } from './IptvSourceForm';
import type { IptvChannel, IptvSourceRecord } from '../../types';

export function IPTVSection() {
  const activeProfile = useAppStore((state) => state.activeProfile);
  const resumeTarget = useAppStore((state) => state.resumeTarget);
  const clearResume = useAppStore((state) => state.clearResume);
  const { addMovie } = useMovies();

  const {
    sources,
    favorites,
    sourceKey,
    groups,
    counts,
    loadError,
    loadSource,
    isLoadingChannels,
    saveSource,
    isSavingSource,
    saveSourceError,
    deleteSource,
    toggleFavorite,
  } = useIptv();

  const [channel, setChannel] = useState<IptvChannel | null>(null);
  const [activeSource, setActiveSource] = useState<IptvSourceRecord | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'erro'; text: string } | null>(null);
  const [sendingTitle, setSendingTitle] = useState<string | null>(null);
  const [resumeAt, setResumeAt] = useState<number | null>(null);

  const { report, flush } = useProgressReporter(channel, activeProfile);

  const sendToWatchlist = useSendToWatchlist(addMovie);

  // Carrega sozinho a última lista usada.
  useEffect(() => {
    if (sourceKey || activeSource || sources.length === 0) return;
    const first = sources[0];
    setActiveSource(first);
    void loadSource(first).catch(() => undefined);
  }, [sources, sourceKey, activeSource, loadSource]);

  // Veio da tela inicial pedindo pra continuar de onde pararam.
  useEffect(() => {
    if (!resumeTarget) return;
    setChannel(resumeTarget.channel);
    setResumeAt(resumeTarget.positionSec);
    clearResume();
  }, [resumeTarget, clearResume]);

  // Trocou de conteudo: grava o ponto do anterior e zera a retomada.
  useEffect(() => {
    return () => flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.url]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 6000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const favoriteUrls = useMemo(
    () => new Set(favorites.map((favorite) => favorite.stream_url)),
    [favorites]
  );
  const favoriteByUrl = useMemo(
    () => new Map(favorites.map((favorite) => [favorite.stream_url, favorite])),
    [favorites]
  );

  /**
   * O parceiro trocou de canal e mandou o NOME. Cada um tem a própria
   * lista, com as próprias credenciais, então a URL dele não serve
   * aqui: é preciso achar o mesmo canal na lista local.
   */
  const handleRemoteChannel = async (remote: { name: string }) => {
    if (!sourceKey) return;

    try {
      const found = await listIptvChannels({ sourceKey, q: remote.name, pageSize: 10 });
      const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
      const exact =
        found.channels.find((item) => normalize(item.name) === normalize(remote.name)) ||
        found.channels[0];
      if (exact) setChannel(exact);
    } catch {
      // Lista expirada ou canal inexistente aqui: melhor não trocar
      // nada do que abrir o canal errado.
    }
  };

  const handleSendToList = async (input: {
    title: string;
    year: number | null;
    type: 'movie' | 'tv';
    streamUrl?: string | null;
    seriesKey?: string | null;
  }) => {
    setSendingTitle(input.title);
    try {
      const match = await sendToWatchlist.mutateAsync({ ...input, profile: activeProfile });
      setFeedback({
        kind: 'ok',
        text: `"${match.title}" entrou na lista de ${activeProfile === 'eduardo' ? 'Eduardo' : 'Laura'}. Agora dá pra dar nota na aba Filmes.`,
      });
    } catch (error) {
      setFeedback({ kind: 'erro', text: (error as Error).message });
    } finally {
      setSendingTitle(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-fadeIn">
      <section className="rounded-2xl sm:rounded-3xl border border-cinema-border bg-gradient-to-br from-cinema-surface via-cinema-surface/90 to-accent-blue/10 p-4 sm:p-6">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-accent-blue/20 text-accent-blue text-[11px] font-bold uppercase tracking-wider mb-2 border border-accent-blue/30">
          <Tv className="w-3 h-3" /> Nossa TV
        </div>
        <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight mb-1">
          Assistir junto 📺
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4 max-w-2xl">
          Com o <strong className="text-accent-pink">Assistir junto</strong> ligado nos dois, o
          play, a pausa e o ponto do filme ficam iguais — e quando um troca de canal, o outro vai
          junto.
        </p>

        <IptvSourceForm
          sources={sources}
          activeSource={activeSource}
          activeProfile={activeProfile}
          isLoadingChannels={isLoadingChannels}
          isSavingSource={isSavingSource}
          saveSourceError={saveSourceError}
          onSelect={(source) => {
            setActiveSource(source);
            void loadSource(source);
          }}
          onReload={(source) => void loadSource(source)}
          onDelete={(id) => {
            void deleteSource(id);
            if (activeSource?.id === id) setActiveSource(null);
          }}
          onSave={saveSource}
        />

        {loadError && (
          <p className="mt-3 text-xs text-rose-400 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {loadError}
          </p>
        )}
      </section>

      {feedback && (
        <div
          className={`flex items-start gap-2 p-3 rounded-xl border text-xs animate-fadeIn ${
            feedback.kind === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          {feedback.kind === 'ok' ? (
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-4 sm:gap-5">
        <div className="space-y-4">
          {/* No celular o player gruda no topo enquanto a guia rola. */}
          <div className="sticky top-[76px] z-20 xl:static -mx-4 sm:mx-0">
            <IPTVPlayer
              channel={channel}
              onRemoteChannel={handleRemoteChannel}
              resumeAtSec={resumeAt}
              onProgress={report}
              onProgressFlush={flush}
            />
          </div>

          {favorites.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Star className="w-3 h-3 text-accent-gold" /> Favoritos do casal
              </h3>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {favorites.map((favorite) => (
                  <button
                    key={favorite.id}
                    onClick={() =>
                      setChannel({
                        id: favorite.id,
                        name: favorite.name,
                        url: favorite.stream_url,
                        logo: favorite.logo_url,
                        group: favorite.group_title,
                        kind: 'live',
                        adult: false,
                        seriesName: null,
                        seriesKey: null,
                        season: null,
                        episode: null,
                        episodeTitle: null,
                      })
                    }
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cinema-surface border border-cinema-border text-xs font-semibold text-slate-300 hover:border-accent-gold/40 hover:text-white transition-colors whitespace-nowrap flex-shrink-0"
                  >
                    {favorite.logo_url && (
                      <img
                        src={favorite.logo_url}
                        alt=""
                        className="w-5 h-5 rounded object-contain"
                      />
                    )}
                    {favorite.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <IptvGuide
          sourceKey={sourceKey}
          groups={groups}
          counts={counts}
          currentUrl={channel?.url || null}
          favoriteUrls={favoriteUrls}
          onPlay={(item) => {
            setResumeAt(null);
            setChannel(item);
          }}
          onToggleFavorite={(item) =>
            void toggleFavorite({
              channel: item,
              sourceId: activeSource?.id || null,
              profile: activeProfile,
              existingId: favoriteByUrl.get(item.url)?.id,
            })
          }
          onSendToList={handleSendToList}
          sendingTitle={sendingTitle}
        />
      </div>
    </div>
  );
}
