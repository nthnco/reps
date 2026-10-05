import { describe, expect, test } from 'vitest'
import { elapsedMs, formatDuration, IDLE, isTimerState, pause, start } from './timer'

describe('timer state', () => {
  test('counts time while running', () => {
    const running = start(IDLE, 1_000)
    expect(elapsedMs(running, 91_000)).toBe(90_000)
  })

  test('pausing banks the time and stops counting', () => {
    const paused = pause(start(IDLE, 0), 60_000)
    expect(paused).toEqual({ bankedMs: 60_000, runningSince: null })
    expect(elapsedMs(paused, 999_999)).toBe(60_000)
  })

  test('resuming adds to the banked time', () => {
    let state = start(IDLE, 0)
    state = pause(state, 60_000) // 1 min
    state = start(state, 300_000) // 4 min break
    expect(elapsedMs(state, 330_000)).toBe(90_000) // 1 min + 30 s
  })

  test('start while running and pause while paused do nothing', () => {
    const running = start(IDLE, 0)
    expect(start(running, 5_000)).toBe(running)
    expect(pause(IDLE, 5_000)).toBe(IDLE)
  })

  test('a clock moving backwards never produces negative time', () => {
    expect(elapsedMs(start(IDLE, 10_000), 5_000)).toBe(0)
  })
})

describe('isTimerState', () => {
  test.each([
    [{ bankedMs: 0, runningSince: null }, true],
    [{ bankedMs: 5, runningSince: 123 }, true],
    [null, false],
    ['garbage', false],
    [{ bankedMs: -1, runningSince: null }, false],
    [{ bankedMs: 0 }, false],
  ])('%j -> %s', (value, expected) => {
    expect(isTimerState(value)).toBe(expected)
  })
})

describe('formatDuration', () => {
  test.each([
    [0, '00:00'],
    [59_999, '00:59'],
    [90_000, '01:30'],
    [3_600_000, '1:00:00'],
    [3_725_000, '1:02:05'],
  ])('%i ms -> %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected)
  })
})
