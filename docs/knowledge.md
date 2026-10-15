# Knowledge graph

What I've learned building Reps, updated after each leaf's quiz. Backend
and TSX/React only; CSS and styling aren't tracked.

- **Introduced**: seen it explained once.
- **Practicing**: answered quiz questions on it, with help.
- **Understood**: can explain why, unprompted.
- **Mastered**: could build it again without help.

| Concept | Level | Leaf | Notes |
| ------- | ----- | ---- | ----- |
| Native radio group vs custom buttons | Practicing | 13.2 Shared components | Knew radios save code; couldn't yet name what: single selection via `name`, one Tab stop plus arrow keys, screen-reader role and checked state, `required` blocking submit |
| Generic components (`<T extends string>`) | Introduced | 13.2 Shared components | `onChange` returns the option's own type (`'yes' \| 'no'`), not `string` |
| Derive during render, don't mirror into state | Introduced | 13.3 Time field | Field value is `typedTime ?? formatDuration(elapsedMs)`; a `useEffect` copy lags a render and clobbers typing |
| `setState` updater form, one update for linked changes | Introduced | 13.3 Time field | `start(id, fromMs)` sets and starts in one updater, so the typed time can't be lost to stale state |
