import { expect, test } from 'vitest'
import { buildWeeks } from './activity'

// A Wednesday; start is the Sunday 25 weeks before Sunday Oct 11.
const activity = {
  today: '2026-10-14',
  start: '2026-04-19',
  days: [
    { day: '2026-04-19', count: 1 },
    { day: '2026-07-12', count: 2 },
    { day: '2026-10-14', count: 7 },
  ],
  run: 1,
}

test('26 weeks run from start to today, with no days after today', () => {
  const weeks = buildWeeks(activity, 26)

  expect(weeks).toHaveLength(26)
  expect(weeks[0].cells[0].day).toBe('2026-04-19')
  expect(weeks[0].cells).toHaveLength(7)
  expect(weeks[25].cells.map((cell) => cell.day)).toEqual([
    '2026-10-11',
    '2026-10-12',
    '2026-10-13',
    '2026-10-14',
  ])
})

test('14 weeks are the tail of the window', () => {
  const weeks = buildWeeks(activity, 14)

  expect(weeks).toHaveLength(14)
  expect(weeks[0].cells[0]).toEqual({ day: '2026-07-12', count: 2, level: 2 })
  expect(weeks[13].cells.at(-1)?.day).toBe('2026-10-14')
})

test('levels cap at 4 and days without attempts are 0', () => {
  const lastWeek = buildWeeks(activity, 26)[25].cells

  expect(lastWeek[0]).toEqual({ day: '2026-10-11', count: 0, level: 0 })
  expect(lastWeek[3]).toEqual({ day: '2026-10-14', count: 7, level: 4 })
})

test('months label the column whose Sunday starts them', () => {
  const months = buildWeeks(activity, 26).map((week) => week.month)

  // Apr 19, Apr 26, May 3, ..., May 31, Jun 7
  expect(months.slice(0, 8)).toEqual(['Apr', null, 'May', null, null, null, null, 'Jun'])
})

test('the first column drops its label when the second starts a month', () => {
  // Start Apr 26, so the second column is May 3: "Apr" and "May" would sit side by side.
  const months = buildWeeks({ ...activity, today: '2026-10-18', start: '2026-04-26' }, 26).map(
    (week) => week.month,
  )

  expect(months.slice(0, 2)).toEqual([null, 'May'])
})
