import { toPercent } from './format'

/**
 * Bar widths in whole percents: `base` in bar-old, then `gain` in accent.
 * Each end is rounded before subtracting, so the gain matches the "+6" next
 * to "60% → 66%" and base + gain is exactly the shown after.
 */
export function skillSegments(after: number, before?: number): { base: number; gain: number } {
  const now = toPercent(after)
  const was = before === undefined ? now : toPercent(before)
  return was < now ? { base: was, gain: now - was } : { base: now, gain: 0 }
}
