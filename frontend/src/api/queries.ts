import { useQuery } from '@tanstack/react-query'
import { getActivity } from './activity'
import { getMe } from './auth'
import { getPatternMastery, getProfileSummary } from './mastery'
import { listProblemAttempts, listProblems } from './problems'
import { getTodaysPlan } from './plan'

// Cache keys in one place, so invalidation can't drift from the queries.
export const queryKeys = {
  me: ['me'] as const,
  problems: ['problems'] as const,
  // All three are computed from every problem and attempt, so any save stales them.
  patternMastery: ['patternMastery'] as const,
  profileSummary: ['profileSummary'] as const,
  plan: ['plan'] as const,
  activity: ['activity'] as const,
  // One entry per problem, so a save stales only that problem's list.
  problemAttempts: (problemId: number) => ['problemAttempts', problemId] as const,
}

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: getMe })
}

export function useProblems() {
  return useQuery({ queryKey: queryKeys.problems, queryFn: listProblems })
}

export function usePatternMastery() {
  return useQuery({ queryKey: queryKeys.patternMastery, queryFn: getPatternMastery })
}

export function useProfileSummary() {
  return useQuery({ queryKey: queryKeys.profileSummary, queryFn: getProfileSummary })
}

export function useTodaysPlan() {
  return useQuery({ queryKey: queryKeys.plan, queryFn: getTodaysPlan })
}

export function useActivity() {
  return useQuery({ queryKey: queryKeys.activity, queryFn: getActivity })
}

export function useProblemAttempts(problemId: number) {
  return useQuery({
    queryKey: queryKeys.problemAttempts(problemId),
    queryFn: () => listProblemAttempts(problemId),
  })
}
