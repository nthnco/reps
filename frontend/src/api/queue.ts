import { apiFetch } from './errors'
import type { QueueItem } from './generated'

// Throws on failure: TanStack Query treats a thrown error as the query's error state.
export async function getTodaysQueue(): Promise<QueueItem[]> {
  const response = await apiFetch('/api/queue')
  if (!response.ok) {
    throw new Error(`Couldn't load today's queue (HTTP ${response.status}).`)
  }
  return (await response.json()) as QueueItem[]
}
