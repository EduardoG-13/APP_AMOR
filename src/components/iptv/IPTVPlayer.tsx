import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Users,
  Tv,
  Loader2,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { iptvStreamUrl } from '../../lib/api';
import { useParty } from '../../hooks/useParty';
import { usePlayerStore } from '../../store/usePlayerStore';
import { DRIFT_TOLERANCE_SEC, HEARTBEAT_MS } from '../../lib/party';
import { cn, formatSeconds } from '../../lib/utils';
import type { IptvChannel } from '../../types';

interface IPTVPlayerProps {
  channel: IptvChannel | null;
  /**
   * O parceiro trocou de canal. Vem o NOME, não a URL: cada um tem a
   * própria lista (com as próprias credenciais), então a URL de um
   * não funciona no outro. Quem recebe procura esse nome na lista
   * dele e abre a versão dele.
   */
  onRemoteChannel: (remote: { name: string; group: string | null; logo: string | null }) => void;
  /** Segundo em que o filme/episodio parou da ultima vez. */
  resumeAtSec?: number | null;
  /** Avisa a posicao atual pra o "continuar assistindo". */
  onProgress?: (positionSec: number, durationSec: number) => void;
  /** Chamado ao pausar ou trocar de conteudo, pra gravar na hora. */
  onProgressFlush?: () => void;
}

type StreamKind = 'hls' | 'mpegts' | 'direct' | 'unsupported';

/**
 * Cada provedor entrega de um jeito e cada formato pede um player
 * diferente. Escolher errado é o que faz a tela ficar carregando
 * pra sempre — o player recebe bytes que não sabe interpretar e
 * simplesmente espera.
 */
function detectStreamKind(url: string): StreamKind {
  const path = url.split('?')[0].toLowerCase();

  if (path.endsWith('.m3u8') || path.endsWith('.m3u')) return 'hls';
  if (path.endsWith('.ts') || path.endsWith('.flv')) return 'mpegts';
  if (/\.(mp4|webm|m4v|mov)$/.test(path)) return 'direct';
  if (/\.(mkv|avi|wmv)$/.test(path)) return 'unsupported';

  // Sem extensão quase sempre é HLS.
  return 'hls';
}

/** Depois disso, é travamento — não vale deixar o usuário esperando. */
const LOAD_TIMEOUT_MS = 25_000;

export function IPTVPlayer({
  channel,
  onRemoteChannel,
  resumeAtSec,
  onProgress,
  onProgressFlush,
}: IPTVPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const tsRef = useRef<mpegts.Player | null>(null);
  const applyingRemote = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const partyEnabled = usePlayerStore((state) => state.partyEnabled);
  const setPartyEnabled = usePlayerStore((state) => state.setPartyEnabled);

  const party = useParty({
    kind: 'iptv',
    onSync: (message) => {
      applyingRemote.current = true;

      if (message.ref !== channel?.name) {
        onRemoteChannel({
          name: message.title,
          group: message.subtitle ?? null,
          logo: message.coverUrl ?? null,
        });
      } else {
        const video = videoRef.current;
        // Em canal ao vivo não faz sentido buscar posição: os dois já
        // estão na ponta da transmissão. Só sincroniza play/pause.
        if (video && !isLive && Math.abs(video.currentTime - message.positionSec) > DRIFT_TOLERANCE_SEC) {
          video.currentTime = message.positionSec;
        }
        if (video) {
          if (message.isPlaying) void video.play().catch(() => undefined);
          else video.pause();
        }
      }

      window.setTimeout(() => {
        applyingRemote.current = false;
      }, 400);
    },
  });

  const broadcast = useCallback(
    (overrides?: { positionSec?: number; isPlaying?: boolean }, persist = false) => {
      if (!party.enabled || applyingRemote.current || !channel) return;

      party.publish(
        {
          // Nome, não URL: é o único identificador que vale nas duas listas.
          ref: channel.name,
          title: channel.name,
          subtitle: channel.group,
          coverUrl: channel.logo,
          positionSec: overrides?.positionSec ?? videoRef.current?.currentTime ?? 0,
          isPlaying: overrides?.isPlaying ?? isPlaying,
        },
        { persist }
      );
    },
    [party, channel, isPlaying]
  );

  // Monta o player certo pro formato do canal.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel) return;

    setError(null);
    setLoading(true);

    const source = iptvStreamUrl(channel.url);
    const kind = detectStreamKind(channel.url);

    hlsRef.current?.destroy();
    hlsRef.current = null;
    tsRef.current?.destroy();
    tsRef.current = null;

    // Se nada tocar dentro do prazo, avisa em vez de girar pra sempre.
    const watchdog = window.setTimeout(() => {
      setLoading(false);
      setError(
        'Esse canal não respondeu a tempo. Pode estar fora do ar, ou a lista precisa ser recarregada (o link do provedor expira).'
      );
    }, LOAD_TIMEOUT_MS);

    const started = () => {
      window.clearTimeout(watchdog);
      setLoading(false);
      // Volta pro ponto onde pararam. So depois do metadata: antes
      // disso o elemento ignora o currentTime.
      if (resumeAtSec && resumeAtSec > 0 && Number.isFinite(video.duration)) {
        video.currentTime = resumeAtSec;
      }
      void video.play().catch(() => setIsPlaying(false));
    };

    if (kind === 'unsupported') {
      window.clearTimeout(watchdog);
      setLoading(false);
      setError(
        'Esse arquivo está em MKV/AVI, formato que navegador nenhum reproduz. Procure a mesma obra em MP4 na sua lista.'
      );
      return () => window.clearTimeout(watchdog);
    }

    if (kind === 'mpegts') {
      // Canal ao vivo em MPEG-TS puro: o hls.js não dá conta, o
      // mpegts.js sim (ele demuxa o TS direto no navegador).
      if (!mpegts.isSupported()) {
        window.clearTimeout(watchdog);
        setLoading(false);
        setError('Esse navegador não consegue tocar MPEG-TS.');
        return () => window.clearTimeout(watchdog);
      }

      const player = mpegts.createPlayer(
        {
          type: channel.url.toLowerCase().includes('.flv') ? 'flv' : 'mpegts',
          url: source,
          isLive: true,
          hasAudio: true,
          hasVideo: true,
        },
        { enableWorker: true, liveBufferLatencyChasing: true, lazyLoad: false }
      );

      player.attachMediaElement(video);
      player.load();
      player.on(mpegts.Events.MEDIA_INFO, started);
      player.on(mpegts.Events.ERROR, () => {
        window.clearTimeout(watchdog);
        setLoading(false);
        setError('Não consegui abrir esse canal. Ele pode estar fora do ar.');
      });

      setIsLive(true);
      tsRef.current = player;

      return () => {
        window.clearTimeout(watchdog);
        player.destroy();
        tsRef.current = null;
      };
    }

    if (kind === 'direct') {
      // Filme em MP4: o próprio <video> resolve, e dá seek.
      video.src = source;
      setIsLive(false);
      video.addEventListener('loadedmetadata', started, { once: true });
      video.addEventListener(
        'error',
        () => {
          window.clearTimeout(watchdog);
          setLoading(false);
          setError('Não consegui abrir esse arquivo.');
        },
        { once: true }
      );

      return () => {
        window.clearTimeout(watchdog);
        video.removeEventListener('loadedmetadata', started);
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        // Buffer curto: canal ao vivo travando é pior que perder
        // alguns segundos de pré-carregamento.
        maxBufferLength: 20,
        liveSyncDurationCount: 3,
        manifestLoadingMaxRetry: 3,
        fragLoadingMaxRetry: 4,
      });

      hls.loadSource(source);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLive(hls.levels?.[0]?.details?.live ?? true);
        started();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }

        window.clearTimeout(watchdog);
        setLoading(false);
        setError(
          'Não consegui abrir esse canal. Pode estar fora do ar ou a lista precisa ser recarregada.'
        );
        hls.destroy();
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari/iOS tocam HLS nativamente.
      video.src = source;
      video.addEventListener('loadedmetadata', started, { once: true });
    } else {
      window.clearTimeout(watchdog);
      setLoading(false);
      setError('Esse navegador não suporta HLS.');
    }

    return () => {
      window.clearTimeout(watchdog);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [channel]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.volume = muted ? 0 : volume;
  }, [volume, muted]);

  // Trocou de canal: manda na hora, senão o outro só descobriria na
  // próxima batida (e só se já estivesse tocando).
  useEffect(() => {
    if (!party.enabled || !channel || applyingRemote.current) return;
    broadcast({ positionSec: 0, isPlaying: true }, true);
    // Só quando o canal muda de verdade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.name, party.enabled]);

  useEffect(() => {
    if (!party.enabled || !isPlaying) return;
    const timer = window.setInterval(() => broadcast(), HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [party.enabled, isPlaying, broadcast]);

  if (!channel) {
    return (
      <div className="w-full aspect-video rounded-2xl bg-cinema-surface/60 border border-dashed border-cinema-border flex flex-col items-center justify-center text-slate-500 gap-2">
        <Tv className="w-10 h-10 opacity-40" />
        <p className="text-sm">Escolha um canal pra começar</p>
      </div>
    );
  }

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play();
      broadcast({ isPlaying: true }, true);
    } else {
      video.pause();
      broadcast({ isPlaying: false }, true);
    }
  };

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-cinema-border group shadow-glow-blue">
      <video
        ref={videoRef}
        playsInline
        className="w-full h-full object-contain bg-black"
        onPlay={() => setIsPlaying(true)}
        onPause={() => {
          setIsPlaying(false);
          onProgressFlush?.();
        }}
        onTimeUpdate={(event) => {
          setPosition(event.currentTarget.currentTime);
          onProgress?.(event.currentTarget.currentTime, event.currentTarget.duration || 0);
        }}
        onDurationChange={(event) => {
          const value = event.currentTarget.duration;
          setDuration(Number.isFinite(value) ? value : 0);
        }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
      />

      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
          <Loader2 className="w-8 h-8 text-accent-blue animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center p-6 gap-2">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <p className="text-sm text-slate-300 max-w-sm">{error}</p>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 sm:p-4 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-bold text-white truncate flex-1">{channel.name}</h3>
          {isLive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
              <Radio className="w-2.5 h-2.5 animate-pulse" /> AO VIVO
            </span>
          )}
        </div>

        {!isLive && duration > 0 && (
          <div className="flex items-center gap-2 mb-2 text-[11px] text-slate-300 tabular-nums">
            <span>{formatSeconds(position)}</span>
            <input
              type="range"
              min={0}
              max={duration}
              step={1}
              value={position}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (videoRef.current) videoRef.current.currentTime = value;
                setPosition(value);
                broadcast({ positionSec: value });
              }}
              className="flex-1"
              aria-label="Progresso"
            />
            <span>{formatSeconds(duration)}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-accent-blue/20 text-accent-blue hover:bg-accent-blue hover:text-white flex items-center justify-center transition-colors"
            aria-label={isPlaying ? 'Pausar' : 'Tocar'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            onClick={() => setMuted((value) => !value)}
            className="text-slate-300 hover:text-white transition-colors"
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
            onChange={(event) => {
              setVolume(Number(event.target.value));
              setMuted(false);
            }}
            className="w-20 sm:w-24"
            aria-label="Volume"
          />

          <div className="flex-1" />

          <button
            onClick={() => setPartyEnabled(!partyEnabled)}
            className={cn(
              'relative p-2 rounded-lg transition-colors',
              party.enabled ? 'text-accent-pink bg-accent-pink/15' : 'text-slate-300 hover:text-white'
            )}
            title={
              party.enabled
                ? party.partnerOnline
                  ? 'Assistindo junto 💞'
                  : 'Assistir junto ligado — esperando o outro entrar'
                : 'Assistir junto'
            }
          >
            <Users className="w-4 h-4" />
            {party.enabled && party.partnerOnline && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              if (document.fullscreenElement) void document.exitFullscreen();
              else void video.requestFullscreen();
            }}
            className="text-slate-300 hover:text-white transition-colors"
            aria-label="Tela cheia"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
