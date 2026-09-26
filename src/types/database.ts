export type UserProfile = 'eduardo' | 'laura';

export type WhoSlept = 'ninguem' | 'eduardo' | 'laura' | 'ambos';

export interface MovieRecord {
  id: string;
  tmdb_id: number;
  title: string;
  original_title: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_year: number | null;
  runtime_minutes: number | null;
  genres: string[];
  tmdb_vote_average: number | null;
  created_at: string;
}

export interface WatchlistRecord {
  id: string;
  movie_id: string;
  added_by: 'eduardo' | 'laura' | 'ambos';
  wanted_by_eduardo: boolean;
  wanted_by_laura: boolean;
  is_match: boolean;
  is_watched: boolean;
  watched_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface RatingRecord {
  id: string;
  movie_id: string;
  rating_eduardo: number | null;
  rating_laura: number | null;
  average_rating: number | null;
  comment_eduardo: string | null;
  comment_laura: string | null;
  fun_tags: string[];
  who_slept: WhoSlept;
  platform_watched: string | null;
  created_at: string;
  updated_at: string;
}

export interface MusicTrackRecord {
  id: string;
  movie_id: string | null;
  title: string;
  artist: string;
  album: string | null;
  cover_url: string | null;
  spotify_url: string | null;
  deezer_url: string | null;
  preview_url: string | null;
  added_by: UserProfile;
  memory_note: string | null;
  created_at: string;
}

export interface PlaylistConfigRecord {
  id: string;
  owner: 'eduardo' | 'laura' | 'casal';
  platform: 'spotify' | 'deezer';
  embed_url: string;
  title: string;
  updated_at: string;
}

// Joined View for easy UI binding
export interface MovieWithDetails {
  movie: MovieRecord;
  watchlist: WatchlistRecord;
  rating?: RatingRecord | null;
}
