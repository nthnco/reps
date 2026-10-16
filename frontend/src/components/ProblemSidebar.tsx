import type { ReactNode } from 'react'
import { CONFIDENCE_WORDS, PATTERN_LABELS } from '../api/labels'
import type { ProblemRead } from '../api/generated'
import { useActivity, usePatternMastery, useProblemAttempts } from '../api/queries'
import { formatDueDate } from '../dates'
import { formatMinutes, toPercent } from '../format'
import { ActivityGrid } from './ActivityGrid'
import { labelClass, panelClass } from './fields'
import { SkillBar } from './SkillBar'

function Card(props: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={`space-y-3 p-4 ${panelClass}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={labelClass}>{props.title}</h3>
        {props.aside}
      </div>
      {props.children}
    </section>
  )
}

// Each card loads on its own, so a slow or failed one doesn't hide the others.
// While loading they render nothing: the form beside them is what matters.

function ActivityCard() {
  const activity = useActivity()
  if (activity.isError) return <Card title="Activity"><ErrorText error={activity.error} /></Card>
  if (!activity.data) return null

  const { run, today, days } = activity.data
  const practicedToday = days.some((d) => d.day === today && d.count > 0)
  return (
    <Card title="Activity" aside={<span className="font-mono text-xs text-muted">{run} day run</span>}>
      <ActivityGrid activity={activity.data} weeks={14} />
      {!practicedToday && (
        <p className="text-sm text-muted">Log today to make it {run + 1}</p>
      )}
    </Card>
  )
}

function SkillCard({ problem }: { problem: ProblemRead }) {
  const mastery = usePatternMastery()
  if (mastery.isError) return <Card title="Skill"><ErrorText error={mastery.error} /></Card>
  const row = mastery.data?.find((r) => r.pattern === problem.pattern)
  if (!row) return null

  const label = PATTERN_LABELS[problem.pattern]
  return (
    <Card title="Skill">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="font-mono">{toPercent(row.mastery)}%</span>
      </div>
      <SkillBar label={label} after={row.mastery} />
    </Card>
  )
}

function LastTimeCard({ problem }: { problem: ProblemRead }) {
  const attempts = useProblemAttempts(problem.id)
  if (attempts.isError) return <Card title="Last time"><ErrorText error={attempts.error} /></Card>
  // Newest first; no attempts yet means no card.
  const last = attempts.data?.[0]
  if (!last) return null

  return (
    <Card title="Last time">
      <p className="font-mono text-sm">
        {formatDueDate(last.attempted_on)} ·{' '}
        <span className={last.solved ? 'text-solved' : 'text-not-solved'}>
          {last.solved ? 'Solved' : 'Not solved'}
        </span>{' '}
        · {formatMinutes(last.duration_seconds)}
      </p>
      <p className="font-mono text-sm text-muted">
        Confidence {last.confidence} {CONFIDENCE_WORDS[last.confidence]}
        {last.used_hint && ' · hint used'}
      </p>
    </Card>
  )
}

function ErrorText({ error }: { error: Error }) {
  return <p role="alert" className="text-sm text-not-solved">{error.message}</p>
}

export function ProblemSidebar({ problem }: { problem: ProblemRead }) {
  return (
    <aside className="space-y-4">
      <ActivityCard />
      <SkillCard problem={problem} />
      <LastTimeCard problem={problem} />
    </aside>
  )
}
