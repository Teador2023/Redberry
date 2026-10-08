import { useCallback, useEffect, useState } from 'react'
import AccountPage from './components/AccountPage'
import BookingDialog from './components/BookingDialog'
import ComingSoonCard from './components/ComingSoonCard'
import MovieDetailsPage from './components/MovieDetailsPage'
import MovieGrid from './components/MovieGrid'
import MovieSearch from './components/MovieSearch'
import SessionsPage from './components/SessionsPage'
import { getCurrentUser } from './services/booking'
import {
  getComingSoonMovies,
  getFeaturedMovies,
  getNowPlayingMovies,
  searchMovies,
  subscribeToMovieNotifications,
} from './services/movies'
import { ApiError } from './types/booking'
import type { User } from './types/booking'
import type { Movie, MovieDetails } from './types/movie'
import type { Session } from './types/session'

type View = 'home' | 'sessions' | 'account' | 'details' | 'not-found'

type HomeContentState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; featuredMovie: Movie | null; nowPlayingMovies: Movie[] }

type SearchState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'error'; query: string; message: string }
  | { status: 'loaded'; query: string; movies: Movie[] }

type ComingSoonState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; movies: Movie[] }

type Route = {
  view: View
  movieSlug: string | null
}

function readRoute(): Route {
  const pathname = window.location.pathname
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (path === '/sessions') return { view: 'sessions', movieSlug: null }
  if (path === '/account') return { view: 'account', movieSlug: null }

  const movieMatch = path.match(/^\/movies\/([^/]+)\/?$/)
  if (movieMatch) {
    try {
      const movieSlug = decodeURIComponent(movieMatch[1])
      if (movieSlug) return { view: 'details', movieSlug }
    } catch {
      return { view: 'not-found', movieSlug: null }
    }
  }
  return path === '/' ? { view: 'home', movieSlug: null } : { view: 'not-found', movieSlug: null }
}

function App() {
  const [initialRoute] = useState(readRoute)
  const [view, setView] = useState<View>(initialRoute.view)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [selectedMovieSlug, setSelectedMovieSlug] = useState<string | null>(initialRoute.movieSlug)
  const [selectedMovieMetadata, setSelectedMovieMetadata] = useState<MovieDetails | null>(null)
  const [detailsFrom, setDetailsFrom] = useState<'home' | 'sessions'>(() => (
    window.history.state?.fromPath === '/sessions' ? 'sessions' : 'home'
  ))
  const [selectedBooking, setSelectedBooking] = useState<{ movie: Movie; session: Session } | null>(null)
  const [homeContent, setHomeContent] = useState<HomeContentState>({ status: 'loading' })
  const [comingSoon, setComingSoon] = useState<ComingSoonState>({ status: 'loading' })
  const [comingSoonAttempt, setComingSoonAttempt] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchAttempt, setSearchAttempt] = useState(0)
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' })

  useEffect(() => {
    const routeMetadata: Record<Exclude<View, 'details'>, { title: string; description: string }> = {
      home: {
        title: 'Kino XII | Movies and showtimes',
        description: 'Discover films now showing and coming soon at Kino XII. Explore movies and find your next cinema session.',
      },
      sessions: {
        title: 'Sessions | Kino XII',
        description: 'Browse movie sessions at Kino XII. Find a screening by date, movie, and showtime.',
      },
      account: {
        title: 'My account | Kino XII',
        description: 'Sign in or manage your Kino XII profile, tickets, and bookings.',
      },
      'not-found': {
        title: 'Page not found | Kino XII',
        description: 'The page you are looking for could not be found. Explore movies and sessions at Kino XII.',
      },
    }
    const metadata = view === 'details' && selectedMovieMetadata
      ? {
          title: `${selectedMovieMetadata.title} | Kino XII`,
          description: selectedMovieMetadata.synopsis
            ?? `View ${selectedMovieMetadata.title} movie details and ${selectedMovieMetadata.isComingSoon ? 'coming soon updates' : 'showtimes'} at Kino XII.`,
        }
      : view === 'details'
        ? { title: 'Movie details | Kino XII', description: 'Movie details, showtimes, and information from Kino XII.' }
        : routeMetadata[view]

    document.title = metadata.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', metadata.description)
  }, [view, selectedMovieMetadata])

  const handleUserChange = useCallback((user: User | null) => {
    setCurrentUser(user)
  }, [])

  useEffect(() => {
    const token = sessionStorage.getItem('kino-auth-token')
    if (!token) return
    let isCurrent = true
    getCurrentUser(token)
      .then((user) => {
        if (isCurrent) setCurrentUser(user)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        if (error instanceof ApiError && error.status === 401) {
          sessionStorage.removeItem('kino-auth-token')
          setCurrentUser(null)
          return
        }
        console.error('Could not restore the signed-in user.', error)
      })
    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    let isCurrent = true
    getComingSoonMovies()
      .then((movies) => {
        if (isCurrent) setComingSoon({ status: 'loaded', movies })
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setComingSoon({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unable to load coming soon films.',
          })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [comingSoonAttempt])

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

  function openMovie(movie: Movie): void {
    const from = view === 'sessions' ? 'sessions' : 'home'
    setDetailsFrom(from)
    setSelectedMovieMetadata(null)
    setSelectedMovieSlug(movie.slug)
    window.history.pushState({ fromPath: from === 'sessions' ? '/sessions' : '/' }, '', `/movies/${encodeURIComponent(movie.slug)}`)
    setView('details')
  }

  function navigateTo(nextView: View): void {
    if (nextView === 'home') {
      window.history.pushState({}, '', '/')
    } else if (nextView === 'sessions' && window.location.pathname !== '/sessions') {
      window.history.pushState({}, '', '/sessions')
    } else if (nextView === 'account' && window.location.pathname !== '/account') {
      window.history.pushState({}, '', '/account')
    }
    if (nextView !== 'details') {
      setSelectedMovieSlug(null)
      setSelectedMovieMetadata(null)
    }
    setView(nextView)
  }

  function returnFromDetails(): void {
    const fromPath = window.history.state?.fromPath
    if (fromPath === '/' || fromPath === '/sessions') {
      window.history.back()
      return
    }
    navigateTo(detailsFrom === 'sessions' ? 'sessions' : 'home')
  }

  useEffect(() => {
    function handlePopState() {
      const route = readRoute()
      setView(route.view)
      setSelectedMovieSlug(route.movieSlug)
      setSelectedMovieMetadata(null)
      if (route.view === 'details') {
        setDetailsFrom(window.history.state?.fromPath === '/sessions' ? 'sessions' : 'home')
      }
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
          <button type="button" className={view === 'home' || (view === 'details' && detailsFrom === 'home') ? 'nav-button active' : 'nav-button'} onClick={() => navigateTo('home')}>
            Home
          </button>
          <button type="button" className={view === 'sessions' || (view === 'details' && detailsFrom === 'sessions') ? 'nav-button active' : 'nav-button'} onClick={() => navigateTo('sessions')}>
            Sessions
          </button>
          <button type="button" className={view === 'account' ? 'nav-button active' : 'nav-button'} onClick={() => navigateTo('account')}>
            {currentUser ? 'My account' : 'Sign in'}
          </button>
        </nav>
      </header>

      {view === 'account' ? (
        <AccountPage key={currentUser?.id ?? 'guest'} user={currentUser} onUserChange={handleUserChange} />
      ) : view === 'home' ? (
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
                onSelectMovie={openMovie}
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
                      onSelectMovie={openMovie}
                    />
                )}
                {(searchState.status === 'idle' || searchState.query !== normalizedSearchQuery) && (
                  <p className="load-state" role="status">Searching films…</p>
                )}
              </div>
            )}
          </section>

          {!normalizedSearchQuery && (
            <section className="movies-section coming-soon-section" aria-labelledby="coming-soon-heading">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">The next big thing</p>
                  <h2 id="coming-soon-heading">Coming soon</h2>
                </div>
              </div>
              {comingSoon.status === 'loading' && (
                <p className="load-state" role="status">Loading upcoming films…</p>
              )}
              {comingSoon.status === 'error' && (
                <div className="search-error" role="alert">
                  <p>{comingSoon.message}</p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setComingSoonAttempt((attempt) => attempt + 1)}
                  >
                    Try again
                  </button>
                </div>
              )}
              {comingSoon.status === 'loaded' && comingSoon.movies.length === 0 && (
                <p className="load-state">No upcoming films have been announced yet.</p>
              )}
              {comingSoon.status === 'loaded' && comingSoon.movies.length > 0 && (
                <div className="content-grid">
                  {comingSoon.movies.map((movie) => (
                    <ComingSoonCard
                      key={movie.id}
                      movie={movie}
                      token={sessionStorage.getItem('kino-auth-token')}
                      onSelectMovie={openMovie}
                      onSignIn={() => navigateTo('account')}
                      onNotify={async (selectedMovie) => {
                        const token = sessionStorage.getItem('kino-auth-token')
                        if (!token) {
                          navigateTo('account')
                          throw new Error('Sign in to get notified when this film opens.')
                        }
                        try {
                          await subscribeToMovieNotifications(selectedMovie.slug, token)
                        } catch (error) {
                          if (error instanceof ApiError && error.status === 401) {
                            sessionStorage.removeItem('kino-auth-token')
                            handleUserChange(null)
                            navigateTo('account')
                          }
                          throw error
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      ) : view === 'details' && selectedMovieSlug ? (
        <MovieDetailsPage
          slug={selectedMovieSlug}
          onDetailsLoaded={setSelectedMovieMetadata}
          onBack={returnFromDetails}
          onBrowseSessions={() => navigateTo('sessions')}
        />
      ) : view === 'not-found' ? (
        <section className="details-state not-found-page" aria-labelledby="not-found-title">
          <p className="eyebrow">404 — Page not found</p>
          <h1 id="not-found-title">This page isn’t on the programme</h1>
          <p>We couldn’t find the page you requested. Head back to the cinema to discover films and showtimes.</p>
          <button type="button" className="primary-button" onClick={() => navigateTo('home')}>
            Back to home <span aria-hidden="true">→</span>
          </button>
        </section>
      ) : (
        <SessionsPage
          onSelectMovie={openMovie}
          onSelectSession={(movie, session) => setSelectedBooking({ movie, session })}
        />
      )}
      {selectedBooking && (
        <BookingDialog
          key={selectedBooking.session.id}
          movie={selectedBooking.movie}
          session={selectedBooking.session}
          onUserChange={handleUserChange}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </main>
  )
}

export default App
