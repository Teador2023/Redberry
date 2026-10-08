import type { Movie } from './movie'

export type User = {
  id: number
  username: string
  email: string
  avatar: string | null
  fullName: string | null
  mobileNumber: string | null
  dateOfBirth: string | null
  age: number | null
  profileComplete: boolean
}

export type AuthResult = {
  user: User
  token: string
}

export type HeldSeat = {
  seatId: number
  code: string
  ticketType: { slug: string; name: string }
  price: number
}

export type SeatHold = {
  holdId: string
  sessionId: number
  expiresAt: string
  secondsRemaining: number
  isLive: boolean
  subtotal: number
  seats: HeldSeat[]
}

export type BookingOrder = {
  id: number
  reference: string
  status: 'paid' | 'refunded'
  isUpcoming: boolean
  isRefundable: boolean
  totalPrice: number
  paidAt: string
  refundedAt: string | null
  cardLastFour: string
  contact: { fullName: string; email: string; mobileNumber: string }
  session: {
    id: number
    startsAt: string
    date: string
    time: string
    price: number
    hall: { id: number; name: string }
    venue: { id: number; name: string; city: string }
    format: { id: number; name: string }
    language: { id: number; name: string }
    movie: Movie
  }
  tickets: {
    id: number
    seatCode: string
    ticketType: { slug: string; name: string }
    price: number
  }[]
}

export class ApiError extends Error {
  status: number
  errors?: Record<string, string[]>
  contested?: string[]

  constructor(
    message: string,
    status: number,
    errors?: Record<string, string[]>,
    contested?: string[],
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
    this.contested = contested
  }
}
