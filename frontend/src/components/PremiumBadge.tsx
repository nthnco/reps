// Outlined rather than filled, so it can't be mistaken for the medium badge
// beside it. The border plus py-px matches DifficultyBadge's height.
export function PremiumBadge() {
  return (
    <span
      title="Requires LeetCode Premium"
      className="rounded border border-amber-500 px-2 py-px text-xs font-medium text-amber-700 dark:border-amber-400 dark:text-amber-300"
    >
      <span aria-hidden="true">★ </span>Premium
    </span>
  )
}
