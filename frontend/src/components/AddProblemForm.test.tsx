import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { PATTERN_LABELS } from '../api/labels'
import { createProblem } from '../api/problems'
import { renderWithProviders } from '../test/render'
import { AddProblemForm } from './AddProblemForm'

// The API helper has its own tests; here we only check the form's behaviour.
vi.mock('../api/problems', () => ({ createProblem: vi.fn() }))
const createProblemMock = vi.mocked(createProblem)

beforeEach(() => {
  createProblemMock.mockReset()
})

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Title'), 'Two Sum')
  await user.type(screen.getByLabelText('LeetCode link'), 'https://leetcode.com/problems/two-sum/')
  // Select by value: user-event matches option text via innerHTML, where "&" is "&amp;".
  await user.selectOptions(screen.getByLabelText('Pattern'), 'arrays_hashing')
  await user.selectOptions(screen.getByLabelText('Difficulty'), 'easy')
}

test('the pattern dropdown offers every pattern', () => {
  renderWithProviders(<AddProblemForm />)

  const options = within(screen.getByLabelText('Pattern')).getAllByRole('option')
  // +1 for the "Choose a pattern…" placeholder.
  expect(options).toHaveLength(Object.keys(PATTERN_LABELS).length + 1)
})

test('submits the problem, shows success, and clears the form', async () => {
  const user = userEvent.setup()
  createProblemMock.mockResolvedValue({
    ok: true,
    problem: {
      id: 7,
      title: 'Two Sum',
      link: 'https://leetcode.com/problems/two-sum/',
      pattern: 'arrays_hashing',
      difficulty: 'easy',
      notes: '',
      is_premium: false,
    },
  })
  const { queryClient } = renderWithProviders(<AddProblemForm />)
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

  await fillValidForm(user)
  await user.click(screen.getByRole('button', { name: 'Add problem' }))

  expect(createProblemMock).toHaveBeenCalledWith({
    title: 'Two Sum',
    link: 'https://leetcode.com/problems/two-sum/',
    pattern: 'arrays_hashing',
    difficulty: 'easy',
    notes: '',
  })
  expect(await screen.findByRole('status')).toHaveTextContent('Saved Two Sum.')
  expect(screen.getByLabelText('Title')).toHaveValue('')
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['problems'] })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['plan'] })
})

test('shows the error message and marks the failing field', async () => {
  const user = userEvent.setup()
  createProblemMock.mockResolvedValue({
    ok: false,
    message: 'That problem is already in your list.',
    fieldErrors: { link: 'That problem is already in your list.' },
  })
  renderWithProviders(<AddProblemForm />)

  await fillValidForm(user)
  await user.click(screen.getByRole('button', { name: 'Add problem' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('That problem is already in your list.')
  const linkInput = screen.getByLabelText('LeetCode link')
  expect(linkInput).toHaveAttribute('aria-invalid', 'true')
  expect(linkInput).toHaveAccessibleDescription('That problem is already in your list.')
  // The form keeps what was typed so it can be corrected.
  expect(screen.getByLabelText('Title')).toHaveValue('Two Sum')
})

test('does not submit when required fields are empty', async () => {
  const user = userEvent.setup()
  renderWithProviders(<AddProblemForm />)

  await user.click(screen.getByRole('button', { name: 'Add problem' }))

  expect(createProblemMock).not.toHaveBeenCalled()
})
