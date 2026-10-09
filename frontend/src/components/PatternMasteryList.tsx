import type { PatternMasteryRead } from '../api/generated'
import { PATTERN_LABELS } from '../api/labels'
import { usePatternMastery } from '../api/queries'
import { formatDueDate } from '../dates'
import { formatMinutes, plural, toPercent } from '../format'
import { cardClass } from './fields'

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
    parts.push(`median ${formatMinutes(row.median_solve_seconds)}`)
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
    <li className={`space-y-2 px-4 py-3 ${untouched ? 'text-gray-500 dark:text-gray-400' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{PATTERN_LABELS[row.pattern]}</span>
          {row.due_count > 0 && (
            <span className={`${badgeClass} bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800`}>
              {row.due_count} due
            </span>
          )}
          {row.low_data && !untouched && (
            <span className={`${badgeClass} bg-gray-50 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700`}>
              Low data
            </span>
          )}
          {row.covered && (
            <span
              title="2+ mediums solved, one without a hint"
              className={`${badgeClass} bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800`}
            >
              Covered
            </span>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg leading-none font-semibold tabular-nums">
            {untouched ? '—' : `${shown}%`}
          </p>
          {raw > shown && (
            <p title="Since you last practiced" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Down from {raw}%
            </p>
          )}
        </div>
      </div>
      <MasteryBar row={row} />
      <p className="text-xs text-gray-500 dark:text-gray-400">{details(row)}</p>
      {next && (
        <p className="rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {next}
        </p>
      )}
    </li>
  )
}

const badgeClass = 'rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset'

function RowList({ label, rows }: { label: string; rows: PatternMasteryRead[] }) {
  return (
    <ul aria-label={label} className={`divide-y divide-gray-100 dark:divide-gray-800 ${cardClass}`}>
      {rows.map((row) => (
        <PatternRow key={row.pattern} row={row} />
      ))}
    </ul>
  )
}

export function PatternMasteryList() {
  const mastery = usePatternMastery()
  const started = mastery.data?.filter((row) => row.attempt_count > 0) ?? []
  const notStarted = mastery.data?.filter((row) => row.attempt_count === 0) ?? []

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
          {started.length === 0 ? (
            <p>No attempts yet. Log an attempt and its pattern starts filling in here.</p>
          ) : (
            <RowList label="Started" rows={started} />
          )}
          {notStarted.length > 0 && (
            // Split off so the few patterns with real numbers aren't lost among empty rows.
            <div className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400">
                Not attempted yet
              </h3>
              <RowList label="Not attempted yet" rows={notStarted} />
            </div>
          )}
        </>
      )}
    </section>
  )
}
