import { apiFetch } from './errors'
import type { Pace, PlanRead } from './generated'

// Throws on failure: TanStack Query treats a thrown error as the query's error state.
export async function getTodaysPlan(pace: Pace): Promise<PlanRead> {
  const response = await apiFetch(`/api/plan/today?pace=${pace}`)
  if (!response.ok) {
    throw new Error(`Couldn't load today's plan (HTTP ${response.status}).`)
  }
  return (await response.json()) as PlanRead
}
