import { useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { createAttempt, type AttemptFieldErrors } from '../api/attempts'
import type { AttemptCreate, ProblemRead } from '../api/generated'
import { queryKeys, useProblems } from '../api/queries'
import { formatDuration } from '../timer/timer'
import { useTimer } from '../timer/useTimer'
import { errorProps, Field, FieldError, inputClass, submitClass } from './fields'

const EMPTY = {
  minutes: '',
  solved: '', // 'yes' | 'no'
  confidence: '', // '1'..'5'
  usedHint: false,
  attemptedOn: '', // blank = today, decided by the server
}
type FormValues = typeof EMPTY

const LONG_TIMER_SECONDS = 3 * 60 * 60

const buttonClass =
  'rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800'

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

  function update(field: Exclude<keyof FormValues, 'usedHint'>) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
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
      solved: values.solved === 'yes',
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
      // The attempt moves this problem's next review date.
      void queryClient.invalidateQueries({ queryKey: queryKeys.queue })
    } else {
      setMessage(result.message)
      setFieldErrors(result.fieldErrors)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold">Log an attempt</h3>

      <div className="space-y-2">
        <p className="font-medium">Time</p>
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
          <div className="flex items-center gap-2">
            <span className="w-20 font-mono text-2xl" aria-label="Timer">
              {formatDuration(elapsedMs)}
            </span>
            {/* type="button": a plain <button> inside a form would submit it. */}
            {timer.running ? (
              <button type="button" onClick={timer.pause} className={buttonClass}>
                Pause
              </button>
            ) : ownsTimer ? (
              <button type="button" onClick={() => timer.start(problem.id)} className={buttonClass}>
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
                className={buttonClass}
              >
                Start problem
              </button>
            )}
            <button
              type="button"
              onClick={timer.reset}
              disabled={!ownsTimer}
              className={buttonClass}
            >
              Reset
            </button>
            {ownsTimer && (
              <a
                href={problem.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 hover:underline dark:text-blue-400"
              >
                Open on LeetCode
              </a>
            )}
          </div>
        )}
        <label htmlFor="minutes" className="block">
          Or enter minutes (overrides the timer)
        </label>
        <input
          id="minutes"
          type="number"
          min={0}
          max={24 * 60}
          value={values.minutes}
          onChange={update('minutes')}
          className={inputClass}
          {...errorProps('minutes', fieldErrors.duration_seconds)}
        />
        <FieldError id="minutes" error={fieldErrors.duration_seconds} />
      </div>

      <fieldset className="space-y-1">
        <legend className="font-medium">Result</legend>
        <div className="flex gap-4">
          {[
            ['yes', 'Solved'],
            ['no', 'Not solved'],
          ].map(([value, label]) => (
            <label key={value} className="flex items-center gap-1">
              <input
                type="radio"
                name="solved"
                value={value}
                required
                checked={values.solved === value}
                onChange={update('solved')}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="font-medium">Confidence (1 = shaky, 5 = could redo it cold)</legend>
        <div className="flex gap-4">
          {['1', '2', '3', '4', '5'].map((value) => (
            <label key={value} className="flex items-center gap-1">
              <input
                type="radio"
                name="confidence"
                value={value}
                required
                checked={values.confidence === value}
                onChange={update('confidence')}
              />
              {value}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={values.usedHint}
          onChange={(event) => setValues((v) => ({ ...v, usedHint: event.target.checked }))}
        />
        Used a hint
      </label>

      <Field id="attempted-on" label="Date (leave blank for today)" error={fieldErrors.attempted_on}>
        <input
          id="attempted-on"
          type="date"
          // en-CA formats as YYYY-MM-DD. Just a hint; the server enforces "not in the future".
          max={new Date().toLocaleDateString('en-CA')}
          value={values.attemptedOn}
          onChange={update('attemptedOn')}
          className={inputClass}
          {...errorProps('attempted-on', fieldErrors.attempted_on)}
        />
      </Field>

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

      <button type="submit" disabled={submitting} className={submitClass}>
        {submitting ? 'Saving…' : 'Log attempt'}
      </button>
    </form>
  )
}
