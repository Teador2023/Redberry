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
  totalPrice: number
  paidAt: string
  cardLastFour: string
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
