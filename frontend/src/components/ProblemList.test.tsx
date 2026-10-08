import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { ProblemRead } from '../api/generated'
import { listProblems } from '../api/problems'
import { renderWithProviders } from '../test/render'
import { ProblemList } from './ProblemList'

vi.mock('../api/problems', () => ({ listProblems: vi.fn() }))
const listProblemsMock = vi.mocked(listProblems)

function problem(
  id: number,
  title: string,
  pattern: ProblemRead['pattern'],
  difficulty: ProblemRead['difficulty'],
): ProblemRead {
  return { id, title, link: `https://leetcode.com/problems/${id}/`, pattern, difficulty, notes: '', is_premium: false }
}

beforeEach(() => {
  listProblemsMock.mockReset()
})

test('groups problems by pattern, in pattern order, with a count each', async () => {
  listProblemsMock.mockResolvedValue([
    problem(1, 'Coin Change', 'dp_1d', 'medium'),
    problem(2, 'Two Sum', 'arrays_hashing', 'easy'),
    problem(3, 'Climbing Stairs', 'dp_1d', 'easy'),
  ])
  renderWithProviders(<ProblemList />)

  const groups = await screen.findAllByRole('group')
  expect(groups.map((g) => g.querySelector('summary')!.textContent)).toEqual([
    'Arrays & Hashing1',
    '1-D Dynamic Programming2',
  ])
})

test('a group opens to its problems, easiest first, each with a difficulty badge', async () => {
  const user = userEvent.setup()
  listProblemsMock.mockResolvedValue([
    problem(1, 'Coin Change', 'dp_1d', 'medium'),
    problem(3, 'Climbing Stairs', 'dp_1d', 'easy'),
  ])
  renderWithProviders(<ProblemList />)

  await user.click(await screen.findByText('1-D Dynamic Programming'))
  const items = within(screen.getByRole('group')).getAllByRole('listitem')
  expect(items.map((i) => i.textContent)).toEqual(['Climbing StairsEasy', 'Coin ChangeMedium'])
  expect(within(items[1]).getByRole('link')).toHaveAttribute('href', '/problems/1')
})

test('points to the Add problem button when there are none', async () => {
  listProblemsMock.mockResolvedValue([])
  renderWithProviders(<ProblemList />)

  expect(await screen.findByText(/Use "Add problem"/)).toBeInTheDocument()
})
