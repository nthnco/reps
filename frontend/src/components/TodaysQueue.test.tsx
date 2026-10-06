import { screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { ProblemRead } from '../api/generated'
import { getTodaysQueue } from '../api/queue'
import { renderWithQueryClient } from '../test/render'
import { formatDueDate } from '../dates'
import { TodaysQueue } from './TodaysQueue'

vi.mock('../api/queue', () => ({ getTodaysQueue: vi.fn() }))
const getTodaysQueueMock = vi.mocked(getTodaysQueue)

const TWO_SUM: ProblemRead = {
  id: 7,
  title: 'Two Sum',
  link: 'https://leetcode.com/problems/two-sum/',
  pattern: 'arrays_hashing',
  difficulty: 'easy',
  notes: '',
}
const COIN_CHANGE: ProblemRead = {
  id: 9,
  title: 'Coin Change',
  link: 'https://leetcode.com/problems/coin-change/',
  pattern: 'dp_1d',
  difficulty: 'medium',
  notes: '',
}

beforeEach(() => {
  getTodaysQueueMock.mockReset()
})

test('lists due and new problems in the order the API returns them', async () => {
  getTodaysQueueMock.mockResolvedValue([
    { problem: TWO_SUM, due_on: '2026-10-03' },
    { problem: COIN_CHANGE, due_on: null },
  ])
  renderWithQueryClient(<TodaysQueue />)

  const items = await screen.findAllByRole('listitem')
  expect(items).toHaveLength(2)

  expect(within(items[0]).getByRole('link', { name: 'Two Sum' })).toHaveAttribute(
    'href',
    'https://leetcode.com/problems/two-sum/',
  )
  expect(items[0]).toHaveTextContent('Arrays & Hashing · Easy')
  expect(items[0]).toHaveTextContent('Due Oct 3')

  expect(items[1]).toHaveTextContent('Coin Change')
  expect(items[1]).toHaveTextContent('1-D Dynamic Programming · Medium')
  expect(items[1]).toHaveTextContent('New')
})

test('says so when nothing is due', async () => {
  getTodaysQueueMock.mockResolvedValue([])
  renderWithQueryClient(<TodaysQueue />)

  expect(await screen.findByText('Nothing due today.')).toBeInTheDocument()
})

test('shows a loading message while the queue loads', () => {
  getTodaysQueueMock.mockReturnValue(new Promise(() => {})) // never resolves
  renderWithQueryClient(<TodaysQueue />)

  expect(screen.getByText("Loading today's queue…")).toBeInTheDocument()
})

test('shows the error when the queue fails to load', async () => {
  getTodaysQueueMock.mockRejectedValue(new Error("Couldn't load today's queue (HTTP 500)."))
  renderWithQueryClient(<TodaysQueue />)

  expect(await screen.findByRole('alert')).toHaveTextContent(
    "Couldn't load today's queue (HTTP 500).",
  )
})

test('formats due dates without shifting the day by timezone', () => {
  expect(formatDueDate('2026-10-03')).toBe('Oct 3')
  expect(formatDueDate('2026-01-01')).toBe('Jan 1')
})
