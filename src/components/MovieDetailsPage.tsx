import { useEffect, useState } from 'react'
import { getMovieDetails } from '../services/movies'
import type { MovieDetails } from '../types/movie'

type MovieDetailsPageProps = {
  slug: string
  onDetailsLoaded: (movie: MovieDetails) => void
  isSaved: boolean
  onToggleSaved: (movie: MovieDetails) => void
  onBack: () => void
  onBrowseSessions: () => void
}

type DetailsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; movie: MovieDetails }

function formatRuntime(runtimeMinutes: number | null): string {
  if (runtimeMinutes === null) {
    return 'Runtime unavailable'
  }

  const hours = Math.floor(runtimeMinutes / 60)
  const minutes = runtimeMinutes % 60
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

function MovieDetailsPage({
  slug,
  onDetailsLoaded,
  isSaved,
  onToggleSaved,
  onBack,
  onBrowseSessions,
}: MovieDetailsPageProps) {
  const [details, setDetails] = useState<DetailsState>({ status: 'loading' })
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let isCurrent = true

    async function loadDetails() {
      setDetails({ status: 'loading' })

      try {
        const movie = await getMovieDetails(slug)
        if (isCurrent) {
          setDetails({ status: 'loaded', movie })
          onDetailsLoaded(movie)
        }
      } catch (error) {
        if (isCurrent) {
          setDetails({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unable to load movie details. Please try again.',
          })
        }
      }
    }

    void loadDetails()
    return () => {
      isCurrent = false
    }
  }, [slug, retryCount, onDetailsLoaded])

  if (details.status === 'loading') {
    return (
      <section className="details-state" role="status">
        <p className="eyebrow">Movie details</p>
        <h1>Loading film…</h1>
      </section>
    )
  }

  if (details.status === 'error') {
    return (
      <section className="details-state error-state" role="alert">
        <p className="eyebrow">Movie details</p>
        <h1>We couldn’t load this film</h1>
        <p>{details.message}</p>
        <div className="details-actions">
          <button type="button" className="primary-button" onClick={() => setRetryCount((count) => count + 1)}>
            Try again
          </button>
          <button type="button" className="secondary-button" onClick={onBack}>
            Back to films
          </button>
        </div>
      </section>
    )
  }

  const { movie } = details

  return (
    <article className="movie-details">
      <button type="button" className="back-button" onClick={onBack}>
        <span aria-hidden="true">←</span> Back to films
      </button>

      <section className="details-hero" aria-labelledby="details-title">
        <div className="details-backdrop" aria-hidden="true">
          {movie.backdropUrl && <img src={movie.backdropUrl} alt="" />}
        </div>
        <div className="details-poster">
          {movie.posterUrl ? (
            <img src={movie.posterUrl} alt={`${movie.title} poster`} />
          ) : (
            <span className="poster-fallback">Poster unavailable</span>
          )}
        </div>
        <div className="details-copy">
          <p className="eyebrow">{movie.isComingSoon ? 'Coming soon' : 'Now showing'}</p>
          <h1 id="details-title">{movie.title}</h1>
          <p className="details-meta">
            {movie.genres.map((genre) => genre.name).join(', ')}
            <span>•</span>{formatRuntime(movie.runtimeMinutes)}
            {movie.ageRating && <><span>•</span>{movie.ageRating.code}</>}
          </p>
          {movie.synopsis && <p className="details-synopsis">{movie.synopsis}</p>}
          <div className="details-actions">
            <button
              type="button"
              className={isSaved ? 'secondary-button watchlist-button saved' : 'secondary-button watchlist-button'}
              aria-label={`${isSaved ? 'Remove' : 'Add'} ${movie.title} ${isSaved ? 'from' : 'to'} your watchlist`}
              aria-pressed={isSaved}
              onClick={() => onToggleSaved(movie)}
            >
              {isSaved ? 'Saved to watchlist' : 'Add to watchlist'}
            </button>
            {!movie.isComingSoon && (
              <button type="button" className="primary-button" onClick={onBrowseSessions}>
                Browse sessions <span aria-hidden="true">→</span>
              </button>
            )}
            {!movie.isComingSoon && movie.fromPrice !== null && (
              <p className="details-price">Tickets from <strong>₾{movie.fromPrice}</strong></p>
            )}
          </div>
        </div>
      </section>

      <section className="details-information" aria-label="Film information">
        {movie.ageRating && (
          <div className="details-information-card">
            <h2>Age rating</h2>
            <p><strong>{movie.ageRating.code}</strong> — {movie.ageRating.description}</p>
          </div>
        )}
        {movie.director && (
          <div className="details-information-card">
            <h2>Director</h2>
            <p>{movie.director}</p>
          </div>
        )}
        {movie.cast && (
          <div className="details-information-card">
            <h2>Cast</h2>
            <p>{movie.cast}</p>
          </div>
        )}
        {movie.formats.length > 0 && (
          <div className="details-information-card">
            <h2>Available formats</h2>
            <div className="details-tags">
              {movie.formats.map((format) => <span key={format.id}>{format.name}</span>)}
            </div>
          </div>
        )}
        {movie.availableDates.length > 0 && (
          <div className="details-information-card">
            <h2>Available dates</h2>
            <div className="details-tags">
              {movie.availableDates.slice(0, 5).map((date) => (
                <span key={date}>{formatDate(date)}</span>
              ))}
              {movie.availableDates.length > 5 && (
                <span>+{movie.availableDates.length - 5} more</span>
              )}
            </div>
          </div>
        )}
      </section>
    </article>
  )
}

export default MovieDetailsPage
