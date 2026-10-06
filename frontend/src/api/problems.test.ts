import { afterEach, expect, test, vi } from 'vitest'
import type { ProblemCreate } from './generated'
import { createProblem, listProblems } from './problems'

const BODY: ProblemCreate = {
  title: 'Two Sum',
  link: 'https://leetcode.com/problems/two-sum/',
  pattern: 'arrays_hashing',
  difficulty: 'easy',
}

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

test('posts the problem as JSON and returns it on success', async () => {
  const saved = { ...BODY, id: 7, notes: '' }
  const fetchMock = mockFetch(201, saved)

  const result = await createProblem(BODY)

  expect(result).toEqual({ ok: true, problem: saved })
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/problems')
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body)).toEqual(BODY)
})

test('maps a 409 to an error on the link field', async () => {
  mockFetch(409, { detail: 'That problem is already in your list.' })

  const result = await createProblem(BODY)

  expect(result).toEqual({
    ok: false,
    message: 'That problem is already in your list.',
    fieldErrors: { link: 'That problem is already in your list.' },
  })
})

test('maps a 422 to per-field errors', async () => {
  mockFetch(422, {
    detail: [
      {
        type: 'value_error',
        loc: ['body', 'link'],
        msg: 'Value error, must be a https://leetcode.com/problems/... link',
        input: 'nope',
      },
      {
        type: 'string_too_short',
        loc: ['body', 'title'],
        msg: 'String should have at least 1 character',
        input: '',
      },
    ],
  })

  const result = await createProblem(BODY)

  expect(result).toEqual({
    ok: false,
    message: 'Please fix the fields below.',
    fieldErrors: {
      link: 'must be a https://leetcode.com/problems/... link',
      title: 'String should have at least 1 character',
    },
  })
})

test('reports other HTTP errors generically', async () => {
  mockFetch(500, { detail: 'Internal Server Error' })

  const result = await createProblem(BODY)

  expect(result).toEqual({
    ok: false,
    message: 'Something went wrong (HTTP 500).',
    fieldErrors: {},
  })
})

test('reports when the server is unreachable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  const result = await createProblem(BODY)

  expect(result.ok).toBe(false)
  expect(result).toMatchObject({ message: expect.stringContaining("Couldn't reach the server") })
})

test('listProblems returns the problems', async () => {
  const problems = [{ ...BODY, id: 7, notes: '' }]
  mockFetch(200, problems)

  expect(await listProblems()).toEqual(problems)
})

test('listProblems throws on an HTTP error', async () => {
  mockFetch(500, { detail: 'Internal Server Error' })

  await expect(listProblems()).rejects.toThrow("Couldn't load problems (HTTP 500).")
})
