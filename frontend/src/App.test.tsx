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
// `gated` turns on the login gate (password "pw"); `expire()` ends the session.
function fakeBackend({ gated = false } = {}) {
  let attempted = false
  let loggedIn = !gated
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const route = `${init?.method ?? 'GET'} ${url}`
    if (route === 'POST /api/auth/login') {
      const { password } = JSON.parse(init!.body as string)
      if (password !== 'pw') return json({ detail: 'Wrong username or password' }, 401)
      loggedIn = true
      return new Response(null, { status: 204 })
    }
    if (route === 'POST /api/auth/logout') {
      loggedIn = !gated
      return new Response(null, { status: 204 })
    }
    if (!loggedIn) return json({ detail: 'Not logged in' }, 401)
    switch (route) {
      case 'GET /api/auth/me':
        return json({ username: gated ? 'nathan' : null })
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
  return { fetchMock, expire: () => (loggedIn = false) }
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', fakeBackend().fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('with the gate off, the app shows without a login or logout', async () => {
  renderWithProviders(<App />)
  expect(await screen.findByRole('heading', { name: "Today's queue" })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
})

test('logging an attempt takes the problem off the queue', async () => {
  const user = userEvent.setup()
  renderWithProviders(<App />)

  await screen.findByRole('heading', { name: "Today's queue" })
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

  const list = (await screen.findByRole('heading', { name: 'All problems' })).closest('section')!
  expect(await within(list).findByRole('link', { name: 'Two Sum' })).toHaveAttribute(
    'href',
    '/problems/7',
  )
})

test('the add-problem form has its own page, reached from the nav', async () => {
  const user = userEvent.setup()
  renderWithProviders(<App />)

  await screen.findByRole('heading', { name: "Today's queue" })
  expect(screen.queryByRole('heading', { name: 'Add a problem' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('link', { name: 'Add problem' }))
  expect(await screen.findByRole('heading', { name: 'Add a problem' })).toBeInTheDocument()
  // Not mistaken for a problem with id "new".
  expect(screen.queryByText("That problem doesn't exist.")).not.toBeInTheDocument()
})

async function logIn(password: string) {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Username'), 'nathan')
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Log in' }))
  return user
}

test('a wrong password stays on the login page', async () => {
  vi.stubGlobal('fetch', fakeBackend({ gated: true }).fetchMock)
  renderWithProviders(<App />)

  await logIn('nope')

  expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password.')
  expect(screen.getByLabelText('Password')).toHaveValue('')
})

test('logging in shows the app, logging out returns to the login page', async () => {
  vi.stubGlobal('fetch', fakeBackend({ gated: true }).fetchMock)
  renderWithProviders(<App />)

  const user = await logIn('pw')
  expect(await screen.findByRole('heading', { name: "Today's queue" })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Log out' }))
  expect(await screen.findByLabelText('Password')).toBeInTheDocument()
})

test('a session that expires mid-use goes back to the login page', async () => {
  const backend = fakeBackend({ gated: true })
  vi.stubGlobal('fetch', backend.fetchMock)
  const { queryClient } = renderWithProviders(<App />)
  await logIn('pw')
  await screen.findByRole('heading', { name: "Today's queue" })

  backend.expire()
  await queryClient.invalidateQueries({ queryKey: ['queue'] })

  expect(await screen.findByLabelText('Password')).toBeInTheDocument()
})
