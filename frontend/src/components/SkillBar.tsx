import { toPercent } from '../format'
import { skillSegments } from '../skill'

/**
 * A pattern's raw skill. With `before` (Rep logged), a gain draws in accent
 * after the old level; a drop draws only the new level.
 */
export function SkillBar(props: { label: string; after: number; before?: number }) {
  const { base, gain } = skillSegments(props.after, props.before)
  const now = toPercent(props.after)
  const change = props.before === undefined ? 0 : now - toPercent(props.before)
  // The gain is only visible as color, so say it for screen readers.
  const text =
    change === 0 ? `${now}%` : `${now}%, ${change > 0 ? 'up' : 'down'} ${Math.abs(change)} from ${now - change}%`

  return (
    <div
      role="meter"
      aria-label={`${props.label} skill`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={now}
      aria-valuetext={text}
      className="flex h-2 overflow-hidden rounded-full bg-line"
    >
      <div className="bg-bar-old" style={{ width: `${base}%` }} />
      {gain > 0 && <div className="bg-accent" style={{ width: `${gain}%` }} />}
    </div>
  )
}
