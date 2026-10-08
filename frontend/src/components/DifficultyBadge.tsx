import type { Difficulty } from '../api/generated'
import { DIFFICULTY_LABELS } from '../api/labels'

// Yellow text is unreadable on white, so medium uses a darker amber-ish shade.
const COLORS: Record<Difficulty, string> = {
  easy: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  hard: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${COLORS[difficulty]}`}>
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  )
}
