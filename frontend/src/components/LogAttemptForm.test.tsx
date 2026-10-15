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
  await user.type(screen.getByLabelText('Time'), '15')
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))

  expect(createAttemptMock).toHaveBeenCalledWith(7, {
    solved: true,
    duration_seconds: 900,
    confidence: 4,
    used_hint: false,
  })
  expect(await screen.findByRole('status')).toHaveTextContent('Logged attempt for Two Sum.')
})

test('refreshes the plan after logging an attempt', async () => {
  const user = userEvent.setup()
  const { queryClient } = renderWithProviders(<LogAttemptForm problem={TWO_SUM} />)
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

  await fillRequired(user)
  await user.type(screen.getByLabelText('Time'), '15')
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))

  await screen.findByRole('status')
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['plan'] })
})

test('uses the timer when nothing is typed, then resets it', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ bankedMs: 125_000, runningSince: null, problemId: 7 }))
  const user = userEvent.setup()
  renderWithProviders(<LogAttemptForm problem={TWO_SUM} />)
  expect(screen.getByLabelText('Time')).toHaveValue('02:05')

  await fillRequired(user)
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))

  expect(createAttemptMock).toHaveBeenCalledWith(7, expect.objectContaining({ duration_seconds: 125 }))
  await screen.findByRole('status')
  expect(screen.getByLabelText('Time')).toHaveValue('')
})

test('asks for a duration when the timer is at zero and nothing is typed', async () => {
  const user = userEvent.setup()
  renderWithProviders(<LogAttemptForm problem={TWO_SUM} />)

  await fillRequired(user)
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))

  expect(createAttemptMock).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Time')).toHaveAccessibleDescription(
    'Start the timer or enter a time.',
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

test('a typed time skips the long-timer question', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ bankedMs: 11 * 3_600_000, runningSince: null, problemId: 7 }))
  const confirm = vi.spyOn(window, 'confirm')
  const user = userEvent.setup()
  renderWithProviders(<LogAttemptForm problem={TWO_SUM} />)

  await fillRequired(user)
  await user.clear(screen.getByLabelText('Time'))
  await user.type(screen.getByLabelText('Time'), '20')
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))

  expect(confirm).not.toHaveBeenCalled()
  expect(createAttemptMock).toHaveBeenCalledWith(7, expect.objectContaining({ duration_seconds: 1200 }))
  confirm.mockRestore()
})

test('typing over a running timer pauses it, and Resume continues from the typed time', async () => {
  // 23:40 and a half, so the display doesn't tick over during the test.
  const runningSince = Date.now() - 1_420_500
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ bankedMs: 0, runningSince, problemId: 7 }))
  const user = userEvent.setup()
  renderWithProviders(<LogAttemptForm problem={TWO_SUM} />)
  const field = screen.getByLabelText('Time')
  expect(field).toHaveValue('23:40')

  await user.clear(field)
  await user.type(field, '18:40')
  expect(field).toHaveValue('18:40')

  await user.click(screen.getByRole('button', { name: 'Resume' }))
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ bankedMs: 1_120_000, problemId: 7 })
  expect(field).toHaveValue('18:40')
})

test('a time that does not parse is not sent', async () => {
  const user = userEvent.setup()
  renderWithProviders(<LogAttemptForm problem={TWO_SUM} />)

  await fillRequired(user)
  await user.type(screen.getByLabelText('Time'), '14.5')
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))

  expect(createAttemptMock).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Time')).toHaveAccessibleDescription('Enter a time like 14 or 14:30.')
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

test("another problem's timer locks this one out, but a typed time still works", async () => {
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
  await user.type(screen.getByLabelText('Time'), '15')
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
