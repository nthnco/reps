# Handoff: today's plan (TREE.md later branch 10)

Build order for the remaining leaves: 8, 9, 7, 10, 11. Branches 8, 9, 7 are
done, plus a small extra leaf (Premium flag). `CLAUDE.md` has an uncommitted
rewrite by the user; leave it alone. Read CLAUDE.md, TREE.md (branches 7-11
and "Decided"), and the memory notes before starting.

## Where things stand

- PR #19 (`neetcode-preload`), #21 (`premium-flag`): merged to `main`.
  #20 was the same Premium commit but merged into `neetcode-preload` by
  mistake (its base was never retargeted); #21 re-opened it against `main`.
  Lesson: when stacking PRs, check each one's base before merging.
- PR for branch 7 (`next-pattern`): open, waiting for the user.
- Production (Render) deploys from `main` only and runs `alembic upgrade
  head` on container start, so merging is all it takes.
- The user's dev database is at `f4ffc45aa5f3` (Premium), which `main` has.
- FSRS switch and fitting: still shelved. Not part of this plan.

## Branch 7 (next-pattern suggestion), as built

- `app/suggest.py`: pure functions. `suggest(problems, raw_mastery)`
  returns `Suggestion(pattern, problem | None, reason)` or `None`;
  `covered_patterns(problems)` gives a bool per pattern. Follows TREE.md
  branch 7, with two decisions by the user:
  - Hards only once every pattern is covered **and** no new medium is
    left anywhere (then the weakest pattern's lowest-id hard). An uncovered
    pattern never gets a hard.
  - A failed new problem isn't retried from the card: it's no longer
    "new", so the card moves on and SM-2 brings it back through the queue.
- Premium problems are not skipped; the badge shows instead.
- `routes/mastery.py`: `covered` on each mastery row, and
  `GET /api/patterns/suggestion` (`SuggestionRead | null`, 200 either way).
  `build_suggestion(db, as_of)` loads through `load_problems`, so it
  replays as-of and branch 10 can call it directly.
- `reason` is a `Reason` enum kind; the frontend words it (`REASONS` in
  `NextUp.tsx`, typed `Record<Reason, …>`), since pattern labels live only
  in `labels.ts`. Sentences avoid the rule's numbers so they can't drift.
- Frontend: `NextUp` card ("Learn next") on the home page between the
  queue and the problem list; "Covered" badge on `/patterns`. The add and
  log forms invalidate `queryKeys.suggestion`.
- Known edge: a pattern with zero problems can never be covered and would
  pin the suggestion on "keep reviewing". Can't happen with the preload;
  noted in TREE.md.

## Next: branch 10, today's plan

- Follow TREE.md branch 10. Reviews come from `build_queue(db, today)`,
  new problems from `build_suggestion` / `suggest`. The plan is computed
  from attempts before today (as-of replay) so it's stable all day, plus a
  "done today" check from today's attempts.
- Read "today" once per request and pass it to both the plan and the
  done-today check.
- Open questions to raise with the user first:
  - `suggest` returns one problem. For pace 11's "2 new a day", either
    call it, pretend the first was attempted, and call again, or add a
    `limit`. The second can land in a different pattern (if the first
    covers nothing, it's the same pattern's next problem).
  - Where the plan lives on the home page relative to the queue and the
    `NextUp` card (likely replaces both).

## After that

- Branch 11 (pace) as TREE.md describes.

## Working style (from CLAUDE.md and memory)

- Explain each change in plain language. Never fix something silently; show
  what broke before changing tests.
- Keep diffs small. Ask one question after each significant piece.
- Don't add tests that only restate data or trivial code.
- Commit after each piece passes tests: one-line subject plus the
  Co-Authored-By trailer. Leave out files the user edited themselves.
- One branch per leaf, PR to `main`; the user merges by hand.
- The user checks work on the dev server (http://localhost:5173), not prod.
