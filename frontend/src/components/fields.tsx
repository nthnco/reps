import type { ReactNode } from 'react'

export const inputClass =
  'w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-900'

export const submitClass =
  'rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50'

/** Marks an input invalid and links it to its error text (read by screen readers). */
export function errorProps(id: string, error: string | undefined) {
  return error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {}
}

export function FieldError(props: { id: string; error?: string }) {
  return props.error ? (
    <p id={`${props.id}-error`} className="text-sm text-red-600 dark:text-red-400">
      {props.error}
    </p>
  ) : null
}

export function Field(props: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={props.id} className="block font-medium">
        {props.label}
      </label>
      {props.children}
      <FieldError id={props.id} error={props.error} />
    </div>
  )
}
