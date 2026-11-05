// The shape of TMDB's "search movies" answer (GET /3/search/movie), as
// documented at developer.themoviedb.org. Only TMDB-specific code uses these
// types; the rest of the app uses our own MediaResult (lib/media/types.ts).

export type TmdbMovie = {
  id: number;
  title: string;
  original_title: string;
  original_language: string;
  overview: string;
  release_date: string; // "2014-11-05", or "" when unknown
  poster_path: string | null; // "/abc123.jpg", glued to TMDB's image address
  backdrop_path: string | null;
  genre_ids: number[];
  popularity: number;
  vote_average: number;
  vote_count: number;
  adult: boolean;
  video: boolean;
};

export type TmdbSearchResponse = {
  page: number;
  results: TmdbMovie[];
  total_pages: number;
  total_results: number;
};
