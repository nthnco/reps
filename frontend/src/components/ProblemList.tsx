import { Link } from 'react-router'
import { DIFFICULTY_LABELS, PATTERN_LABELS } from '../api/labels'
import { useProblems } from '../api/queries'

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
        <p>No problems yet. Add one below.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {problems.data.map((problem) => (
            <li key={problem.id} className="p-3">
              <Link
                to={`/problems/${problem.id}`}
                className="font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                {problem.title}
              </Link>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {PATTERN_LABELS[problem.pattern]} · {DIFFICULTY_LABELS[problem.difficulty]}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
