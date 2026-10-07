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
