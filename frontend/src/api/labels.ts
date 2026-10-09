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
  greedy: 'Greedy',
  intervals: 'Intervals',
  backtracking: 'Backtracking',
  graphs: 'Graphs',
  advanced_graphs: 'Advanced Graphs',
  dp_1d: '1-D Dynamic Programming',
  dp_2d: '2-D Dynamic Programming',
  math_geometry: 'Math & Geometry',
  bit_manipulation: 'Bit Manipulation',
}

// Roadmap stages for the All problems page. Each is a contiguous slice of the
// roadmap order (the Pattern enum), so branch 7's next pattern is always in
// the first stage that isn't fully covered.
export const STAGES: { label: string; patterns: Pattern[] }[] = [
  {
    label: 'Foundations',
    patterns: ['arrays_hashing', 'two_pointers', 'sliding_window', 'stack', 'binary_search'],
  },
  { label: 'Lists and trees', patterns: ['linked_list', 'trees', 'tries', 'heap'] },
  { label: 'Greedy and intervals', patterns: ['greedy', 'intervals'] },
  { label: 'Search', patterns: ['backtracking', 'graphs', 'advanced_graphs'] },
  { label: 'Dynamic programming', patterns: ['dp_1d', 'dp_2d'] },
  { label: 'Extras', patterns: ['math_geometry', 'bit_manipulation'] },
]

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}
