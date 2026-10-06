import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import type { ProblemRead } from './api/generated'
import { renderWithProviders } from './test/render'

const TWO_SUM: ProblemRead = {
  id: 7,
  title: 'Two Sum',
  link: 'https://leetcode.com/problems/two-sum/',
  pattern: 'arrays_hashing',
  difficulty: 'easy',
  notes: '',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Just enough of the API for one problem: it's new until an attempt is logged.
function fakeBackend() {
  let attempted = false
  return vi.fn(async (url: string, init?: RequestInit) => {
    const route = `${init?.method ?? 'GET'} ${url}`
    switch (route) {
      case 'GET /api/problems':
        return json([TWO_SUM])
      case 'GET /api/queue':
        return json(attempted ? [] : [{ problem: TWO_SUM, due_on: null }])
      case 'POST /api/problems/7/attempts':
        attempted = true
        return json({ id: 1, problem_id: 7, ...JSON.parse(init!.body as string) }, 201)
      default:
        throw new Error(`Unexpected request: ${route}`)
    }
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', fakeBackend())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('renders the app heading', () => {
  renderWithProviders(<App />)
  expect(screen.getByRole('heading', { name: 'Reps' })).toBeInTheDocument()
})

test('logging an attempt takes the problem off the queue', async () => {
  const user = userEvent.setup()
  renderWithProviders(<App />)

  const queue = () => screen.getByRole('heading', { name: "Today's queue" }).closest('section')!
  await user.click(await within(queue()).findByRole('link', { name: 'Two Sum' }))

  expect(await screen.findByRole('heading', { name: 'Two Sum' })).toBeInTheDocument()
  await user.type(screen.getByLabelText(/enter minutes/), '15')
  await user.click(screen.getByRole('radio', { name: 'Solved' }))
  await user.click(screen.getByRole('radio', { name: '4' }))
  await user.click(screen.getByRole('button', { name: 'Log attempt' }))
  await screen.findByRole('status')

  await user.click(screen.getByRole('link', { name: '← All problems' }))
  expect(await within(queue()).findByText('Nothing due today.')).toBeInTheDocument()
})

test('the problem page says so when the problem does not exist', async () => {
  renderWithProviders(<App />, { route: '/problems/999' })

  expect(await screen.findByText("That problem doesn't exist.")).toBeInTheDocument()
})

test('all problems link to their problem pages', async () => {
  renderWithProviders(<App />)

  const list = screen.getByRole('heading', { name: 'All problems' }).closest('section')!
  expect(await within(list).findByRole('link', { name: 'Two Sum' })).toHaveAttribute(
    'href',
    '/problems/7',
  )
})
