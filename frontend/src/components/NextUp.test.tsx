import { screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { ProblemRead } from '../api/generated'
import { getSuggestion } from '../api/mastery'
import { renderWithProviders } from '../test/render'
import { NextUp } from './NextUp'

vi.mock('../api/mastery', () => ({ getSuggestion: vi.fn() }))
const getSuggestionMock = vi.mocked(getSuggestion)

const MEETING_ROOMS: ProblemRead = {
  id: 12,
  title: 'Meeting Rooms',
  link: 'https://leetcode.com/problems/meeting-rooms/',
  pattern: 'intervals',
  difficulty: 'easy',
  notes: '',
  is_premium: true,
}

beforeEach(() => {
  getSuggestionMock.mockReset()
})

test('shows the reason with the pattern label, and links the problem', async () => {
  getSuggestionMock.mockResolvedValue({
    pattern: 'intervals',
    problem: MEETING_ROOMS,
    reason: 'step_back',
  })
  renderWithProviders(<NextUp />)

  expect(
    await screen.findByText("Your last two Intervals attempts failed, so here's an easier one."),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Meeting Rooms' })).toHaveAttribute(
    'href',
    '/problems/12',
  )
  expect(screen.getByText('Premium')).toBeInTheDocument()
})

test('keep reviewing has no problem to link', async () => {
  getSuggestionMock.mockResolvedValue({
    pattern: 'arrays_hashing',
    problem: null,
    reason: 'keep_reviewing',
  })
  renderWithProviders(<NextUp />)

  expect(
    await screen.findByText(
      'Nothing new is left in Arrays & Hashing. Keep reviewing it from the queue.',
    ),
  ).toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

test('says so when nothing new is left anywhere', async () => {
  getSuggestionMock.mockResolvedValue(null)
  renderWithProviders(<NextUp />)

  expect(await screen.findByText(/nothing new is left\. The queue/)).toBeInTheDocument()
})
