import type { Movie } from '../types/movie'

const WATCHLIST_STORAGE_KEY = 'kino-watchlist'

function isMovie(value: unknown): value is Movie {
  if (typeof value !== 'object' || value === null) return false
  const movie = value as Record<string, unknown>
  const genresAreValid = Array.isArray(movie.genres) && movie.genres.every((genre) => (
    typeof genre === 'object'
      && genre !== null
      && typeof genre.id === 'number'
      && typeof genre.slug === 'string'
      && typeof genre.name === 'string'
  ))
  const ageRatingIsValid = movie.ageRating === null
    || (
      typeof movie.ageRating === 'object'
      && movie.ageRating !== null
      && 'code' in movie.ageRating
      && typeof movie.ageRating.code === 'string'
      && 'minAge' in movie.ageRating
      && typeof movie.ageRating.minAge === 'number'
      && 'description' in movie.ageRating
      && typeof movie.ageRating.description === 'string'
    )
  return typeof movie.id === 'number'
    && typeof movie.slug === 'string'
    && typeof movie.title === 'string'
    && (typeof movie.runtimeMinutes === 'number' || movie.runtimeMinutes === null)
    && (typeof movie.posterUrl === 'string' || movie.posterUrl === null)
    && (typeof movie.backdropUrl === 'string' || movie.backdropUrl === null)
    && genresAreValid
    && ageRatingIsValid
}

export function getSavedMovies(): Movie[] {
  let savedValue: string | null
  try {
    savedValue = window.localStorage.getItem(WATCHLIST_STORAGE_KEY)
  } catch {
    throw new Error('Your browser does not allow access to saved films.')
  }
  if (savedValue === null) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(savedValue)
  } catch {
    throw new Error('Saved films could not be read because the stored data is invalid.')
  }
  if (!Array.isArray(parsed) || !parsed.every(isMovie)) {
    throw new Error('Saved films could not be read because the stored data is invalid.')
  }
  return parsed
}

export function saveMovies(movies: Movie[]): void {
  try {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(movies))
  } catch {
    throw new Error('Could not save this film. Check that your browser has storage available.')
  }
}
