export type Movie = {
  id: number
  slug: string
  title: string
  runtimeMinutes: number | null
  posterUrl: string | null
  backdropUrl: string | null
  genres: { id: number; slug: string; name: string }[]
  ageRating: { code: string; minAge: number; description: string } | null
}

export type MovieDetails = Movie & {
  releaseDate: string | null
  isComingSoon: boolean
  fromPrice: number | null
  formats: { id: number; slug: string; name: string; priceUplift: number }[]
  synopsis: string | null
  director: string | null
  cast: string | null
  availableDates: string[]
}
