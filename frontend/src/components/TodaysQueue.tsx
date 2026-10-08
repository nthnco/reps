import { Link } from 'react-router'
import type { QueueItem } from '../api/generated'
import { DIFFICULTY_LABELS, PATTERN_LABELS } from '../api/labels'
import { useTodaysQueue } from '../api/queries'
import { formatDueDate } from '../dates'

// How many of each list to show. Finishing one brings in the next; the rest are
// still due, just hidden, so a backlog shows up in the "more" line.
export const REVIEW_LIMIT = 10
export const NEW_LIMIT = 5

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
        <>
          <QueueList
            title="Reviews"
            items={queue.data.filter((item) => item.due_on !== null)}
            limit={REVIEW_LIMIT}
          />
          <QueueList
            title="New"
            items={queue.data.filter((item) => item.due_on === null)}
            limit={NEW_LIMIT}
          />
        </>
      )}
    </section>
  )
}

function QueueList({ title, items, limit }: { title: string; items: QueueItem[]; limit: number }) {
  if (items.length === 0) return null
  const hidden = items.length - limit

  // Keeps the API's order: most overdue first, then by title.
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="font-medium">
        {title} <span className="text-sm text-gray-600 dark:text-gray-400">({items.length})</span>
      </h3>
      <ul className="divide-y divide-gray-200 rounded border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
        {items.slice(0, limit).map(({ problem, due_on }) => (
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
      {hidden > 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-400">+{hidden} more after these</p>
      )}
    </section>
  )
}
