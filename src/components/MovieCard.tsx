import type { Movie } from '../types/movie'

type MovieCardProps = {
  movie: Movie
}

function formatRuntime(runtimeMinutes: number | null): string {
  if (runtimeMinutes === null) {
    return 'Runtime unavailable'
  }

  const hours = Math.floor(runtimeMinutes / 60)
  const minutes = runtimeMinutes % 60
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`
}

function MovieCard({ movie }: MovieCardProps) {
  return (
    <article className="movie-card">
      <div className="movie-poster">
        {movie.posterUrl ? (
          <img src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" />
        ) : (
          <span className="poster-fallback">Poster unavailable</span>
        )}
        {movie.ageRating && <span className="poster-rating">{movie.ageRating.code}</span>}
      </div>
      <div className="movie-info">
        <div>
          <h3>{movie.title}</h3>
          <p>
            {movie.genres.map((genre) => genre.name).join(', ')}
            <span>•</span>
            {formatRuntime(movie.runtimeMinutes)}
          </p>
        </div>
        <span className="movie-arrow" aria-hidden="true">↗</span>
      </div>
    </article>
  )
}

export default MovieCard
