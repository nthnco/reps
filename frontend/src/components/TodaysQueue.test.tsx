import { screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { ProblemRead } from '../api/generated'
import { getTodaysQueue } from '../api/queue'
import { renderWithProviders } from '../test/render'
import { formatDueDate } from '../dates'
import { REVIEW_LIMIT, TodaysQueue } from './TodaysQueue'

vi.mock('../api/queue', () => ({ getTodaysQueue: vi.fn() }))
const getTodaysQueueMock = vi.mocked(getTodaysQueue)

const TWO_SUM: ProblemRead = {
  id: 7,
  title: 'Two Sum',
  link: 'https://leetcode.com/problems/two-sum/',
  pattern: 'arrays_hashing',
  difficulty: 'easy',
  notes: '',
  is_premium: false,
}

beforeEach(() => {
  getTodaysQueueMock.mockReset()
})

function problem(id: number): ProblemRead {
  return { ...TWO_SUM, id, title: `Problem ${id}` }
}

test('shows due problems with pattern, difficulty and due date', async () => {
  getTodaysQueueMock.mockResolvedValue([{ problem: TWO_SUM, due_on: '2026-10-03' }])
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
  // Everything fits, so no "more" line.
  expect(screen.queryByText(/more after these/)).not.toBeInTheDocument()
})

test('shows only the first few, in API order, and counts the rest', async () => {
  const due = Array.from({ length: REVIEW_LIMIT + 3 }, (_, i) => ({
    problem: problem(i),
    due_on: '2026-10-03',
  }))
  getTodaysQueueMock.mockResolvedValue(due)
  renderWithProviders(<TodaysQueue />)

  const reviews = await screen.findByRole('region', { name: 'Reviews' })
  const shown = within(reviews).getAllByRole('listitem')
  expect(shown).toHaveLength(REVIEW_LIMIT)
  expect(shown[0]).toHaveTextContent('Problem 0')
  expect(reviews).toHaveTextContent(`(${REVIEW_LIMIT + 3})`)
  expect(reviews).toHaveTextContent('+3 more after these')
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
