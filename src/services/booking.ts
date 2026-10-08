import type { AuthResult, BookingOrder, SeatHold, User } from '../types/booking'
import type { SeatMap } from '../types/session'
import { ApiError } from '../types/booking'

const API_BASE_URL = 'https://api.kinoxii.redberryinternship.ge/api'

type ApiEnvelope<T> = { data: T }

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    token?: string
    body?: object | FormData
  } = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' })
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  let body: string | FormData | undefined
  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body,
  })
  const responseText = await response.text()
  let result: Record<string, unknown> = {}

  if (responseText) {
    try {
      result = JSON.parse(responseText) as Record<string, unknown>
    } catch {
      if (response.ok) {
        throw new Error('The booking service returned an unreadable response.')
      }
    }
  }

  if (!response.ok) {
    const message = typeof result.message === 'string'
      ? result.message
      : `The booking service returned an error (${response.status}). Please try again.`
    const errors = result.errors && typeof result.errors === 'object'
      ? result.errors as Record<string, string[]>
      : undefined
    const contested = Array.isArray(result.contested)
      ? result.contested.filter((seat): seat is string => typeof seat === 'string')
      : undefined
    throw new ApiError(message, response.status, errors, contested)
  }

  return result as T
}

export async function getSeatMap(sessionId: number, token?: string): Promise<SeatMap> {
  const result = await request<ApiEnvelope<SeatMap>>(`/sessions/${sessionId}/seats`, { token })
  return result.data
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const result = await request<ApiEnvelope<AuthResult>>('/login', {
    method: 'POST',
    body: { email, password },
  })
  return result.data
}

export async function register(
  username: string,
  email: string,
  password: string,
  passwordConfirmation: string,
): Promise<AuthResult> {
  const body = new FormData()
  body.set('username', username)
  body.set('email', email)
  body.set('password', password)
  body.set('password_confirmation', passwordConfirmation)
  const result = await request<ApiEnvelope<AuthResult>>('/register', { method: 'POST', body })
  return result.data
}

export async function getCurrentUser(token: string): Promise<User> {
  const result = await request<ApiEnvelope<User>>('/me', { token })
  return result.data
}

export async function logout(token: string): Promise<void> {
  await request<unknown>('/logout', { method: 'POST', token })
}

export async function updateProfile(
  token: string,
  profile: { fullName: string; mobileNumber: string; dateOfBirth: string },
): Promise<User> {
  const body = new FormData()
  body.set('fullName', profile.fullName)
  body.set('mobileNumber', profile.mobileNumber)
  body.set('dateOfBirth', profile.dateOfBirth)
  const result = await request<ApiEnvelope<User>>('/profile', { method: 'PUT', token, body })
  return result.data
}

export async function createSeatHold(
  sessionId: number,
  token: string,
  seats: { seatId: number; ticketType: string }[],
): Promise<SeatHold> {
  const result = await request<ApiEnvelope<SeatHold>>(`/sessions/${sessionId}/holds`, {
    method: 'POST',
    token,
    body: { seats },
  })
  return result.data
}

export async function getSeatHold(holdId: string, token: string): Promise<SeatHold> {
  const result = await request<ApiEnvelope<SeatHold>>(`/holds/${encodeURIComponent(holdId)}`, { token })
  return result.data
}

export async function releaseSeatHold(holdId: string, token: string): Promise<void> {
  await request<unknown>(`/holds/${encodeURIComponent(holdId)}`, { method: 'DELETE', token })
}

export async function createOrder(
  token: string,
  order: {
    holdId: string
    fullName: string
    email: string
    mobileNumber: string
    cardNumber: string
    expiry: string
    cvv: string
  },
): Promise<BookingOrder> {
  const result = await request<ApiEnvelope<BookingOrder>>('/orders', {
    method: 'POST',
    token,
    body: order,
  })
  return result.data
}

export async function getTickets(
  token: string,
  filter: 'upcoming' | 'past',
): Promise<BookingOrder[]> {
  const result = await request<ApiEnvelope<BookingOrder[]>>(`/tickets?filter=${filter}`, { token })
  return result.data
}

export async function refundOrder(token: string, orderReference: string): Promise<BookingOrder> {
  const result = await request<ApiEnvelope<BookingOrder>>(`/orders/${encodeURIComponent(orderReference)}/refund`, {
    method: 'POST',
    token,
  })
  return result.data
}
