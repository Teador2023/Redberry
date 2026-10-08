import type { Movie, MovieDetails } from '../types/movie'

const API_BASE_URL = 'https://api.kinoxii.redberryinternship.ge/api'

type MovieResponse = {
  data: Movie[]
}

type MovieDetailsResponse = {
  data: MovieDetails
}

async function fetchMovies(endpoint: string): Promise<Movie[]> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`)

  if (!response.ok) {
    throw new Error(`Could not load movies (${response.status}). Please try again.`)
  }

  const result: MovieResponse = await response.json()
  return result.data
}

export function getFeaturedMovies(): Promise<Movie[]> {
  return fetchMovies('/movies/featured')
}

export function getNowPlayingMovies(): Promise<Movie[]> {
  return fetchMovies('/movies/now-playing')
}

export function searchMovies(query: string): Promise<Movie[]> {
  const parameters = new URLSearchParams({ q: query })
  return fetchMovies(`/search?${parameters}`)
}

export async function getMovieDetails(slug: string): Promise<MovieDetails> {
  const response = await fetch(`${API_BASE_URL}/movies/${encodeURIComponent(slug)}`)

  if (!response.ok) {
    throw new Error(`Could not load movie details (${response.status}). Please try again.`)
  }

  const result: MovieDetailsResponse = await response.json()
  return result.data
}
