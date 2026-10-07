import type { Pattern } from '../api/generated'
import { PATTERN_LABELS } from '../api/labels'
import { useProfileSummary } from '../api/queries'
import { plural, toPercent } from '../format'

function PatternGroup({
  title,
  patterns,
  empty,
}: {
  title: string
  patterns: Pattern[]
  empty: string
}) {
  return (
    <div className="space-y-1">
      <h3 className="font-medium">{title}</h3>
      {patterns.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">{empty}</p>
      ) : (
        <ul aria-label={title} className="text-sm">
          {patterns.map((pattern) => (
            <li key={pattern}>{PATTERN_LABELS[pattern]}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ProfileSummary() {
  const summary = useProfileSummary()

  if (summary.isPending) return <p>Loading your profile…</p>
  if (summary.isError) {
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        {summary.error.message}
      </p>
    )
  }

  const {
    rules,
    overall,
    breakdown,
    strengths,
    weaknesses,
    needs_review,
    not_started,
    total_completed,
  } = summary.data
  const counted = breakdown.filter((part) => part.counted)
  const equalWeights = new Set(counted.map((part) => part.weight)).size <= 1
  const masteredAt = toPercent(rules.mastered_at)

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Profile</h2>

      <div className="space-y-5 rounded border border-gray-200 p-4 dark:border-gray-700">
        {counted.length === 0 ? (
          <p>
            No overall rating yet. Attempt {rules.overall_min_problems} different problems in a
            pattern to unlock it.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-4xl font-bold tabular-nums">{toPercent(overall)}%</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Overall, across {counted.length} of {breakdown.length} patterns ·{' '}
              {plural(total_completed, 'problem')} solved
            </p>
            <details className="text-sm">
              <summary className="cursor-pointer text-blue-700 dark:text-blue-400">
                How this is calculated
              </summary>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {equalWeights ? 'The average' : 'The weighted average'} of each pattern's current
                mastery, counting only patterns where you've attempted{' '}
                {rules.overall_min_problems}+ different problems.
              </p>
              <ul aria-label="Breakdown" className="mt-2 space-y-0.5">
                {counted.map((part) => (
                  <li key={part.pattern} className="flex justify-between gap-4">
                    <span>{PATTERN_LABELS[part.pattern]}</span>
                    <span className="tabular-nums">
                      {toPercent(part.displayed_mastery)}%
                      {!equalWeights && ` × ${part.weight}`}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <PatternGroup
            title="Strengths"
            patterns={strengths}
            empty={`None yet. A strength needs ${masteredAt}%+ mastery and ${rules.strength_min_attempts}+ attempts.`}
          />
          <PatternGroup
            title="Needs work"
            patterns={weaknesses}
            empty={`Nothing you've started is below ${masteredAt}%.`}
          />
          <PatternGroup
            title="Needs review"
            patterns={needs_review}
            empty="Nothing you've mastered has faded yet."
          />
          <PatternGroup
            title="Not started"
            patterns={not_started}
            empty="You've started every pattern."
          />
        </div>
      </div>
    </section>
  )
}
