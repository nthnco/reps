import { useState } from 'react'
import { Link } from 'react-router'
import type { Difficulty, Pattern, PatternMasteryRead, ProblemRead } from '../api/generated'
import { PATTERN_LABELS, STAGES } from '../api/labels'
import { usePatternMastery, useProblems } from '../api/queries'
import { DifficultyBadge } from './DifficultyBadge'
import { PremiumBadge } from './PremiumBadge'

const DIFFICULTY_ORDER: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 }

/** A pattern's problems, easiest first, then by title. */
function problemsIn(problems: ProblemRead[], pattern: Pattern): ProblemRead[] {
  return problems
    .filter((p) => p.pattern === pattern)
    .sort(
      (a, b) =>
        DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty] ||
        a.title.localeCompare(b.title),
    )
}

export function ProblemList() {
  const problems = useProblems()
  const mastery = usePatternMastery()
  const [open, setOpen] = useState<Pattern | null>(null)

  const rows = new Map(mastery.data?.map((row) => [row.pattern, row]))

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">All problems</h2>

      {problems.isError || mastery.isError ? (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {(problems.error ?? mastery.error)?.message}
        </p>
      ) : problems.isPending || mastery.isPending ? (
        <p>Loading problems…</p>
      ) : problems.data.length === 0 ? (
        <p>No problems yet. Use "Add problem" to add one.</p>
      ) : (
        STAGES.map((stage) => {
          const coveredCount = stage.patterns.filter((p) => rows.get(p)?.covered).length
          return (
            <section key={stage.label} aria-label={stage.label} className="space-y-2">
              <h3 className="text-sm font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400">
                {stage.label}
                <span className="ml-2 font-normal tracking-normal normal-case">
                  {coveredCount} of {stage.patterns.length} covered
                </span>
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
                {stage.patterns.map((pattern) => (
                  <PatternCard
                    key={pattern}
                    pattern={pattern}
                    row={rows.get(pattern)}
                    isOpen={open === pattern}
                    onToggle={() => setOpen(open === pattern ? null : pattern)}
                  />
                ))}
              </div>
              {open !== null && stage.patterns.includes(open) && (
                <ProblemPanel pattern={open} problems={problemsIn(problems.data, open)} />
              )}
            </section>
          )
        })
      )}
    </section>
  )
}

function PatternCard({
  pattern,
  row,
  isOpen,
  onToggle,
}: {
  pattern: Pattern
  row: PatternMasteryRead | undefined
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls={`panel-${pattern}`}
      onClick={onToggle}
      className={`flex items-center justify-between rounded border p-3 text-left font-medium hover:bg-gray-50 dark:hover:bg-gray-800 ${
        isOpen ? 'border-blue-600 dark:border-blue-400' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {PATTERN_LABELS[pattern]}
      {row?.covered && (
        <span aria-label="Covered" className="text-green-700 dark:text-green-400">
          ✓
        </span>
      )}
    </button>
  )
}

function ProblemPanel({ pattern, problems }: { pattern: Pattern; problems: ProblemRead[] }) {
  return (
    <div id={`panel-${pattern}`} className="rounded border border-gray-200 dark:border-gray-700">
      <h4 className="border-b border-gray-200 p-3 font-medium dark:border-gray-700">
        {PATTERN_LABELS[pattern]}
      </h4>
      {problems.length === 0 ? (
        <p className="p-3 text-gray-600 dark:text-gray-400">No problems in this pattern yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {problems.map((problem) => (
            <li key={problem.id} className="flex items-center justify-between gap-4 px-3 py-2">
              <Link
                to={`/problems/${problem.id}`}
                className="text-blue-700 hover:underline dark:text-blue-400"
              >
                {problem.title}
              </Link>
              <span className="flex shrink-0 items-center gap-2">
                {problem.is_premium && <PremiumBadge />}
                <DifficultyBadge difficulty={problem.difficulty} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
