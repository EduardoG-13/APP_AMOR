import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
  Repeat,
  Repeat1,
  Shuffle,
  Download,
  Video,
  Mic2,
  ListMusic,
  Users,
  X,
  Loader2,
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useAppStore } from '../../store/useAppStore';
import { useParty } from '../../hooks/useParty';
import { audioDownloadUrl, audioStreamUrl, apiUrl, getLyrics, videoStreamUrl } from '../../lib/api';
import { DRIFT_TOLERANCE_SEC, HEARTBEAT_MS } from '../../lib/party';
import { cn, formatSeconds } from '../../lib/utils';
import type { LyricsLine } from '../../types';

/**
 * Lê a mensagem de erro real do backend. Sem isso o <audio> só emite
 * um evento `error` mudo e o usuário fica sem saber se a faixa é
 * restrita, se o yt-dlp falhou ou se o servidor está fora.
 */
async function describeMediaFailure(url: string): Promise<string> {
  try {
    const response = await fetch(url, { headers: { Range: 'bytes=0-1' } });
    if (response.ok || response.status === 206) {
      return 'O arquivo chegou, mas o navegador não conseguiu decodificar essa faixa.';
    }
    const body = await response.json().catch(() => null);
    return body?.error || `O servidor respondeu ${response.status}.`;
  } catch {
    return 'Não consegui falar com o servidor de música. Ele está rodando?';
  }
}

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const applyingRemote = useRef(false);
  /** Mantém o ponto ao alternar entre áudio e videoclipe. */
  const carryPosition = useRef(0);
  const lyricsListRef = useRef<HTMLUListElement>(null);

  const {
    queue,
    index,
    isPlaying,
    showVideo,
    volume,
    muted,
    repeat,
    shuffle,
    pendingRemote,
    setPlaying,
    next,
    previous,
    goTo,
    removeAt,
    toggleVideo,
    setVolume,
    toggleMute,
    cycleRepeat,
    toggleShuffle,
    consumeRemote,
    adoptQueue,
  } = usePlayerStore();

  const track = queue[index] ?? null;
  const { isLyricsOpen, toggleLyrics, mainView } = useAppStore();

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [lyrics, setLyrics] = useState<{
    synced: LyricsLine[] | null;
    text: string | null;
    source: string | null;
    loading: boolean;
  }>({ synced: null, text: null, source: null, loading: false });

  const getMedia = useCallback(
    (): HTMLMediaElement | null => (showVideo ? videoRef.current : audioRef.current),
    [showVideo]
  );

  /* ---------------------------------------------------------------- */
  /* Ouvir junto                                                       */
  /* ---------------------------------------------------------------- */

  const party = useParty({
    kind: 'music',
    onSync: (message) => {
      applyingRemote.current = true;

      if (message.ref !== track?.sourceId) {
        if (message.queue?.length) adoptQueue(message.queue, message.queueIndex ?? 0);
      } else {
        const media = getMedia();
        // Corrige só quando a diferença já incomoda. Pular por 200ms
        // dá mais dor de cabeça do que a diferença em si.
        if (media && Math.abs(media.currentTime - message.positionSec) > DRIFT_TOLERANCE_SEC) {
          media.currentTime = message.positionSec;
        }
      }

      setPlaying(message.isPlaying);
      window.setTimeout(() => {
        applyingRemote.current = false;
      }, 300);
    },
  });

  const broadcast = useCallback(
    (overrides?: { positionSec?: number; isPlaying?: boolean }, persist = false) => {
      if (!party.enabled || applyingRemote.current || !track) return;

      party.publish(
        {
          ref: track.sourceId,
          title: track.title,
          subtitle: track.artist,
          coverUrl: track.coverUrl,
          positionSec: overrides?.positionSec ?? getMedia()?.currentTime ?? 0,
          isPlaying: overrides?.isPlaying ?? isPlaying,
          queue,
          queueIndex: index,
        },
        { persist }
      );
    },
    [party, track, isPlaying, queue, index, getMedia]
  );

  // Trocou de faixa: avisa na hora, sem esperar a próxima batida.
  useEffect(() => {
    if (!party.enabled || !track || applyingRemote.current) return;
    broadcast({ positionSec: 0 }, true);
    // Só quando a faixa muda de verdade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.sourceId, party.enabled]);

  useEffect(() => {
    if (!party.enabled || !isPlaying) return;
    const timer = window.setInterval(() => broadcast(), HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [party.enabled, isPlaying, broadcast]);

  /* ---------------------------------------------------------------- */
  /* Carregamento da mídia                                             */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!track) return;

    setError(null);
    setBuffering(true);

    const restore = carryPosition.current;
    carryPosition.current = 0;

    // ---- Videoclipe: o YouTube não serve mais áudio e vídeo no mesmo
    // arquivo, então vem manifesto HLS e o hls.js remonta.
    if (showVideo) {
      audioRef.current?.pause();

      const video = videoRef.current;
      if (!video) return;

      const source = videoStreamUrl(track.sourceId);
      hlsRef.current?.destroy();
      hlsRef.current = null;

      const onReady = () => {
        setBuffering(false);
        if (restore > 0) video.currentTime = restore;
      };

      if (Hls.isSupported()) {
        const hls = new Hls({ maxBufferLength: 30 });
        hls.loadSource(source);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, onReady);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) return hls.startLoad();
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) return hls.recoverMediaError();

          setBuffering(false);
          void describeMediaFailure(source).then(setError);
          hls.destroy();
        });
        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = source;
        video.addEventListener('loadedmetadata', onReady, { once: true });
      } else {
        setBuffering(false);
        setError('Esse navegador não consegue tocar o videoclipe.');
      }

      return () => {
        hlsRef.current?.destroy();
        hlsRef.current = null;
      };
    }

    // ---- Só áudio: arquivo progressivo, o <audio> dá conta sozinho.
    const audio = audioRef.current;
    if (!audio) return;

    const source = audioStreamUrl(track.sourceId);
    audio.src = source;
    audio.load();

    const onReady = () => {
      setBuffering(false);
      if (restore > 0) audio.currentTime = restore;
    };
    audio.addEventListener('loadedmetadata', onReady, { once: true });

    return () => audio.removeEventListener('loadedmetadata', onReady);
  }, [track, showVideo]);

  useEffect(() => {
    const media = getMedia();
    if (!media) return;

    if (isPlaying) {
      media.play().catch((reason: DOMException) => {
        // NotAllowedError = política de autoplay, não é falha de rede.
        if (reason?.name !== 'AbortError') setPlaying(false);
      });
    } else {
      media.pause();
    }
  }, [isPlaying, track, showVideo, getMedia, setPlaying]);

  useEffect(() => {
    const media = getMedia();
    if (media) media.volume = muted ? 0 : volume;
  }, [volume, muted, getMedia, showVideo, track]);

  useEffect(() => {
    if (!pendingRemote) return;
    const media = getMedia();
    if (media) {
      media.currentTime = pendingRemote.positionSec;
      if (pendingRemote.isPlaying) void media.play().catch(() => undefined);
    }
    consumeRemote();
  }, [pendingRemote, consumeRemote, getMedia]);

  // Resolve a próxima faixa no backend enquanto a atual toca.
  useEffect(() => {
    const upcoming = queue.slice(index + 1, index + 3).map((item) => item.sourceId);
    if (upcoming.length === 0) return;

    void fetch(apiUrl('/api/music/warm'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: upcoming }),
    }).catch(() => undefined);
  }, [queue, index]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !track) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || 'Nossa Sessão',
      artwork: track.coverUrl ? [{ src: track.coverUrl, sizes: '544x544', type: 'image/jpeg' }] : [],
    });

    navigator.mediaSession.setActionHandler('play', () => setPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => setPlaying(false));
    navigator.mediaSession.setActionHandler('previoustrack', () => previous());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
  }, [track, setPlaying, previous, next]);

  /* ---------------------------------------------------------------- */
  /* Letra                                                             */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!isLyricsOpen || !track) return;

    setLyrics({ synced: null, text: null, source: null, loading: true });
    getLyrics(track.sourceId, {
      title: track.title,
      artist: track.artist,
      album: track.album,
      durationSec: track.durationSec,
    })
      .then((result) => setLyrics({ ...result, loading: false }))
      .catch(() => setLyrics({ synced: null, text: null, source: null, loading: false }));
  }, [isLyricsOpen, track]);

  /** Índice da linha que está tocando agora. */
  const activeLine = useMemo(() => {
    if (!lyrics.synced?.length) return -1;
    let found = -1;
    for (let i = 0; i < lyrics.synced.length; i += 1) {
      if (lyrics.synced[i].timeSec <= position + 0.15) found = i;
      else break;
    }
    return found;
  }, [lyrics.synced, position]);

  // Mantém a linha atual no centro do painel.
  useEffect(() => {
    if (activeLine < 0 || !lyricsListRef.current) return;
    const node = lyricsListRef.current.children[activeLine] as HTMLElement | undefined;
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeLine]);

  // Na aba de TV o player de música sai da frente — dois áudios ao
  // mesmo tempo não faz sentido.
  if (!track || mainView === 'tv') return null;

  const totalDuration = duration || track.durationSec || 0;
  const progressPercent =
    totalDuration > 0 ? Math.min((position / totalDuration) * 100, 100) : 0;

  const handleSeek = (value: number) => {
    const media = getMedia();
    if (!media) return;
    media.currentTime = value;
    setPosition(value);
    broadcast({ positionSec: value });
  };

  const handleTogglePlay = () => {
    const nextPlaying = !isPlaying;
    setPlaying(nextPlaying);
    broadcast({ isPlaying: nextPlaying }, true);
  };

  const handleToggleVideo = () => {
    carryPosition.current = getMedia()?.currentTime ?? 0;
    toggleVideo();
  };

  const mediaEvents = {
    onTimeUpdate: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      setPosition(event.currentTarget.currentTime),
    onDurationChange: (event: React.SyntheticEvent<HTMLMediaElement>) => {
      const value = event.currentTarget.duration;
      setDuration(Number.isFinite(value) ? value : 0);
    },
    onEnded: () => next(true),
    onWaiting: () => setBuffering(true),
    onPlaying: () => {
      setBuffering(false);
      setError(null);
    },
    onCanPlay: () => setBuffering(false),
  };

  return (
    <>
      {/* Elemento de áudio: fica sempre montado pra não perder estado. */}
      <audio
        ref={audioRef}
        {...mediaEvents}
        onError={() => {
          setBuffering(false);
          void describeMediaFailure(audioStreamUrl(track.sourceId)).then(setError);
        }}
      />

      {/* Videoclipe */}
      {showVideo && (
        <div className="fixed bottom-24 right-4 z-40 w-[min(420px,calc(100vw-2rem))] rounded-2xl overflow-hidden glass-modal shadow-glow-purple animate-fadeIn">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-xs font-bold text-white truncate">{track.title}</span>
            <button
              onClick={handleToggleVideo}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Fechar videoclipe"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <video
            ref={videoRef}
            playsInline
            className="w-full aspect-video bg-black"
            {...mediaEvents}
          />
        </div>
      )}

      {/* Letra */}
      {isLyricsOpen && (
        <div className="fixed bottom-24 left-4 z-40 w-[min(380px,calc(100vw-2rem))] h-[min(50vh,420px)] rounded-2xl glass-modal shadow-glow-purple animate-fadeIn flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="min-w-0">
              <span className="block text-xs font-bold text-white truncate">{track.title}</span>
              {lyrics.source && (
                <span className="block text-[10px] text-slate-500">
                  {lyrics.synced ? 'acompanhando a música' : 'letra completa'} · {lyrics.source}
                </span>
              )}
            </div>
            <button
              onClick={toggleLyrics}
              className="p-1 text-slate-400 hover:text-white transition-colors"
              aria-label="Fechar letra"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {lyrics.loading ? (
            <p className="p-4 text-sm text-slate-500">Procurando a letra...</p>
          ) : lyrics.synced?.length ? (
            <ul ref={lyricsListRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-2.5">
              {lyrics.synced.map((line, position_) => (
                <li
                  key={`${line.timeSec}-${position_}`}
                  onClick={() => handleSeek(line.timeSec)}
                  className={cn(
                    'cursor-pointer transition-all duration-300 leading-snug',
                    position_ === activeLine
                      ? 'text-white font-bold text-base text-glow-purple'
                      : 'text-slate-500 text-sm hover:text-slate-300'
                  )}
                >
                  {line.text || '♪'}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed text-slate-300 whitespace-pre-line">
              {lyrics.text || 'Não achei a letra dessa música.'}
            </div>
          )}
        </div>
      )}

      {/* Fila */}
      {showQueue && (
        <div className="fixed bottom-24 right-4 z-40 w-[min(380px,calc(100vw-2rem))] max-h-[50vh] rounded-2xl glass-modal shadow-glow-purple animate-fadeIn flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-xs font-bold text-white">Na fila · {queue.length}</span>
            <button
              onClick={() => setShowQueue(false)}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Fechar fila"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ul className="overflow-y-auto py-1">
            {queue.map((item, position_) => (
              <li key={`${item.sourceId}-${position_}`}>
                <div
                  className={cn(
                    'group flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors',
                    position_ === index && 'bg-accent-purple/15'
                  )}
                >
                  <button onClick={() => goTo(position_)} className="flex-1 min-w-0 text-left">
                    <p
                      className={cn(
                        'text-xs font-semibold truncate',
                        position_ === index ? 'text-accent-purple' : 'text-white'
                      )}
                    >
                      {item.title}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{item.artist}</p>
                  </button>
                  <button
                    onClick={() => removeAt(position_)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-accent-pink transition-all"
                    aria-label={`Tirar ${item.title} da fila`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Barra do player */}
      <div className="fixed bottom-0 left-0 right-0 z-40 glass-modal border-t border-cinema-border pb-[env(safe-area-inset-bottom)]">
        {/* No celular o progresso vira um fio no topo da barra: ocupa
            espaco nenhum e continua dando pra arrastar. */}
        <div className="sm:hidden relative h-1 bg-cinema-border">
          <div
            className="absolute inset-y-0 left-0 bg-accent-purple"
            style={{ width: progressPercent + '%' }}
          />
          <input
            type="range"
            min={0}
            max={duration || track.durationSec || 100}
            step={0.5}
            value={position}
            onChange={(event) => handleSeek(Number(event.target.value))}
            className="absolute inset-0 w-full opacity-0"
            aria-label="Progresso"
          />
        </div>

        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5">
          {error && (
            <p className="text-[11px] text-rose-400 text-center pb-1.5 font-medium">{error}</p>
          )}

          <div className="flex items-center gap-3 sm:gap-6">
            {/* Faixa atual. No celular ela divide o espaco com o play. */}
            <div className="flex items-center gap-3 flex-1 sm:flex-none sm:w-1/3 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-cinema-elevated flex-shrink-0 flex items-center justify-center border border-cinema-border">
                {track.coverUrl ? (
                  <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Music className="w-5 h-5 text-slate-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] sm:text-sm font-bold text-white truncate leading-tight">
                  {track.title}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">{track.artist}</p>
              </div>
            </div>

            {/* Controles */}
            <div className="flex sm:flex-1 flex-col items-center gap-1.5 min-w-0">
              <div className="flex items-center gap-1 sm:gap-4">
                <button
                  onClick={toggleShuffle}
                  className={cn(
                    'hidden sm:block transition-colors',
                    shuffle ? 'text-accent-purple' : 'text-slate-500 hover:text-slate-300'
                  )}
                  aria-label="Aleatorio"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button
                  onClick={previous}
                  className="p-1.5 text-slate-300 hover:text-white transition-colors"
                  aria-label="Faixa anterior"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button
                  onClick={handleTogglePlay}
                  className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-accent-purple text-white hover:brightness-110 transition-all shadow-glow-purple active:scale-95"
                  aria-label={isPlaying ? 'Pausar' : 'Tocar'}
                >
                  {buffering ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5 ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => next()}
                  className="p-1.5 text-slate-300 hover:text-white transition-colors"
                  aria-label="Proxima faixa"
                >
                  <SkipForward className="w-5 h-5" />
                </button>

                <button
                  onClick={cycleRepeat}
                  className={cn(
                    'hidden sm:block transition-colors',
                    repeat !== 'off' ? 'text-accent-purple' : 'text-slate-500 hover:text-slate-300'
                  )}
                  aria-label="Repetir"
                >
                  {repeat === 'one' ? (
                    <Repeat1 className="w-4 h-4" />
                  ) : (
                    <Repeat className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-2 w-full max-w-xl text-[11px] text-slate-400 font-medium tabular-nums">
                <span>{formatSeconds(position)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || track.durationSec || 100}
                  step={0.5}
                  value={position}
                  onChange={(event) => handleSeek(Number(event.target.value))}
                  className="flex-1"
                  aria-label="Progresso"
                />
                <span>{formatSeconds(duration || track.durationSec)}</span>
              </div>
            </div>

            {/* Acoes */}
            <div className="flex items-center justify-end gap-0.5 sm:gap-2 sm:w-1/3 flex-shrink-0">
              <button
                onClick={() => party.setEnabled(!party.enabled)}
                className={cn(
                  'relative p-2 rounded-lg transition-colors',
                  party.enabled
                    ? 'text-accent-pink bg-accent-pink/15'
                    : 'text-slate-500 hover:text-slate-300'
                )}
                title={
                  party.enabled
                    ? party.partnerOnline
                      ? 'Ouvindo junto'
                      : 'Ouvir junto ligado, esperando o outro entrar'
                    : 'Ouvir junto'
                }
              >
                <Users className="w-4 h-4" />
                {party.enabled && party.partnerOnline && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>

              <button
                onClick={handleToggleVideo}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  showVideo
                    ? 'text-accent-blue bg-accent-blue/15'
                    : 'text-slate-500 hover:text-slate-300'
                )}
                title="Videoclipe"
              >
                <Video className="w-4 h-4" />
              </button>

              <button
                onClick={toggleLyrics}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  isLyricsOpen
                    ? 'text-accent-gold bg-accent-gold/15'
                    : 'text-slate-500 hover:text-slate-300'
                )}
                title="Letra"
              >
                <Mic2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowQueue((value) => !value)}
                className={cn(
                  'hidden xs:block p-2 rounded-lg transition-colors',
                  showQueue ? 'text-white bg-white/10' : 'text-slate-500 hover:text-slate-300'
                )}
                title="Fila"
              >
                <ListMusic className="w-4 h-4" />
              </button>

              <a
                href={audioDownloadUrl(track.sourceId, track.artist + ' - ' + track.title)}
                download
                className="hidden sm:block p-2 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
                title="Baixar pra ouvir offline"
              >
                <Download className="w-4 h-4" />
              </a>

              <div className="hidden lg:flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label="Mudo"
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="w-20"
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
