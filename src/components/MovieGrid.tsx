import type { Movie } from '../types/movie'
import MovieCard from './MovieCard'

type MovieGridProps = {
  movies: Movie[]
}

function MovieGrid({ movies }: MovieGridProps) {
  return (
    <div className="content-grid">
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} />
      ))}
    </div>
  )
}

export default MovieGrid
