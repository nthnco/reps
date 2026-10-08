import { screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Pattern, PatternMasteryRead } from '../api/generated'
import { getPatternMastery } from '../api/mastery'
import { PATTERN_LABELS } from '../api/labels'
import { renderWithProviders } from '../test/render'
import { PatternMasteryList } from './PatternMasteryList'

vi.mock('../api/mastery', () => ({ getPatternMastery: vi.fn() }))
const getPatternMasteryMock = vi.mocked(getPatternMastery)

const PATTERNS = Object.keys(PATTERN_LABELS) as Pattern[]

function untouched(pattern: Pattern): PatternMasteryRead {
  return {
    pattern,
    displayed_mastery: 0,
    mastery: 0,
    peak: 0,
    certainty: 0,
    low_data: true,
    attempt_count: 0,
    problem_count: 0,
    problems_attempted: 0,
    problems_until_counted: 2,
    attempts_until_trusted: 5,
    due_count: 0,
    last_practiced_on: null,
    median_solve_seconds: null,
    covered: false,
  }
}

const STACK: PatternMasteryRead = {
  ...untouched('stack'),
  displayed_mastery: 0.72,
  mastery: 0.9,
  peak: 0.95,
  certainty: 0.5,
  low_data: false,
  attempt_count: 5,
  problem_count: 3,
  problems_attempted: 3,
  problems_until_counted: 0,
  attempts_until_trusted: 0,
  due_count: 2,
  last_practiced_on: '2026-10-03',
  median_solve_seconds: 1100,
}

function rowsWith(...rows: PatternMasteryRead[]): PatternMasteryRead[] {
  return PATTERNS.map((p) => rows.find((r) => r.pattern === p) ?? untouched(p))
}

function rowFor(pattern: Pattern) {
  return screen.getByRole('meter', { name: `${PATTERN_LABELS[pattern]} mastery` }).closest('li')!
}

beforeEach(() => {
  getPatternMasteryMock.mockReset()
})

test('shows a bar per pattern with its displayed mastery', async () => {
  getPatternMasteryMock.mockResolvedValue(rowsWith(STACK))
  renderWithProviders(<PatternMasteryList />)

  expect(await screen.findAllByRole('meter')).toHaveLength(PATTERNS.length)
  const meter = screen.getByRole('meter', { name: 'Stack mastery' })
  expect(meter).toHaveAttribute('aria-valuenow', '72')
  expect(rowFor('stack')).toHaveTextContent('72%')
})

test('shows the details, due count, decay, and peak marker', async () => {
  getPatternMasteryMock.mockResolvedValue(rowsWith(STACK))
  renderWithProviders(<PatternMasteryList />)

  await screen.findAllByRole('meter')
  const row = rowFor('stack')
  expect(row).toHaveTextContent(
    '5 attempts · 3 problems · last practiced Oct 3 · median 18 min · 2 due',
  )
  expect(row).toHaveTextContent('Down from 90% since you last practiced')
  expect(within(row).getByTitle('Peak 95%')).toBeInTheDocument()
  expect(row).not.toHaveTextContent('Low data')
})

test('marks low-data patterns', async () => {
  getPatternMasteryMock.mockResolvedValue(
    rowsWith({ ...STACK, low_data: true, attempt_count: 2 }),
  )
  renderWithProviders(<PatternMasteryList />)

  await screen.findAllByRole('meter')
  expect(rowFor('stack')).toHaveTextContent('Low data')
})

test('marks covered patterns only', async () => {
  getPatternMasteryMock.mockResolvedValue(rowsWith({ ...STACK, covered: true }))
  renderWithProviders(<PatternMasteryList />)

  await screen.findAllByRole('meter')
  expect(rowFor('stack')).toHaveTextContent('Covered')
  expect(rowFor('trees')).not.toHaveTextContent('Covered')
})

test('hides the peak marker and decay note when at peak and fresh', async () => {
  getPatternMasteryMock.mockResolvedValue(
    rowsWith({ ...STACK, displayed_mastery: 0.9, mastery: 0.9, peak: 0.9 }),
  )
  renderWithProviders(<PatternMasteryList />)

  await screen.findAllByRole('meter')
  const row = rowFor('stack')
  expect(within(row).queryByTitle(/Peak/)).not.toBeInTheDocument()
  expect(row).not.toHaveTextContent('Down from')
})

test('describes patterns with no problems or no attempts', async () => {
  getPatternMasteryMock.mockResolvedValue(
    rowsWith({ ...untouched('heap'), problem_count: 2 }),
  )
  renderWithProviders(<PatternMasteryList />)

  await screen.findAllByRole('meter')
  expect(rowFor('heap')).toHaveTextContent('2 problems, not attempted yet')
  expect(rowFor('heap')).toHaveTextContent('—')
  expect(rowFor('tries')).toHaveTextContent('No problems yet')
})

test('explains the empty state when nothing has been attempted', async () => {
  getPatternMasteryMock.mockResolvedValue(rowsWith())
  renderWithProviders(<PatternMasteryList />)

  expect(await screen.findByText(/No attempts yet/)).toBeInTheDocument()
})

test('shows the error when mastery fails to load', async () => {
  getPatternMasteryMock.mockRejectedValue(new Error("Couldn't load pattern mastery (HTTP 500)."))
  renderWithProviders(<PatternMasteryList />)

  expect(await screen.findByRole('alert')).toHaveTextContent(
    "Couldn't load pattern mastery (HTTP 500).",
  )
})

test('nudges toward the next milestones', async () => {
  getPatternMasteryMock.mockResolvedValue(
    rowsWith({ ...STACK, low_data: true, problems_until_counted: 1, attempts_until_trusted: 3 }),
  )
  renderWithProviders(<PatternMasteryList />)

  await screen.findAllByRole('meter')
  expect(rowFor('stack')).toHaveTextContent(
    'Next: 1 more problem to count toward your overall · 3 more attempts to trust this score',
  )
})

test('no nudge once both milestones are reached, or before any attempt', async () => {
  getPatternMasteryMock.mockResolvedValue(rowsWith(STACK, { ...untouched('heap'), problem_count: 1 }))
  renderWithProviders(<PatternMasteryList />)

  await screen.findAllByRole('meter')
  expect(rowFor('stack')).not.toHaveTextContent('Next:')
  expect(rowFor('heap')).not.toHaveTextContent('Next:')
})
