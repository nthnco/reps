import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { createAttempt } from '../api/attempts'
import type { ProblemRead } from '../api/generated'
import { listProblems } from '../api/problems'
import { renderWithQueryClient } from '../test/render'
import { STORAGE_KEY } from '../timer/useTimer'
import { LogAttemptForm } from './LogAttemptForm'

vi.mock('../api/problems', () => ({ listProblems: vi.fn() }))
vi.mock('../api/attempts', () => ({ createAttempt: vi.fn() }))
const listProblemsMock = vi.mocked(listProblems)
const createAttemptMock = vi.mocked(createAttempt)

const TWO_SUM: ProblemRead = {
  id: 7,
  title: 'Two Sum',
  link: 'https://leetcode.com/problems/two-sum/',
  pattern: 'arrays_hashing',
  difficulty: 'easy',
  notes: '',
}

beforeEach(() => {
  localStorage.clear()
  listProblemsMock.mockReset().mockResolvedValue([TWO_SUM])
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
  await user.selectOptions(await screen.findByLabelText('Problem'), '7')
  await user.click(screen.getByRole('radio', { name: 'Solved' }))
  await user.click(screen.getByRole('radio', { name: '4' }))
}

test('lists problems from the API', async () => {
  renderWithQueryClient(<LogAttemptForm />)

  expect(await screen.findByRole('option', { name: 'Two Sum' })).toBeInTheDocument()
})

test('tells you to add a problem when there are none', async () => {
  listProblemsMock.mockResolvedValue([])
  renderWithQueryClient(<LogAttemptForm />)

  expect(await screen.findByText('No problems yet. Add one above first.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Log attempt' })).toBeDisabled()
})

test('submit is disabled while problems are loading', () => {
  listProblemsMock.mockReturnValue(new Promise(() => {})) // never resolves
  renderWithQueryClient(<LogAttemptForm />)

  expect(screen.getByText('Loading problems…')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Log attempt' })).toBeDisabled()
})

test('typed minutes are sent as seconds, and a blank date is left to the server', async () => {
  const user = userEvent.setup()
  renderWithQueryClient(<LogAttemptForm />)

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

test('uses the timer when minutes are blank, then resets it', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ bankedMs: 125_000, runningSince: null }))
  const user = userEvent.setup()
  renderWithQueryClient(<LogAttemptForm />)
  expect(screen.getByLabelText('Timer')).toHaveTextContent('02:05')

  await fillRequired(user)
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))

  expect(createAttemptMock).toHaveBeenCalledWith(7, expect.objectContaining({ duration_seconds: 125 }))
  await screen.findByRole('status')
  expect(screen.getByLabelText('Timer')).toHaveTextContent('00:00')
})

test('asks for a duration when the timer is at zero and minutes are blank', async () => {
  const user = userEvent.setup()
  renderWithQueryClient(<LogAttemptForm />)

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ bankedMs: elevenHours, runningSince: null }))
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(answer)
  const user = userEvent.setup()
  renderWithQueryClient(<LogAttemptForm />)

  await fillRequired(user)
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))

  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('11:00:00'))
  expect(createAttemptMock).toHaveBeenCalledTimes(submits)
  confirm.mockRestore()
})

test('typed minutes skip the long-timer question', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ bankedMs: 11 * 3_600_000, runningSince: null }))
  const confirm = vi.spyOn(window, 'confirm')
  const user = userEvent.setup()
  renderWithQueryClient(<LogAttemptForm />)

  await fillRequired(user)
  await user.type(screen.getByLabelText(/enter minutes/), '20')
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))

  expect(confirm).not.toHaveBeenCalled()
  expect(createAttemptMock).toHaveBeenCalledWith(7, expect.objectContaining({ duration_seconds: 1200 }))
  confirm.mockRestore()
})

test('timer buttons do not submit the form', async () => {
  const user = userEvent.setup()
  renderWithQueryClient(<LogAttemptForm />)
  await fillRequired(user)

  await user.click(screen.getByRole('button', { name: 'Start' }))

  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  expect(createAttemptMock).not.toHaveBeenCalled()
})
