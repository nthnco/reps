import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Pattern, ProfileSummaryRead, RatingPartRead } from '../api/generated'
import { PATTERN_LABELS } from '../api/labels'
import { getProfileSummary } from '../api/mastery'
import { renderWithProviders } from '../test/render'
import { ProfileSummary } from './ProfileSummary'

vi.mock('../api/mastery', () => ({ getProfileSummary: vi.fn() }))
const getProfileSummaryMock = vi.mocked(getProfileSummary)

const PATTERNS = Object.keys(PATTERN_LABELS) as Pattern[]

// A summary where `counted` patterns are rated and every other one is not started.
function summaryWith(
  counted: Partial<Record<Pattern, number>>,
  overrides: Partial<ProfileSummaryRead> = {},
): ProfileSummaryRead {
  return {
    ...EMPTY,
    breakdown: breakdown(counted),
    not_started: PATTERNS.filter((p) => !(p in counted)),
    ...overrides,
  }
}

function breakdown(counted: Partial<Record<Pattern, number>>): RatingPartRead[] {
  return PATTERNS.map((pattern) => ({
    pattern,
    weight: 1,
    displayed_mastery: counted[pattern] ?? 0,
    counted: pattern in counted,
  }))
}

const EMPTY: ProfileSummaryRead = {
  rules: { overall_min_problems: 2, mastered_at: 0.6, strength_min_attempts: 5 },
  overall: 0,
  breakdown: breakdown({}),
  strengths: [],
  weaknesses: [],
  needs_review: [],
  not_started: PATTERNS,
  total_completed: 0,
}

beforeEach(() => {
  getProfileSummaryMock.mockReset()
})

test('shows the overall rating and what it averages over', async () => {
  getProfileSummaryMock.mockResolvedValue(
    summaryWith({ stack: 0.9, heap: 0.7 }, { overall: 0.8, total_completed: 7 }),
  )
  renderWithProviders(<ProfileSummary />)

  expect(await screen.findByText('80%')).toBeInTheDocument()
  expect(screen.getByText(/Overall, across 2 of 18 patterns · 7 problems solved/)).toBeInTheDocument()

  await userEvent.click(screen.getByText('How this is calculated'))
  const items = within(screen.getByRole('list', { name: 'Breakdown' })).getAllByRole('listitem')
  expect(items.map((item) => item.textContent)).toEqual(['Stack90%', 'Heap / Priority Queue70%'])
  expect(screen.getByText(/^The average/)).toBeInTheDocument()
})

test('ranks by the rounded percent shown, so 89.6% reads as 90% Bulletproof', async () => {
  getProfileSummaryMock.mockResolvedValue(summaryWith({ stack: 0.9, heap: 0.9 }, { overall: 0.896 }))
  renderWithProviders(<ProfileSummary />)

  expect(await screen.findByRole('meter', { name: 'Overall rating' })).toHaveAttribute(
    'aria-valuetext',
    '90%, Bulletproof',
  )
})

test('shows weights only when they differ', async () => {
  const summary = summaryWith({ stack: 0.9, heap: 0.7 }, { overall: 0.85 })
  summary.breakdown = summary.breakdown.map((part) =>
    part.pattern === 'stack' ? { ...part, weight: 3 } : part,
  )
  getProfileSummaryMock.mockResolvedValue(summary)
  renderWithProviders(<ProfileSummary />)

  await userEvent.click(await screen.findByText('How this is calculated'))
  const items = within(screen.getByRole('list', { name: 'Breakdown' })).getAllByRole('listitem')
  expect(items.map((item) => item.textContent)).toEqual([
    'Stack90% × 3',
    'Heap / Priority Queue70% × 1',
  ])
  expect(screen.getByText(/^The weighted average/)).toBeInTheDocument()
})

test('lists strengths, weaknesses, and not-started patterns', async () => {
  getProfileSummaryMock.mockResolvedValue(
    summaryWith(
      { stack: 0.9, heap: 0.3 },
      {
        overall: 0.6,
        strengths: ['stack'],
        weaknesses: ['heap'],
        needs_review: ['tries'],
        not_started: ['greedy'],
      },
    ),
  )
  renderWithProviders(<ProfileSummary />)

  expect(await screen.findByRole('list', { name: 'Strengths' })).toHaveTextContent('Stack')
  expect(screen.getByRole('list', { name: 'Needs work' })).toHaveTextContent('Heap')
  expect(screen.getByRole('list', { name: 'Needs review' })).toHaveTextContent('Tries')
  expect(screen.getByRole('list', { name: 'Not started' })).toHaveTextContent('Greedy')
})

test('explains the empty states', async () => {
  getProfileSummaryMock.mockResolvedValue(EMPTY)
  renderWithProviders(<ProfileSummary />)

  expect(await screen.findByText(
      "No overall rating yet. Attempt 2 different problems in a pattern to unlock it.",
    )).toBeInTheDocument()
  expect(screen.getByText("None yet. A strength needs 60%+ mastery and 5+ attempts.")).toBeInTheDocument()
  expect(screen.getByText("Nothing you've started is below 60%.")).toBeInTheDocument()
  expect(screen.getByText("Nothing you've mastered has faded yet.")).toBeInTheDocument()
  expect(screen.queryByText('How this is calculated')).not.toBeInTheDocument()
})

test('shows the error when the summary fails to load', async () => {
  getProfileSummaryMock.mockRejectedValue(new Error("Couldn't load your profile summary (HTTP 500)."))
  renderWithProviders(<ProfileSummary />)

  expect(await screen.findByRole('alert')).toHaveTextContent(
    "Couldn't load your profile summary (HTTP 500).",
  )
})

test('states the thresholds the backend sends', async () => {
  getProfileSummaryMock.mockResolvedValue({
    ...EMPTY,
    rules: { overall_min_problems: 3, mastered_at: 0.75, strength_min_attempts: 8 },
  })
  renderWithProviders(<ProfileSummary />)

  expect(await screen.findByText(/Attempt 3 different problems/)).toBeInTheDocument()
  expect(screen.getByText(/75%\+ mastery and 8\+ attempts/)).toBeInTheDocument()
  expect(screen.getByText("Nothing you've started is below 75%.")).toBeInTheDocument()
})
