import { afterEach, expect, test, vi } from 'vitest'
import type { QueueItem } from './generated'
import { getTodaysQueue } from './queue'

const QUEUE: QueueItem[] = [
  {
    problem: {
      id: 7,
      title: 'Two Sum',
      link: 'https://leetcode.com/problems/two-sum/',
      pattern: 'arrays_hashing',
      difficulty: 'easy',
      notes: '',
      is_premium: false,
    },
    due_on: '2026-10-03',
  },
]

afterEach(() => {
  vi.unstubAllGlobals()
})

test('getTodaysQueue returns the queue', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(QUEUE)))
  vi.stubGlobal('fetch', fetchMock)

  await expect(getTodaysQueue()).resolves.toEqual(QUEUE)
  expect(fetchMock).toHaveBeenCalledWith('/api/queue')
})

test('getTodaysQueue throws on an HTTP error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))

  await expect(getTodaysQueue()).rejects.toThrow("Couldn't load today's queue (HTTP 500).")
})
