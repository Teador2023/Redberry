import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createOrder,
  createSeatHold,
  getCurrentUser,
  getSeatHold,
  getSeatMap,
  login,
  register,
  releaseSeatHold,
  updateProfile,
} from '../services/booking'
import { getSessionFilterOptions } from '../services/sessions'
import { ApiError } from '../types/booking'
import type { AuthResult, BookingOrder, SeatHold, User } from '../types/booking'
import type { Movie } from '../types/movie'
import type { Seat, SeatMap, Session, SessionFilterOptions, TicketType } from '../types/session'

type BookingDialogProps = {
  movie: Movie
  session: Session
  onClose: () => void
}

type Stage = 'seats' | 'auth' | 'profile' | 'checkout' | 'complete'
type AuthMode = 'login' | 'register'
type FieldErrors = Record<string, string>

const TOKEN_STORAGE_KEY = 'kino-auth-token'

function holdStorageKey(sessionId: number): string {
  return `kino-hold-${sessionId}`
}

function formatPrice(price: number): string {
  return `₾${new Intl.NumberFormat('en').format(price)}`
}

function formatSessionDate(date: string): string {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

function getErrorFields(error: ApiError): FieldErrors {
  if (!error.errors) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(error.errors).map(([field, messages]) => [field, messages.join(' ')]),
  )
}

function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

function BookingDialog({ movie, session, onClose }: BookingDialogProps) {
  const [stage, setStage] = useState<Stage>('seats')
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authReturn, setAuthReturn] = useState<'hold' | 'checkout'>('hold')
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_STORAGE_KEY))
  const [user, setUser] = useState<User | null>(null)
  const [options, setOptions] = useState<SessionFilterOptions | null>(null)
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null)
  const [selectedTickets, setSelectedTickets] = useState<Record<number, string>>({})
  const [hold, setHold] = useState<SeatHold | null>(null)
  const [order, setOrder] = useState<BookingOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadRetry, setLoadRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirmation: '',
  })
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    mobileNumber: '',
    dateOfBirth: '',
  })
  const [contactForm, setContactForm] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
  })

  useEffect(() => {
    let isCurrent = true

    async function loadBookingData() {
      try {
        const filterOptions = await getSessionFilterOptions()
        if (!isCurrent) return
        setOptions(filterOptions)

        let activeToken = sessionStorage.getItem(TOKEN_STORAGE_KEY)
        let activeUser: User | null = null
        if (activeToken) {
          try {
            activeUser = await getCurrentUser(activeToken)
          } catch (error) {
            if (!isApiError(error) || error.status !== 401) {
              throw error
            }
            sessionStorage.removeItem(TOKEN_STORAGE_KEY)
            activeToken = null
          }
        }
        if (!isCurrent) return
        setToken(activeToken)
        setUser(activeUser)

        const map = await getSeatMap(session.id, activeToken ?? undefined)
        if (!isCurrent) return
        setSeatMap(map)

        const savedHoldId = activeToken && sessionStorage.getItem(holdStorageKey(session.id))
        if (savedHoldId && activeToken) {
          try {
            const savedHold = await getSeatHold(savedHoldId, activeToken)
            if (!isCurrent) return
            if (savedHold.isLive && Date.parse(savedHold.expiresAt) > Date.now()) {
              setHold(savedHold)
              setSelectedTickets(Object.fromEntries(
                savedHold.seats.map((seat) => [seat.seatId, seat.ticketType.slug]),
              ))
              setStage('checkout')
              setContactForm((current) => ({
                ...current,
                fullName: activeUser?.fullName ?? '',
                email: activeUser?.email ?? '',
                mobileNumber: activeUser?.mobileNumber ?? '',
              }))
            } else {
              sessionStorage.removeItem(holdStorageKey(session.id))
              setMessage('Your previous seat hold expired. Please select seats again.')
            }
          } catch (error) {
            if (!isApiError(error) || (error.status !== 401 && error.status !== 404)) {
              throw error
            }
            sessionStorage.removeItem(holdStorageKey(session.id))
          }
        }
      } catch (error) {
        if (isCurrent) {
          setLoadError(error instanceof Error ? error.message : 'Could not load the seat map. Please try again.')
        }
      } finally {
        if (isCurrent) setLoading(false)
      }
    }

    void loadBookingData()
    return () => {
      isCurrent = false
    }
  }, [loadRetry, session.id])

  const allowedTicketTypes = useMemo(() => {
    if (!options) return []
    return options.ticketTypes.filter((ticketType) => (
      ticketType.blockedFromRatingAge === null
      || movie.ageRating === null
      || movie.ageRating.minAge < ticketType.blockedFromRatingAge
    ))
  }, [movie.ageRating, options])

  const selectedSeatRows = useMemo(() => {
    if (!seatMap) return []
    return seatMap.sections.flatMap((section) => section.rows.flatMap((row) => (
      row.seats
        .filter((seat) => Object.prototype.hasOwnProperty.call(selectedTickets, seat.id))
        .map((seat) => ({
          seat,
          section: section.name,
          ticketType: options?.ticketTypes.find(
            (type) => type.slug === selectedTickets[seat.id],
          ),
        }))
    )))
  }, [options?.ticketTypes, seatMap, selectedTickets])

  const selectedTotal = selectedSeatRows.reduce(
    (total, item) => total + session.price * (item.ticketType?.priceRatio ?? 0),
    0,
  )

  async function refreshSeatMap(authToken = token): Promise<void> {
    try {
      const map = await getSeatMap(session.id, authToken ?? undefined)
      setSeatMap(map)
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not refresh the seat map.')
    }
  }

  function changeSeat(seat: Seat): void {
    if (seat.state !== 'available' && !seat.isMine) return

    setMessage('')
    setFieldErrors({})
    const isSelected = Object.prototype.hasOwnProperty.call(selectedTickets, seat.id)
    if (!isSelected && options && Object.keys(selectedTickets).length >= options.maxSeatsPerOrder) {
      setMessage(`You can select up to ${options.maxSeatsPerOrder} seats per order.`)
      return
    }
    setSelectedTickets((current) => {
      if (Object.prototype.hasOwnProperty.call(current, seat.id)) {
        const next = { ...current }
        delete next[seat.id]
        return next
      }
      return { ...current, [seat.id]: 'adult' }
    })
  }

  async function reserveSelectedSeats(authToken: string, contactUser = user): Promise<void> {
    if (!options || Object.keys(selectedTickets).length === 0) {
      setMessage('Select at least one available seat to continue.')
      return
    }

    setBusy(true)
    setMessage('')
    setFieldErrors({})
    try {
      const newHold = await createSeatHold(
        session.id,
        authToken,
        Object.entries(selectedTickets).map(([seatId, ticketType]) => ({
          seatId: Number(seatId),
          ticketType,
        })),
      )
      sessionStorage.setItem(holdStorageKey(session.id), newHold.holdId)
      setHold(newHold)
      setSecondsRemaining(Math.max(0, Math.ceil((Date.parse(newHold.expiresAt) - Date.now()) / 1000)))
      setContactForm((current) => ({
        ...current,
        fullName: contactUser?.fullName ?? current.fullName,
        email: contactUser?.email ?? current.email,
        mobileNumber: contactUser?.mobileNumber ?? current.mobileNumber,
      }))
      setStage('checkout')
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY)
        setToken(null)
        setUser(null)
        setAuthReturn('hold')
        setStage('auth')
        setMessage('Please sign in again to reserve these seats.')
      } else if (isApiError(error) && error.status === 409) {
        const contestedSeats = error.contested ?? []
        const contestedLabel = contestedSeats.length > 0
          ? `Seats ${contestedSeats.join(', ')} were just taken.`
          : error.message
        setSelectedTickets((current) => {
          const next = { ...current }
          for (const [seatId] of Object.entries(current)) {
            const seat = seatMap?.sections
              .flatMap((section) => section.rows.flatMap((row) => row.seats))
              .find((candidate) => candidate.id === Number(seatId))
            if (seat && contestedSeats.includes(seat.code)) delete next[Number(seatId)]
          }
          return next
        })
        setMessage(`${contestedLabel} Your other seats remain selected.`)
        await refreshSeatMap(authToken)
      } else if (isApiError(error)) {
        setMessage(error.message)
        setFieldErrors(getErrorFields(error))
        if (error.status === 422 && !error.errors && /profile/i.test(error.message) && user) {
          setAuthReturn('hold')
          setProfileForm({
            fullName: user.fullName ?? '',
            mobileNumber: user.mobileNumber ?? '',
            dateOfBirth: user.dateOfBirth ?? '',
          })
          setStage('profile')
        }
      } else {
        setMessage(error instanceof Error ? error.message : 'Could not reserve those seats. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function continueAfterAuthentication(result: AuthResult): Promise<void> {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, result.token)
    setToken(result.token)
    setUser(result.user)
    setMessage('')
    setFieldErrors({})
    setContactForm((current) => ({
      ...current,
      fullName: result.user.fullName ?? current.fullName,
      email: result.user.email,
      mobileNumber: result.user.mobileNumber ?? current.mobileNumber,
    }))

    if (!result.user.profileComplete) {
      setProfileForm({
        fullName: result.user.fullName ?? '',
        mobileNumber: result.user.mobileNumber ?? '',
        dateOfBirth: result.user.dateOfBirth ?? '',
      })
      setStage('profile')
      return
    }
    if (authReturn === 'checkout') {
      setStage('checkout')
      if (hold) await placeOrder(result.token)
      return
    }
    await reserveSelectedSeats(result.token, result.user)
  }

  async function submitAuthentication(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setFieldErrors({})
    try {
      const result = authMode === 'login'
        ? await login(authForm.email, authForm.password)
        : await register(
          authForm.username,
          authForm.email,
          authForm.password,
          authForm.passwordConfirmation,
        )
      await continueAfterAuthentication(result)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign in. Please try again.')
      if (isApiError(error)) setFieldErrors(getErrorFields(error))
    } finally {
      setBusy(false)
    }
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!token) {
      setStage('auth')
      setMessage('Sign in to finish your profile and continue booking.')
      return
    }
    setBusy(true)
    setMessage('')
    setFieldErrors({})
    try {
      const updatedUser = await updateProfile(token, profileForm)
      setUser(updatedUser)
      if (authReturn === 'checkout' && hold) {
        const updatedContact = {
          ...contactForm,
          fullName: updatedUser.fullName ?? contactForm.fullName,
          email: updatedUser.email,
          mobileNumber: updatedUser.mobileNumber ?? contactForm.mobileNumber,
        }
        setContactForm(updatedContact)
        setStage('checkout')
        await placeOrder(token, updatedContact)
      } else {
        await reserveSelectedSeats(token, updatedUser)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save your profile.')
      if (isApiError(error)) setFieldErrors(getErrorFields(error))
    } finally {
      setBusy(false)
    }
  }

  async function placeOrder(
    authToken: string | null = token,
    contact = contactForm,
  ): Promise<void> {
    if (!authToken || !hold) {
      setMessage('Your seat hold is no longer available. Please choose seats again.')
      setHold(null)
      setStage('seats')
      return
    }

    setBusy(true)
    setMessage('')
    setFieldErrors({})
    try {
      const completedOrder = await createOrder(authToken, { ...contact, holdId: hold.holdId })
      sessionStorage.removeItem(holdStorageKey(session.id))
      setOrder(completedOrder)
      setHold(null)
      setStage('complete')
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY)
        setToken(null)
        setUser(null)
        setAuthReturn('checkout')
        setStage('auth')
        setMessage('Please sign in again. Your seat hold is still active.')
      } else if (isApiError(error) && error.status === 409) {
        const contestedSeats = error.contested ?? []
        sessionStorage.removeItem(holdStorageKey(session.id))
        setHold(null)
        setSelectedTickets((current) => {
          const next = { ...current }
          for (const [seatId] of Object.entries(current)) {
            const seat = seatMap?.sections
              .flatMap((section) => section.rows.flatMap((row) => row.seats))
              .find((candidate) => candidate.id === Number(seatId))
            if (seat && contestedSeats.includes(seat.code)) delete next[Number(seatId)]
          }
          return next
        })
        setStage('seats')
        setMessage(`${contestedSeats.length ? `Seats ${contestedSeats.join(', ')} were just sold.` : error.message} Please review your selection.`)
        await refreshSeatMap(authToken)
      } else if (isApiError(error)) {
        setMessage(error.message)
        setFieldErrors(getErrorFields(error))
        if (error.status === 422 && !error.errors && /hold time expired/i.test(error.message)) {
          sessionStorage.removeItem(holdStorageKey(session.id))
          setHold(null)
          setSelectedTickets({})
          setStage('seats')
          await refreshSeatMap(token)
        }
      } else {
        setMessage(error instanceof Error ? error.message : 'Could not complete your order. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  const closeBooking = useCallback(async (): Promise<void> => {
    if (hold?.isLive && token) {
      setBusy(true)
      setMessage('')
      try {
        await releaseSeatHold(hold.holdId, token)
        sessionStorage.removeItem(holdStorageKey(session.id))
        setHold(null)
        onClose()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not release the held seats. Please try again.')
      } finally {
        setBusy(false)
      }
      return
    }
    onClose()
  }, [hold, onClose, session.id, token])

  async function returnToSeatSelection(): Promise<void> {
    await refreshSeatMap(token)
    setStage('seats')
    setMessage('Your current seats remain held. Continuing will update the hold.')
  }

  useEffect(() => {
    if ((stage !== 'checkout' && stage !== 'seats') || !hold) return

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((Date.parse(hold.expiresAt) - Date.now()) / 1000))
      setSecondsRemaining(remaining)
      if (remaining === 0) {
        sessionStorage.removeItem(holdStorageKey(session.id))
        setHold(null)
        setSelectedTickets({})
        setStage('seats')
        setMessage('Your hold expired. Please select seats again.')
        void getSeatMap(session.id, token ?? undefined)
          .then(setSeatMap)
          .catch((error: unknown) => {
            setLoadError(error instanceof Error ? error.message : 'Could not refresh the seat map.')
          })
      }
    }

    updateCountdown()
    const interval = window.setInterval(updateCountdown, 500)
    return () => window.clearInterval(interval)
  }, [hold, session.id, stage, token])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) void closeBooking()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [busy, closeBooking])

  function setTicketType(seatId: number, ticketType: string): void {
    setSelectedTickets((current) => ({ ...current, [seatId]: ticketType }))
  }

  const formattedRemaining = `${String(Math.floor(secondsRemaining / 60)).padStart(2, '0')}:${String(secondsRemaining % 60).padStart(2, '0')}`

  return (
    <div className="booking-backdrop">
      <section className="booking-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <header className="booking-header">
          <div>
            <p className="section-kicker">Reserve your seats</p>
            <h2 id="booking-title">{movie.title}</h2>
            <p>{formatSessionDate(session.startsAt)} · {session.venue.name} · Hall {session.hall.name}</p>
          </div>
          <button
            type="button"
            className="booking-close"
            onClick={() => void closeBooking()}
            disabled={busy}
            aria-label="Close booking"
          >
            ×
          </button>
        </header>

        {loadError && (
          <div className="booking-message error-state" role="alert">
            <p>{loadError}</p>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setLoading(true)
                setLoadError('')
                setLoadRetry((retry) => retry + 1)
              }}
            >
              Try again
            </button>
          </div>
        )}
        {message && <p className="booking-message" role="alert">{message}</p>}

        {loading ? (
          <p className="load-state" role="status">Loading hall seats…</p>
        ) : stage === 'seats' ? (
          <div className="booking-seats-stage">
            {options && seatMap && (
              <>
                <p className="seat-cap-note">
                  Select up to {options.maxSeatsPerOrder} seats. Holds last {options.holdMinutes} minutes.
                </p>
                {hold?.isLive && (
                  <p className="hold-countdown" role="status">
                    Your current seats are held for <strong>{formattedRemaining}</strong>.
                  </p>
                )}
                <div className="seat-legend" aria-label="Seat availability">
                  <span><i className="seat-legend-available" /> Available</span>
                  <span><i className="seat-legend-selected" /> Selected</span>
                  <span><i className="seat-legend-held" /> Held</span>
                  <span><i className="seat-legend-sold" /> Sold</span>
                </div>
                <div className="screen-label">SCREEN</div>
                <div className="seat-sections">
                  {seatMap.sections.map((section) => (
                    <section className="seat-section" key={section.name} aria-label={section.name}>
                      <h3>{section.name}</h3>
                      {section.rows.map((row) => (
                        <div className="seat-row" key={`${section.name}-${row.label}`}>
                          <span className="seat-row-label">{row.label}</span>
                          <div className="seat-row-seats">
                            {row.seats.map((seat) => (
                              <span className="seat-position" key={seat.id}>
                                {seat.state === 'unavailable' ? (
                                  <span className="seat-gap" aria-hidden="true" />
                                ) : (
                                  <button
                                    type="button"
                                    className={[
                                      'seat-button',
                                      `seat-${seat.state}`,
                                      Object.prototype.hasOwnProperty.call(selectedTickets, seat.id) || seat.isMine ? 'seat-selected' : '',
                                    ].filter(Boolean).join(' ')}
                                    disabled={seat.state !== 'available' && !seat.isMine}
                                    aria-label={`Row ${row.label}, seat ${seat.label}, ${seat.isMine ? 'yours' : seat.state}`}
                                    aria-pressed={Object.prototype.hasOwnProperty.call(selectedTickets, seat.id) || seat.isMine}
                                    title={`${row.label}${seat.label} · ${seat.state}`}
                                    onClick={() => changeSeat(seat)}
                                  >
                                    {seat.label}
                                  </button>
                                )}
                                {seat.aisleAfter && <span className="seat-aisle" aria-hidden="true" />}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </section>
                  ))}
                </div>

                {selectedSeatRows.length > 0 && (
                  <div className="booking-selection">
                    <h3>Your selection</h3>
                    {selectedSeatRows.map(({ seat, section, ticketType }) => (
                      <label className="booking-ticket-row" key={seat.id}>
                        <span>{section} · {seat.code}</span>
                        <select
                          aria-label={`Ticket type for seat ${seat.code}`}
                          value={selectedTickets[seat.id]}
                          onChange={(event) => setTicketType(seat.id, event.target.value)}
                        >
                          {allowedTicketTypes.map((type: TicketType) => (
                            <option key={type.id} value={type.slug}>
                              {type.name} · {formatPrice(session.price * type.priceRatio)}
                            </option>
                          ))}
                        </select>
                        <strong>{formatPrice(session.price * (ticketType?.priceRatio ?? 0))}</strong>
                      </label>
                    ))}
                    <div className="booking-total">
                      <span>Estimated total</span>
                      <strong>{formatPrice(selectedTotal)}</strong>
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="booking-actions">
              <button type="button" className="secondary-button" onClick={() => void closeBooking()} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={busy || loading || !options || Object.keys(selectedTickets).length === 0}
                onClick={() => {
                  if (!token) {
                    setAuthReturn('hold')
                    setStage('auth')
                  } else if (!user?.profileComplete) {
                    setAuthReturn('hold')
                    setProfileForm({
                      fullName: user?.fullName ?? '',
                      mobileNumber: user?.mobileNumber ?? '',
                      dateOfBirth: user?.dateOfBirth ?? '',
                    })
                    setStage('profile')
                  } else {
                    void reserveSelectedSeats(token)
                  }
                }}
              >
                {busy ? 'Reserving…' : 'Continue to checkout'}
              </button>
            </div>
          </div>
        ) : stage === 'auth' ? (
          <form className="booking-form" onSubmit={(event) => void submitAuthentication(event)}>
            <h3>{authMode === 'login' ? 'Sign in to reserve seats' : 'Create your account'}</h3>
            {authMode === 'register' && (
              <label>
                Username
                <input
                  required
                  minLength={3}
                  value={authForm.username}
                  onChange={(event) => setAuthForm({ ...authForm, username: event.target.value })}
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
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
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
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
              />
              {fieldErrors.password && <small>{fieldErrors.password}</small>}
            </label>
            {authMode === 'register' && (
              <label>
                Confirm password
                <input
                  required
                  minLength={3}
                  type="password"
                  value={authForm.passwordConfirmation}
                  onChange={(event) => setAuthForm({ ...authForm, passwordConfirmation: event.target.value })}
                  autoComplete="new-password"
                />
                {fieldErrors.password_confirmation && <small>{fieldErrors.password_confirmation}</small>}
              </label>
            )}
            <div className="booking-actions">
              <button type="button" className="secondary-button" onClick={() => setStage('seats')} disabled={busy}>
                Back to seats
              </button>
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </div>
            <p className="booking-form-switch">
              {authMode === 'login' ? 'New to Kino XII?' : 'Already have an account?'}
              {' '}
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login')
                  setMessage('')
                  setFieldErrors({})
                }}
              >
                {authMode === 'login' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </form>
        ) : stage === 'profile' ? (
          <form className="booking-form" onSubmit={(event) => void submitProfile(event)}>
            <h3>Complete your profile to book</h3>
            <p className="booking-help">Your name, mobile number, and date of birth are required for ticket eligibility.</p>
            <label>
              Full name
              <input
                required
                minLength={3}
                maxLength={50}
                value={profileForm.fullName}
                onChange={(event) => setProfileForm({ ...profileForm, fullName: event.target.value })}
                autoComplete="name"
              />
              {fieldErrors.fullName && <small>{fieldErrors.fullName}</small>}
            </label>
            <label>
              Georgian mobile number
              <input
                required
                value={profileForm.mobileNumber}
                onChange={(event) => setProfileForm({ ...profileForm, mobileNumber: event.target.value })}
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
                value={profileForm.dateOfBirth}
                onChange={(event) => setProfileForm({ ...profileForm, dateOfBirth: event.target.value })}
                autoComplete="bday"
              />
              {fieldErrors.dateOfBirth && <small>{fieldErrors.dateOfBirth}</small>}
            </label>
            <div className="booking-actions">
              <button type="button" className="secondary-button" onClick={() => setStage('seats')} disabled={busy}>
                Back to seats
              </button>
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? 'Saving…' : 'Save profile and continue'}
              </button>
            </div>
          </form>
        ) : stage === 'checkout' && hold ? (
          <div className="booking-checkout">
            <div className="hold-countdown" role="status">
              Complete your order in <strong>{formattedRemaining}</strong>
            </div>
            <button
              type="button"
              className="text-button booking-change-seats"
              onClick={() => void returnToSeatSelection()}
              disabled={busy}
            >
              Change seats
            </button>
            <div className="checkout-summary">
              <h3>Held seats</h3>
              {hold.seats.map((seat) => (
                <div className="checkout-ticket-row" key={seat.seatId}>
                  <span>{seat.code} · {seat.ticketType.name}</span>
                  <strong>{formatPrice(seat.price)}</strong>
                </div>
              ))}
              <div className="booking-total">
                <span>Total</span>
                <strong>{formatPrice(hold.subtotal)}</strong>
              </div>
            </div>
            <form className="booking-form" onSubmit={(event) => {
              event.preventDefault()
              void placeOrder(token)
            }}>
              <h3>Contact and payment</h3>
              <label>
                Full name
                <input
                  required
                  minLength={3}
                  maxLength={50}
                  value={contactForm.fullName}
                  onChange={(event) => setContactForm({ ...contactForm, fullName: event.target.value })}
                  autoComplete="name"
                />
                {fieldErrors.fullName && <small>{fieldErrors.fullName}</small>}
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={contactForm.email}
                  onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })}
                  autoComplete="email"
                />
                {fieldErrors.email && <small>{fieldErrors.email}</small>}
              </label>
              <label>
                Georgian mobile number
                <input
                  required
                  value={contactForm.mobileNumber}
                  onChange={(event) => setContactForm({ ...contactForm, mobileNumber: event.target.value })}
                  placeholder="599 123 456"
                  autoComplete="tel"
                />
                {fieldErrors.mobileNumber && <small>{fieldErrors.mobileNumber}</small>}
              </label>
              <label>
                Card number
                <input
                  required
                  inputMode="numeric"
                  autoComplete="cc-number"
                  maxLength={19}
                  value={contactForm.cardNumber}
                  onChange={(event) => setContactForm({ ...contactForm, cardNumber: event.target.value })}
                  placeholder="4242 4242 4242 4242"
                />
                {fieldErrors.cardNumber && <small>{fieldErrors.cardNumber}</small>}
              </label>
              <div className="booking-form-row">
                <label>
                  Expiry (MM/YY)
                  <input
                    required
                    autoComplete="cc-exp"
                    maxLength={5}
                    value={contactForm.expiry}
                    onChange={(event) => setContactForm({ ...contactForm, expiry: event.target.value })}
                    placeholder="09/30"
                  />
                  {fieldErrors.expiry && <small>{fieldErrors.expiry}</small>}
                </label>
                <label>
                  CVV
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    maxLength={4}
                    value={contactForm.cvv}
                    onChange={(event) => setContactForm({ ...contactForm, cvv: event.target.value })}
                    placeholder="123"
                  />
                  {fieldErrors.cvv && <small>{fieldErrors.cvv}</small>}
                </label>
              </div>
              <p className="booking-help">Payment is simulated by the cinema API. Card details are not stored.</p>
              <div className="booking-actions">
                <button type="button" className="secondary-button" onClick={() => void closeBooking()} disabled={busy}>
                  Cancel and release seats
                </button>
                <button type="submit" className="primary-button" disabled={busy || secondsRemaining <= 0}>
                  {busy ? 'Completing order…' : `Pay ${formatPrice(hold.subtotal)}`}
                </button>
              </div>
            </form>
          </div>
        ) : stage === 'complete' && order ? (
          <div className="booking-confirmation">
            <p className="eyebrow">Booking confirmed</p>
            <h3>Your movie night is booked.</h3>
            <p>Order reference <strong>{order.reference}</strong></p>
            <p>{formatSessionDate(session.startsAt)} · {session.venue.name} · Hall {session.hall.name}</p>
            <div className="checkout-summary">
              {order.tickets.map((ticket) => (
                <div className="checkout-ticket-row" key={ticket.id}>
                  <span>{ticket.seatCode} · {ticket.ticketType.name}</span>
                  <strong>{formatPrice(ticket.price)}</strong>
                </div>
              ))}
              <div className="booking-total">
                <span>Paid</span>
                <strong>{formatPrice(order.totalPrice)}</strong>
              </div>
            </div>
            <button type="button" className="primary-button" onClick={onClose}>Done</button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default BookingDialog
