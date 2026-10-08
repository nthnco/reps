import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { createAttempt } from '../api/attempts'
import type { ProblemRead } from '../api/generated'
import { listProblems } from '../api/problems'
import { renderWithProviders } from '../test/render'
import { STORAGE_KEY } from '../timer/useTimer'
import { LogAttemptForm } from './LogAttemptForm'

vi.mock('../api/attempts', () => ({ createAttempt: vi.fn() }))
vi.mock('../api/problems', () => ({ listProblems: vi.fn() }))
const createAttemptMock = vi.mocked(createAttempt)

const TWO_SUM: ProblemRead = {
  id: 7,
  title: 'Two Sum',
  link: 'https://leetcode.com/problems/two-sum/',
  pattern: 'arrays_hashing',
  difficulty: 'easy',
  notes: '',
  is_premium: false,
}
const COIN_CHANGE: ProblemRead = {
  id: 9,
  title: 'Coin Change',
  link: 'https://leetcode.com/problems/coin-change/',
  pattern: 'dp_1d',
  difficulty: 'medium',
  notes: '',
  is_premium: false,
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(listProblems).mockReset().mockResolvedValue([TWO_SUM, COIN_CHANGE])
  createAttemptMock.mockReset().mockResolvedValue({
    ok: true,
    attempt: {
      id: 1,
      problem_id: 7,
      attempted_on: '2026-10-05',
      solved: true,
      duration_seconds: 900,
      confidence: 4,
      used_hint: false,
    },
  })
})

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', { name: 'Solved' }))
  await user.click(screen.getByRole('radio', { name: '4' }))
}

test('typed minutes are sent as seconds, and a blank date is left to the server', async () => {
  const user = userEvent.setup()
  renderWithProviders(<LogAttemptForm problem={TWO_SUM} />)

  await fillRequired(user)
  await user.type(screen.getByLabelText(/enter minutes/), '15')
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))

  expect(createAttemptMock).toHaveBeenCalledWith(7, {
    solved: true,
    duration_seconds: 900,
    confidence: 4,
    used_hint: false,
  })
  expect(await screen.findByRole('status')).toHaveTextContent('Logged attempt for Two Sum.')
})

test('refreshes the queue after logging an attempt', async () => {
  const user = userEvent.setup()
  const { queryClient } = renderWithProviders(<LogAttemptForm problem={TWO_SUM} />)
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

  await fillRequired(user)
  await user.type(screen.getByLabelText(/enter minutes/), '15')
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))

  await screen.findByRole('status')
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['queue'] })
})

test('uses the timer when minutes are blank, then resets it', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ bankedMs: 125_000, runningSince: null, problemId: 7 }))
  const user = userEvent.setup()
  renderWithProviders(<LogAttemptForm problem={TWO_SUM} />)
  expect(screen.getByLabelText('Timer')).toHaveTextContent('02:05')

  await fillRequired(user)
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))

  expect(createAttemptMock).toHaveBeenCalledWith(7, expect.objectContaining({ duration_seconds: 125 }))
  await screen.findByRole('status')
  expect(screen.getByLabelText('Timer')).toHaveTextContent('00:00')
})

test('asks for a duration when the timer is at zero and minutes are blank', async () => {
  const user = userEvent.setup()
  renderWithProviders(<LogAttemptForm problem={TWO_SUM} />)

  await fillRequired(user)
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))

  expect(createAttemptMock).not.toHaveBeenCalled()
  expect(screen.getByLabelText(/enter minutes/)).toHaveAccessibleDescription(
    'Start the timer or enter minutes.',
  )
})

test.each([
  [true, 1],
  [false, 0],
])('a long timer asks first (confirm=%s -> %i submits)', async (answer, submits) => {
  const elevenHours = 11 * 60 * 60 * 1000
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ bankedMs: elevenHours, runningSince: null, problemId: 7 }))
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(answer)
  const user = userEvent.setup()
  renderWithProviders(<LogAttemptForm problem={TWO_SUM} />)

  await fillRequired(user)
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))

  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('11:00:00'))
  expect(createAttemptMock).toHaveBeenCalledTimes(submits)
  confirm.mockRestore()
})

test('typed minutes skip the long-timer question', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ bankedMs: 11 * 3_600_000, runningSince: null, problemId: 7 }))
  const confirm = vi.spyOn(window, 'confirm')
  const user = userEvent.setup()
  renderWithProviders(<LogAttemptForm problem={TWO_SUM} />)

  await fillRequired(user)
  await user.type(screen.getByLabelText(/enter minutes/), '20')
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))

  expect(confirm).not.toHaveBeenCalled()
  expect(createAttemptMock).toHaveBeenCalledWith(7, expect.objectContaining({ duration_seconds: 1200 }))
  confirm.mockRestore()
})

test('Start problem starts the timer and opens LeetCode, without submitting', async () => {
  const open = vi.spyOn(window, 'open').mockReturnValue(null)
  const user = userEvent.setup()
  renderWithProviders(<LogAttemptForm problem={TWO_SUM} />)
  await fillRequired(user)

  await user.click(screen.getByRole('button', { name: 'Start problem' }))

  expect(open).toHaveBeenCalledWith(TWO_SUM.link, '_blank', 'noopener,noreferrer')
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ problemId: 7 })
  expect(createAttemptMock).not.toHaveBeenCalled()
  open.mockRestore()
})

test('a paused timer resumes without opening LeetCode again', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ bankedMs: 60_000, runningSince: null, problemId: 7 }))
  const open = vi.spyOn(window, 'open')
  const user = userEvent.setup()
  renderWithProviders(<LogAttemptForm problem={TWO_SUM} />)

  await user.click(screen.getByRole('button', { name: 'Resume' }))

  expect(open).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  open.mockRestore()
})

test("another problem's timer locks this one out, but typed minutes still work", async () => {
  const saved = { bankedMs: 60_000, runningSince: null, problemId: 9 }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  const user = userEvent.setup()
  renderWithProviders(<LogAttemptForm problem={TWO_SUM} />)

  expect(await screen.findByRole('link', { name: 'Coin Change' })).toHaveAttribute(
    'href',
    '/problems/9',
  )
  expect(screen.queryByRole('button', { name: 'Start problem' })).not.toBeInTheDocument()

  await fillRequired(user)
  await user.type(screen.getByLabelText(/enter minutes/), '15')
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))

  expect(createAttemptMock).toHaveBeenCalledWith(7, expect.objectContaining({ duration_seconds: 900 }))
  await screen.findByText('Logged attempt for Two Sum.')
  // Coin Change's time is left alone.
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(saved)
})

test("another problem's timer can be discarded", async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ bankedMs: 60_000, runningSince: null, problemId: 9 }))
  const user = userEvent.setup()
  renderWithProviders(<LogAttemptForm problem={TWO_SUM} />)

  await user.click(screen.getByRole('button', { name: 'discard it' }))

  expect(screen.getByRole('button', { name: 'Start problem' })).toBeInTheDocument()
})
