import type { Pattern } from '../api/generated'
import { PATTERN_LABELS } from '../api/labels'
import { useProfileSummary } from '../api/queries'
import { plural, toPercent } from '../format'
import { cardClass } from './fields'

type Tone = 'green' | 'red' | 'amber' | 'gray'

// Full class strings, not built from the tone name: Tailwind only ships
// classes it can find written out in the source.
const TONES: Record<Tone, { dot: string; chip: string }> = {
  green: {
    dot: 'bg-green-500',
    chip: 'bg-green-50 text-green-800 ring-green-200 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-800',
  },
  red: {
    dot: 'bg-red-500',
    chip: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800',
  },
  amber: {
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800',
  },
  gray: {
    dot: 'bg-gray-400',
    chip: 'bg-gray-50 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700',
  },
}

function PatternGroup({
  title,
  tone,
  patterns,
  empty,
}: {
  title: string
  tone: Tone
  patterns: Pattern[]
  empty: string
}) {
  return (
    <div className={`space-y-3 p-4 ${cardClass}`}>
      <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400">
        <span aria-hidden="true" className={`size-2 rounded-full ${TONES[tone].dot}`} />
        {title}
        <span className="ml-auto font-normal tabular-nums">{patterns.length}</span>
      </h3>
      {patterns.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{empty}</p>
      ) : (
        <ul aria-label={title} className="flex flex-wrap gap-1.5">
          {patterns.map((pattern) => (
            <li
              key={pattern}
              className={`rounded-full px-2.5 py-0.5 text-sm ring-1 ring-inset ${TONES[tone].chip}`}
            >
              {PATTERN_LABELS[pattern]}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Each rank starts at its lower bound: 30 is Proficient, 65 Ready, 90 Bulletproof.
// The arc and its glow are drawn in currentColor, so one text class colors both.
const RANKS = [
  { min: 90, label: 'Bulletproof', color: 'text-violet-500' },
  { min: 65, label: 'Ready', color: 'text-green-500' },
  { min: 30, label: 'Proficient', color: 'text-amber-500' },
  { min: 0, label: 'Noob', color: 'text-red-500' },
]

const GAUGE_WIDTH = 168
const GAUGE_STROKE = 12
const GAUGE_RADIUS = (GAUGE_WIDTH - GAUGE_STROKE) / 2
const GAUGE_HEIGHT = GAUGE_RADIUS + GAUGE_STROKE
// The top half of a circle, from its left end over the top to its right end.
const GAUGE_ARC = `M ${GAUGE_STROKE / 2} ${GAUGE_RADIUS + GAUGE_STROKE / 2} A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 0 1 ${GAUGE_WIDTH - GAUGE_STROKE / 2} ${GAUGE_RADIUS + GAUGE_STROKE / 2}`

/** Takes the rounded percent on screen, so "90%" never reads as Ready. */
function OverallGauge({ percent }: { percent: number }) {
  const rank = RANKS.find((r) => percent >= r.min)!

  return (
    <div
      role="meter"
      aria-label="Overall rating"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}%, ${rank.label}`}
      className="relative shrink-0"
      style={{ width: GAUGE_WIDTH, height: GAUGE_HEIGHT }}
    >
      {/* overflow-visible so the glow isn't clipped at the SVG's edges. */}
      <svg width={GAUGE_WIDTH} height={GAUGE_HEIGHT} className="overflow-visible" aria-hidden="true">
        <path
          d={GAUGE_ARC}
          fill="none"
          strokeWidth={GAUGE_STROKE}
          strokeLinecap="round"
          className="stroke-gray-200 dark:stroke-gray-800"
        />
        <path
          d={GAUGE_ARC}
          // pathLength 100 lets the dash be measured in percent: draw `percent`
          // units of the arc, then a gap covering the rest.
          pathLength={100}
          fill="none"
          stroke="currentColor"
          strokeWidth={GAUGE_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${percent} 100`}
          className={rank.color}
          style={{ filter: 'drop-shadow(0 0 6px currentColor)' }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <p className="text-3xl font-bold tracking-tight tabular-nums">{percent}%</p>
        <p className={`text-xs font-semibold tracking-wide uppercase ${rank.color}`}>
          {rank.label}
        </p>
      </div>
    </div>
  )
}

export function ProfileSummary() {
  const summary = useProfileSummary()

  if (summary.isPending) return <p>Loading your profile…</p>
  if (summary.isError) {
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        {summary.error.message}
      </p>
    )
  }

  const {
    rules,
    overall,
    breakdown,
    strengths,
    weaknesses,
    needs_review,
    not_started,
    total_completed,
  } = summary.data
  const counted = breakdown.filter((part) => part.counted)
  const equalWeights = new Set(counted.map((part) => part.weight)).size <= 1
  const masteredAt = toPercent(rules.mastered_at)

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Profile</h2>

      <div className={`p-5 ${cardClass}`}>
        {counted.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">
            No overall rating yet. Attempt {rules.overall_min_problems} different problems in a
            pattern to unlock it.
          </p>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <OverallGauge percent={toPercent(overall)} />
            <div className="flex-1 space-y-2">
              <p className="text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400">
                Overall rating
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Overall, across {counted.length} of {breakdown.length} patterns ·{' '}
                {plural(total_completed, 'problem')} solved
              </p>
              <details className="text-sm">
                <summary className="cursor-pointer text-blue-700 dark:text-blue-400">
                  How this is calculated
                </summary>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  {equalWeights ? 'The average' : 'The weighted average'} of each pattern's current
                  mastery, counting only patterns where you've attempted{' '}
                  {rules.overall_min_problems}+ different problems.
                </p>
                <ul aria-label="Breakdown" className="mt-2 space-y-0.5">
                  {counted.map((part) => (
                    <li key={part.pattern} className="flex justify-between gap-4">
                      <span>{PATTERN_LABELS[part.pattern]}</span>
                      <span className="tabular-nums">
                        {toPercent(part.displayed_mastery)}%
                        {!equalWeights && ` × ${part.weight}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PatternGroup
          title="Strengths"
          tone="green"
          patterns={strengths}
          empty={`None yet. A strength needs ${masteredAt}%+ mastery and ${rules.strength_min_attempts}+ attempts.`}
        />
        <PatternGroup
          title="Needs work"
          tone="red"
          patterns={weaknesses}
          empty={`Nothing you've started is below ${masteredAt}%.`}
        />
        <PatternGroup
          title="Needs review"
          tone="amber"
          patterns={needs_review}
          empty="Nothing you've mastered has faded yet."
        />
        <PatternGroup
          title="Not started"
          tone="gray"
          patterns={not_started}
          empty="You've started every pattern."
        />
      </div>
    </section>
  )
}
