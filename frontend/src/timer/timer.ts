// Pure timer logic. Times are passed in (rather than read from Date.now())
// so tests can control the clock.

export type TimerState = {
  bankedMs: number // time from finished stretches
  runningSince: number | null // start of the current stretch, or null if paused
  problemId: number | null // the problem being timed; null only when idle
}

export const IDLE: TimerState = { bankedMs: 0, runningSince: null, problemId: null }

/** No-op if already running, or if the timer (even paused) belongs to another problem. */
export function start(state: TimerState, now: number, problemId: number): TimerState {
  if (state.runningSince !== null) return state
  if (state.problemId !== null && state.problemId !== problemId) return state
  return { ...state, runningSince: now, problemId }
}

export function pause(state: TimerState, now: number): TimerState {
  if (state.runningSince === null) return state
  return { ...state, bankedMs: state.bankedMs + (now - state.runningSince), runningSince: null }
}

export function elapsedMs(state: TimerState, now: number): number {
  const current = state.runningSince === null ? 0 : now - state.runningSince
  // max() guards against the system clock moving backwards.
  return state.bankedMs + Math.max(0, current)
}

export function isTimerState(value: unknown): value is TimerState {
  if (typeof value !== 'object' || value === null) return false
  const { bankedMs, runningSince, problemId } = value as Record<string, unknown>
  return (
    typeof bankedMs === 'number' &&
    bankedMs >= 0 &&
    (runningSince === null || typeof runningSince === 'number') &&
    (problemId === null || typeof problemId === 'number')
  )
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return hours > 0 ? `${hours}:${mmss}` : mmss
}
