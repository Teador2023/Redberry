import type { Movie } from '../types/movie'
import MovieCard from './MovieCard'

type MovieGridProps = {
  movies: Movie[]
  onSelectMovie: (movie: Movie) => void
}

function MovieGrid({ movies, onSelectMovie }: MovieGridProps) {
  return (
    <div className="content-grid">
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} onSelect={onSelectMovie} />
      ))}
    </div>
  )
}

export default MovieGrid
