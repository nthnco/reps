import { apiFetch } from './errors'
import type { ActivityRead } from './generated'

// Throws on failure: TanStack Query treats a thrown error as the query's error state.
export async function getActivity(): Promise<ActivityRead> {
  const response = await apiFetch('/api/activity')
  if (!response.ok) {
    throw new Error(`Couldn't load activity (HTTP ${response.status}).`)
  }
  return (await response.json()) as ActivityRead
}
