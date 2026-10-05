import type { Difficulty, Pattern } from './generated'

// Typed as Record<Pattern, string> so the build fails if the backend adds a
// pattern (after `npm run gen:api`) and it has no label here.
export const PATTERN_LABELS: Record<Pattern, string> = {
  arrays_hashing: 'Arrays & Hashing',
  two_pointers: 'Two Pointers',
  sliding_window: 'Sliding Window',
  stack: 'Stack',
  binary_search: 'Binary Search',
  linked_list: 'Linked List',
  trees: 'Trees',
  tries: 'Tries',
  heap: 'Heap / Priority Queue',
  backtracking: 'Backtracking',
  graphs: 'Graphs',
  advanced_graphs: 'Advanced Graphs',
  dp_1d: '1-D Dynamic Programming',
  dp_2d: '2-D Dynamic Programming',
  greedy: 'Greedy',
  intervals: 'Intervals',
  math_geometry: 'Math & Geometry',
  bit_manipulation: 'Bit Manipulation',
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}
