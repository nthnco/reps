import { useState, type ChangeEvent, type SubmitEvent } from 'react'
import { createAttempt, type AttemptFieldErrors } from '../api/attempts'
import type { AttemptCreate, ProblemRead } from '../api/generated'
import { useProblems } from '../api/queries'
import { formatDuration } from '../timer/timer'
import { useTimer } from '../timer/useTimer'
import { errorProps, Field, FieldError, inputClass, submitClass } from './fields'

const EMPTY = {
  problemId: '',
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

export function LogAttemptForm() {
  const problems = useProblems()
  const timer = useTimer()
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<AttemptFieldErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  const [logged, setLogged] = useState<ProblemRead | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Without the dropdown there's no `required` problem field to block submit.
  const hasProblems = (problems.data?.length ?? 0) > 0

  function update(field: Exclude<keyof FormValues, 'usedHint'>) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((current) => ({ ...current, [field]: event.target.value }))
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setLogged(null)

    // Typed minutes win; otherwise use the timer.
    const durationSeconds =
      values.minutes !== ''
        ? Math.round(Number(values.minutes) * 60)
        : Math.floor(timer.elapsedMs / 1000)
    if (values.minutes === '' && durationSeconds === 0) {
      setFieldErrors({ duration_seconds: 'Start the timer or enter minutes.' })
      return
    }
    // A timer left running (e.g. overnight) would otherwise be logged silently.
    if (
      values.minutes === '' &&
      durationSeconds > LONG_TIMER_SECONDS &&
      !window.confirm(
        `The timer says ${formatDuration(timer.elapsedMs)}. Log it anyway?\n\n` +
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
    const result = await createAttempt(Number(values.problemId), body)
    setSubmitting(false)

    if (result.ok) {
      setLogged(problems.data?.find((p) => p.id === result.attempt.problem_id) ?? null)
      setValues(EMPTY)
      setFieldErrors({})
      timer.reset()
    } else {
      setMessage(result.message)
      setFieldErrors(result.fieldErrors)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold">Log an attempt</h2>

      <Field id="problem" label="Problem">
        {problems.isPending ? (
          <p>Loading problems…</p>
        ) : problems.isError ? (
          <p role="alert" className="text-red-600 dark:text-red-400">
            {problems.error.message}
          </p>
        ) : problems.data.length === 0 ? (
          <p>No problems yet. Add one above first.</p>
        ) : (
          <select
            id="problem"
            required
            value={values.problemId}
            onChange={update('problemId')}
            className={inputClass}
          >
            <option value="">Choose a problem…</option>
            {problems.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="space-y-2">
        <p className="font-medium">Time</p>
        <div className="flex items-center gap-2">
          <span className="w-20 font-mono text-2xl" aria-label="Timer">
            {formatDuration(timer.elapsedMs)}
          </span>
          {/* type="button": a plain <button> inside a form would submit it. */}
          {timer.running ? (
            <button type="button" onClick={timer.pause} className={buttonClass}>
              Pause
            </button>
          ) : (
            <button type="button" onClick={timer.start} className={buttonClass}>
              {timer.elapsedMs > 0 ? 'Resume' : 'Start'}
            </button>
          )}
          <button
            type="button"
            onClick={timer.reset}
            disabled={!timer.running && timer.elapsedMs === 0}
            className={buttonClass}
          >
            Reset
          </button>
        </div>
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
          Logged attempt for {logged.title}.
        </p>
      )}

      <button type="submit" disabled={submitting || !hasProblems} className={submitClass}>
        {submitting ? 'Saving…' : 'Log attempt'}
      </button>
    </form>
  )
}
