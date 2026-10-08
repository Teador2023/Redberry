import { useEffect, useState } from 'react'
import BookingDialog from './components/BookingDialog'
import MovieDetailsPage from './components/MovieDetailsPage'
import MovieGrid from './components/MovieGrid'
import MovieSearch from './components/MovieSearch'
import SessionsPage from './components/SessionsPage'
import { getFeaturedMovies, getNowPlayingMovies, searchMovies } from './services/movies'
import type { Movie } from './types/movie'
import type { Session } from './types/session'

type View = 'home' | 'sessions' | 'details'

type HomeContentState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; featuredMovie: Movie | null; nowPlayingMovies: Movie[] }

type SearchState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'error'; query: string; message: string }
  | { status: 'loaded'; query: string; movies: Movie[] }

function App() {
  const [view, setView] = useState<View>(
    window.location.pathname === '/sessions' ? 'sessions' : 'home',
  )
  const [selectedMovieSlug, setSelectedMovieSlug] = useState<string | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<{ movie: Movie; session: Session } | null>(null)
  const [homeContent, setHomeContent] = useState<HomeContentState>({ status: 'loading' })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchAttempt, setSearchAttempt] = useState(0)
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' })

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

  const normalizedSearchQuery = searchQuery.trim()

  useEffect(() => {
    if (!normalizedSearchQuery) {
      return
    }

    let isCurrent = true
    const timeoutId = window.setTimeout(async () => {
      try {
        const movies = await searchMovies(normalizedSearchQuery)
        if (isCurrent) {
          setSearchState({ status: 'loaded', query: normalizedSearchQuery, movies })
        }
      } catch (error) {
        if (isCurrent) {
          setSearchState({
            status: 'error',
            query: normalizedSearchQuery,
            message: error instanceof Error ? error.message : 'Unable to search films. Please try again.',
          })
        }
      }
    }, 300)

    return () => {
      isCurrent = false
      window.clearTimeout(timeoutId)
    }
  }, [normalizedSearchQuery, searchAttempt])

  function handleSearchQueryChange(query: string) {
    const normalizedQuery = query.trim()
    setSearchQuery(query)
    setSearchState(normalizedQuery
      ? { status: 'loading', query: normalizedQuery }
      : { status: 'idle' })
  }

  function retrySearch() {
    setSearchState({ status: 'loading', query: normalizedSearchQuery })
    setSearchAttempt((attempt) => attempt + 1)
  }

  function navigateTo(nextView: View): void {
    if (nextView === 'home') {
      window.history.pushState({}, '', '/')
    } else if (nextView === 'sessions' && window.location.pathname !== '/sessions') {
      window.history.pushState({}, '', '/sessions')
    }
    setView(nextView)
  }

  useEffect(() => {
    function handlePopState() {
      setView(window.location.pathname === '/sessions' ? 'sessions' : 'home')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return (
    <main className="app-shell">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => navigateTo('home')}>
          <span className="brand-mark" aria-hidden="true">K</span>
          <span>Kino <strong>XII</strong></span>
        </button>

        <nav className="nav" aria-label="Main navigation">
          <button type="button" className={window.location.pathname !== '/sessions' ? 'nav-button active' : 'nav-button'} onClick={() => navigateTo('home')}>
            Home
          </button>
          <button type="button" className={window.location.pathname === '/sessions' ? 'nav-button active' : 'nav-button'} onClick={() => navigateTo('sessions')}>
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
              <button type="button" className="primary-button" onClick={() => navigateTo('sessions')}>
                Browse sessions <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>

          <section className="movies-section" aria-labelledby="movies-heading">
            <div className="section-heading">
              <div>
                <p className="section-kicker">On the big screen</p>
                <h2 id="movies-heading">{normalizedSearchQuery ? 'Search results' : 'Now showing'}</h2>
              </div>
              <button type="button" className="text-button" onClick={() => navigateTo('sessions')}>
                View sessions <span aria-hidden="true">→</span>
              </button>
            </div>

            <MovieSearch query={searchQuery} onQueryChange={handleSearchQueryChange} />

            {!normalizedSearchQuery && homeContent.status === 'loading' && (
              <p className="load-state" role="status">Loading films…</p>
            )}
            {!normalizedSearchQuery && homeContent.status === 'error' && (
              <p className="load-state error-state" role="alert">{homeContent.message}</p>
            )}
            {!normalizedSearchQuery && homeContent.status === 'loaded' && homeContent.nowPlayingMovies.length === 0 && (
              <p className="load-state">No films are currently showing.</p>
            )}
            {!normalizedSearchQuery && homeContent.status === 'loaded' && homeContent.nowPlayingMovies.length > 0 && (
              <MovieGrid
                movies={homeContent.nowPlayingMovies}
                onSelectMovie={(movie) => {
                  setSelectedMovieSlug(movie.slug)
                  setView('details')
                }}
              />
            )}
            {normalizedSearchQuery && (
              <div aria-live="polite">
                {searchState.status !== 'idle' && searchState.query === normalizedSearchQuery
                  && searchState.status === 'loading' && (
                    <p className="load-state" role="status">Searching films…</p>
                )}
                {searchState.status !== 'idle' && searchState.query === normalizedSearchQuery
                  && searchState.status === 'error' && (
                    <div className="search-error" role="alert">
                      <p>{searchState.message}</p>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={retrySearch}
                      >
                        Try again
                      </button>
                    </div>
                )}
                {searchState.status === 'loaded' && searchState.query === normalizedSearchQuery
                  && searchState.movies.length === 0 && (
                    <p className="load-state">No films match “{normalizedSearchQuery}”. Try a different title.</p>
                )}
                {searchState.status === 'loaded' && searchState.query === normalizedSearchQuery
                  && searchState.movies.length > 0 && (
                    <MovieGrid
                      movies={searchState.movies}
                      onSelectMovie={(movie) => {
                        setSelectedMovieSlug(movie.slug)
                        setView('details')
                      }}
                    />
                )}
                {(searchState.status === 'idle' || searchState.query !== normalizedSearchQuery) && (
                  <p className="load-state" role="status">Searching films…</p>
                )}
              </div>
            )}
          </section>
        </div>
      ) : view === 'details' && selectedMovieSlug ? (
        <MovieDetailsPage
          slug={selectedMovieSlug}
          onBack={() => {
            if (window.location.pathname === '/sessions') {
              setView('sessions')
            } else {
              navigateTo('home')
            }
          }}
          onBrowseSessions={() => navigateTo('sessions')}
        />
      ) : (
        <SessionsPage
          onSelectMovie={(movie) => {
            setSelectedMovieSlug(movie.slug)
            setView('details')
          }}
          onSelectSession={(movie, session) => setSelectedBooking({ movie, session })}
        />
      )}
      {selectedBooking && (
        <BookingDialog
          key={selectedBooking.session.id}
          movie={selectedBooking.movie}
          session={selectedBooking.session}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </main>
  )
}

export default App
