import type { Movie } from '../types/movie'

type MovieCardProps = {
  movie: Movie
  onSelect: (movie: Movie) => void
  isSaved: boolean
  onToggleSaved: (movie: Movie) => void
}

function formatRuntime(runtimeMinutes: number | null): string {
  if (runtimeMinutes === null) {
    return 'Runtime unavailable'
  }

  const hours = Math.floor(runtimeMinutes / 60)
  const minutes = runtimeMinutes % 60
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`
}

function MovieCard({ movie, onSelect, isSaved, onToggleSaved }: MovieCardProps) {
  return (
    <article className="movie-card">
      <button
        type="button"
        className="movie-card-action"
        onClick={() => onSelect(movie)}
        aria-label={`View details for ${movie.title}`}
      >
        <div className="movie-poster">
          {movie.posterUrl ? (
            <img src={movie.posterUrl} alt="" loading="lazy" />
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
      </button>
      <button
        type="button"
        className={isSaved ? 'watchlist-button saved' : 'watchlist-button'}
        aria-label={`${isSaved ? 'Remove' : 'Add'} ${movie.title} ${isSaved ? 'from' : 'to'} your watchlist`}
        aria-pressed={isSaved}
        onClick={() => onToggleSaved(movie)}
      >
        {isSaved ? 'Saved to watchlist' : 'Add to watchlist'}
      </button>
    </article>
  )
}

export default MovieCard
