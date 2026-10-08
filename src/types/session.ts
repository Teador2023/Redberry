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
  ticketTypes: TicketType[]
  maxSeatsPerOrder: number
  holdMinutes: number
}

export type TicketType = {
  id: number
  slug: 'adult' | 'child' | 'student'
  name: string
  priceRatio: number
  note: string | null
  blockedFromRatingAge: number | null
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

export type Seat = {
  id: number
  code: string
  label: string
  state: 'available' | 'sold' | 'held' | 'unavailable'
  aisleAfter: boolean
  isMine: boolean
}

export type SeatMap = {
  sessionId: number
  hall: {
    id: number
    name: string
    venue: { id: number; slug: string; name: string; city: string }
  }
  sections: {
    name: string
    rows: { label: string; seats: Seat[] }[]
  }[]
}
