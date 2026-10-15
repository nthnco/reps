# Log screen redesign

The spec for TREE.md branch 13. TREE.md holds the leaves and their order;
this file holds what the screens look like and the data behind them.

## Look

Flat and quiet. No 3D buttons, no emoji, no mascots, no confetti. It should
feel like a developer tool, not a game.

## Tokens

Defined once in `frontend/src/index.css` under Tailwind's `@theme`, so each
is both a CSS variable (`var(--color-card)`) and a utility (`bg-card`).

### Fonts

- **IBM Plex Sans**: body text and the timer. The timer uses tabular numbers
  (`font-variant-numeric: tabular-nums`) so digits don't jump as they tick.
- **IBM Plex Mono**: small labels, numbers, and dates.

### Colors

| Token            | Value     | Used for                                          |
| ---------------- | --------- | ------------------------------------------------- |
| `page`           | `#0c0e12` | page background                                   |
| `card`           | `#12151b` | cards                                             |
| `line`           | `#232831` | all 1px borders                                   |
| `ink`            | `#e6e8ec` | body text                                         |
| `muted`          | `#8b93a1` | secondary text                                    |
| `accent`         | `#f5a524` | primary buttons, selected options, skill gain     |
| `on-accent`      | `#1a1204` | text on amber                                     |
| `link`           | `#6ea8fe` | links, the Start button, next review              |
| `solved`         | `#5fd38a` | Solved result only                                |
| `not-solved`     | `#ff8a7a` | Not solved result only                            |
| `grid-0`..`grid-4` | `#1b2029` `#4a3511` `#80581a` `#c08420` `#f5b03a` | activity grid levels |
| `bar-old`        | `#c9ced8` | skill bar, the level before this attempt          |

The skill gain segment uses `accent`.

### Shapes

Buttons 6px radius, cards 8px, grid squares 3px. Borders are 1px. Every tap
target is at least 44px in both directions.

## Log screen (`/problems/:id`)

Main column:

- **Header**: title, then pattern and difficulty on one line. Difficulty is
  neutral (border and muted text), not green/yellow/red. "Open on LeetCode ↗"
  on the right.
- **Time**: the timer readout and an "Or enter minutes" box, as today;
  typed minutes override the timer. (A single field was built and reverted:
  the user preferred two.) "Start problem" (steel blue outline) starts the
  timer and opens LeetCode. Pause/Resume and Reset as today.
- **Result**: two buttons, Solved (check icon) and Not solved (X icon), so
  color is never the only signal. Selected: tinted background and colored
  border in `solved` / `not-solved`.
- **Confidence**: five tiles, 1 to 5, labeled Shaky, Unsure, Okay, Solid,
  Cold. Selected tile: amber border and amber text. Under the row,
  "1 = shaky" on the left and "5 = could redo it cold" on the right.
- **Used a hint** checkbox, and a date picker on the same row (default
  today, no future dates, as the API already enforces).
- **Log attempt**: full-width amber button. Under it, muted:
  "Updates <pattern> skill and sets the next review".

Sidebar:

- **Activity**: grid of the last 14 weeks, "N day run" top right, and under
  it "Log today to make it N+1" when today has no attempt yet.
- **Skill**: the pattern's name, raw skill percent, and bar (see Skill,
  below).
- **Last time**: date, result, minutes, then confidence and hint. Hidden
  for a problem with no attempts.

On narrow screens the sidebar moves under the form.

## Rep logged screen

Shown on the same URL after a successful save (page state, not a new
route; a refresh goes back to the form).

- Small amber label "REP LOGGED" with a check.
- Problem name.
- One mono line: result (in its color), confidence N, "hint used" if so,
  the date.
- **Skill card**: the pattern's bar, showing before, after, and the
  change: "60% → 66% +6". The bar draws the old level in `bar-old`
  and the gain in `accent`. If the value drops, the bar shows only the new
  level and the change is muted ("−4"), not red.
- **Next review card**: "3 days" large in steel blue, the date under it,
  then "Back in your queue then". Due today or earlier (possible with a
  backdated attempt): "Today".
- **Activity card**: 26 weeks, month labels on top, Mon / Wed / Fri on the
  left, "N reps in 26 weeks" bottom left, a Less → More legend bottom right,
  and "N day run" top right (text, no flame). Today's square has an amber
  outline.
- **Buttons**: "Next problem" (amber) and "Back to problem" (outline).

## Activity grid

One component, used with 14 weeks (sidebar) and 26 weeks (Rep logged).

- Columns are weeks, rows are days, Sunday on top. The last column is the
  current week; days after today are not drawn.
- Level from that day's attempt count: 0 → 0, 1 → 1, 2 → 2, 3 → 3, 4+ → 4.
- Each square has a text label ("Oct 9: 2 reps") for screen readers and
  hover.
- **Run**: consecutive days with at least one attempt, ending today. If
  today has none yet, it ends yesterday, so the run isn't shown as broken
  before you've practiced. Counted over all attempts, not just the window.
  Backdating an attempt can fill a gap; accepted, same as today's plan.

## Data

What exists today, and the smallest change for each gap:

| Needed                         | Today                                         | Change |
| ------------------------------ | --------------------------------------------- | ------ |
| Next review date after a save  | `sm2.schedule()` computes it, but `POST /api/problems/{id}/attempts` returns only the attempt | Add `next_review_on` to the response |
| Pattern skill before / after   | Per-pattern raw `mastery` exists (`/api/patterns/mastery`); nothing compares before and after | Add `skill_before` / `skill_after` (the pattern's raw `mastery`) to the same response |
| Per-problem mastery            | Doesn't exist; mastery is only per pattern    | None: the Skill card shows only the pattern (see Decided) |
| Attempts per day, run length   | No endpoint                                   | `GET /api/activity`: last 26 weeks of `{date, count}` (days with attempts only), `run`, and `today` |
| "Last time" on the log screen  | No endpoint lists a problem's attempts        | `GET /api/problems/{id}/attempts`, newest first |

All new routes take their session from `get_db`, so demo mode keeps
working.

## Skill

Both screens show the pattern's raw `mastery`, labeled "Skill", not
`displayed_mastery` (labeled "Mastery" on the Mastery page). Displayed is
skill × the average retention of the pattern's problems, and any attempt
resets its problem's retention to 1, so a hint solve (or, rarely, a fail)
could show a gain the attempt didn't earn. Raw skill moves only with the
result: a fail never raises it, a clean solve never lowers it, and a hint
or slow solve can lower it a little ("Solved · −4"). The two numbers
differ for the same pattern; the different names say so.

## Decided

- **No per-problem bar**: the mockup's "Contains Duplicate 55% → 72%" has
  no data behind it, and a per-problem model would be new work. The Skill
  card shows only the pattern.
- **Next problem**: the first item in today's plan that isn't done; home if
  none is left.
- **Dark only**: the whole app, so the other pages (which already have
  `dark:` styles) don't clash with this palette.

## Not in this branch

- The top nav (the mockup's "run 5d" badge and restyled header).
- Home, mastery, and add-problem pages, beyond what dark-only changes.
- The mockups' layout glitches (title overlapping the pattern line, "Add
  problem" wrapping): not part of the spec.
