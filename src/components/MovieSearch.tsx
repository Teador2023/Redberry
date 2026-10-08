type MovieSearchProps = {
  query: string
  onQueryChange: (query: string) => void
}

function MovieSearch({ query, onQueryChange }: MovieSearchProps) {
  return (
    <div className="movie-search">
      <label htmlFor="movie-search-input">Search films</label>
      <div className="movie-search-field">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input
          id="movie-search-input"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by movie title"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className="clear-search"
            onClick={() => onQueryChange('')}
            aria-label="Clear movie search"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

export default MovieSearch
