import { Link, useParams } from 'react-router'
import { DIFFICULTY_LABELS, PATTERN_LABELS } from '../api/labels'
import { useProblems } from '../api/queries'
import { outlineButtonClass } from './fields'
import { PremiumBadge } from './PremiumBadge'
import { LogAttemptForm } from './LogAttemptForm'
import { ProblemSidebar } from './ProblemSidebar'

export function ProblemPage() {
  const { id } = useParams()
  // There's no single-problem endpoint; the list is small and usually cached already.
  const problems = useProblems()
  const problem = problems.data?.find((p) => String(p.id) === id)

  return (
    <div className="space-y-6">
      <Link to="/" className={`text-sm ${outlineButtonClass}`}>
        ← All problems
      </Link>

      {problems.isPending ? (
        <p>Loading problem…</p>
      ) : problems.isError ? (
        <p role="alert" className="text-not-solved">
          {problems.error.message}
        </p>
      ) : problem === undefined ? (
        <p>That problem doesn't exist.</p>
      ) : (
        // One column on narrow screens, so the sidebar falls under the form.
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">{problem.title}</h2>
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  {PATTERN_LABELS[problem.pattern]}
                  <span className="rounded border border-line px-2 py-px font-mono text-xs">
                    {DIFFICULTY_LABELS[problem.difficulty]}
                  </span>
                  {problem.is_premium && <PremiumBadge />}
                </p>
              </div>
              <a
                href={problem.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-sm ${outlineButtonClass}`}
              >
                Open on LeetCode <span aria-hidden="true">↗</span>
              </a>
            </div>
            {/* key: a fresh form (no leftover answers) when moving between problems. */}
            <LogAttemptForm key={problem.id} problem={problem} />
          </div>
          <ProblemSidebar problem={problem} />
        </div>
      )}
    </div>
  )
}
