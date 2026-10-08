import { useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent, type SubmitEvent } from 'react'
import type { Difficulty, Pattern, ProblemCreate, ProblemRead } from '../api/generated'
import { DIFFICULTY_LABELS, PATTERN_LABELS } from '../api/labels'
import { createProblem, type FieldErrors } from '../api/problems'
import { queryKeys } from '../api/queries'
import { errorProps, Field, inputClass, submitClass } from './fields'

// Everything is a string while editing; converted to ProblemCreate on submit.
const EMPTY = { title: '', link: '', pattern: '', difficulty: '', notes: '' }
type FormValues = typeof EMPTY

export function AddProblemForm() {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  const [saved, setSaved] = useState<ProblemRead | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function update(field: keyof FormValues) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues((current) => ({ ...current, [field]: event.target.value }))
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    setSaved(null)

    const body: ProblemCreate = {
      title: values.title,
      link: values.link,
      // The selects are `required`, so the browser won't submit an empty choice.
      pattern: values.pattern as Pattern,
      difficulty: values.difficulty as Difficulty,
      notes: values.notes,
    }
    const result = await createProblem(body)
    setSubmitting(false)

    if (result.ok) {
      setSaved(result.problem)
      setValues(EMPTY)
      setFieldErrors({})
      // Anything showing the problem list (e.g. the log-attempt dropdown) refetches.
      void queryClient.invalidateQueries({ queryKey: queryKeys.problems })
      void queryClient.invalidateQueries({ queryKey: queryKeys.queue })
      void queryClient.invalidateQueries({ queryKey: queryKeys.patternMastery })
      void queryClient.invalidateQueries({ queryKey: queryKeys.profileSummary })
      void queryClient.invalidateQueries({ queryKey: queryKeys.suggestion })
    } else {
      setMessage(result.message)
      setFieldErrors(result.fieldErrors)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold">Add a problem</h2>

      <Field id="title" label="Title" error={fieldErrors.title}>
        <input
          id="title"
          required
          maxLength={200}
          value={values.title}
          onChange={update('title')}
          className={inputClass}
          {...errorProps('title', fieldErrors.title)}
        />
      </Field>

      <Field id="link" label="LeetCode link" error={fieldErrors.link}>
        <input
          id="link"
          type="url"
          required
          maxLength={500}
          placeholder="https://leetcode.com/problems/two-sum/"
          value={values.link}
          onChange={update('link')}
          className={inputClass}
          {...errorProps('link', fieldErrors.link)}
        />
      </Field>

      <Field id="pattern" label="Pattern" error={fieldErrors.pattern}>
        <select
          id="pattern"
          required
          value={values.pattern}
          onChange={update('pattern')}
          className={inputClass}
          {...errorProps('pattern', fieldErrors.pattern)}
        >
          <option value="">Choose a pattern…</option>
          {Object.entries(PATTERN_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field id="difficulty" label="Difficulty" error={fieldErrors.difficulty}>
        <select
          id="difficulty"
          required
          value={values.difficulty}
          onChange={update('difficulty')}
          className={inputClass}
          {...errorProps('difficulty', fieldErrors.difficulty)}
        >
          <option value="">Choose a difficulty…</option>
          {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field id="notes" label="Notes (optional)" error={fieldErrors.notes}>
        <textarea
          id="notes"
          rows={3}
          value={values.notes}
          onChange={update('notes')}
          className={inputClass}
          {...errorProps('notes', fieldErrors.notes)}
        />
      </Field>

      {message && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {message}
        </p>
      )}
      {saved && (
        <p role="status" className="text-green-700 dark:text-green-400">
          Saved {saved.title}.
        </p>
      )}

      <button type="submit" disabled={submitting} className={submitClass}>
        {submitting ? 'Saving…' : 'Add problem'}
      </button>
    </form>
  )
}
