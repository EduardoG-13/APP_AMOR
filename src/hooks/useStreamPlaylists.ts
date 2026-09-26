import { useEffect, useId } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type {
  PlaylistExportRecord,
  StreamPlaylistRecord,
  StreamPlaylistTrackRecord,
  StreamTrack,
  UserProfile,
} from '../types';

async function fetchPlaylists(): Promise<StreamPlaylistRecord[]> {
  const { data, error } = await supabase
    .from('stream_playlists')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchTracks(playlistId: string): Promise<StreamPlaylistTrackRecord[]> {
  const { data, error } = await supabase
    .from('stream_playlist_tracks')
    .select('*')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchExports(playlistId: string): Promise<PlaylistExportRecord[]> {
  const { data, error } = await supabase
    .from('playlist_exports')
    .select('*')
    .eq('playlist_id', playlistId);

  if (error) throw error;
  return data || [];
}

export function useStreamPlaylists(selectedPlaylistId: string | null) {
  const queryClient = useQueryClient();
  // Nome único por instância do hook. Dois componentes pedindo o
  // mesmo nome de canal fazem o supabase-js devolver o canal já
  // existente, e o segundo subscribe() lança — derrubando a tela.
  const channelId = useId();

  // Playlist é do casal: o que um adiciona tem que aparecer no outro.
  useEffect(() => {
    const channel = supabase
      .channel(`playlists-do-casal${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_playlists' }, () => {
        queryClient.invalidateQueries({ queryKey: ['stream_playlists'] });
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stream_playlist_tracks' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['stream_playlist_tracks'] });
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist_exports' }, () => {
        queryClient.invalidateQueries({ queryKey: ['playlist_exports'] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, channelId]);

  const playlistsQuery = useQuery({
    queryKey: ['stream_playlists'],
    queryFn: fetchPlaylists,
  });

  const tracksQuery = useQuery({
    queryKey: ['stream_playlist_tracks', selectedPlaylistId],
    queryFn: () => fetchTracks(selectedPlaylistId as string),
    enabled: Boolean(selectedPlaylistId),
  });

  const exportsQuery = useQuery({
    queryKey: ['playlist_exports', selectedPlaylistId],
    queryFn: () => fetchExports(selectedPlaylistId as string),
    enabled: Boolean(selectedPlaylistId),
  });

  const createPlaylist = useMutation({
    mutationFn: async (input: { name: string; description?: string; profile: UserProfile }) => {
      const { data, error } = await supabase
        .from('stream_playlists')
        .insert({
          name: input.name.trim(),
          description: input.description?.trim() || null,
          created_by: input.profile,
        })
        .select()
        .single();

      if (error) throw error;
      return data as StreamPlaylistRecord;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stream_playlists'] }),
  });

  const renamePlaylist = useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase
        .from('stream_playlists')
        .update({ name: input.name.trim() })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stream_playlists'] }),
  });

  const deletePlaylist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('stream_playlists').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stream_playlists'] }),
  });

  const addTrack = useMutation({
    mutationFn: async (input: {
      playlistId: string;
      track: StreamTrack;
      profile: UserProfile;
      memoryNote?: string | null;
    }) => {
      // Pega a próxima posição no banco pra dois celulares adicionando
      // ao mesmo tempo não brigarem pelo mesmo número.
      const { data: position, error: positionError } = await supabase.rpc(
        'next_playlist_position',
        { p_playlist_id: input.playlistId }
      );
      if (positionError) throw positionError;

      const { error } = await supabase.from('stream_playlist_tracks').insert({
        playlist_id: input.playlistId,
        position: position ?? 0,
        source: input.track.source,
        source_id: input.track.sourceId,
        title: input.track.title,
        artist: input.track.artist,
        album: input.track.album,
        cover_url: input.track.coverUrl,
        duration_sec: input.track.durationSec,
        memory_note: input.memoryNote || null,
        added_by: input.profile,
      });

      // 23505 = unique_violation: a faixa já estava na playlist.
      if (error && error.code !== '23505') throw error;
      return { duplicated: error?.code === '23505' };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stream_playlist_tracks'] }),
  });

  const removeTrack = useMutation({
    mutationFn: async (trackId: string) => {
      const { error } = await supabase.from('stream_playlist_tracks').delete().eq('id', trackId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stream_playlist_tracks'] }),
  });

  const moveTrack = useMutation({
    mutationFn: async (input: { tracks: StreamPlaylistTrackRecord[]; from: number; to: number }) => {
      const reordered = [...input.tracks];
      const [moved] = reordered.splice(input.from, 1);
      reordered.splice(input.to, 0, moved);

      await Promise.all(
        reordered.map((track, position) =>
          supabase.from('stream_playlist_tracks').update({ position }).eq('id', track.id)
        )
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stream_playlist_tracks'] }),
  });

  return {
    playlists: playlistsQuery.data || [],
    isLoadingPlaylists: playlistsQuery.isLoading,
    playlistsError: playlistsQuery.error as Error | null,

    tracks: tracksQuery.data || [],
    isLoadingTracks: tracksQuery.isLoading,

    exports: exportsQuery.data || [],

    createPlaylist: createPlaylist.mutateAsync,
    isCreating: createPlaylist.isPending,
    renamePlaylist: renamePlaylist.mutateAsync,
    deletePlaylist: deletePlaylist.mutateAsync,
    addTrack: addTrack.mutateAsync,
    isAddingTrack: addTrack.isPending,
    removeTrack: removeTrack.mutateAsync,
    moveTrack: moveTrack.mutateAsync,
  };
}

/** Converte a faixa salva no banco de volta pro formato do player. */
export function toStreamTrack(record: StreamPlaylistTrackRecord): StreamTrack {
  return {
    sourceId: record.source_id,
    source: record.source,
    title: record.title,
    artist: record.artist,
    album: record.album,
    coverUrl: record.cover_url,
    durationSec: record.duration_sec,
  };
}
