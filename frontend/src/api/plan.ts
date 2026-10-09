import { apiFetch } from './errors'
import type { PlanRead } from './generated'

// Throws on failure: TanStack Query treats a thrown error as the query's error state.
export async function getTodaysPlan(): Promise<PlanRead> {
  const response = await apiFetch('/api/plan/today')
  if (!response.ok) {
    throw new Error(`Couldn't load today's plan (HTTP ${response.status}).`)
  }
  return (await response.json()) as PlanRead
}
