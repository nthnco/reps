import { expect, test } from 'vitest'
import { skillSegments } from './skill'

test('a gain rounds each end first, so its width matches the shown change', () => {
  // 0.655 - 0.604 rounds to 5, but the screen says 60% → 66%, so +6.
  expect(skillSegments(0.655, 0.604)).toEqual({ base: 60, gain: 6 })
})

test('a drop draws only the new level', () => {
  expect(skillSegments(0.56, 0.6)).toEqual({ base: 56, gain: 0 })
})
