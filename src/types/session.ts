import type { Movie } from './movie'

export type SessionFilters = {
  date: string
  venues: string[]
  formats: string[]
  languages: string[]
  bands: string[]
  search: string
  sort: string
  page: number
}

export type SessionFilterOptions = {
  venues: {
    id: number
    slug: string
    name: string
    city: string
    formats: { id: number; slug: string; name: string; priceUplift: number }[]
  }[]
  formats: { id: number; slug: string; name: string; priceUplift: number }[]
  languages: { id: number; slug: string; name: string; code: string }[]
  timeBands: { id: string; label: string }[]
  sorts: { id: string; label: string }[]
}

export type Session = {
  id: number
  startsAt: string
  date: string
  time: string
  timeBand: string
  price: number
  seatsLeft: number
  isSoldOut: boolean
  hall: { id: number; name: string }
  venue: { id: number; slug: string; name: string; city: string }
  format: { id: number; slug: string; name: string; priceUplift: number }
  language: { id: number; slug: string; name: string; code: string }
}

export type SessionGroup = {
  movie: Movie
  sessions: Session[]
}

export type SessionsResponse = {
  data: SessionGroup[]
  meta: {
    currentPage: number
    lastPage: number
    perPage: number
    totalSessions: number
    totalMovies: number
    date: string
  }
}
