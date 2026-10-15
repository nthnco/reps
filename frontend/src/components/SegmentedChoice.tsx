import type { ReactNode } from 'react'
import { labelClass } from './fields'

// Selected look per tone. Written out in full so Tailwind can find the classes.
const tones = {
  accent: 'has-checked:border-accent has-checked:text-accent',
  solved: 'has-checked:border-solved has-checked:bg-solved/10 has-checked:text-solved',
  'not-solved':
    'has-checked:border-not-solved has-checked:bg-not-solved/10 has-checked:text-not-solved',
}

export type Choice<T extends string> = {
  value: T
  label: ReactNode
  tone?: keyof typeof tones
}

/**
 * A row of buttons that picks one value, built as a real radio group. The
 * radios are visually hidden but not removed, so the legend names the group,
 * Tab stops once, arrow keys move between options, and `required` blocks submit.
 */
export function SegmentedChoice<T extends string>(props: {
  name: string
  legend: string
  options: Choice<T>[]
  value: T | null
  onChange: (value: T) => void
  required?: boolean
}) {
  return (
    <fieldset className="space-y-2">
      <legend className={labelClass}>{props.legend}</legend>
      {/* One equal-width column per option, however many there are. */}
      <div className="grid auto-cols-fr grid-flow-col gap-2">
        {props.options.map((option) => (
          <label
            key={option.value}
            className={`flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-button border border-line px-2 py-2 text-sm font-medium hover:bg-line/50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-link ${tones[option.tone ?? 'accent']}`}
          >
            <input
              type="radio"
              name={props.name}
              value={option.value}
              required={props.required}
              checked={props.value === option.value}
              onChange={() => props.onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
