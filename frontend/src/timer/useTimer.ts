import { useEffect, useState } from 'react'
import { elapsedMs, IDLE, isTimerState, pause, setElapsed, start, type TimerState } from './timer'

export const STORAGE_KEY = 'reps.timer'

function load(): TimerState {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return isTimerState(parsed) ? parsed : IDLE
  } catch {
    // Storage blocked (private mode) or corrupted: start fresh.
    return IDLE
  }
}

function save(state: TimerState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Without storage the timer still works; it just won't survive a refresh.
  }
}

export function useTimer() {
  const [state, setState] = useState<TimerState>(load)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    save(state)
  }, [state])

  // Re-render once a second while running so the display ticks. Elapsed time
  // is always recomputed from `state`, so a missed tick never loses time.
  const running = state.runningSince !== null
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])

  return {
    problemId: state.problemId,
    running,
    elapsedMs: elapsedMs(state, now),
    /** `fromMs` continues from a typed time instead of the timer's own. */
    start: (problemId: number, fromMs?: number) => {
      const t = Date.now()
      setNow(t)
      setState((s) => start(fromMs === undefined ? s : setElapsed(s, fromMs, problemId), t, problemId))
    },
    pause: () => {
      const t = Date.now()
      setNow(t)
      setState((s) => pause(s, t))
    },
    reset: () => setState(IDLE),
  }
}
