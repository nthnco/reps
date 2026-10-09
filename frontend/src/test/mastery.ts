import type { Pattern, PatternMasteryRead } from '../api/generated'

/** A mastery row for a pattern with no problems or attempts. */
export function untouched(pattern: Pattern): PatternMasteryRead {
  return {
    pattern,
    displayed_mastery: 0,
    mastery: 0,
    peak: 0,
    certainty: 0,
    low_data: true,
    attempt_count: 0,
    problem_count: 0,
    problems_attempted: 0,
    problems_until_counted: 2,
    attempts_until_trusted: 5,
    due_count: 0,
    last_practiced_on: null,
    median_solve_seconds: null,
    covered: false,
    solved_by_tier: { easy: 0, medium: 0, hard: 0 },
    total_by_tier: { easy: 0, medium: 0, hard: 0 },
  }
}
