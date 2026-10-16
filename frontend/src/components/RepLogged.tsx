import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import type { AttemptCreated, ProblemRead } from '../api/generated'
import { PATTERN_LABELS } from '../api/labels'
import { useActivity, useTodaysPlan } from '../api/queries'
import { daysBetween, formatDueDate } from '../dates'
import { plural, toPercent } from '../format'
import { ActivityGrid } from './ActivityGrid'
import { accentButtonClass, labelClass, outlineButtonClass, panelClass } from './fields'
import { SkillBar } from './SkillBar'

const legendClasses = ['bg-grid-0', 'bg-grid-1', 'bg-grid-2', 'bg-grid-3', 'bg-grid-4']

/** Shown on the problem's page after a save. Page state: a refresh goes back to the form. */
export function RepLogged(props: { problem: ProblemRead; attempt: AttemptCreated; onBack: () => void }) {
  const { problem, attempt } = props
  const navigate = useNavigate()
  const activity = useActivity()
  const plan = useTodaysPlan()
  const heading = useRef<HTMLHeadingElement>(null)

  // The form the user just submitted is gone, and focus with it. Move focus to
  // the new screen's heading so keyboard and screen-reader users land here.
  useEffect(() => heading.current?.focus(), [])

  function nextProblem() {
    // The plan refetches after the save; until then it may still list this
    // problem as not done, so skip it explicitly.
    const next = plan.data?.items.find((item) => !item.done && item.problem.id !== problem.id)
    void navigate(next ? `/problems/${next.problem.id}` : '/')
  }

  const before = toPercent(attempt.skill_before)
  const after = toPercent(attempt.skill_after)
  const change = after - before
  const label = PATTERN_LABELS[problem.pattern]

  return (
    <div className="max-w-2xl space-y-4">
      <div className="space-y-2">
        <p className="font-mono text-xs font-medium tracking-wide text-accent uppercase">
          <span aria-hidden="true">✓ </span>Rep logged
        </p>
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight focus:outline-none">
          {problem.title}
        </h2>
        <p className="font-mono text-sm text-muted">
          <span className={attempt.solved ? 'text-solved' : 'text-not-solved'}>
            {attempt.solved ? 'Solved' : 'Not solved'}
          </span>
          {` · confidence ${attempt.confidence}`}
          {attempt.used_hint && ' · hint used'}
          {` · ${formatDueDate(attempt.attempted_on)}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className={`space-y-3 p-4 ${panelClass}`}>
          <h3 className={labelClass}>Skill</h3>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span>{label}</span>
            <span className="font-mono">
              {before}% → {after}%{' '}
              {/* A drop is muted, not red: a hint solve can lower skill a little. */}
              <span className={change > 0 ? 'text-accent' : 'text-muted'}>
                {change > 0 ? `+${change}` : change < 0 ? `−${-change}` : '±0'}
              </span>
            </span>
          </div>
          <SkillBar label={label} before={attempt.skill_before} after={attempt.skill_after} />
        </section>

        {activity.data && (
          <section className={`space-y-1 p-4 ${panelClass}`}>
            <h3 className={labelClass}>Next review</h3>
            <NextReview today={activity.data.today} due={attempt.next_review_on} />
            <p className="text-sm text-muted">Back in your queue then</p>
          </section>
        )}
      </div>

      {activity.data && (
        <section className={`space-y-3 p-4 ${panelClass}`}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className={labelClass}>Activity</h3>
            <span className="font-mono text-xs text-muted">{activity.data.run} day run</span>
          </div>
          <ActivityGrid activity={activity.data} weeks={26} />
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-muted">
            <span>
              {plural(activity.data.days.reduce((sum, d) => sum + d.count, 0), 'rep')} in 26 weeks
            </span>
            <span className="flex items-center gap-1" aria-hidden="true">
              Less
              {legendClasses.map((c) => (
                <span key={c} className={`size-2.5 rounded-cell ${c}`} />
              ))}
              More
            </span>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={nextProblem} className={accentButtonClass}>
          Next problem
        </button>
        <button type="button" onClick={props.onBack} className={outlineButtonClass}>
          Back to problem
        </button>
      </div>
    </div>
  )
}

function NextReview(props: { today: string; due: string }) {
  const days = daysBetween(props.today, props.due)
  // Due today or earlier happens with a backdated attempt.
  return (
    <>
      <p className="text-3xl font-semibold text-link">{days <= 0 ? 'Today' : plural(days, 'day')}</p>
      <p className="font-mono text-sm text-muted">{formatDueDate(props.due)}</p>
    </>
  )
}
