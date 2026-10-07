import { apiFetch } from './errors'
import type { PatternMasteryRead, ProfileSummaryRead } from './generated'

// Throws on failure: TanStack Query treats a thrown error as the query's error state.
export async function getPatternMastery(): Promise<PatternMasteryRead[]> {
  const response = await apiFetch('/api/patterns/mastery')
  if (!response.ok) {
    throw new Error(`Couldn't load pattern mastery (HTTP ${response.status}).`)
  }
  return (await response.json()) as PatternMasteryRead[]
}

export async function getProfileSummary(): Promise<ProfileSummaryRead> {
  const response = await apiFetch('/api/profile/summary')
  if (!response.ok) {
    throw new Error(`Couldn't load your profile summary (HTTP ${response.status}).`)
  }
  return (await response.json()) as ProfileSummaryRead
}
