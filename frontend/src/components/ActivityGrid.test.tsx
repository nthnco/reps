import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ActivityGrid } from './ActivityGrid'

test('each square names its day and rep count', () => {
  const activity = {
    today: '2026-10-14',
    start: '2026-04-19',
    days: [{ day: '2026-10-13', count: 1 }],
    run: 1,
  }
  render(<ActivityGrid activity={activity} weeks={14} />)

  expect(screen.getByRole('img', { name: 'Oct 13: 1 rep' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Oct 14: 0 reps' })).toBeInTheDocument()
  // 13 full weeks plus Sunday to Wednesday of this one.
  expect(screen.getAllByRole('img')).toHaveLength(13 * 7 + 4)
})
