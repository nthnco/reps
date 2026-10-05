import { useQuery } from '@tanstack/react-query'
import { listProblems } from './problems'

// Cache keys in one place, so invalidation can't drift from the queries.
export const queryKeys = {
  problems: ['problems'] as const,
}

export function useProblems() {
  return useQuery({ queryKey: queryKeys.problems, queryFn: listProblems })
}
