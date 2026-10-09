import { useState } from 'react'
import { Link } from 'react-router'
import type { Difficulty, Pattern, PatternMasteryRead, ProblemRead } from '../api/generated'
import { PATTERN_LABELS, STAGES } from '../api/labels'
import { usePatternMastery, useProblems, useTodaysPlan } from '../api/queries'
import { toPercent } from '../format'
import { DifficultyBadge } from './DifficultyBadge'
import { cardClass } from './fields'
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
  // Today's plan's suggestion, not the live one, so "Next" matches the plan all day.
  const plan = useTodaysPlan()
  const [open, setOpen] = useState<Pattern | null>(null)

  const rows = new Map(mastery.data?.map((row) => [row.pattern, row]))
  const next = plan.data?.suggestion?.pattern ?? null
  const coveredCounts = STAGES.map(
    (stage) => stage.patterns.filter((p) => rows.get(p)?.covered).length,
  )
  // Stages after the first one with nothing covered are dimmed (still clickable).
  const firstGap = coveredCounts.indexOf(0)

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
        STAGES.map((stage, i) => {
          const dimmed = firstGap !== -1 && i > firstGap
          return (
            <section key={stage.label} aria-label={stage.label} className="space-y-2">
              <h3 className="text-sm font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400">
                {stage.label}
                <span className="ml-2 font-normal tracking-normal normal-case">
                  {coveredCounts[i]} of {stage.patterns.length} covered
                  {dimmed && ` · Suggested after ${STAGES[firstGap].label}`}
                </span>
              </h3>
              <div
                className={`grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2 ${dimmed ? 'opacity-50' : ''}`}
              >
                {stage.patterns.map((pattern) => (
                  <PatternCard
                    key={pattern}
                    pattern={pattern}
                    row={rows.get(pattern)}
                    isNext={next === pattern}
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
  isNext,
  isOpen,
  onToggle,
}: {
  pattern: Pattern
  row: PatternMasteryRead | undefined
  isNext: boolean
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls={`panel-${pattern}`}
      onClick={onToggle}
      className={`space-y-1 rounded-lg border bg-white p-3 text-left shadow-sm transition hover:shadow-md dark:bg-gray-900 ${
        isOpen
          ? 'border-gray-500 dark:border-gray-400'
          : 'border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-600'
      } ${isNext ? 'ring-2 ring-blue-500' : ''}`}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{PATTERN_LABELS[pattern]}</span>
        <span className="text-sm text-gray-600 tabular-nums dark:text-gray-400">
          <span className="sr-only">Mastery </span>
          {!row || row.low_data ? '–' : toPercent(row.displayed_mastery)}
        </span>
      </span>
      <span className="flex items-center justify-between gap-2 text-sm">
        {row && <TierCounts row={row} />}
        {isNext && (
          <span className="rounded bg-blue-600 px-1.5 text-xs font-semibold text-white">Next</span>
        )}
        {row?.covered && (
          <span className="text-green-700 dark:text-green-400">
            <span aria-hidden="true">✓</span>
            <span className="sr-only">Covered</span>
          </span>
        )}
      </span>
    </button>
  )
}

// Darker shades than the badges because these sit on a white card with no
// badge background. Amber rather than yellow: yellow-700 reads as a heavy
// brown and outweighs the other two.
const TIERS: [Difficulty, string, string][] = [
  ['easy', 'E', 'text-green-700 dark:text-green-400'],
  ['medium', 'M', 'text-amber-600 dark:text-amber-400'],
  ['hard', 'H', 'text-red-700 dark:text-red-400'],
]

/** "E 1/1 · M 1/4 · H 0/1"; a tier the pattern has no problems in is muted. */
function TierCounts({ row }: { row: PatternMasteryRead }) {
  return (
    <span className="text-gray-700 tabular-nums dark:text-gray-300">
      {TIERS.map(([tier, letter, color], i) => {
        const empty = row.total_by_tier[tier] === 0
        return (
          <span key={tier}>
            {i > 0 && ' · '}
            <span className={empty ? 'text-gray-400 dark:text-gray-600' : ''}>
              <span className={empty ? '' : color}>{letter}</span>{' '}
              {row.solved_by_tier[tier]}/{row.total_by_tier[tier]}
            </span>
          </span>
        )
      })}
    </span>
  )
}

function ProblemPanel({ pattern, problems }: { pattern: Pattern; problems: ProblemRead[] }) {
  return (
    <div id={`panel-${pattern}`} className={cardClass}>
      <h4 className="border-b border-gray-100 p-3 font-medium dark:border-gray-800">
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
