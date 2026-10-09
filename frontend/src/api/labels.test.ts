import { expect, test } from 'vitest'
import openapi from '../../openapi.json'
import { PATTERN_LABELS, STAGES } from './labels'

// The backend's Pattern enum is the roadmap order; the frontend has to match it
// by hand, and the TypeScript union can't check order.
const ROADMAP = openapi.components.schemas.Pattern.enum

test('labels follow the roadmap order', () => {
  expect(Object.keys(PATTERN_LABELS)).toEqual(ROADMAP)
})

test('stages slice the roadmap in order, each pattern once', () => {
  expect(STAGES.flatMap((stage) => stage.patterns)).toEqual(ROADMAP)
})
