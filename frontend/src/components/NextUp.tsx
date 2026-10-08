import { Link } from 'react-router'
import type { Reason } from '../api/generated'
import { PATTERN_LABELS } from '../api/labels'
import { useSuggestion } from '../api/queries'
import { DifficultyBadge } from './DifficultyBadge'
import { PremiumBadge } from './PremiumBadge'

// The backend sends the reason as a kind; pattern labels only live here.
const REASONS: Record<Reason, (pattern: string) => string> = {
  start_easy: (p) => `${p} is next on the roadmap. Start with an easy.`,
  next_medium: (p) => `${p} is next on the roadmap. Mediums cover it.`,
  step_back: (p) => `Your last two ${p} attempts failed, so here's an easier one.`,
  keep_reviewing: (p) => `Nothing new is left in ${p}. Keep reviewing it from the queue.`,
  deepen: (p) => `Every pattern is covered. ${p} is your weakest, so go deeper there.`,
}

export function NextUp() {
  const suggestion = useSuggestion()

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Learn next</h2>

      {suggestion.isPending ? (
        <p>Loading what to learn next…</p>
      ) : suggestion.isError ? (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {suggestion.error.message}
        </p>
      ) : suggestion.data === null ? (
        <p>Every pattern is covered and nothing new is left. The queue has it from here.</p>
      ) : (
        <div className="space-y-2 rounded border border-gray-200 p-3 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {REASONS[suggestion.data.reason](PATTERN_LABELS[suggestion.data.pattern])}
          </p>
          {suggestion.data.problem && (
            <p className="flex items-center gap-2">
              <Link
                to={`/problems/${suggestion.data.problem.id}`}
                className="font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                {suggestion.data.problem.title}
              </Link>
              <DifficultyBadge difficulty={suggestion.data.problem.difficulty} />
              {suggestion.data.problem.is_premium && <PremiumBadge />}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
