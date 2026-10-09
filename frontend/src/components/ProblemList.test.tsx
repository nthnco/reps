import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Pattern, PlanRead, ProblemRead } from '../api/generated'
import { PATTERN_LABELS } from '../api/labels'
import { getPatternMastery } from '../api/mastery'
import { getTodaysPlan } from '../api/plan'
import { listProblems } from '../api/problems'
import { untouched } from '../test/mastery'
import { renderWithProviders } from '../test/render'
import { ProblemList } from './ProblemList'

vi.mock('../api/problems', () => ({ listProblems: vi.fn() }))
vi.mock('../api/mastery', () => ({ getPatternMastery: vi.fn() }))
vi.mock('../api/plan', () => ({ getTodaysPlan: vi.fn() }))
const listProblemsMock = vi.mocked(listProblems)
const getPatternMasteryMock = vi.mocked(getPatternMastery)
const getTodaysPlanMock = vi.mocked(getTodaysPlan)

function planSuggesting(pattern: Pattern | null): PlanRead {
  return {
    today: '2026-10-08',
    budget_seconds: 3600,
    items: [],
    backlog: [],
    suggestion: pattern && { pattern, problem: null, reason: 'keep_reviewing' },
  }
}

function problem(
  id: number,
  title: string,
  pattern: ProblemRead['pattern'],
  difficulty: ProblemRead['difficulty'],
): ProblemRead {
  return { id, title, link: `https://leetcode.com/problems/${id}/`, pattern, difficulty, notes: '', is_premium: false }
}

function masteryWithCovered(...covered: Pattern[]) {
  return (Object.keys(PATTERN_LABELS) as Pattern[]).map((p) => ({
    ...untouched(p),
    covered: covered.includes(p),
  }))
}

beforeEach(() => {
  listProblemsMock.mockReset()
  getPatternMasteryMock.mockReset()
  getPatternMasteryMock.mockResolvedValue(masteryWithCovered())
  getTodaysPlanMock.mockReset()
  getTodaysPlanMock.mockResolvedValue(planSuggesting(null))
})

test('a card shows mastery (a dash on low data) and solved / total per tier', async () => {
  listProblemsMock.mockResolvedValue([problem(1, 'Two Sum', 'arrays_hashing', 'easy')])
  getPatternMasteryMock.mockResolvedValue(
    masteryWithCovered().map((row) =>
      row.pattern === 'arrays_hashing'
        ? {
            ...row,
            low_data: false,
            displayed_mastery: 0.724,
            solved_by_tier: { easy: 3, medium: 2, hard: 0 },
            total_by_tier: { easy: 3, medium: 6, hard: 0 },
          }
        : row,
    ),
  )
  renderWithProviders(<ProblemList />)

  const arrays = await screen.findByRole('button', { name: /Arrays & Hashing/ })
  expect(arrays).toHaveTextContent('Mastery 72')
  expect(arrays).toHaveTextContent('E 3/3 · M 2/6 · H 0/0')
  expect(screen.getByRole('button', { name: /Two Pointers/ })).toHaveTextContent('Mastery –')
})

test("'Next' marks the pattern today's plan suggests", async () => {
  listProblemsMock.mockResolvedValue([problem(1, 'Two Sum', 'arrays_hashing', 'easy')])
  getTodaysPlanMock.mockResolvedValue(planSuggesting('stack'))
  renderWithProviders(<ProblemList />)

  expect(await screen.findByRole('button', { name: /Stack.*Next/ })).toBeInTheDocument()
  expect(screen.getAllByText('Next')).toHaveLength(1)
})

test('stages after the first one with nothing covered are dimmed and say why', async () => {
  listProblemsMock.mockResolvedValue([problem(1, 'Two Sum', 'arrays_hashing', 'easy')])
  getPatternMasteryMock.mockResolvedValue(masteryWithCovered('arrays_hashing', 'backtracking'))
  renderWithProviders(<ProblemList />)

  const heading = async (stage: string) =>
    within(await screen.findByRole('region', { name: stage })).getByRole('heading')
  expect(await heading('Lists and trees')).not.toHaveTextContent('Suggested after')
  // Covering a later pattern out of order doesn't undim its stage.
  expect(await heading('Search')).toHaveTextContent('Suggested after Lists and trees')
  expect(await heading('Extras')).toHaveTextContent('Suggested after Lists and trees')
})

test('groups patterns into stages, each counting its covered patterns', async () => {
  listProblemsMock.mockResolvedValue([problem(1, 'Two Sum', 'arrays_hashing', 'easy')])
  getPatternMasteryMock.mockResolvedValue(masteryWithCovered('arrays_hashing', 'stack'))
  renderWithProviders(<ProblemList />)

  const foundations = await screen.findByRole('region', { name: 'Foundations' })
  expect(within(foundations).getByRole('heading')).toHaveTextContent('2 of 5 covered')
  expect(within(foundations).getByRole('button', { name: /Stack/ })).toHaveTextContent('✓')
  expect(within(foundations).getByRole('button', { name: /Two Pointers/ })).not.toHaveTextContent('✓')
  const search = screen.getByRole('region', { name: 'Search' })
  expect(within(search).getByRole('heading')).toHaveTextContent('0 of 3 covered')
})

test('a card opens its problems under its stage, easiest first, one pattern at a time', async () => {
  const user = userEvent.setup()
  listProblemsMock.mockResolvedValue([
    problem(1, 'Coin Change', 'dp_1d', 'medium'),
    problem(3, 'Climbing Stairs', 'dp_1d', 'easy'),
    problem(4, 'Two Sum', 'arrays_hashing', 'easy'),
  ])
  renderWithProviders(<ProblemList />)

  const dp = await screen.findByRole('region', { name: 'Dynamic programming' })
  const card = within(dp).getByRole('button', { name: /1-D Dynamic Programming/ })
  await user.click(card)

  expect(card).toHaveAttribute('aria-expanded', 'true')
  const items = within(dp).getAllByRole('listitem')
  expect(items.map((i) => i.textContent)).toEqual(['Climbing StairsEasy', 'Coin ChangeMedium'])
  expect(within(items[1]).getByRole('link')).toHaveAttribute('href', '/problems/1')

  await user.click(screen.getByRole('button', { name: /Arrays & Hashing/ }))
  expect(within(dp).queryByRole('list')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Two Sum' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /Arrays & Hashing/ }))
  expect(screen.queryByRole('link', { name: 'Two Sum' })).not.toBeInTheDocument()
})

test('points to the Add problem button when there are none', async () => {
  listProblemsMock.mockResolvedValue([])
  renderWithProviders(<ProblemList />)

  expect(await screen.findByText(/Use "Add problem"/)).toBeInTheDocument()
})
