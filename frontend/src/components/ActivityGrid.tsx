import { buildWeeks } from '../activity'
import type { ActivityRead } from '../api/generated'
import { formatDueDate } from '../dates'
import { plural } from '../format'

// Written out in full so Tailwind can find the classes.
const levelClasses = ['bg-grid-0', 'bg-grid-1', 'bg-grid-2', 'bg-grid-3', 'bg-grid-4']
const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', '']

/**
 * Weeks as columns, Sunday on top. Row 1 holds month labels and column 1 the
 * day labels; each square is placed by its week and weekday, so the current
 * week simply stops at today.
 */
export function ActivityGrid(props: { activity: ActivityRead; weeks: number }) {
  const weeks = buildWeeks(props.activity, props.weeks)

  return (
    <div
      role="group"
      aria-label={`Activity, last ${props.weeks} weeks`}
      className="grid gap-[3px] font-mono text-[10px] leading-none text-muted"
      // minmax(0, 1fr): squares share the width, and a month label can spill
      // past its column instead of widening it. maxWidth caps squares near 14px.
      style={{
        gridTemplateColumns: `auto repeat(${props.weeks}, minmax(0, 1fr))`,
        maxWidth: `${props.weeks * 17 + 28}px`,
      }}
    >
      {weeks.map(
        (week, w) =>
          week.month && (
            <span
              key={`month-${w}`}
              className="pb-1 whitespace-nowrap"
              style={{ gridColumn: w + 2, gridRow: 1 }}
            >
              {week.month}
            </span>
          ),
      )}
      {dayLabels.map(
        (label, d) =>
          label && (
            <span key={label} className="self-center pr-1" style={{ gridColumn: 1, gridRow: d + 2 }}>
              {label}
            </span>
          ),
      )}
      {weeks.map((week, w) =>
        week.cells.map((cell, d) => {
          const label = `${formatDueDate(cell.day)}: ${plural(cell.count, 'rep')}`
          const today = cell.day === props.activity.today ? 'outline-1 outline-accent' : ''
          return (
            <span
              key={cell.day}
              role="img"
              aria-label={label}
              title={label}
              className={`aspect-square rounded-cell ${levelClasses[cell.level]} ${today}`}
              style={{ gridColumn: w + 2, gridRow: d + 2 }}
            />
          )
        }),
      )}
    </div>
  )
}
