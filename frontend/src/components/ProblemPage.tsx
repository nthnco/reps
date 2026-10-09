import { Link, useParams } from 'react-router'
import { PATTERN_LABELS } from '../api/labels'
import { useProblems } from '../api/queries'
import { DifficultyBadge } from './DifficultyBadge'
import { secondaryButtonClass } from './fields'
import { PremiumBadge } from './PremiumBadge'
import { LogAttemptForm } from './LogAttemptForm'

export function ProblemPage() {
  const { id } = useParams()
  // There's no single-problem endpoint; the list is small and usually cached already.
  const problems = useProblems()
  const problem = problems.data?.find((p) => String(p.id) === id)

  return (
    <div className="space-y-6">
      <Link to="/" className={`inline-block text-sm ${secondaryButtonClass}`}>
        ← All problems
      </Link>

      {problems.isPending ? (
        <p>Loading problem…</p>
      ) : problems.isError ? (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {problems.error.message}
        </p>
      ) : problem === undefined ? (
        <p>That problem doesn't exist.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">{problem.title}</h2>
              <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                {PATTERN_LABELS[problem.pattern]}
                <DifficultyBadge difficulty={problem.difficulty} />
                {problem.is_premium && <PremiumBadge />}
              </p>
            </div>
            <a
              href={problem.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm ${secondaryButtonClass}`}
            >
              View problem <span aria-hidden="true">↗</span>
            </a>
          </div>
          {/* key: a fresh form (no leftover answers) when moving between problems. */}
          <LogAttemptForm key={problem.id} problem={problem} />
        </>
      )}
    </div>
  )
}
