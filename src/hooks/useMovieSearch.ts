import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchMovies } from '../lib/tmdb';

export function useMovieSearch(query: string, delay = 350) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [query, delay]);

  const queryInfo = useQuery({
    queryKey: ['tmdb_search', debouncedQuery],
    queryFn: () => searchMovies(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
  });

  return {
    ...queryInfo,
    debouncedQuery,
  };
}
