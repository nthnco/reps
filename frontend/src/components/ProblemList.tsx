import { Link } from 'react-router'
import type { Difficulty, Pattern, ProblemRead } from '../api/generated'
import { PATTERN_LABELS } from '../api/labels'
import { useProblems } from '../api/queries'
import { DifficultyBadge } from './DifficultyBadge'
import { PremiumBadge } from './PremiumBadge'

const DIFFICULTY_ORDER: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 }

/** Problems grouped by pattern, in PATTERN_LABELS order; patterns with none are left out. */
function byPattern(problems: ProblemRead[]): [Pattern, ProblemRead[]][] {
  return (Object.keys(PATTERN_LABELS) as Pattern[])
    .map((pattern): [Pattern, ProblemRead[]] => [
      pattern,
      problems
        .filter((p) => p.pattern === pattern)
        .sort(
          (a, b) =>
            DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty] ||
            a.title.localeCompare(b.title),
        ),
    ])
    .filter(([, group]) => group.length > 0)
}

export function ProblemList() {
  const problems = useProblems()

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">All problems</h2>

      {problems.isPending ? (
        <p>Loading problems…</p>
      ) : problems.isError ? (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {problems.error.message}
        </p>
      ) : problems.data.length === 0 ? (
        <p>No problems yet. Use "Add problem" to add one.</p>
      ) : (
        <div className="divide-y divide-gray-200 rounded border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {byPattern(problems.data).map(([pattern, group]) => (
            // Native <details>: collapsed by default, keyboard and screen-reader friendly, no state.
            <details key={pattern} className="group">
              <summary className="flex cursor-pointer items-center justify-between p-3 font-medium hover:bg-gray-50 dark:hover:bg-gray-800">
                {PATTERN_LABELS[pattern]}
                <span className="text-sm font-normal text-gray-600 dark:text-gray-400">
                  {group.length}
                </span>
              </summary>
              <ul className="divide-y divide-gray-100 border-t border-gray-200 dark:divide-gray-800 dark:border-gray-700">
                {group.map((problem) => (
                  <li key={problem.id} className="flex items-center justify-between gap-4 py-2 pr-3 pl-6">
                    <Link
                      to={`/problems/${problem.id}`}
                      className="text-blue-700 hover:underline dark:text-blue-400"
                    >
                      {problem.title}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2">
                      {problem.is_premium && <PremiumBadge />}
                      <DifficultyBadge difficulty={problem.difficulty} />
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
