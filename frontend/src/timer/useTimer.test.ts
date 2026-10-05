import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { STORAGE_KEY, useTimer } from './useTimer'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers() // also fakes Date.now()
})

afterEach(() => {
  vi.useRealTimers()
})

test('ticks while running and stops when paused', () => {
  const { result } = renderHook(() => useTimer())

  act(() => result.current.start())
  act(() => vi.advanceTimersByTime(90_000))
  expect(result.current.elapsedMs).toBe(90_000)

  act(() => result.current.pause())
  act(() => vi.advanceTimersByTime(60_000))
  expect(result.current.elapsedMs).toBe(90_000)
  expect(result.current.running).toBe(false)
})

test('survives a page refresh while running', () => {
  const first = renderHook(() => useTimer())
  act(() => first.result.current.start())
  act(() => vi.advanceTimersByTime(30_000))
  first.unmount() // the "refresh"

  vi.advanceTimersByTime(15_000) // time passes while the page is reloading
  const second = renderHook(() => useTimer())

  expect(second.result.current.running).toBe(true)
  expect(second.result.current.elapsedMs).toBe(45_000)
})

test('reset clears the saved timer', () => {
  const { result } = renderHook(() => useTimer())
  act(() => result.current.start())
  act(() => vi.advanceTimersByTime(10_000))

  act(() => result.current.reset())

  expect(result.current.elapsedMs).toBe(0)
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
    bankedMs: 0,
    runningSince: null,
  })
})

test('ignores corrupted saved data', () => {
  localStorage.setItem(STORAGE_KEY, '{not json')

  const { result } = renderHook(() => useTimer())

  expect(result.current.elapsedMs).toBe(0)
  expect(result.current.running).toBe(false)
})
