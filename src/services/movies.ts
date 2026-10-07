import type { Movie } from '../types/movie'

const API_BASE_URL = 'https://api.kinoxii.redberryinternship.ge/api'

type MovieResponse = {
  data: Movie[]
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
