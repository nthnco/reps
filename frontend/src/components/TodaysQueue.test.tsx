import { screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { ProblemRead } from '../api/generated'
import { getTodaysQueue } from '../api/queue'
import { renderWithProviders } from '../test/render'
import { formatDueDate } from '../dates'
import { NEW_LIMIT, REVIEW_LIMIT, TodaysQueue } from './TodaysQueue'

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

function problem(id: number): ProblemRead {
  return { ...TWO_SUM, id, title: `Problem ${id}` }
}

test('splits due and new problems into separate lists', async () => {
  getTodaysQueueMock.mockResolvedValue([
    { problem: TWO_SUM, due_on: '2026-10-03' },
    { problem: COIN_CHANGE, due_on: null },
  ])
  renderWithProviders(<TodaysQueue />)

  const reviews = await screen.findByRole('region', { name: 'Reviews' })
  const review = within(reviews).getByRole('listitem')
  expect(within(review).getByRole('link', { name: 'Two Sum' })).toHaveAttribute(
    'href',
    '/problems/7',
  )
  expect(review).toHaveTextContent('Arrays & Hashing')
  expect(within(review).getByText('Easy')).toHaveClass('bg-green-100')
  expect(review).toHaveTextContent('Due Oct 3')

  const fresh = within(screen.getByRole('region', { name: 'New' })).getByRole('listitem')
  expect(fresh).toHaveTextContent('Coin Change')
  expect(fresh).toHaveTextContent('1-D Dynamic Programming')
  expect(within(fresh).getByText('Medium')).toHaveClass('bg-yellow-100')
  expect(fresh).toHaveTextContent('New')
})

test('shows only the first few of each list, in API order, and counts the rest', async () => {
  const due = Array.from({ length: REVIEW_LIMIT + 3 }, (_, i) => ({
    problem: problem(i),
    due_on: '2026-10-03',
  }))
  const fresh = Array.from({ length: NEW_LIMIT + 2 }, (_, i) => ({
    problem: problem(100 + i),
    due_on: null,
  }))
  getTodaysQueueMock.mockResolvedValue([...due, ...fresh])
  renderWithProviders(<TodaysQueue />)

  const reviews = await screen.findByRole('region', { name: 'Reviews' })
  const shown = within(reviews).getAllByRole('listitem')
  expect(shown).toHaveLength(REVIEW_LIMIT)
  expect(shown[0]).toHaveTextContent('Problem 0')
  expect(reviews).toHaveTextContent(`(${REVIEW_LIMIT + 3})`)
  expect(reviews).toHaveTextContent('+3 more after these')

  const news = screen.getByRole('region', { name: 'New' })
  expect(within(news).getAllByRole('listitem')).toHaveLength(NEW_LIMIT)
  expect(news).toHaveTextContent('+2 more after these')
})

test('leaves out an empty list and the "more" line when everything fits', async () => {
  getTodaysQueueMock.mockResolvedValue([{ problem: COIN_CHANGE, due_on: null }])
  renderWithProviders(<TodaysQueue />)

  await screen.findByRole('region', { name: 'New' })
  expect(screen.queryByRole('region', { name: 'Reviews' })).not.toBeInTheDocument()
  expect(screen.queryByText(/more after these/)).not.toBeInTheDocument()
})

test('says so when nothing is due', async () => {
  getTodaysQueueMock.mockResolvedValue([])
  renderWithProviders(<TodaysQueue />)

  expect(await screen.findByText('Nothing due today.')).toBeInTheDocument()
})

test('shows a loading message while the queue loads', () => {
  getTodaysQueueMock.mockReturnValue(new Promise(() => {})) // never resolves
  renderWithProviders(<TodaysQueue />)

  expect(screen.getByText("Loading today's queue…")).toBeInTheDocument()
})

test('shows the error when the queue fails to load', async () => {
  getTodaysQueueMock.mockRejectedValue(new Error("Couldn't load today's queue (HTTP 500)."))
  renderWithProviders(<TodaysQueue />)

  expect(await screen.findByRole('alert')).toHaveTextContent(
    "Couldn't load today's queue (HTTP 500).",
  )
})

test('formats due dates without shifting the day by timezone', () => {
  expect(formatDueDate('2026-10-03')).toBe('Oct 3')
  expect(formatDueDate('2026-01-01')).toBe('Jan 1')
})
