import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Pattern, ProblemRead } from '../api/generated'
import { PATTERN_LABELS } from '../api/labels'
import { getPatternMastery } from '../api/mastery'
import { listProblems } from '../api/problems'
import { untouched } from '../test/mastery'
import { renderWithProviders } from '../test/render'
import { ProblemList } from './ProblemList'

vi.mock('../api/problems', () => ({ listProblems: vi.fn() }))
vi.mock('../api/mastery', () => ({ getPatternMastery: vi.fn() }))
const listProblemsMock = vi.mocked(listProblems)
const getPatternMasteryMock = vi.mocked(getPatternMastery)

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
