import { useCallback, useEffect, useId, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { IptvChannel, UserProfile } from '../types';

export interface WatchProgressRecord {
  id: string;
  stream_url: string;
  name: string;
  kind: 'live' | 'movie' | 'series';
  series_key: string | null;
  series_name: string | null;
  season: number | null;
  episode: number | null;
  episode_title: string | null;
  logo_url: string | null;
  group_title: string | null;
  position_sec: number;
  duration_sec: number | null;
  finished: boolean;
  last_profile: UserProfile;
  updated_at: string;
}

/** Abaixo disso não vale oferecer "continuar": mal começou. */
const MIN_POSITION_SEC = 30;
/** Acima disso o filme acabou — tirar da lista em vez de oferecer o final. */
const FINISHED_RATIO = 0.93;

export function useWatchProgress() {
  const queryClient = useQueryClient();
  const channelId = useId();

  useEffect(() => {
    const channel = supabase
      .channel(`watch-progress${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watch_progress' }, () => {
        queryClient.invalidateQueries({ queryKey: ['watch_progress'] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, channelId]);

  const query = useQuery({
    queryKey: ['watch_progress'],
    queryFn: async (): Promise<WatchProgressRecord[]> => {
      const { data, error } = await supabase
        .from('watch_progress')
        .select('*')
        .eq('finished', false)
        .order('updated_at', { ascending: false })
        .limit(12);

      if (error) throw error;
      return data || [];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('watch_progress').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watch_progress'] }),
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    remove: remove.mutateAsync,
  };
}

/**
 * Salva a posição enquanto assiste, sem martelar o banco: grava a
 * cada 15 segundos e sempre que o player para ou troca de conteúdo.
 * Canal ao vivo fica de fora — não existe "onde parei" numa transmissão.
 */
export function useProgressReporter(channel: IptvChannel | null, profile: UserProfile) {
  const lastSaved = useRef(0);
  const latest = useRef({ position: 0, duration: 0 });

  const persist = useCallback(
    async (positionSec: number, durationSec: number) => {
      if (!channel || channel.kind === 'live') return;
      if (positionSec < MIN_POSITION_SEC) return;

      const finished = durationSec > 0 && positionSec / durationSec >= FINISHED_RATIO;

      const { error } = await supabase.from('watch_progress').upsert(
        {
          stream_url: channel.url,
          name: channel.name,
          kind: channel.kind,
          series_key: channel.seriesKey,
          series_name: channel.seriesName,
          season: channel.season,
          episode: channel.episode,
          episode_title: channel.episodeTitle,
          logo_url: channel.logo,
          group_title: channel.group,
          position_sec: Math.floor(positionSec),
          duration_sec: durationSec > 0 ? Math.floor(durationSec) : null,
          finished,
          last_profile: profile,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'stream_url' }
      );

      if (error) console.warn('Não consegui salvar onde paramos:', error.message);
    },
    [channel, profile]
  );

  const report = useCallback(
    (positionSec: number, durationSec: number) => {
      latest.current = { position: positionSec, duration: durationSec };

      const now = Date.now();
      if (now - lastSaved.current < 15_000) return;
      lastSaved.current = now;
      void persist(positionSec, durationSec);
    },
    [persist]
  );

  /** Chamado ao pausar, trocar de conteúdo ou fechar a tela. */
  const flush = useCallback(() => {
    const { position, duration } = latest.current;
    if (position > 0) void persist(position, duration);
  }, [persist]);

  // Fechar a aba no meio do filme também tem que contar.
  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  return { report, flush };
}
