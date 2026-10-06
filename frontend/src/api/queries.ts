import { useQuery } from '@tanstack/react-query'
import { listProblems } from './problems'
import { getTodaysQueue } from './queue'

// Cache keys in one place, so invalidation can't drift from the queries.
export const queryKeys = {
  problems: ['problems'] as const,
  queue: ['queue'] as const,
}

export function useProblems() {
  return useQuery({ queryKey: queryKeys.problems, queryFn: listProblems })
}

export function useTodaysQueue() {
  return useQuery({ queryKey: queryKeys.queue, queryFn: getTodaysQueue })
}
