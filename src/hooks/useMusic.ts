import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { MusicTrackRecord, PlaylistConfigRecord, UserProfile } from '../types';

export function useMusic() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('schema-music-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'music_tracks' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['music_tracks'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playlist_config' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['playlist_config'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const musicQuery = useQuery({
    queryKey: ['music_tracks'],
    queryFn: async (): Promise<MusicTrackRecord[]> => {
      const { data, error } = await supabase
        .from('music_tracks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching music tracks:', error);
        throw error;
      }

      return data || [];
    },
  });

  const playlistsQuery = useQuery({
    queryKey: ['playlist_config'],
    queryFn: async (): Promise<PlaylistConfigRecord[]> => {
      const { data, error } = await supabase
        .from('playlist_config')
        .select('*');

      if (error) {
        console.error('Error fetching playlist configs:', error);
        return [];
      }

      return data || [];
    },
  });

  const addTrackMutation = useMutation({
    mutationFn: async (track: {
      title: string;
      artist: string;
      album?: string | null;
      cover_url?: string | null;
      spotify_url?: string | null;
      deezer_url?: string | null;
      preview_url?: string | null;
      added_by: UserProfile;
      memory_note?: string | null;
      movie_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('music_tracks')
        .insert({
          title: track.title,
          artist: track.artist,
          album: track.album || null,
          cover_url: track.cover_url || null,
          spotify_url: track.spotify_url || null,
          deezer_url: track.deezer_url || null,
          preview_url: track.preview_url || null,
          added_by: track.added_by,
          memory_note: track.memory_note || null,
          movie_id: track.movie_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['music_tracks'] });
    },
  });

  const deleteTrackMutation = useMutation({
    mutationFn: async (trackId: string) => {
      const { error } = await supabase
        .from('music_tracks')
        .delete()
        .eq('id', trackId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['music_tracks'] });
    },
  });

  const updatePlaylistMutation = useMutation({
    mutationFn: async (playlist: {
      owner: 'eduardo' | 'laura' | 'casal';
      platform: 'spotify' | 'deezer';
      embed_url: string;
      title: string;
    }) => {
      const { data, error } = await supabase
        .from('playlist_config')
        .upsert(
          {
            owner: playlist.owner,
            platform: playlist.platform,
            embed_url: playlist.embed_url,
            title: playlist.title,
          },
          { onConflict: 'owner' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlist_config'] });
    },
  });

  return {
    tracks: musicQuery.data || [],
    isLoading: musicQuery.isLoading,
    playlists: playlistsQuery.data || [],
    addTrack: addTrackMutation.mutateAsync,
    isAddingTrack: addTrackMutation.isPending,
    deleteTrack: deleteTrackMutation.mutateAsync,
    updatePlaylist: updatePlaylistMutation.mutateAsync,
  };
}
