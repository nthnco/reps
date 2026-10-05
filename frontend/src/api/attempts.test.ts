import { afterEach, expect, test, vi } from 'vitest'
import { createAttempt } from './attempts'
import type { AttemptCreate } from './generated'

const BODY: AttemptCreate = { solved: true, duration_seconds: 900, confidence: 4 }

function mockFetch(status: number, json: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(json), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('posts to the problem’s attempts URL and returns the attempt', async () => {
  const saved = { ...BODY, id: 3, problem_id: 7, attempted_on: '2026-10-05', used_hint: false }
  const fetchMock = mockFetch(201, saved)

  const result = await createAttempt(7, BODY)

  expect(result).toEqual({ ok: true, attempt: saved })
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/problems/7/attempts')
  expect(JSON.parse(init.body)).toEqual(BODY)
})

test('maps a 404 to a message', async () => {
  mockFetch(404, { detail: 'Problem not found.' })

  const result = await createAttempt(7, BODY)

  expect(result).toEqual({
    ok: false,
    message: 'That problem no longer exists. Refresh and pick another.',
    fieldErrors: {},
  })
})

test('maps a 422 to per-field errors', async () => {
  mockFetch(422, {
    detail: [
      {
        type: 'value_error',
        loc: ['body', 'attempted_on'],
        msg: "Value error, can't be in the future",
        input: '2999-01-01',
      },
    ],
  })

  const result = await createAttempt(7, BODY)

  expect(result).toEqual({
    ok: false,
    message: 'Please fix the fields below.',
    fieldErrors: { attempted_on: "can't be in the future" },
  })
})
