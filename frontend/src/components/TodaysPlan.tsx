import { Link } from 'react-router'
import type { PlanItemRead, Reason, SuggestionRead } from '../api/generated'
import { PATTERN_LABELS } from '../api/labels'
import { useTodaysPlan } from '../api/queries'
import { formatDueDate } from '../dates'
import { formatMinutes, plural } from '../format'
import { DifficultyBadge } from './DifficultyBadge'
import { cardClass } from './fields'
import { PremiumBadge } from './PremiumBadge'

// The backend sends the reason as a kind; pattern labels only live here.
const REASONS: Record<Reason, (pattern: string) => string> = {
  start_easy: (p) => `${p} is next on the roadmap. Start with an easy.`,
  next_medium: (p) => `${p} is next on the roadmap. Mediums cover it.`,
  step_back: (p) => `Your last two ${p} attempts failed, so here's an easier one.`,
  keep_reviewing: (p) => `Nothing new is left in ${p}. Keep reviewing it.`,
  deepen: (p) => `Every pattern is covered. ${p} is your weakest, so go deeper there.`,
}

function totalSeconds(items: PlanItemRead[]): number {
  return items.reduce((sum, item) => sum + item.estimate_seconds, 0)
}

export function TodaysPlan() {
  const plan = useTodaysPlan()

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Today's plan</h2>

      {plan.isPending ? (
        <p>Loading today's plan…</p>
      ) : plan.isError ? (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {plan.error.message}
        </p>
      ) : (
        <>
          {plan.data.items.length === 0 ? (
            <p>Nothing due and nothing new today.</p>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                About {formatMinutes(totalSeconds(plan.data.items))} of{' '}
                {formatMinutes(plan.data.budget_seconds)}
                {plan.data.items.every((item) => item.done) && '. All done for today.'}
              </p>
              <PlanList items={plan.data.items} suggestion={plan.data.suggestion} />
            </>
          )}
          <SuggestionNote suggestion={plan.data.suggestion} />
          {plan.data.backlog.length > 0 && (
            // Collapsed: the backlog is context, not today's work.
            <details className="space-y-2">
              <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400">
                +{plural(plan.data.backlog.length, 'more review')} due (about{' '}
                {formatMinutes(totalSeconds(plan.data.backlog))}), for another day
              </summary>
              <PlanList items={plan.data.backlog} suggestion={null} />
            </details>
          )}
        </>
      )}
    </section>
  )
}

/** Only when there's no new problem to explain inline: keep reviewing, or nothing new left. */
function SuggestionNote({ suggestion }: { suggestion: SuggestionRead | null }) {
  if (suggestion?.problem) return null
  return (
    <p className="text-sm text-gray-600 dark:text-gray-400">
      {suggestion
        ? REASONS[suggestion.reason](PATTERN_LABELS[suggestion.pattern])
        : 'Every pattern is covered and nothing new is left. Reviews have it from here.'}
    </p>
  )
}

function PlanList({
  items,
  suggestion,
}: {
  items: PlanItemRead[]
  suggestion: SuggestionRead | null
}) {
  // Keeps the API's order: the new problem, then most overdue first.
  return (
    <ul className={`divide-y divide-gray-100 dark:divide-gray-800 ${cardClass}`}>
      {items.map(({ problem, due_on, estimate_seconds, done }) => (
        <li key={problem.id} className="flex items-center justify-between gap-4 p-3">
          <div className={done ? 'opacity-60' : undefined}>
            <Link
              to={`/problems/${problem.id}`}
              className="font-medium text-blue-700 hover:underline dark:text-blue-400"
            >
              {problem.title}
            </Link>
            <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              {PATTERN_LABELS[problem.pattern]}
              <DifficultyBadge difficulty={problem.difficulty} />
              {problem.is_premium && <PremiumBadge />}
            </p>
            {due_on === null && suggestion && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {REASONS[suggestion.reason](PATTERN_LABELS[suggestion.pattern])}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right text-sm text-gray-600 dark:text-gray-400">
            <p>{done ? '✓ Done' : due_on === null ? 'New' : `Due ${formatDueDate(due_on)}`}</p>
            <p>~{formatMinutes(estimate_seconds)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
