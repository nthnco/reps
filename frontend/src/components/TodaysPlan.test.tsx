import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { PlanItemRead, PlanRead, ProblemRead } from '../api/generated'
import { getTodaysPlan } from '../api/plan'
import { renderWithProviders } from '../test/render'
import { TodaysPlan } from './TodaysPlan'

vi.mock('../api/plan', () => ({ getTodaysPlan: vi.fn() }))
const getTodaysPlanMock = vi.mocked(getTodaysPlan)

function problem(id: number, title: string): ProblemRead {
  return {
    id,
    title,
    link: `https://leetcode.com/problems/p${id}/`,
    pattern: 'intervals',
    difficulty: 'medium',
    notes: '',
    is_premium: false,
  }
}

function item(id: number, title: string, overrides: Partial<PlanItemRead> = {}): PlanItemRead {
  return { problem: problem(id, title), due_on: '2026-10-03', estimate_seconds: 1200, done: false, ...overrides }
}

function plan(overrides: Partial<PlanRead> = {}): PlanRead {
  return {
    today: '2026-10-08',
    budget_seconds: 3600,
    items: [],
    backlog: [],
    suggestion: null,
    ...overrides,
  }
}

beforeEach(() => {
  getTodaysPlanMock.mockReset()
})

test('the new problem carries its reason; reviews their due date; done ones say so', async () => {
  const meetingRooms = item(1, 'Meeting Rooms', { due_on: null, estimate_seconds: 900 })
  getTodaysPlanMock.mockResolvedValue(
    plan({
      items: [meetingRooms, item(2, 'Merge Intervals'), item(3, 'Insert Interval', { done: true })],
      suggestion: { pattern: 'intervals', problem: meetingRooms.problem, reason: 'step_back' },
    }),
  )
  renderWithProviders(<TodaysPlan />)

  const [newOne, review, done] = await screen.findAllByRole('listitem')
  expect(newOne).toHaveTextContent("Your last two Intervals attempts failed, so here's an easier one.")
  expect(newOne).toHaveTextContent('New')
  expect(newOne).toHaveTextContent('~15 min')
  expect(review).toHaveTextContent('Due Oct 3')
  expect(review).not.toHaveTextContent('attempts failed')
  expect(done).toHaveTextContent('✓ Done')
  expect(screen.getByText('About 55 min of 60 min')).toBeInTheDocument()
})

test('the backlog is collapsed, with its count and time', async () => {
  const user = userEvent.setup()
  getTodaysPlanMock.mockResolvedValue(
    plan({ items: [item(1, 'Planned')], backlog: [item(2, 'Later'), item(3, 'Even later')] }),
  )
  renderWithProviders(<TodaysPlan />)

  const summary = await screen.findByText('+2 more reviews due (about 40 min), for another day')
  expect(screen.getByRole('link', { name: 'Later' })).not.toBeVisible()

  await user.click(summary)
  expect(within(summary.closest('details')!).getByRole('link', { name: 'Later' })).toBeVisible()
})

test('with no new problem, the suggestion still says why', async () => {
  getTodaysPlanMock.mockResolvedValue(
    plan({
      items: [item(1, 'Merge Intervals')],
      suggestion: { pattern: 'arrays_hashing', problem: null, reason: 'keep_reviewing' },
    }),
  )
  renderWithProviders(<TodaysPlan />)

  expect(
    await screen.findByText('Nothing new is left in Arrays & Hashing. Keep reviewing it.'),
  ).toBeInTheDocument()
})

test('says when every item is done', async () => {
  getTodaysPlanMock.mockResolvedValue(plan({ items: [item(1, 'Merge Intervals', { done: true })] }))
  renderWithProviders(<TodaysPlan />)

  expect(await screen.findByText(/All done for today\./)).toBeInTheDocument()
})
