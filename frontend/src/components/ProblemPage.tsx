import { Link, useParams } from 'react-router'
import { DIFFICULTY_LABELS, PATTERN_LABELS } from '../api/labels'
import { useProblems } from '../api/queries'
import { LogAttemptForm } from './LogAttemptForm'

export function ProblemPage() {
  const { id } = useParams()
  // There's no single-problem endpoint; the list is small and usually cached already.
  const problems = useProblems()
  const problem = problems.data?.find((p) => String(p.id) === id)

  return (
    <div className="space-y-6">
      <Link to="/" className="text-blue-700 hover:underline dark:text-blue-400">
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
          <div>
            <h2 className="text-xl font-semibold">{problem.title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {PATTERN_LABELS[problem.pattern]} · {DIFFICULTY_LABELS[problem.difficulty]}
            </p>
          </div>
          {/* key: a fresh form (no leftover answers) when moving between problems. */}
          <LogAttemptForm key={problem.id} problem={problem} />
        </>
      )}
    </div>
  )
}
