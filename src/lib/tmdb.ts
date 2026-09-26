import type { TMDBMovieResult, TMDBMovieDetails } from '../types';

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

/* ------------------------------------------------------------------ */
/* Séries e busca automática                                           */
/* ------------------------------------------------------------------ */

/**
 * O TMDB separa filme e série em endpoints diferentes, com campos
 * diferentes (`name`/`first_air_date` em vez de `title`/`release_date`).
 * Aqui normalizamos pro mesmo formato que o resto do app já usa.
 */
export async function searchTvShows(query: string): Promise<TMDBMovieResult[]> {
  if (!query || query.trim().length < 2) return [];

  const response = await fetch(
    `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
      query.trim()
    )}&language=pt-BR&page=1&include_adult=false`
  );

  if (!response.ok) throw new Error('Falha ao buscar séries no TMDB');

  const data = await response.json();
  return (data.results || []).map(
    (item: {
      id: number;
      name: string;
      original_name: string;
      overview: string;
      poster_path: string | null;
      backdrop_path: string | null;
      first_air_date: string;
      vote_average: number;
      genre_ids: number[];
    }) => ({
      id: item.id,
      title: item.name,
      original_title: item.original_name,
      overview: item.overview,
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      release_date: item.first_air_date,
      vote_average: item.vote_average,
      genre_ids: item.genre_ids,
    })
  );
}

export async function getTvDetails(tmdbId: number): Promise<TMDBMovieDetails> {
  const response = await fetch(
    `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`
  );
  if (!response.ok) throw new Error(`Falha ao obter detalhes da série ${tmdbId}`);

  const data = await response.json();
  return {
    ...data,
    title: data.name,
    original_title: data.original_name,
    release_date: data.first_air_date,
    // Séries têm duração por episódio, não total.
    runtime: data.episode_run_time?.[0] ?? 0,
  };
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Acha a obra no TMDB a partir do nome cru da lista de IPTV.
 * Prioriza título igual e, quando o ano vem junto, ano igual —
 * senão "Round 6" viraria um documentário qualquer de nome parecido.
 */
export async function findTmdbMatch(
  title: string,
  options: { year?: number | null; type: 'movie' | 'tv' }
): Promise<TMDBMovieResult | null> {
  const results =
    options.type === 'tv' ? await searchTvShows(title) : await searchMovies(title);

  if (results.length === 0) return null;

  const target = normalizeForMatch(title);

  const scored = results.map((item) => {
    const candidate = normalizeForMatch(item.title);
    let score = 0;

    if (candidate === target) score += 10;
    else if (candidate.startsWith(target) || target.startsWith(candidate)) score += 6;
    else if (candidate.includes(target) || target.includes(candidate)) score += 3;

    if (options.year && item.release_date) {
      const itemYear = Number(item.release_date.slice(0, 4));
      if (itemYear === options.year) score += 4;
      else if (Math.abs(itemYear - options.year) <= 1) score += 2;
      else score -= 2;
    }

    // Desempate por popularidade implícita na nota.
    score += Math.min(item.vote_average / 10, 1);
    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  // Abaixo disso é chute, e chute vira filme errado na lista do casal.
  return scored[0].score >= 3 ? scored[0].item : null;
}
