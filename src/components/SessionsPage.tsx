import { useEffect, useMemo, useState } from 'react'
import { getSessionFilterOptions, getSessions } from '../services/sessions'
import type { Movie } from '../types/movie'
import type { SessionFilterOptions, SessionFilters, SessionsResponse } from '../types/session'

type SessionsPageProps = {
  onSelectMovie: (movie: Movie) => void
}

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; data: T }

function getToday(): string {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

function readFiltersFromUrl(): SessionFilters {
  const parameters = new URLSearchParams(window.location.search)
  const parsedPage = Number(parameters.get('page'))

  return {
    date: parameters.get('date') || getToday(),
    venues: parameters.getAll('venues[]'),
    formats: parameters.getAll('formats[]'),
    languages: parameters.getAll('languages[]'),
    bands: parameters.getAll('bands[]'),
    search: parameters.get('search') ?? '',
    sort: parameters.get('sort') || 'time_asc',
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  }
}

function writeFiltersToUrl(filters: SessionFilters): void {
  const parameters = new URLSearchParams()
  parameters.set('date', filters.date)

  filters.venues.forEach((venue) => parameters.append('venues[]', venue))
  filters.formats.forEach((format) => parameters.append('formats[]', format))
  filters.languages.forEach((language) => parameters.append('languages[]', language))
  filters.bands.forEach((band) => parameters.append('bands[]', band))

  if (filters.search.trim()) {
    parameters.set('search', filters.search.trim())
  }
  if (filters.sort !== 'time_asc') {
    parameters.set('sort', filters.sort)
  }
  if (filters.page > 1) {
    parameters.set('page', String(filters.page))
  }

  window.history.pushState({}, '', `${window.location.pathname}?${parameters}`)
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((currentValue) => currentValue !== value)
    : [...values, value]
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

function SessionsPage({ onSelectMovie }: SessionsPageProps) {
  const [filters, setFilters] = useState<SessionFilters>(readFiltersFromUrl)
  const [filterOptions, setFilterOptions] = useState<LoadState<SessionFilterOptions>>({ status: 'loading' })
  const [sessions, setSessions] = useState<LoadState<SessionsResponse>>({ status: 'loading' })
  const [filterRetry, setFilterRetry] = useState(0)
  const [sessionRetry, setSessionRetry] = useState(0)

  useEffect(() => {
    let isCurrent = true

    getSessionFilterOptions()
      .then((options) => {
        if (isCurrent) {
          setFilterOptions({ status: 'loaded', data: options })
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setFilterOptions({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unable to load filter options.',
          })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [filterRetry])

  useEffect(() => {
    let isCurrent = true
    const timeoutId = window.setTimeout(() => {
      setSessions({ status: 'loading' })
      void getSessions(filters)
        .then((result) => {
          if (isCurrent) {
            setSessions({ status: 'loaded', data: result })
          }
        })
        .catch((error: unknown) => {
          if (isCurrent) {
            setSessions({
              status: 'error',
              message: error instanceof Error ? error.message : 'Unable to load sessions.',
            })
          }
        })
    }, filters.search ? 250 : 0)

    return () => {
      isCurrent = false
      window.clearTimeout(timeoutId)
    }
  }, [filters, sessionRetry])

  useEffect(() => {
    function handlePopState() {
      setFilters(readFiltersFromUrl())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const availableFormats = useMemo(() => {
    if (filterOptions.status !== 'loaded') {
      return []
    }

    if (filters.venues.length === 0) {
      return filterOptions.data.formats
    }

    const venueFormats = filterOptions.data.venues
      .filter((venue) => filters.venues.includes(venue.slug))
      .flatMap((venue) => venue.formats)
    const availableSlugs = new Set(venueFormats.map((format) => format.slug))
    return filterOptions.data.formats.filter((format) => availableSlugs.has(format.slug))
  }, [filterOptions, filters.venues])

  function updateFilters(nextFilters: SessionFilters): void {
    writeFiltersToUrl(nextFilters)
    setFilters(nextFilters)
  }

  function updateArrayFilter(
    key: 'venues' | 'formats' | 'languages' | 'bands',
    value: string,
  ): void {
    const nextFilters = { ...filters, [key]: toggleValue(filters[key], value), page: 1 }

    if (key === 'venues' && filterOptions.status === 'loaded') {
      const allowedFormats = nextFilters.venues.length === 0
        ? new Set(filterOptions.data.formats.map((format) => format.slug))
        : new Set(
          filterOptions.data.venues
            .filter((venue) => nextFilters.venues.includes(venue.slug))
            .flatMap((venue) => venue.formats.map((format) => format.slug)),
        )
      nextFilters.formats = nextFilters.formats.filter((format) => allowedFormats.has(format))
    }

    updateFilters(nextFilters)
  }

  function clearFilters(): void {
    updateFilters({
      date: getToday(),
      venues: [],
      formats: [],
      languages: [],
      bands: [],
      search: '',
      sort: 'time_asc',
      page: 1,
    })
  }

  const hasActiveFilters = filters.venues.length > 0
    || filters.formats.length > 0
    || filters.languages.length > 0
    || filters.bands.length > 0
    || filters.search.length > 0

  return (
    <section className="sessions-page" aria-labelledby="sessions-heading">
      <div className="sessions-page-heading">
        <div>
          <p className="section-kicker">Find your next screening</p>
          <h1 id="sessions-heading">Sessions</h1>
        </div>
        <label className="sort-control">
          <span>Sort by</span>
          <select
            value={filters.sort}
            disabled={filterOptions.status !== 'loaded'}
            onChange={(event) => updateFilters({ ...filters, sort: event.target.value, page: 1 })}
          >
            {filterOptions.status === 'loaded' && filterOptions.data.sorts.map((sort) => (
              <option key={sort.id} value={sort.id}>{sort.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="sessions-layout">
        <aside className="filters-panel" aria-label="Session filters">
          <div className="panel-header">
            <h2>Filters</h2>
            <button type="button" className="text-button" onClick={clearFilters}>Clear all</button>
          </div>

          <label className="filter-group date-filter">
            <span className="filter-label">Date</span>
            <input
              type="date"
              value={filters.date}
              onChange={(event) => updateFilters({ ...filters, date: event.target.value || getToday(), page: 1 })}
            />
          </label>

          <label className="filter-group session-search">
            <span className="filter-label">Movie title</span>
            <input
              type="search"
              value={filters.search}
              maxLength={100}
              placeholder="Search sessions"
              onChange={(event) => updateFilters({ ...filters, search: event.target.value, page: 1 })}
            />
          </label>

          {filterOptions.status === 'loading' && <p className="filter-help" role="status">Loading filter options…</p>}
          {filterOptions.status === 'error' && (
            <div className="filter-error" role="alert">
              <p>{filterOptions.message}</p>
              <button type="button" className="text-button" onClick={() => setFilterRetry((retry) => retry + 1)}>
                Retry filters
              </button>
            </div>
          )}

          {filterOptions.status === 'loaded' && (
            <>
              <fieldset className="filter-group">
                <legend className="filter-label">Venues</legend>
                {filterOptions.data.venues.map((venue) => (
                  <label key={venue.id} className="filter-option">
                    <input
                      type="checkbox"
                      checked={filters.venues.includes(venue.slug)}
                      onChange={() => updateArrayFilter('venues', venue.slug)}
                    />
                    <span>{venue.name}</span>
                  </label>
                ))}
              </fieldset>

              <fieldset className="filter-group">
                <legend className="filter-label">Formats</legend>
                {availableFormats.map((format) => (
                  <label key={format.id} className="filter-option">
                    <input
                      type="checkbox"
                      checked={filters.formats.includes(format.slug)}
                      onChange={() => updateArrayFilter('formats', format.slug)}
                    />
                    <span>{format.name}</span>
                  </label>
                ))}
              </fieldset>

              <fieldset className="filter-group">
                <legend className="filter-label">Language</legend>
                {filterOptions.data.languages.map((language) => (
                  <label key={language.id} className="filter-option">
                    <input
                      type="checkbox"
                      checked={filters.languages.includes(language.slug)}
                      onChange={() => updateArrayFilter('languages', language.slug)}
                    />
                    <span>{language.name}</span>
                  </label>
                ))}
              </fieldset>

              <fieldset className="filter-group">
                <legend className="filter-label">Time of day</legend>
                {filterOptions.data.timeBands.map((band) => (
                  <label key={band.id} className="filter-option">
                    <input
                      type="checkbox"
                      checked={filters.bands.includes(band.id)}
                      onChange={() => updateArrayFilter('bands', band.id)}
                    />
                    <span>{band.label}</span>
                  </label>
                ))}
              </fieldset>
            </>
          )}
        </aside>

        <div className="sessions-content">
          <div className="sessions-toolbar">
            <p className="toolbar-title">
              {sessions.status === 'loaded'
                ? `Showing ${sessions.data.meta.totalSessions} sessions`
                : `Showtimes for ${formatDate(filters.date)}`}
            </p>
            <span className="selected-date">{formatDate(filters.date)}</span>
          </div>

          {sessions.status === 'loading' && <p className="load-state" role="status">Loading sessions…</p>}
          {sessions.status === 'error' && (
            <div className="load-state error-state" role="alert">
              <p>{sessions.message}</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSessionRetry((retry) => retry + 1)}
              >
                Try again
              </button>
            </div>
          )}
          {sessions.status === 'loaded' && sessions.data.meta.totalSessions === 0 && (
            <p className="load-state">
              No sessions match these filters for {formatDate(filters.date)}. {hasActiveFilters ? 'Try changing or clearing a filter.' : 'Choose another date.'}
            </p>
          )}

          {sessions.status === 'loaded' && sessions.data.data.length > 0 && (
            <div className="session-list">
              {sessions.data.data.map((group) => (
                <article className="session-movie-card" key={group.movie.id}>
                  <button
                    type="button"
                    className="session-movie-poster"
                    onClick={() => onSelectMovie(group.movie)}
                    aria-label={`View details for ${group.movie.title}`}
                  >
                    {group.movie.posterUrl
                      ? <img src={group.movie.posterUrl} alt="" loading="lazy" />
                      : <span>Poster unavailable</span>}
                  </button>
                  <div className="session-movie-content">
                    <div className="session-movie-heading">
                      <h2>
                        <button type="button" className="session-movie-title" onClick={() => onSelectMovie(group.movie)}>
                          {group.movie.title}
                        </button>
                      </h2>
                      <span className="age-badge">{group.movie.ageRating?.code ?? 'Not rated'}</span>
                    </div>
                    <p className="session-movie-genres">{group.movie.genres.map((genre) => genre.name).join(', ')}</p>
                    <div className="showtime-list">
                      {group.sessions.map((session) => (
                        <div
                          className={session.isSoldOut ? 'showtime-option showtime-sold-out' : 'showtime-option'}
                          key={session.id}
                          role="group"
                          aria-disabled={session.isSoldOut}
                          aria-label={`${session.time}, ${session.venue.name}, Hall ${session.hall.name}, ${session.format.name}, ${session.language.name}, ${session.isSoldOut ? 'sold out' : `${session.seatsLeft} seats left`}`}
                        >
                          <span className="showtime-time">{session.time}</span>
                          <span>{session.venue.name}</span>
                          <span>Hall {session.hall.name}</span>
                          <span>{session.format.name}</span>
                          <span>{session.language.name}</span>
                          <strong>₾{session.price}</strong>
                          <span className={session.isSoldOut ? 'sold-out' : 'seat-status'}>
                            {session.isSoldOut ? 'Sold out' : `${session.seatsLeft} seats`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {sessions.status === 'loaded' && sessions.data.meta.lastPage > 1 && (
            <nav className="pagination" aria-label="Sessions pages">
              <button
                type="button"
                className="secondary-button"
                disabled={filters.page <= 1}
                onClick={() => updateFilters({ ...filters, page: filters.page - 1 })}
              >
                Previous
              </button>
              <span>Page {sessions.data.meta.currentPage} of {sessions.data.meta.lastPage}</span>
              <button
                type="button"
                className="secondary-button"
                disabled={filters.page >= sessions.data.meta.lastPage}
                onClick={() => updateFilters({ ...filters, page: filters.page + 1 })}
              >
                Next
              </button>
            </nav>
          )}
        </div>
      </div>
    </section>
  )
}

export default SessionsPage
