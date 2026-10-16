import { useSyncExternalStore } from 'react'
import type { Pace } from './api/generated'

export const PACES: Pace[] = ['light', 'steady', 'intense']

export const PACE_STORAGE_KEY = 'reps.pace'

// Stored per browser until accounts exist. Anything unreadable or unknown
// (an old value, a private window that throws) is steady, the server's default.
export function readPace(): Pace {
  try {
    const stored = localStorage.getItem(PACE_STORAGE_KEY)
    return PACES.find((p) => p === stored) ?? 'steady'
  } catch {
    return 'steady'
  }
}

const listeners = new Set<() => void>()

export function setPace(pace: Pace) {
  try {
    localStorage.setItem(PACE_STORAGE_KEY, pace)
  } catch {
    // Storage blocked: nothing to switch to, so the dropdown stays on steady.
    return
  }
  listeners.forEach((listener) => listener())
}

// Module level, not inline: a new subscribe function each render would
// unsubscribe and resubscribe every time.
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The current pace; every component using it re-renders when it changes. */
export function usePace(): Pace {
  return useSyncExternalStore(subscribe, readPace)
}
