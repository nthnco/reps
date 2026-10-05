import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App'
import { renderWithQueryClient } from './test/render'

test('renders the app heading', () => {
  renderWithQueryClient(<App />)
  expect(screen.getByRole('heading', { name: 'Reps' })).toBeInTheDocument()
})
