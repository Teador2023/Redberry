import { useState } from 'react'
import type { Movie } from '../types/movie'

type ComingSoonCardProps = {
  movie: Movie
  token: string | null
  onSelectMovie: (movie: Movie) => void
  isSaved: boolean
  onToggleSaved: (movie: Movie) => void
  onSignIn: () => void
  onNotify: (movie: Movie) => Promise<void>
}

function ComingSoonCard({
  movie,
  token,
  isSaved,
  onSelectMovie,
  onToggleSaved,
  onSignIn,
  onNotify,
}: ComingSoonCardProps) {
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleNotify(): Promise<void> {
    if (!token) {
      onSignIn()
      return
    }
    setBusy(true)
    setError('')
    try {
      await onNotify(movie)
      setSubscribed(true)
    } catch (notifyError) {
      setError(notifyError instanceof Error ? notifyError.message : 'Could not subscribe. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="movie-card coming-soon-card">
      <button
        type="button"
        className="movie-card-action"
        onClick={() => onSelectMovie(movie)}
        aria-label={`View details for ${movie.title}`}
      >
        <div className="movie-poster">
          {movie.posterUrl ? (
            <img src={movie.posterUrl} alt="" loading="lazy" />
          ) : (
            <span className="poster-fallback">Poster unavailable</span>
          )}
          <span className="coming-soon-badge">Coming soon</span>
          {movie.ageRating && <span className="poster-rating">{movie.ageRating.code}</span>}
        </div>
        <div className="movie-info">
          <div>
            <h3>{movie.title}</h3>
            <p>
              {movie.genres.map((genre) => genre.name).join(', ')}
              <span>•</span>
              {movie.runtimeMinutes === null ? 'Runtime unavailable' : `${movie.runtimeMinutes} min`}
            </p>
          </div>
          <span className="movie-arrow" aria-hidden="true">↗</span>
        </div>
      </button>
      <div className="coming-soon-actions">
        <button
          type="button"
          className={isSaved ? 'watchlist-button saved' : 'watchlist-button'}
          aria-label={`${isSaved ? 'Remove' : 'Add'} ${movie.title} ${isSaved ? 'from' : 'to'} your watchlist`}
          aria-pressed={isSaved}
          onClick={() => onToggleSaved(movie)}
        >
          {isSaved ? 'Saved to watchlist' : 'Add to watchlist'}
        </button>
        <button
          type="button"
          className={subscribed ? 'notify-button subscribed' : 'notify-button'}
          disabled={busy || subscribed}
          onClick={() => void handleNotify()}
        >
          {busy ? 'Subscribing…' : subscribed ? 'We’ll notify you' : 'Notify me'}
        </button>
        {error && <p className="notify-error" role="alert">{error}</p>}
      </div>
    </article>
  )
}

export default ComingSoonCard
