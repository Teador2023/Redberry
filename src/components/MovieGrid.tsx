import type { Movie } from '../types/movie'
import MovieCard from './MovieCard'

type MovieGridProps = {
  movies: Movie[]
  onSelectMovie: (movie: Movie) => void
  savedMovieSlugs: Set<string>
  onToggleSaved: (movie: Movie) => void
}

function MovieGrid({ movies, onSelectMovie, savedMovieSlugs, onToggleSaved }: MovieGridProps) {
  return (
    <div className="content-grid">
      {movies.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          onSelect={onSelectMovie}
          isSaved={savedMovieSlugs.has(movie.slug)}
          onToggleSaved={onToggleSaved}
        />
      ))}
    </div>
  )
}

export default MovieGrid
