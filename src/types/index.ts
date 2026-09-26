export * from './database';

export interface TMDBMovieResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
}

export interface TMDBMovieDetails extends TMDBMovieResult {
  runtime: number;
  genres: Array<{ id: number; name: string }>;
}

export interface SonglinkResolvedTrack {
  title: string;
  artist: string;
  album?: string | null;
  cover_url: string | null;
  spotify_url: string | null;
  deezer_url: string | null;
  spotify_native: string | null;
  deezer_native: string | null;
}

export type MovieListTab = 'match' | 'eduardo' | 'laura' | 'watched';
export type MainView = 'movies' | 'music';
