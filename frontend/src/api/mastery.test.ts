import { afterEach, expect, test, vi } from 'vitest'
import { getPatternMastery, getProfileSummary } from './mastery'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('getPatternMastery returns the rows', async () => {
  const rows = [{ pattern: 'stack', displayed_mastery: 0.5 }]
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(rows)))
  vi.stubGlobal('fetch', fetchMock)

  await expect(getPatternMastery()).resolves.toEqual(rows)
  expect(fetchMock).toHaveBeenCalledWith('/api/patterns/mastery')
})

test('getPatternMastery throws on an HTTP error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))

  await expect(getPatternMastery()).rejects.toThrow("Couldn't load pattern mastery (HTTP 500).")
})

test('getProfileSummary returns the summary', async () => {
  const summary = { overall: 0.4, strengths: [] }
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(summary)))
  vi.stubGlobal('fetch', fetchMock)

  await expect(getProfileSummary()).resolves.toEqual(summary)
  expect(fetchMock).toHaveBeenCalledWith('/api/profile/summary')
})

test('getProfileSummary throws on an HTTP error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })))

  await expect(getProfileSummary()).rejects.toThrow(
    "Couldn't load your profile summary (HTTP 503).",
  )
})
