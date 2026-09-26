import { useEffect, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  getIptvSeriesEpisodes,
  listIptvChannels,
  listIptvSeries,
  parseIptvSource,
  type IptvParseResult,
} from '../lib/api';
import { findTmdbMatch } from '../lib/tmdb';
import type {
  IptvChannel,
  IptvFavoriteRecord,
  IptvKind,
  IptvSourceRecord,
  TMDBMovieResult,
  UserProfile,
} from '../types';

/**
 * A lista do provedor fica em cache no backend (são dezenas de
 * milhares de entradas, já classificadas em ao vivo, filme e série).
 * Aqui guardamos só a chave dela e a configuração da fonte no
 * Supabase, pra os dois usarem sem cadastrar duas vezes.
 */
export function useIptv() {
  const queryClient = useQueryClient();
  const channelId = useId();
  const [sourceKey, setSourceKey] = useState<string | null>(null);
  const [parsed, setParsed] = useState<IptvParseResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sourcesQuery = useQuery({
    queryKey: ['iptv_sources'],
    queryFn: async (): Promise<IptvSourceRecord[]> => {
      const { data, error } = await supabase
        .from('iptv_sources')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const favoritesQuery = useQuery({
    queryKey: ['iptv_favorites'],
    queryFn: async (): Promise<IptvFavoriteRecord[]> => {
      const { data, error } = await supabase
        .from('iptv_favorites')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`iptv-do-casal${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iptv_favorites' }, () => {
        queryClient.invalidateQueries({ queryKey: ['iptv_favorites'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iptv_sources' }, () => {
        queryClient.invalidateQueries({ queryKey: ['iptv_sources'] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, channelId]);

  const loadSource = useMutation({
    mutationFn: async (source: IptvSourceRecord) => {
      const result = await parseIptvSource(
        source.kind === 'xtream'
          ? {
              xtream: {
                host: source.xtream_host || '',
                username: source.xtream_username || '',
                password: source.xtream_password || '',
              },
            }
          : { m3uUrl: source.m3u_url || '' }
      );

      await supabase
        .from('iptv_sources')
        .update({ channel_count: result.totalChannels, last_used_at: new Date().toISOString() })
        .eq('id', source.id);

      return result;
    },
    onSuccess: (result) => {
      setSourceKey(result.sourceKey);
      setParsed(result);
      setLoadError(null);
    },
    onError: (error) => setLoadError((error as Error).message),
  });

  const saveSource = useMutation({
    mutationFn: async (input: {
      label: string;
      kind: 'm3u' | 'xtream';
      m3uUrl?: string;
      xtreamHost?: string;
      xtreamUsername?: string;
      xtreamPassword?: string;
      profile: UserProfile;
    }) => {
      // Valida antes de salvar: guardar uma lista quebrada só adia o problema.
      const result = await parseIptvSource(
        input.kind === 'xtream'
          ? {
              xtream: {
                host: input.xtreamHost || '',
                username: input.xtreamUsername || '',
                password: input.xtreamPassword || '',
              },
            }
          : { m3uUrl: input.m3uUrl || '' }
      );

      const { data, error } = await supabase
        .from('iptv_sources')
        .insert({
          label: input.label.trim() || 'Minha lista',
          kind: input.kind,
          m3u_url: input.m3uUrl || null,
          xtream_host: input.xtreamHost || null,
          xtream_username: input.xtreamUsername || null,
          xtream_password: input.xtreamPassword || null,
          channel_count: result.totalChannels,
          added_by: input.profile,
          last_used_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return { source: data as IptvSourceRecord, result };
    },
    onSuccess: ({ result }) => {
      setSourceKey(result.sourceKey);
      setParsed(result);
      setLoadError(null);
      queryClient.invalidateQueries({ queryKey: ['iptv_sources'] });
    },
  });

  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('iptv_sources').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSourceKey(null);
      setParsed(null);
      queryClient.invalidateQueries({ queryKey: ['iptv_sources'] });
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async (input: {
      channel: IptvChannel;
      sourceId: string | null;
      profile: UserProfile;
      existingId?: string;
    }) => {
      if (input.existingId) {
        const { error } = await supabase.from('iptv_favorites').delete().eq('id', input.existingId);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('iptv_favorites').insert({
        source_id: input.sourceId,
        name: input.channel.name,
        stream_url: input.channel.url,
        logo_url: input.channel.logo,
        group_title: input.channel.group,
        added_by: input.profile,
      });
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['iptv_favorites'] }),
  });

  return {
    sources: sourcesQuery.data || [],
    isLoadingSources: sourcesQuery.isLoading,
    favorites: favoritesQuery.data || [],

    sourceKey,
    counts: parsed?.counts || null,
    groups: parsed?.groups || null,
    totalChannels: parsed?.totalChannels || 0,
    totalSeries: parsed?.totalSeries || 0,
    loadError,

    loadSource: loadSource.mutateAsync,
    isLoadingChannels: loadSource.isPending,
    saveSource: saveSource.mutateAsync,
    isSavingSource: saveSource.isPending,
    saveSourceError: saveSource.error as Error | null,
    deleteSource: deleteSource.mutateAsync,
    toggleFavorite: toggleFavorite.mutateAsync,
  };
}

export function useIptvChannels(params: {
  sourceKey: string | null;
  kind: IptvKind;
  group: string | null;
  query: string;
  page: number;
  includeAdult: boolean;
}) {
  return useQuery({
    queryKey: [
      'iptv_channels',
      params.sourceKey,
      params.kind,
      params.group,
      params.query,
      params.page,
      params.includeAdult,
    ],
    queryFn: () =>
      listIptvChannels({
        sourceKey: params.sourceKey as string,
        kind: params.kind,
        group: params.group || undefined,
        q: params.query || undefined,
        page: params.page,
        pageSize: 60,
        includeAdult: params.includeAdult,
      }),
    enabled: Boolean(params.sourceKey) && params.kind !== 'series',
    placeholderData: (previous) => previous,
  });
}

export function useIptvSeriesList(params: {
  sourceKey: string | null;
  group: string | null;
  query: string;
  page: number;
  includeAdult: boolean;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: [
      'iptv_series',
      params.sourceKey,
      params.group,
      params.query,
      params.page,
      params.includeAdult,
    ],
    queryFn: () =>
      listIptvSeries({
        sourceKey: params.sourceKey as string,
        group: params.group || undefined,
        q: params.query || undefined,
        page: params.page,
        pageSize: 48,
        includeAdult: params.includeAdult,
      }),
    enabled: Boolean(params.sourceKey) && params.enabled,
    placeholderData: (previous) => previous,
  });
}

export function useSeriesEpisodes(sourceKey: string | null, seriesKey: string | null) {
  return useQuery({
    queryKey: ['iptv_series_episodes', sourceKey, seriesKey],
    queryFn: () => getIptvSeriesEpisodes(sourceKey as string, seriesKey as string),
    enabled: Boolean(sourceKey && seriesKey),
  });
}

/**
 * Favoritar um filme ou série da TV não deve parar no IPTV: a graça é
 * ela entrar na lista do casal, com pôster e ficha, pra dar nota
 * depois. Procuramos a obra no TMDB pelo nome já limpo e, achando,
 * ela vai pra watchlist de quem favoritou.
 */
export function useSendToWatchlist(
  addMovie: (input: {
    tmdbMovie: TMDBMovieResult;
    profile: UserProfile;
    mediaType?: 'movie' | 'tv';
    iptvStreamUrl?: string | null;
    iptvSeriesKey?: string | null;
  }) => Promise<unknown>
) {
  return useMutation({
    mutationFn: async (input: {
      title: string;
      year: number | null;
      type: 'movie' | 'tv';
      profile: UserProfile;
      streamUrl?: string | null;
      seriesKey?: string | null;
    }) => {
      const match = await findTmdbMatch(input.title, { year: input.year, type: input.type });
      if (!match) {
        throw new Error(
          `Não achei "${input.title}" no TMDB. Dá pra adicionar na mão pela busca de filmes.`
        );
      }

      await addMovie({
        tmdbMovie: match,
        profile: input.profile,
        mediaType: input.type,
        iptvStreamUrl: input.streamUrl || null,
        iptvSeriesKey: input.seriesKey || null,
      });

      return match;
    },
  });
}
