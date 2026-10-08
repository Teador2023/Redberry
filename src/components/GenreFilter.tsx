import type { Movie } from '../types/movie'

type GenreFilterProps = {
  genres: Pick<Movie['genres'][number], 'slug' | 'name'>[]
  selectedGenre: string | null
  onSelectGenre: (slug: string | null) => void
}

function GenreFilter({ genres, selectedGenre, onSelectGenre }: GenreFilterProps) {
  if (genres.length === 0) return null

  return (
    <div className="genre-filter" role="group" aria-label="Filter films by genre">
      <span className="genre-filter-label">Genres</span>
      <div className="genre-filter-options">
        <button
          type="button"
          className={selectedGenre === null ? 'genre-filter-button active' : 'genre-filter-button'}
          aria-pressed={selectedGenre === null}
          onClick={() => onSelectGenre(null)}
        >
          All genres
        </button>
        {genres.map((genre) => (
          <button
            type="button"
            className={selectedGenre === genre.slug ? 'genre-filter-button active' : 'genre-filter-button'}
            aria-pressed={selectedGenre === genre.slug}
            key={genre.slug}
            onClick={() => onSelectGenre(genre.slug)}
          >
            {genre.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export default GenreFilter
