import type { ReactNode } from 'react'

export const inputClass =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none dark:border-gray-700 dark:bg-gray-900'

export const submitClass =
  'rounded-md bg-blue-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50'

export const primaryButtonClass =
  'rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50'

export const secondaryButtonClass =
  'rounded-md border border-gray-300 bg-white px-3 py-1.5 font-medium shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800'

/**
 * A label that wraps a visually hidden radio and looks like a toggle button.
 * The radio stays real, so keyboard arrows, `required`, and screen readers still work.
 */
export const choiceClass =
  'flex cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-gray-50 has-checked:border-blue-600 has-checked:bg-blue-600 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-blue-500/40 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800 dark:has-checked:border-blue-500 dark:has-checked:bg-blue-500'

export const ghostButtonClass =
  'rounded-md px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'

/** A white panel that lifts off the tinted page background. */
export const cardClass =
  'rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900'

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
