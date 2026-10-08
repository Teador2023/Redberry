import { useCallback, useEffect, useState } from 'react'
import AccountPage from './components/AccountPage'
import BookingDialog from './components/BookingDialog'
import ComingSoonCard from './components/ComingSoonCard'
import GenreFilter from './components/GenreFilter'
import MovieDetailsPage from './components/MovieDetailsPage'
import MovieGrid from './components/MovieGrid'
import MovieSearch from './components/MovieSearch'
import SessionsPage from './components/SessionsPage'
import { getCurrentUser } from './services/booking'
import { getSavedMovies, saveMovies } from './services/watchlist'
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

type View = 'home' | 'sessions' | 'account' | 'watchlist' | 'details' | 'not-found'
type DetailsFrom = 'home' | 'sessions' | 'watchlist'
type MovieSort = 'featured' | 'title' | 'runtime'

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

type CatalogueRouteState = {
  search: string
  genre: string | null
  sort: MovieSort
}

function readCatalogueRouteState(): CatalogueRouteState {
  const parameters = new URLSearchParams(window.location.search)
  const sort = parameters.get('sort')
  return {
    search: parameters.get('q') ?? '',
    genre: parameters.get('genre') || null,
    sort: sort === 'title' || sort === 'runtime' ? sort : 'featured',
  }
}

function readRoute(): Route {
  const pathname = window.location.pathname
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (path === '/sessions') return { view: 'sessions', movieSlug: null }
  if (path === '/account') return { view: 'account', movieSlug: null }
  if (path === '/watchlist') return { view: 'watchlist', movieSlug: null }

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

function readDetailsFrom(): DetailsFrom {
  const fromPath = window.history.state?.fromPath
  if (fromPath === '/sessions') return 'sessions'
  if (fromPath === '/watchlist') return 'watchlist'
  return 'home'
}

function App() {
  const [initialRoute] = useState(readRoute)
  const [initialCatalogueState] = useState(readCatalogueRouteState)
  const [view, setView] = useState<View>(initialRoute.view)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [selectedMovieSlug, setSelectedMovieSlug] = useState<string | null>(initialRoute.movieSlug)
  const [selectedMovieMetadata, setSelectedMovieMetadata] = useState<MovieDetails | null>(null)
  const [detailsFrom, setDetailsFrom] = useState<DetailsFrom>(readDetailsFrom)
  const [selectedBooking, setSelectedBooking] = useState<{ movie: Movie; session: Session } | null>(null)
  const [homeContent, setHomeContent] = useState<HomeContentState>({ status: 'loading' })
  const [comingSoon, setComingSoon] = useState<ComingSoonState>({ status: 'loading' })
  const [comingSoonAttempt, setComingSoonAttempt] = useState(0)
  const [searchQuery, setSearchQuery] = useState(initialCatalogueState.search)
  const [searchAttempt, setSearchAttempt] = useState(0)
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' })
  const [selectedGenre, setSelectedGenre] = useState<string | null>(initialCatalogueState.genre)
  const [movieSort, setMovieSort] = useState<MovieSort>(initialCatalogueState.sort)
  const [watchlistState, setWatchlistState] = useState<{
    movies: Movie[]
    error: string | null
    loaded: boolean
  }>(() => {
    try {
      return { movies: getSavedMovies(), error: null, loaded: true }
    } catch (error) {
      return {
        movies: [],
        error: error instanceof Error ? error.message : 'Could not load saved films.',
        loaded: true,
      }
    }
  })
  const savedMovieSlugs = new Set(watchlistState.movies.map((movie) => movie.slug))
  const catalogueMovies = [
    ...(homeContent.status === 'loaded' ? homeContent.nowPlayingMovies : []),
    ...(comingSoon.status === 'loaded' ? comingSoon.movies : []),
  ]
  const availableGenres = Array.from(
    new Map(catalogueMovies.flatMap((movie) => movie.genres).map((genre) => [genre.slug, genre])).values(),
  ).sort((first, second) => first.name.localeCompare(second.name))
  function filterAndSortMovies(movies: Movie[]): Movie[] {
    const filteredMovies = selectedGenre
      ? movies.filter((movie) => movie.genres.some((genre) => genre.slug === selectedGenre))
      : movies
    if (movieSort === 'featured') return filteredMovies

    return [...filteredMovies].sort((first, second) => {
      if (movieSort === 'title') {
        return first.title.localeCompare(second.title, undefined, { sensitivity: 'base' })
      }
      if (first.runtimeMinutes === null) return second.runtimeMinutes === null ? 0 : 1
      if (second.runtimeMinutes === null) return -1
      return first.runtimeMinutes - second.runtimeMinutes
    })
  }

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
      watchlist: {
        title: 'My watchlist | Kino XII',
        description: 'Your saved films at Kino XII. Keep track of movies you want to see.',
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

  useEffect(() => {
    if (view !== 'home') return

    const parameters = new URLSearchParams()
    if (searchQuery.trim()) parameters.set('q', searchQuery.trim())
    if (selectedGenre) parameters.set('genre', selectedGenre)
    if (movieSort !== 'featured') parameters.set('sort', movieSort)
    const query = parameters.toString()
    const nextUrl = query ? `/?${query}` : '/'
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (currentUrl !== nextUrl) {
      window.history.replaceState(window.history.state, '', nextUrl)
    }
  }, [view, searchQuery, selectedGenre, movieSort])

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

  function toggleSavedMovie(movie: Movie): void {
    if (!watchlistState.loaded) return
    const movies = savedMovieSlugs.has(movie.slug)
      ? watchlistState.movies.filter((savedMovie) => savedMovie.slug !== movie.slug)
      : [movie, ...watchlistState.movies]

    try {
      saveMovies(movies)
      setWatchlistState({ movies, error: null, loaded: true })
    } catch (error) {
      setWatchlistState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Could not update saved films.',
      }))
    }
  }

  function openMovie(movie: Movie): void {
    const from: DetailsFrom = view === 'sessions' ? 'sessions' : view === 'watchlist' ? 'watchlist' : 'home'
    setDetailsFrom(from)
    setSelectedMovieMetadata(null)
    setSelectedMovieSlug(movie.slug)
    const fromPath = from === 'sessions' ? '/sessions' : from === 'watchlist' ? '/watchlist' : '/'
    window.history.pushState({ fromPath }, '', `/movies/${encodeURIComponent(movie.slug)}`)
    setView('details')
  }

  function navigateTo(nextView: View): void {
    if (nextView === 'home') {
      window.history.pushState({}, '', '/')
    } else if (nextView === 'sessions' && window.location.pathname !== '/sessions') {
      window.history.pushState({}, '', '/sessions')
    } else if (nextView === 'account' && window.location.pathname !== '/account') {
      window.history.pushState({}, '', '/account')
    } else if (nextView === 'watchlist' && window.location.pathname !== '/watchlist') {
      window.history.pushState({}, '', '/watchlist')
    }
    if (nextView !== 'details') {
      setSelectedMovieSlug(null)
      setSelectedMovieMetadata(null)
    }
    setView(nextView)
  }

  function returnFromDetails(): void {
    const fromPath = window.history.state?.fromPath
    if (fromPath === '/' || fromPath === '/sessions' || fromPath === '/watchlist') {
      window.history.back()
      return
    }
    navigateTo(detailsFrom)
  }

  useEffect(() => {
    function handlePopState() {
      const route = readRoute()
      setView(route.view)
      setSelectedMovieSlug(route.movieSlug)
      setSelectedMovieMetadata(null)
      if (route.view === 'home') {
        const catalogueState = readCatalogueRouteState()
        setSearchQuery(catalogueState.search)
        setSelectedGenre(catalogueState.genre)
        setMovieSort(catalogueState.sort)
      }
      if (route.view === 'details') {
        setDetailsFrom(readDetailsFrom())
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
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
          <button type="button" className={view === 'watchlist' || (view === 'details' && detailsFrom === 'watchlist') ? 'nav-button active' : 'nav-button'} onClick={() => navigateTo('watchlist')}>
            Watchlist{watchlistState.movies.length > 0 ? ` (${watchlistState.movies.length})` : ''}
          </button>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
      {watchlistState.error && (
        <p className="load-state error-state" role="alert">{watchlistState.error}</p>
      )}
      {view === 'account' ? (
        <AccountPage key={currentUser?.id ?? 'guest'} user={currentUser} onUserChange={handleUserChange} />
      ) : view === 'watchlist' ? (
        <section className="movies-section watchlist-page" aria-labelledby="watchlist-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Your saved films</p>
              <h1 id="watchlist-heading">Watchlist</h1>
            </div>
          </div>
          {!watchlistState.loaded ? (
            <p className="load-state" role="status">Loading your watchlist…</p>
          ) : watchlistState.movies.length === 0 ? (
            <p className="load-state">Your watchlist is empty. Save films from the catalogue to keep them here.</p>
          ) : (
            <MovieGrid
              movies={watchlistState.movies}
              onSelectMovie={openMovie}
              savedMovieSlugs={savedMovieSlugs}
              onToggleSaved={toggleSavedMovie}
            />
          )}
        </section>
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
            <div className="movie-sort">
              <label htmlFor="movie-sort-select">Sort films</label>
              <select
                id="movie-sort-select"
                value={movieSort}
                onChange={(event) => {
                  const sort = event.target.value
                  if (sort === 'featured' || sort === 'title' || sort === 'runtime') {
                    setMovieSort(sort)
                  }
                }}
              >
                <option value="featured">Featured</option>
                <option value="title">Title (A–Z)</option>
                <option value="runtime">Runtime (shortest first)</option>
              </select>
            </div>
            <GenreFilter
              genres={availableGenres}
              selectedGenre={selectedGenre}
              onSelectGenre={setSelectedGenre}
            />

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
              filterAndSortMovies(homeContent.nowPlayingMovies).length === 0 ? (
                <p className="load-state">No currently showing films match this genre. Choose another genre or select All genres.</p>
              ) : (
                <MovieGrid
                  movies={filterAndSortMovies(homeContent.nowPlayingMovies)}
                  onSelectMovie={openMovie}
                  savedMovieSlugs={savedMovieSlugs}
                  onToggleSaved={toggleSavedMovie}
                />
              )
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
                    filterAndSortMovies(searchState.movies).length === 0 ? (
                      <p className="load-state">No search results match both “{normalizedSearchQuery}” and this genre. Choose another genre or select All genres.</p>
                    ) : (
                      <MovieGrid
                        movies={filterAndSortMovies(searchState.movies)}
                        onSelectMovie={openMovie}
                        savedMovieSlugs={savedMovieSlugs}
                        onToggleSaved={toggleSavedMovie}
                      />
                    )
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
                      isSaved={savedMovieSlugs.has(movie.slug)}
                      onSelectMovie={openMovie}
                      onToggleSaved={toggleSavedMovie}
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
          isSaved={savedMovieSlugs.has(selectedMovieSlug)}
          onToggleSaved={toggleSavedMovie}
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
      </main>
      {selectedBooking && (
        <BookingDialog
          key={selectedBooking.session.id}
          movie={selectedBooking.movie}
          session={selectedBooking.session}
          onUserChange={handleUserChange}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  )
}

export default App
