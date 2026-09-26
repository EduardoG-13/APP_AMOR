import { TMDBMovieResult, TMDBMovieDetails } from '../types';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export const TMDB_GENRES_MAP: Record<number, string> = {
  28: 'Ação',
  12: 'Aventura',
  16: 'Animação',
  35: 'Comédia',
  80: 'Crime',
  99: 'Documentário',
  18: 'Drama',
  10751: 'Família',
  14: 'Fantasia',
  36: 'História',
  27: 'Terror',
  10402: 'Música',
  9648: 'Mistério',
  10749: 'Romance',
  878: 'Ficção Científica',
  10770: 'Cinema TV',
  53: 'Thriller',
  10752: 'Guerra',
  37: 'Faroeste',
};

export function mapGenreIdsToNames(genreIds?: number[]): string[] {
  if (!genreIds || !Array.isArray(genreIds)) return [];
  return genreIds.map((id) => TMDB_GENRES_MAP[id] || 'Outro').filter(Boolean);
}

export function getTMDBImageUrl(path: string | null, size: 'w200' | 'w300' | 'w500' | 'original' = 'w500'): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export async function searchMovies(query: string): Promise<TMDBMovieResult[]> {
  if (!query || query.trim().length < 2) return [];

  const response = await fetch(
    `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
      query.trim()
    )}&language=pt-BR&page=1&include_adult=false`
  );

  if (!response.ok) {
    throw new Error('Falha ao buscar filmes no TMDB');
  }

  const data = await response.json();
  return data.results || [];
}

export async function getMovieDetails(tmdbId: number): Promise<TMDBMovieDetails> {
  const response = await fetch(
    `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`
  );

  if (!response.ok) {
    throw new Error(`Falha ao obter detalhes do filme ${tmdbId}`);
  }

  return response.json();
}
