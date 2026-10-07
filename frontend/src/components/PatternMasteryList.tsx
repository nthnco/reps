import type { PatternMasteryRead } from '../api/generated'
import { PATTERN_LABELS } from '../api/labels'
import { usePatternMastery } from '../api/queries'
import { formatDueDate } from '../dates'
import { plural, toPercent } from '../format'

function MasteryBar({ row }: { row: PatternMasteryRead }) {
  const shown = toPercent(row.displayed_mastery)
  const peak = toPercent(row.peak)

  return (
    <div
      role="meter"
      aria-label={`${PATTERN_LABELS[row.pattern]} mastery`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shown}
      className="relative h-2.5 rounded-full bg-gray-200 dark:bg-gray-700"
    >
      <div
        // Faded while there are too few attempts to trust the score.
        className={`h-full rounded-full bg-blue-600 dark:bg-blue-400 ${row.low_data ? 'opacity-35' : ''}`}
        style={{ width: `${shown}%` }}
      />
      {peak > shown && (
        <div
          title={`Peak ${peak}%`}
          className="absolute -top-1 -bottom-1 w-0.5 rounded bg-gray-400 dark:bg-gray-500"
          style={{ left: `calc(${peak}% - 1px)` }}
        />
      )}
    </div>
  )
}

function details(row: PatternMasteryRead): string {
  if (row.problem_count === 0) return 'No problems yet'
  if (row.attempt_count === 0) return `${plural(row.problem_count, 'problem')}, not attempted yet`

  const parts = [plural(row.attempt_count, 'attempt'), plural(row.problem_count, 'problem')]
  if (row.last_practiced_on) parts.push(`last practiced ${formatDueDate(row.last_practiced_on)}`)
  if (row.median_solve_seconds !== null) {
    parts.push(`median ${Math.max(1, Math.round(row.median_solve_seconds / 60))} min`)
  }
  return parts.join(' · ')
}

/** "Next: 1 more problem to count toward your overall · 3 more attempts to trust this score". */
function nextSteps(row: PatternMasteryRead): string | null {
  if (row.attempt_count === 0) return null
  const steps = []
  if (row.problems_until_counted > 0) {
    steps.push(`${plural(row.problems_until_counted, 'more problem')} to count toward your overall`)
  }
  if (row.attempts_until_trusted > 0) {
    steps.push(`${plural(row.attempts_until_trusted, 'more attempt')} to trust this score`)
  }
  return steps.length ? `Next: ${steps.join(' · ')}` : null
}

function PatternRow({ row }: { row: PatternMasteryRead }) {
  const shown = toPercent(row.displayed_mastery)
  const raw = toPercent(row.mastery)
  const untouched = row.attempt_count === 0
  const next = nextSteps(row)

  return (
    <li className={`space-y-1.5 p-3 ${untouched ? 'text-gray-500 dark:text-gray-400' : ''}`}>
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-medium">
          {PATTERN_LABELS[row.pattern]}
          {row.low_data && !untouched && (
            <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              Low data
            </span>
          )}
        </span>
        <span className="shrink-0 tabular-nums">{untouched ? '—' : `${shown}%`}</span>
      </div>
      <MasteryBar row={row} />
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {details(row)}
        {row.due_count > 0 && (
          <span className="font-medium text-amber-700 dark:text-amber-400">
            {' · '}
            {row.due_count} due
          </span>
        )}
      </p>
      {raw > shown && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Down from {raw}% since you last practiced
        </p>
      )}
      {next && <p className="text-sm text-blue-700 dark:text-blue-400">{next}</p>}
    </li>
  )
}

export function PatternMasteryList() {
  const mastery = usePatternMastery()

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Patterns</h2>

      {mastery.isPending ? (
        <p>Loading pattern mastery…</p>
      ) : mastery.isError ? (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {mastery.error.message}
        </p>
      ) : (
        <>
          {mastery.data.every((row) => row.attempt_count === 0) && (
            <p>No attempts yet. Log an attempt and its pattern starts filling in here.</p>
          )}
          <ul className="divide-y divide-gray-200 rounded border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {mastery.data.map((row) => (
              <PatternRow key={row.pattern} row={row} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
