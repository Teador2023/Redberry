import { useEffect, useMemo, useState } from 'react'
import MovieDetailsPage from './components/MovieDetailsPage'
import MovieGrid from './components/MovieGrid'
import { getFeaturedMovies, getNowPlayingMovies } from './services/movies'
import type { Movie } from './types/movie'

type View = 'home' | 'sessions' | 'details'

type HomeContentState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; featuredMovie: Movie | null; nowPlayingMovies: Movie[] }

type Session = {
  id: number
  movie: string
  rating: string
  time: string
  hall: string
  format: string
  language: string
  price: number
  seatsLeft: number
}

const sessions: Session[] = [
  { id: 1, movie: 'Midnight Echo', rating: '16+', time: '12:00', hall: 'Hall 1', format: 'Standard', language: 'Georgian Dub', price: 24, seatsLeft: 12 },
  { id: 2, movie: 'Midnight Echo', rating: '16+', time: '15:30', hall: 'Hall 3', format: 'MAX', language: 'Original', price: 36, seatsLeft: 5 },
  { id: 3, movie: 'Golden Hour', rating: '12+', time: '14:15', hall: 'Hall 2', format: 'ATMOS', language: 'Georgian Subtitles', price: 28, seatsLeft: 18 },
  { id: 4, movie: 'Glass Horizon', rating: '18+', time: '19:00', hall: 'Hall 4', format: 'PANORAMA', language: 'Russian Dub', price: 32, seatsLeft: 0 },
  { id: 5, movie: 'Paper Lanterns', rating: 'PG', time: '17:45', hall: 'Hall 1', format: 'Standard', language: 'Original', price: 22, seatsLeft: 9 },
]

const filters = ['Venue', 'Date', 'Format', 'Language', 'Time of Day']

function App() {
  const [view, setView] = useState<View>('home')
  const [selectedMovieSlug, setSelectedMovieSlug] = useState<string | null>(null)
  const [homeContent, setHomeContent] = useState<HomeContentState>({ status: 'loading' })

  useEffect(() => {
    let isCurrent = true

    async function loadHomeContent() {
      try {
        const [featuredMovies, nowPlayingMovies] = await Promise.all([
          getFeaturedMovies(),
          getNowPlayingMovies(),
        ])

        if (isCurrent) {
          setHomeContent({
            status: 'loaded',
            featuredMovie: featuredMovies[0] ?? null,
            nowPlayingMovies,
          })
        }
      } catch (error) {
        if (isCurrent) {
          setHomeContent({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unable to load movies. Please try again.',
          })
        }
      }
    }

    void loadHomeContent()
    return () => {
      isCurrent = false
    }
  }, [])

  const activeSessions = useMemo(() => {
    return sessions.filter((session) => session.seatsLeft > 0)
  }, [])

  return (
    <main className="app-shell">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => setView('home')}>
          <span className="brand-mark" aria-hidden="true">K</span>
          <span>Kino <strong>XII</strong></span>
        </button>

        <nav className="nav" aria-label="Main navigation">
          <button type="button" className={view !== 'sessions' ? 'nav-button active' : 'nav-button'} onClick={() => setView('home')}>
            Home
          </button>
          <button type="button" className={view === 'sessions' ? 'nav-button active' : 'nav-button'} onClick={() => setView('sessions')}>
            Sessions
          </button>
        </nav>
      </header>

      {view === 'home' ? (
        <div className="home-page">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-art" aria-hidden="true">
              {homeContent.status === 'loaded' && homeContent.featuredMovie?.backdropUrl && (
                <img src={homeContent.featuredMovie.backdropUrl} alt="" />
              )}
            </div>
            <div className="hero-copy">
              <p className="eyebrow"><span className="live-dot" /> Featured film</p>
              <h1 id="hero-title">
                {homeContent.status === 'loading'
                  ? 'Finding your next film'
                  : homeContent.status === 'error'
                    ? 'Featured film unavailable'
                    : homeContent.featuredMovie?.title ?? 'Coming soon'}
              </h1>
              {homeContent.status === 'loaded' && homeContent.featuredMovie && (
                <>
                  <p className="hero-meta">
                    {homeContent.featuredMovie.genres.map((genre) => genre.name).join(', ')}
                    {homeContent.featuredMovie.runtimeMinutes !== null && (
                      <><span>•</span>{homeContent.featuredMovie.runtimeMinutes} min</>
                    )}
                    {homeContent.featuredMovie.ageRating && (
                      <><span>•</span>{homeContent.featuredMovie.ageRating.code}</>
                    )}
                  </p>
                  <p className="subtitle">
                    Find a showtime for {homeContent.featuredMovie.title} and make it a movie night.
                  </p>
                </>
              )}
              <button type="button" className="primary-button" onClick={() => setView('sessions')}>
                Browse sessions <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>

          <section className="movies-section" aria-labelledby="movies-heading">
            <div className="section-heading">
              <div>
                <p className="section-kicker">On the big screen</p>
                <h2 id="movies-heading">Now showing</h2>
              </div>
              <button type="button" className="text-button" onClick={() => setView('sessions')}>
                View sessions <span aria-hidden="true">→</span>
              </button>
            </div>

            {homeContent.status === 'loading' && (
              <p className="load-state" role="status">Loading films…</p>
            )}
            {homeContent.status === 'error' && (
              <p className="load-state error-state" role="alert">{homeContent.message}</p>
            )}
            {homeContent.status === 'loaded' && homeContent.nowPlayingMovies.length === 0 && (
              <p className="load-state">No films are currently showing.</p>
            )}
            {homeContent.status === 'loaded' && homeContent.nowPlayingMovies.length > 0 && (
              <MovieGrid
                movies={homeContent.nowPlayingMovies}
                onSelectMovie={(movie) => {
                  setSelectedMovieSlug(movie.slug)
                  setView('details')
                }}
              />
            )}
          </section>
        </div>
      ) : view === 'details' && selectedMovieSlug ? (
        <MovieDetailsPage
          slug={selectedMovieSlug}
          onBack={() => setView('home')}
          onBrowseSessions={() => setView('sessions')}
        />
      ) : (
        <section className="sessions-layout" aria-label="Sessions page">
          <aside className="filters-panel" aria-label="Filter options">
            <div className="panel-header">
              <h2>Filters</h2>
              <button type="button" className="text-button">Clear all</button>
            </div>

            {filters.map((filter) => (
              <div key={filter} className="filter-group">
                <label className="filter-label">{filter}</label>
                <div className="chip-list">
                  <button type="button" className="chip active">All</button>
                  <button type="button" className="chip">Option</button>
                  <button type="button" className="chip">Option</button>
                </div>
              </div>
            ))}
          </aside>

          <div className="sessions-content">
            <div className="toolbar">
              <div>
                <p className="toolbar-title">Showing {activeSessions.length} sessions</p>
              </div>
              <label className="sort-control">
                <span>Sort by</span>
                <select defaultValue="time-earliest">
                  <option value="time-earliest">Showtime: Earliest First</option>
                  <option value="time-latest">Showtime: Latest First</option>
                  <option value="price-low">Price: Low to High</option>
                </select>
              </label>
            </div>

            <div className="session-list">
              {activeSessions.map((session) => (
                <article key={session.id} className="session-card">
                  <div className="session-poster poster-sunset" aria-hidden="true" />
                  <div className="session-details">
                    <div className="session-header-row">
                      <h3>{session.movie}</h3>
                      <span className="age-badge">{session.rating}</span>
                    </div>

                    <p className="meta-line">{session.time} • {session.hall}</p>
                    <div className="meta-tags">
                      <span>{session.format}</span>
                      <span>{session.language}</span>
                    </div>
                    <div className="session-footer">
                      <strong>from ₾{session.price}</strong>
                      <span className={session.seatsLeft === 0 ? 'sold-out' : 'seat-status'}>
                        {session.seatsLeft === 0 ? 'Sold out' : `${session.seatsLeft} seats left`}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

export default App
