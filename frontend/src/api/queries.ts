import { useQuery } from '@tanstack/react-query'
import { getMe } from './auth'
import { listProblems } from './problems'
import { getTodaysQueue } from './queue'

// Cache keys in one place, so invalidation can't drift from the queries.
export const queryKeys = {
  me: ['me'] as const,
  problems: ['problems'] as const,
  queue: ['queue'] as const,
}

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: getMe })
}

export function useProblems() {
  return useQuery({ queryKey: queryKeys.problems, queryFn: listProblems })
}

export function useTodaysQueue() {
  return useQuery({ queryKey: queryKeys.queue, queryFn: getTodaysQueue })
}
