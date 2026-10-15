import { useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { createAttempt, type AttemptFieldErrors } from '../api/attempts'
import type { AttemptCreate, ProblemRead } from '../api/generated'
import { queryKeys, useProblems } from '../api/queries'
import { formatDuration } from '../timer/timer'
import { useTimer } from '../timer/useTimer'
import {
  cardClass,
  errorProps,
  FieldError,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  submitClass,
} from './fields'
import { SegmentedChoice, type Choice } from './SegmentedChoice'

type Result = 'solved' | 'not-solved'
type Confidence = '1' | '2' | '3' | '4' | '5'

type FormValues = {
  minutes: string
  solved: Result | null
  confidence: Confidence | null
  usedHint: boolean
  attemptedOn: string // blank = today, decided by the server
}

const EMPTY: FormValues = {
  minutes: '',
  solved: null,
  confidence: null,
  usedHint: false,
  attemptedOn: '',
}

const LONG_TIMER_SECONDS = 3 * 60 * 60

// The icons are hidden from screen readers; the text already says it.
const RESULT_OPTIONS: Choice<Result>[] = [
  { value: 'solved', tone: 'solved', label: <><span aria-hidden="true">✓</span> Solved</> },
  { value: 'not-solved', tone: 'not-solved', label: <><span aria-hidden="true">✕</span> Not solved</> },
]

const CONFIDENCE_WORDS = { '1': 'Shaky', '2': 'Unsure', '3': 'Okay', '4': 'Solid', '5': 'Cold' }

const CONFIDENCE_OPTIONS = Object.entries(CONFIDENCE_WORDS).map(
  ([value, word]): Choice<Confidence> => ({
    value: value as Confidence,
    // The space keeps the name "4 Solid", not "4Solid"; the column layout hides it.
    label: (
      <>
        <span className="font-mono text-lg">{value}</span>{' '}
        <span className="font-mono text-xs text-muted">{word}</span>
      </>
    ),
  }),
)

export function LogAttemptForm({ problem }: { problem: ProblemRead }) {
  const queryClient = useQueryClient()
  const timer = useTimer()
  // Only one problem is timed at a time (even while paused), so this form
  // ignores a timer that belongs to another problem.
  const ownsTimer = timer.problemId === problem.id
  const elapsedMs = ownsTimer ? timer.elapsedMs : 0
  const otherProblemId = timer.problemId !== null && !ownsTimer ? timer.problemId : null
  const otherProblem = useProblems().data?.find((p) => p.id === otherProblemId)
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<AttemptFieldErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  const [logged, setLogged] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function update(field: 'minutes' | 'attemptedOn') {
    return (event: ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [field]: event.target.value }))
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setLogged(false)

    // Typed minutes win; otherwise use the timer.
    const durationSeconds =
      values.minutes !== ''
        ? Math.round(Number(values.minutes) * 60)
        : Math.floor(elapsedMs / 1000)
    if (values.minutes === '' && durationSeconds === 0) {
      setFieldErrors({ duration_seconds: 'Start the timer or enter minutes.' })
      return
    }
    // A timer left running (e.g. overnight) would otherwise be logged silently.
    if (
      values.minutes === '' &&
      durationSeconds > LONG_TIMER_SECONDS &&
      !window.confirm(
        `The timer says ${formatDuration(elapsedMs)}. Log it anyway?\n\n` +
          'Cancel to go back and type the minutes instead.',
      )
    ) {
      return
    }

    const body: AttemptCreate = {
      solved: values.solved === 'solved',
      duration_seconds: durationSeconds,
      confidence: Number(values.confidence),
      used_hint: values.usedHint,
      ...(values.attemptedOn && { attempted_on: values.attemptedOn }),
    }

    setSubmitting(true)
    const result = await createAttempt(problem.id, body)
    setSubmitting(false)

    if (result.ok) {
      setLogged(true)
      setValues(EMPTY)
      setFieldErrors({})
      if (ownsTimer) timer.reset()
      // The attempt moves this problem's next review date and its pattern's mastery.
      void queryClient.invalidateQueries({ queryKey: queryKeys.patternMastery })
      void queryClient.invalidateQueries({ queryKey: queryKeys.profileSummary })
      void queryClient.invalidateQueries({ queryKey: queryKeys.plan })
    } else {
      setMessage(result.message)
      setFieldErrors(result.fieldErrors)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-lg font-semibold">Log an attempt</h3>

      <div className={`divide-y divide-gray-100 dark:divide-gray-800 ${cardClass}`}>
        <div className="space-y-3 p-5">
          <p className={labelClass}>Time</p>
          {otherProblemId !== null ? (
            <p role="status">
              The timer is in use for{' '}
              <Link
                to={`/problems/${otherProblemId}`}
                className="text-blue-700 hover:underline dark:text-blue-400"
              >
                {otherProblem?.title ?? 'another problem'}
              </Link>
              . Log or reset it there first, or{' '}
              {/* Escape hatch if that problem's page can't be reached. */}
              <button type="button" onClick={timer.reset} className="underline">
                discard it
              </button>
              .
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`min-w-32 font-mono text-4xl tabular-nums ${timer.running && ownsTimer ? '' : 'text-gray-400 dark:text-gray-500'}`}
                aria-label="Timer"
              >
                {formatDuration(elapsedMs)}
              </span>
              {/* type="button": a plain <button> inside a form would submit it. */}
              {timer.running ? (
                <button type="button" onClick={timer.pause} className={secondaryButtonClass}>
                  Pause
                </button>
              ) : ownsTimer ? (
                <button
                  type="button"
                  onClick={() => timer.start(problem.id)}
                  className={primaryButtonClass}
                >
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    timer.start(problem.id)
                    // Called straight from the click, so popup blockers allow it.
                    window.open(problem.link, '_blank', 'noopener,noreferrer')
                  }}
                  className={primaryButtonClass}
                >
                  Start problem <span aria-hidden="true">↗</span>
                </button>
              )}
              <button
                type="button"
                onClick={timer.reset}
                disabled={!ownsTimer}
                className={ghostButtonClass}
              >
                Reset
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="minutes">Or enter minutes</label>
            <input
              id="minutes"
              type="number"
              min={0}
              max={24 * 60}
              value={values.minutes}
              onChange={update('minutes')}
              className={`${inputClass} max-w-24`}
              {...errorProps('minutes', fieldErrors.duration_seconds)}
            />
            <span className="text-gray-500 dark:text-gray-400">overrides the timer</span>
          </div>
          <FieldError id="minutes" error={fieldErrors.duration_seconds} />
        </div>

        <div className="space-y-5 p-5">
          <SegmentedChoice
            name="solved"
            legend="Result"
            options={RESULT_OPTIONS}
            value={values.solved}
            onChange={(solved) => setValues((v) => ({ ...v, solved }))}
            required
          />
          <div className="space-y-2">
            <SegmentedChoice
              name="confidence"
              legend="Confidence"
              options={CONFIDENCE_OPTIONS}
              value={values.confidence}
              onChange={(confidence) => setValues((v) => ({ ...v, confidence }))}
              required
            />
            <p className="flex justify-between font-mono text-xs text-muted">
              <span>1 = shaky</span>
              <span>5 = could redo it cold</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <label className="flex min-h-11 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={values.usedHint}
              onChange={(event) => setValues((v) => ({ ...v, usedHint: event.target.checked }))}
              className="size-4 accent-accent"
            />
            Used a hint
          </label>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <label htmlFor="attempted-on" className={labelClass}>
                Date <span className="normal-case">(blank = today)</span>
              </label>
              <input
                id="attempted-on"
                type="date"
                // en-CA formats as YYYY-MM-DD. Just a hint; the server enforces "not in the future".
                max={new Date().toLocaleDateString('en-CA')}
                value={values.attemptedOn}
                onChange={update('attemptedOn')}
                className={`${inputClass} min-h-11 w-auto font-mono`}
                {...errorProps('attempted-on', fieldErrors.attempted_on)}
              />
            </div>
            <FieldError id="attempted-on" error={fieldErrors.attempted_on} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 p-5">
          <button type="submit" disabled={submitting} className={submitClass}>
            {submitting ? 'Saving…' : 'Log attempt'}
          </button>
          {message && (
            <p role="alert" className="text-red-600 dark:text-red-400">
              {message}
            </p>
          )}
          {logged && (
            <p role="status" className="text-green-700 dark:text-green-400">
              Logged attempt for {problem.title}.
            </p>
          )}
        </div>
      </div>
    </form>
  )
}
