import { useMemo } from 'react';
import type { MovieWithDetails } from '../types';

const RELATIONSHIP_START = import.meta.env.VITE_RELATIONSHIP_START_DATE || '2024-03-24';

export function useCoupleStats(movies: MovieWithDetails[]) {
  return useMemo(() => {
    // 1. Calculate days together
    const start = new Date(RELATIONSHIP_START);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const daysTogether = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // 2. Movie counters
    let matchCount = 0;
    let eduardoOnlyCount = 0;
    let lauraOnlyCount = 0;
    let watchedCount = 0;
    let totalMinutesWatched = 0;

    let totalRatingSum = 0;
    let ratedMoviesCount = 0;

    const sleepStats = {
      eduardo: 0,
      laura: 0,
      ambos: 0,
      ninguem: 0,
    };

    movies.forEach((item) => {
      const w = item.watchlist;
      const r = item.rating;

      if (w.is_watched) {
        watchedCount++;
        if (item.movie.runtime_minutes) {
          totalMinutesWatched += item.movie.runtime_minutes;
        }

        if (r) {
          if (r.average_rating !== null && r.average_rating !== undefined) {
            totalRatingSum += Number(r.average_rating);
            ratedMoviesCount++;
          }
          if (r.who_slept && sleepStats[r.who_slept] !== undefined) {
            sleepStats[r.who_slept]++;
          }
        }
      } else {
        if (w.is_match) {
          matchCount++;
        } else if (w.wanted_by_eduardo) {
          eduardoOnlyCount++;
        } else if (w.wanted_by_laura) {
          lauraOnlyCount++;
        }
      }
    });

    const averageCoupleRating =
      ratedMoviesCount > 0 ? (totalRatingSum / ratedMoviesCount).toFixed(1) : null;

    const totalHoursWatched = (totalMinutesWatched / 60).toFixed(0);

    return {
      daysTogether,
      matchCount,
      eduardoOnlyCount,
      lauraOnlyCount,
      watchedCount,
      totalHoursWatched,
      averageCoupleRating,
      sleepStats,
    };
  }, [movies]);
}
