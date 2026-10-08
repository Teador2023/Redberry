import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  getTickets,
  logout,
  login,
  refundOrder,
  register,
  updateProfile,
} from '../services/booking'
import { ApiError } from '../types/booking'
import type { AuthResult, BookingOrder, User } from '../types/booking'

type AccountPageProps = {
  user: User | null
  onUserChange: (user: User | null) => void
}

type Tab = 'upcoming' | 'past'
type LoadState = 'idle' | 'loading' | 'loaded' | 'error'
type FieldErrors = Record<string, string>

const TOKEN_STORAGE_KEY = 'kino-auth-token'

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

function formatPrice(price: number): string {
  return `₾${new Intl.NumberFormat('en').format(price)}`
}

function AccountPage({ user, onUserChange }: AccountPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [activeTab, setActiveTab] = useState<Tab>('upcoming')
  const [authState, setAuthState] = useState<LoadState>('idle')
  const [profileState, setProfileState] = useState<LoadState>('idle')
  const [ticketsState, setTicketsState] = useState<LoadState>('idle')
  const [orders, setOrders] = useState<BookingOrder[]>([])
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [auth, setAuth] = useState({ username: '', email: '', password: '', confirmation: '' })
  const [profile, setProfile] = useState(() => ({
    fullName: user?.fullName ?? '',
    mobileNumber: user?.mobileNumber ?? '',
    dateOfBirth: user?.dateOfBirth ?? '',
  }))
  const [retry, setRetry] = useState(0)

  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY)

  useEffect(() => {
    if (!token || !user) {
      return
    }

    let isCurrent = true
    getTickets(token, activeTab)
      .then((result) => {
        if (isCurrent) {
          setOrders(result)
          setTicketsState('loaded')
          setError('')
        }
      })
      .catch((loadError: unknown) => {
        if (!isCurrent) return
        if (loadError instanceof ApiError && loadError.status === 401) {
          sessionStorage.removeItem(TOKEN_STORAGE_KEY)
          onUserChange(null)
          setError('Your session expired. Sign in again to see your tickets.')
        } else {
          setError(loadError instanceof Error ? loadError.message : 'Could not load your tickets.')
          setTicketsState('error')
        }
      })

    return () => {
      isCurrent = false
    }
  }, [activeTab, onUserChange, retry, token, user])

  async function handleAuthentication(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setAuthState('loading')
    setError('')
    setFieldErrors({})
    try {
      const result: AuthResult = mode === 'login'
        ? await login(auth.email, auth.password)
        : await register(auth.username, auth.email, auth.password, auth.confirmation)
      sessionStorage.setItem(TOKEN_STORAGE_KEY, result.token)
      onUserChange(result.user)
      setAuthState('loaded')
      setActiveTab('upcoming')
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Could not sign in.')
      setAuthState('error')
      if (authError instanceof ApiError && authError.errors) {
        setFieldErrors(Object.fromEntries(
          Object.entries(authError.errors).map(([key, messages]) => [key, messages.join(' ')]),
        ))
      }
    }
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!token) return
    setProfileState('loading')
    setError('')
    setFieldErrors({})
    try {
      const updatedUser = await updateProfile(token, profile)
      onUserChange(updatedUser)
      setProfileState('loaded')
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : 'Could not save your profile.')
      setProfileState('error')
      if (profileError instanceof ApiError && profileError.errors) {
        setFieldErrors(Object.fromEntries(
          Object.entries(profileError.errors).map(([key, messages]) => [key, messages.join(' ')]),
        ))
      }
    }
  }

  async function handleLogout(): Promise<void> {
    if (!token) return
    setError('')
    try {
      await logout(token)
    } catch (logoutError) {
      if (!(logoutError instanceof ApiError && logoutError.status === 401)) {
        setError(logoutError instanceof Error ? logoutError.message : 'Could not sign out.')
        return
      }
    } finally {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY)
      onUserChange(null)
      setOrders([])
      setTicketsState('idle')
    }
  }

  async function handleRefund(order: BookingOrder): Promise<void> {
    if (!token || !order.isRefundable) return
    if (!window.confirm(`Refund order ${order.reference}? This cannot be undone.`)) return

    setError('')
    try {
      const updatedOrder = await refundOrder(token, order.reference)
      setOrders((currentOrders) => currentOrders.map((item) => (
        item.id === updatedOrder.id ? updatedOrder : item
      )))
    } catch (refundError) {
      setError(refundError instanceof Error ? refundError.message : 'Could not refund this order.')
    }
  }

  if (!user) {
    return (
      <section className="account-page" aria-labelledby="account-heading">
        <p className="section-kicker">Your Kino XII account</p>
        <h1 id="account-heading">{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        <p className="account-intro">Sign in to manage your profile and movie tickets.</p>
        {error && <p className="booking-message" role="alert">{error}</p>}
        <form className="account-form" onSubmit={(event) => void handleAuthentication(event)}>
          {mode === 'register' && (
            <label>
              Username
              <input
                required
                minLength={3}
                value={auth.username}
                onChange={(event) => setAuth({ ...auth, username: event.target.value })}
                autoComplete="username"
              />
              {fieldErrors.username && <small>{fieldErrors.username}</small>}
            </label>
          )}
          <label>
            Email
            <input
              required
              type="email"
              value={auth.email}
              onChange={(event) => setAuth({ ...auth, email: event.target.value })}
              autoComplete="email"
            />
            {fieldErrors.email && <small>{fieldErrors.email}</small>}
          </label>
          <label>
            Password
            <input
              required
              minLength={3}
              type="password"
              value={auth.password}
              onChange={(event) => setAuth({ ...auth, password: event.target.value })}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {fieldErrors.password && <small>{fieldErrors.password}</small>}
          </label>
          {mode === 'register' && (
            <label>
              Confirm password
              <input
                required
                minLength={3}
                type="password"
                value={auth.confirmation}
                onChange={(event) => setAuth({ ...auth, confirmation: event.target.value })}
                autoComplete="new-password"
              />
              {fieldErrors.password_confirmation && <small>{fieldErrors.password_confirmation}</small>}
            </label>
          )}
          <button type="submit" className="primary-button" disabled={authState === 'loading'}>
            {authState === 'loading' ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p className="account-switch">
          {mode === 'login' ? 'New to Kino XII?' : 'Already have an account?'}
          {' '}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError('')
              setFieldErrors({})
            }}
          >
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </section>
    )
  }

  return (
    <section className="account-page" aria-labelledby="account-heading">
      <div className="account-heading">
        <div>
          <p className="section-kicker">Your Kino XII account</p>
          <h1 id="account-heading">{user.fullName || user.username}</h1>
          <p>{user.email}{user.age !== null ? ` · ${user.age} years old` : ''}</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => void handleLogout()}>
          Sign out
        </button>
      </div>

      {error && <p className="booking-message" role="alert">{error}</p>}

      <section className="account-profile" aria-labelledby="profile-heading">
        <div className="account-section-heading">
          <div>
            <h2 id="profile-heading">Profile</h2>
            <p>Keep your contact details up to date for bookings.</p>
          </div>
          <span className={user.profileComplete ? 'profile-status complete' : 'profile-status incomplete'}>
            {user.profileComplete ? 'Complete' : 'Needs details'}
          </span>
        </div>
        <form className="account-form profile-form" onSubmit={(event) => void handleProfileSave(event)}>
          <label>
            Full name
            <input
              required
              minLength={3}
              maxLength={50}
              value={profile.fullName}
              onChange={(event) => setProfile({ ...profile, fullName: event.target.value })}
              autoComplete="name"
            />
            {fieldErrors.fullName && <small>{fieldErrors.fullName}</small>}
          </label>
          <label>
            Georgian mobile number
            <input
              required
              value={profile.mobileNumber}
              onChange={(event) => setProfile({ ...profile, mobileNumber: event.target.value })}
              placeholder="599 123 456"
              autoComplete="tel"
            />
            {fieldErrors.mobileNumber && <small>{fieldErrors.mobileNumber}</small>}
          </label>
          <label>
            Date of birth
            <input
              required
              type="date"
              value={profile.dateOfBirth}
              onChange={(event) => setProfile({ ...profile, dateOfBirth: event.target.value })}
              autoComplete="bday"
            />
            {fieldErrors.dateOfBirth && <small>{fieldErrors.dateOfBirth}</small>}
          </label>
          <button type="submit" className="primary-button" disabled={profileState === 'loading'}>
            {profileState === 'loading' ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </section>

      <section className="account-tickets" aria-labelledby="tickets-heading">
        <div className="account-section-heading">
          <div>
            <p className="section-kicker">Your bookings</p>
            <h2 id="tickets-heading">My tickets</h2>
          </div>
          <div className="ticket-tabs" role="tablist" aria-label="Ticket history">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'upcoming'}
              className={activeTab === 'upcoming' ? 'ticket-tab active' : 'ticket-tab'}
              onClick={() => {
                setTicketsState('loading')
                setActiveTab('upcoming')
              }}
            >
              Upcoming
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'past'}
              className={activeTab === 'past' ? 'ticket-tab active' : 'ticket-tab'}
              onClick={() => {
                setTicketsState('loading')
                setActiveTab('past')
              }}
            >
              Past
            </button>
          </div>
        </div>

        {(ticketsState === 'loading' || ticketsState === 'idle') && (
          <p className="load-state" role="status">Loading tickets…</p>
        )}
        {ticketsState === 'error' && (
          <button type="button" className="secondary-button" onClick={() => {
            setTicketsState('loading')
            setRetry((value) => value + 1)
          }}>
            Try loading again
          </button>
        )}
        {ticketsState === 'loaded' && orders.length === 0 && (
          <p className="load-state">No {activeTab} tickets yet.</p>
        )}
        {ticketsState === 'loaded' && orders.length > 0 && (
          <div className="ticket-list">
            {orders.map((order) => (
              <article className="ticket-card" key={order.id}>
                <div className="ticket-card-heading">
                  <div>
                    <p className="ticket-reference">Order {order.reference}</p>
                    <h3>{order.session.movie.title}</h3>
                  </div>
                  <span className={order.status === 'refunded' ? 'ticket-status refunded' : 'ticket-status'}>
                    {order.status === 'refunded' ? 'Refunded' : order.isUpcoming ? 'Upcoming' : 'Watched'}
                  </span>
                </div>
                <p className="ticket-session-meta">
                  {formatDate(order.session.startsAt)} · {order.session.venue.name} · Hall {order.session.hall.name}
                </p>
                <p className="ticket-session-meta">
                  {order.session.format.name} · {order.session.language.name} · {order.session.movie.ageRating?.code ?? 'Unrated'}
                </p>
                <div className="ticket-seats">
                  {order.tickets.map((ticket) => (
                    <div className="ticket-seat" key={ticket.id}>
                      <span><strong>{ticket.seatCode}</strong> · {ticket.ticketType.name}</span>
                      <span>{formatPrice(ticket.price)}</span>
                    </div>
                  ))}
                </div>
                <div className="ticket-card-footer">
                  <span>Total <strong>{formatPrice(order.totalPrice)}</strong></span>
                  {order.status === 'paid' && order.isUpcoming && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={!order.isRefundable}
                      title={order.isRefundable ? 'Request a refund' : 'Refunds close 2 hours before the session.'}
                      onClick={() => void handleRefund(order)}
                    >
                      {order.isRefundable ? 'Refund order' : 'Refund unavailable'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

export default AccountPage
