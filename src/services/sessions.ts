import type { SessionFilterOptions, SessionFilters, SessionsResponse } from '../types/session'

const API_BASE_URL = 'https://api.kinoxii.redberryinternship.ge/api'

type FilterOptionsResponse = {
  data: SessionFilterOptions
}

let filterOptionsRequest: Promise<SessionFilterOptions> | undefined

export function getSessionFilterOptions(): Promise<SessionFilterOptions> {
  if (!filterOptionsRequest) {
    filterOptionsRequest = fetch(`${API_BASE_URL}/filter-options`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Could not load session filters (${response.status}). Please try again.`)
        }
        const result: FilterOptionsResponse = await response.json()
        return result.data
      })
      .catch((error: unknown) => {
        filterOptionsRequest = undefined
        throw error
      })
  }

  return filterOptionsRequest
}

export async function getSessions(filters: SessionFilters): Promise<SessionsResponse> {
  const parameters = new URLSearchParams({
    date: filters.date,
    sort: filters.sort,
    page: String(filters.page),
  })

  filters.venues.forEach((venue) => parameters.append('venues[]', venue))
  filters.formats.forEach((format) => parameters.append('formats[]', format))
  filters.languages.forEach((language) => parameters.append('languages[]', language))
  filters.bands.forEach((band) => parameters.append('bands[]', band))

  if (filters.search.trim()) {
    parameters.set('search', filters.search.trim())
  }

  const response = await fetch(`${API_BASE_URL}/sessions?${parameters}`)
  if (!response.ok) {
    throw new Error(`Could not load sessions (${response.status}). Please check your filters and try again.`)
  }

  const result: SessionsResponse = await response.json()
  return result
}
