import { useMemo, useState } from 'react'

type View = 'home' | 'sessions'

type Movie = {
  id: number
  title: string
  genre: string
  duration: string
  rating: string
  accent: string
}

type Session = {
  id: number
  movie: string
  time: string
  hall: string
  format: string
  language: string
  price: number
  seatsLeft: number
}

const movies: Movie[] = [
  { id: 1, title: 'Midnight Echo', genre: 'Thriller', duration: '2h 06m', rating: '16+', accent: 'sunset' },
  { id: 2, title: 'Golden Hour', genre: 'Drama', duration: '1h 48m', rating: '12+', accent: 'ocean' },
  { id: 3, title: 'Glass Horizon', genre: 'Sci‑Fi', duration: '2h 14m', rating: '18+', accent: 'forest' },
  { id: 4, title: 'Paper Lanterns', genre: 'Adventure', duration: '1h 34m', rating: 'PG', accent: 'rose' },
]

const sessions: Session[] = [
  { id: 1, movie: 'Midnight Echo', time: '12:00', hall: 'Hall 1', format: 'Standard', language: 'Georgian Dub', price: 24, seatsLeft: 12 },
  { id: 2, movie: 'Midnight Echo', time: '15:30', hall: 'Hall 3', format: 'MAX', language: 'Original', price: 36, seatsLeft: 5 },
  { id: 3, movie: 'Golden Hour', time: '14:15', hall: 'Hall 2', format: 'ATMOS', language: 'Georgian Subtitles', price: 28, seatsLeft: 18 },
  { id: 4, movie: 'Glass Horizon', time: '19:00', hall: 'Hall 4', format: 'PANORAMA', language: 'Russian Dub', price: 32, seatsLeft: 0 },
  { id: 5, movie: 'Paper Lanterns', time: '17:45', hall: 'Hall 1', format: 'Standard', language: 'Original', price: 22, seatsLeft: 9 },
]

const filters = ['Venue', 'Date', 'Format', 'Language', 'Time of Day']

function App() {
  const [view, setView] = useState<View>('home')

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
          <button type="button" className={view === 'home' ? 'nav-button active' : 'nav-button'} onClick={() => setView('home')}>
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
            <div className="hero-art" aria-hidden="true" />
            <div className="hero-copy">
              <p className="eyebrow"><span className="live-dot" /> Featured film</p>
              <h1 id="hero-title">{movies[0].title}</h1>
              <p className="hero-meta">
                {movies[0].genre}<span>•</span>{movies[0].duration}<span>•</span>{movies[0].rating}
              </p>
              <p className="subtitle">
                Settle in for a story worth seeing on the big screen. Find a showtime and make it a movie night.
              </p>
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

            <div className="content-grid">
              {movies.map((movie, index) => (
                <article key={movie.id} className="movie-card">
                  <div className={`movie-poster poster-${movie.accent}`} aria-hidden="true">
                    <span className="poster-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="poster-rating">{movie.rating}</span>
                  </div>
                  <div className="movie-info">
                    <div>
                      <h3>{movie.title}</h3>
                      <p>{movie.genre}<span>•</span>{movie.duration}</p>
                    </div>
                    <span className="movie-arrow" aria-hidden="true">↗</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
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
                      <span className="age-badge">{movies.find((movie) => movie.title === session.movie)?.rating ?? 'PG'}</span>
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
