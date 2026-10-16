import { screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { getActivity } from '../api/activity'
import type { ActivityRead, ProblemRead } from '../api/generated'
import { getPatternMastery } from '../api/mastery'
import { listProblemAttempts } from '../api/problems'
import { renderWithProviders } from '../test/render'
import { ProblemSidebar } from './ProblemSidebar'

vi.mock('../api/activity', () => ({ getActivity: vi.fn() }))
vi.mock('../api/mastery', () => ({ getPatternMastery: vi.fn() }))
vi.mock('../api/problems', () => ({ listProblemAttempts: vi.fn() }))

const TWO_SUM: ProblemRead = {
  id: 7,
  title: 'Two Sum',
  link: 'https://leetcode.com/problems/two-sum/',
  pattern: 'arrays_hashing',
  difficulty: 'easy',
  notes: '',
  is_premium: false,
}

function activity(days: ActivityRead['days']): ActivityRead {
  return { today: '2026-10-05', start: '2026-04-05', days, run: 3 }
}

beforeEach(() => {
  vi.mocked(getActivity).mockReset().mockResolvedValue(activity([]))
  vi.mocked(getPatternMastery).mockReset().mockResolvedValue([])
  vi.mocked(listProblemAttempts).mockReset().mockResolvedValue([])
})

test('nudges to extend the run only while today has no attempt', async () => {
  const { unmount } = renderWithProviders(<ProblemSidebar problem={TWO_SUM} />)
  expect(await screen.findByText('Log today to make it 4')).toBeInTheDocument()
  unmount()

  vi.mocked(getActivity).mockResolvedValue(activity([{ day: '2026-10-05', count: 1 }]))
  renderWithProviders(<ProblemSidebar problem={TWO_SUM} />)
  expect(await screen.findByText('3 day run')).toBeInTheDocument()
  expect(screen.queryByText(/Log today/)).not.toBeInTheDocument()
})

test('Last time shows the newest attempt', async () => {
  vi.mocked(listProblemAttempts).mockResolvedValue([
    { id: 2, problem_id: 7, attempted_on: '2026-10-03', solved: false, duration_seconds: 1500, confidence: 2, used_hint: true },
    { id: 1, problem_id: 7, attempted_on: '2026-09-20', solved: true, duration_seconds: 600, confidence: 4, used_hint: false },
  ])
  renderWithProviders(<ProblemSidebar problem={TWO_SUM} />)
  expect(await screen.findByText(/Oct 3/)).toHaveTextContent('Oct 3 · Not solved · 25 min')
  expect(screen.getByText(/Confidence/)).toHaveTextContent('Confidence 2 Unsure · hint used')
})
