import { Link } from 'react-router'
import { DIFFICULTY_LABELS, PATTERN_LABELS } from '../api/labels'
import { useTodaysQueue } from '../api/queries'
import { formatDueDate } from '../dates'

export function TodaysQueue() {
  const queue = useTodaysQueue()

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Today's queue</h2>

      {queue.isPending ? (
        <p>Loading today's queue…</p>
      ) : queue.isError ? (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {queue.error.message}
        </p>
      ) : queue.data.length === 0 ? (
        <p>Nothing due today.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {queue.data.map(({ problem, due_on }) => (
            <li key={problem.id} className="flex items-center justify-between gap-4 p-3">
              <div>
                <Link
                  to={`/problems/${problem.id}`}
                  className="font-medium text-blue-700 hover:underline dark:text-blue-400"
                >
                  {problem.title}
                </Link>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {PATTERN_LABELS[problem.pattern]} · {DIFFICULTY_LABELS[problem.difficulty]}
                </p>
              </div>
              <span className="shrink-0 text-sm text-gray-600 dark:text-gray-400">
                {due_on === null ? 'New' : `Due ${formatDueDate(due_on)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
