import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { getMovieDetails, mapGenreIdsToNames } from '../lib/tmdb';
import {
  MovieWithDetails,
  MovieRecord,
  WatchlistRecord,
  RatingRecord,
  UserProfile,
  TMDBMovieResult,
  WhoSlept,
} from '../types';

export function fireMatchConfetti() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#8B5CF6', '#38BDF8', '#F43F5E', '#FBBF24'],
  });
}

export function useMovies() {
  const queryClient = useQueryClient();

  // Realtime subscription for instant multi-device sync
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movie_watchlist' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['movies'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movie_ratings' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['movies'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const moviesQuery = useQuery({
    queryKey: ['movies'],
    queryFn: async (): Promise<MovieWithDetails[]> => {
      // 1. Fetch all watchlist records
      const { data: watchlistData, error: watchlistError } = await supabase
        .from('movie_watchlist')
        .select('*')
        .order('created_at', { ascending: false });

      if (watchlistError) {
        console.error('Error fetching watchlist:', watchlistError);
        throw watchlistError;
      }

      if (!watchlistData || watchlistData.length === 0) {
        return [];
      }

      const movieIds = watchlistData.map((w) => w.movie_id);

      // 2. Fetch corresponding movies
      const { data: moviesData, error: moviesError } = await supabase
        .from('movies')
        .select('*')
        .in('id', movieIds);

      if (moviesError) {
        console.error('Error fetching movies:', moviesError);
        throw moviesError;
      }

      // 3. Fetch ratings for these movies
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('movie_ratings')
        .select('*')
        .in('id', movieIds); // Note: or movie_id

      let safeRatings: RatingRecord[] = [];
      if (!ratingsError && ratingsData) {
        safeRatings = ratingsData;
      } else {
        // Query by movie_id if PK id differed
        const { data: ratingsByMovieId } = await supabase
          .from('movie_ratings')
          .select('*')
          .in('movie_id', movieIds);
        if (ratingsByMovieId) safeRatings = ratingsByMovieId;
      }

      const moviesMap = new Map<string, MovieRecord>(
        (moviesData || []).map((m) => [m.id, m])
      );
      const ratingsMap = new Map<string, RatingRecord>(
        safeRatings.map((r) => [r.movie_id, r])
      );

      const result: MovieWithDetails[] = [];
      for (const w of watchlistData as WatchlistRecord[]) {
        const m = moviesMap.get(w.movie_id);
        if (m) {
          result.push({
            movie: m,
            watchlist: w,
            rating: ratingsMap.get(m.id) || null,
          });
        }
      }

      return result;
    },
  });

  // Mutation: Add movie from TMDB
  const addMovieMutation = useMutation({
    mutationFn: async ({
      tmdbMovie,
      profile,
    }: {
      tmdbMovie: TMDBMovieResult;
      profile: UserProfile;
    }) => {
      // Fetch extra details if runtime is missing
      let runtimeMinutes: number | null = null;
      let detailedGenres = mapGenreIdsToNames(tmdbMovie.genre_ids);

      try {
        const details = await getMovieDetails(tmdbMovie.id);
        if (details.runtime) runtimeMinutes = details.runtime;
        if (details.genres && details.genres.length > 0) {
          detailedGenres = details.genres.map((g) => g.name);
        }
      } catch (e) {
        console.warn('Could not fetch TMDB movie extra details:', e);
      }

      // 1. Check if movie already exists
      const { data: existingMovie } = await supabase
        .from('movies')
        .select('*')
        .eq('tmdb_id', tmdbMovie.id)
        .maybeSingle();

      let movieId: string;

      if (existingMovie) {
        movieId = existingMovie.id;
      } else {
        const posterUrl = tmdbMovie.poster_path
          ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}`
          : null;
        const backdropUrl = tmdbMovie.backdrop_path
          ? `https://image.tmdb.org/t/p/original${tmdbMovie.backdrop_path}`
          : null;
        const releaseYear = tmdbMovie.release_date
          ? parseInt(tmdbMovie.release_date.substring(0, 4), 10)
          : null;

        const { data: newMovie, error: movieInsertError } = await supabase
          .from('movies')
          .insert({
            tmdb_id: tmdbMovie.id,
            title: tmdbMovie.title,
            original_title: tmdbMovie.original_title || null,
            overview: tmdbMovie.overview || null,
            poster_path: posterUrl,
            backdrop_path: backdropUrl,
            release_year: releaseYear,
            runtime_minutes: runtimeMinutes,
            genres: detailedGenres,
            tmdb_vote_average: tmdbMovie.vote_average ? parseFloat(tmdbMovie.vote_average.toFixed(1)) : null,
          })
          .select()
          .single();

        if (movieInsertError) throw movieInsertError;
        movieId = newMovie.id;
      }

      // 2. Check if watchlist entry exists
      const { data: existingWatchlist } = await supabase
        .from('movie_watchlist')
        .select('*')
        .eq('movie_id', movieId)
        .maybeSingle();

      if (existingWatchlist) {
        const updates: Partial<WatchlistRecord> = {};
        let becomesMatch = false;

        if (profile === 'eduardo') {
          updates.wanted_by_eduardo = true;
          if (existingWatchlist.wanted_by_laura) becomesMatch = true;
        } else {
          updates.wanted_by_laura = true;
          if (existingWatchlist.wanted_by_eduardo) becomesMatch = true;
        }

        const { error: updateError } = await supabase
          .from('movie_watchlist')
          .update(updates)
          .eq('id', existingWatchlist.id);

        if (updateError) throw updateError;
        if (becomesMatch) fireMatchConfetti();
      } else {
        const { error: insertWatchlistError } = await supabase
          .from('movie_watchlist')
          .insert({
            movie_id: movieId,
            added_by: profile,
            wanted_by_eduardo: profile === 'eduardo',
            wanted_by_laura: profile === 'laura',
            is_watched: false,
          });

        if (insertWatchlistError) throw insertWatchlistError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movies'] });
    },
  });

  // Mutation: Toggle partner interest (Match trigger)
  const toggleInterestMutation = useMutation({
    mutationFn: async ({
      watchlistId,
      profile,
      currentValue,
      partnerValue,
    }: {
      watchlistId: string;
      profile: UserProfile;
      currentValue: boolean;
      partnerValue: boolean;
    }) => {
      const nextValue = !currentValue;
      const updates: Record<string, boolean> =
        profile === 'eduardo'
          ? { wanted_by_eduardo: nextValue }
          : { wanted_by_laura: nextValue };

      const { error } = await supabase
        .from('movie_watchlist')
        .update(updates)
        .eq('id', watchlistId);

      if (error) throw error;

      if (nextValue && partnerValue) {
        fireMatchConfetti();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movies'] });
    },
  });

  // Mutation: Delete movie from watchlist
  const deleteMovieMutation = useMutation({
    mutationFn: async (watchlistId: string) => {
      const { error } = await supabase
        .from('movie_watchlist')
        .delete()
        .eq('id', watchlistId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movies'] });
    },
  });

  // Mutation: Rate and mark watched
  const rateMovieMutation = useMutation({
    mutationFn: async ({
      movieId,
      watchlistId,
      ratingEduardo,
      ratingLaura,
      commentEduardo,
      commentLaura,
      funTags,
      whoSlept,
      platformWatched,
    }: {
      movieId: string;
      watchlistId: string;
      ratingEduardo?: number | null;
      ratingLaura?: number | null;
      commentEduardo?: string | null;
      commentLaura?: string | null;
      funTags: string[];
      whoSlept: WhoSlept;
      platformWatched?: string | null;
    }) => {
      const today = new Date().toISOString().split('T')[0];

      // 1. Mark as watched in movie_watchlist
      const { error: watchlistError } = await supabase
        .from('movie_watchlist')
        .update({
          is_watched: true,
          watched_date: today,
        })
        .eq('id', watchlistId);

      if (watchlistError) throw watchlistError;

      // 2. Upsert rating record
      const { data: existingRating } = await supabase
        .from('movie_ratings')
        .select('id')
        .eq('movie_id', movieId)
        .maybeSingle();

      const ratingPayload = {
        movie_id: movieId,
        rating_eduardo: ratingEduardo ?? null,
        rating_laura: ratingLaura ?? null,
        comment_eduardo: commentEduardo?.trim() || null,
        comment_laura: commentLaura?.trim() || null,
        fun_tags: funTags,
        who_slept: whoSlept,
        platform_watched: platformWatched?.trim() || null,
      };

      if (existingRating) {
        const { error: ratingUpdateError } = await supabase
          .from('movie_ratings')
          .update(ratingPayload)
          .eq('id', existingRating.id);

        if (ratingUpdateError) throw ratingUpdateError;
      } else {
        const { error: ratingInsertError } = await supabase
          .from('movie_ratings')
          .insert(ratingPayload);

        if (ratingInsertError) throw ratingInsertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movies'] });
    },
  });

  return {
    movies: moviesQuery.data || [],
    isLoading: moviesQuery.isLoading,
    isError: moviesQuery.isError,
    error: moviesQuery.error,
    addMovie: addMovieMutation.mutateAsync,
    isAddingMovie: addMovieMutation.isPending,
    toggleInterest: toggleInterestMutation.mutateAsync,
    deleteMovie: deleteMovieMutation.mutateAsync,
    rateMovie: rateMovieMutation.mutateAsync,
    isRatingMovie: rateMovieMutation.isPending,
    refetch: moviesQuery.refetch,
  };
}
