# Reps: Project Tree

## Trunk

add a problem -> log an attempt -> scheduler sets next review -> today's
queue shows what's due

## MVP leaves

- [x] **Data model**: `Problem` (number, title, link, pattern, difficulty,
      notes) and `Attempt` (problem, attempted_on, solved, duration_seconds,
      confidence 1-5, used_hint)
- [x] **Add-problem form** with pattern dropdown (API endpoint + React form)
- [x] **Log-attempt form** (API endpoint + React form) with a timer that
      survives a page refresh, plus manual duration entry as a fallback
- [x] **Scheduler**: SM-2 style next-review date from result and confidence,
      as a pure function with unit tests
- [x] **Today's queue page** (API endpoint + React page)
- [x] **Tests** for the scheduler, the main API routes, and the key React
      components

## Later branches (in order)

1. [x] **Pattern mastery view**: per-pattern confidence and speed
2. **GitHub linking** via the official API: detect commits, auto-log attempts
3. **Learned scheduler**: FSRS-style recall model, evaluated against SM-2 on
   the user's own history
4. **Pattern classifier**: suggests a label from solution code
5. **Company readiness**: framed as coverage of the patterns a company's
   questions lean on; only once the data supports it
6. **Accounts and a shareable demo**

## Decided

- **Dates**: attempts and review due dates are calendar dates, no time of
  day. "Today" is computed by the backend in one configured timezone,
  `America/Los_Angeles`, with a midnight rollover.
- **Duration**: stored as seconds, shown as minutes.
- **Styling**: Tailwind.
- **Frontend API types**: generated from FastAPI's OpenAPI schema with
  `@hey-api/openapi-ts` (types only), via `npm run gen:api`. Chosen over
  `openapi-typescript`, which doesn't support TypeScript 6.
- **Frontend data fetching**: TanStack Query. Cache keys live in
  `src/api/queries.ts`.
- **Routing**: React Router. `/` is home (queue, all problems, add form);
  `/problems/:id` is a problem's page with the log-attempt form; `/patterns`
  is the mastery page (profile summary, a bar per pattern).
- **Type checking**: pyright over `backend/app` in CI. Database models need a
  `# pyright: ignore[reportArgumentType]` where they're passed to the pure
  functions' `...Like` protocols (pyright sees `Mapped[date]`, not `date`).
- **Scheduler interface**: each scheduler module (`sm2.py`, later `fsrs.py`)
  exposes `update(state, rating, now)` and `retention(state, now)`, typed by
  `scheduling.py`, and owns its state type. SM-2's retention is an
  approximation: `0.9 ** (days since review / max(interval, 7))`.
- **FSRS** (`fsrs.py`): FSRS-6, written by hand on calendar dates, matching
  py-fsrs 6.3.2 (no learning steps, no fuzzing) to float precision. Starts on
  the published default parameters, aiming for 90% recall on the due date.
  - Ratings: failed is Again; hint or confidence 1-2 is Hard; 3 is Good; 4-5
    is Easy. Any solve, even with a hint, counts as a recall.
  - Same-day repeats use FSRS's short-term rule and barely move stability.
  - Versus SM-2: a first confident solve (4-5) is due in 8 days, not 1; two
    Good reviews reach ~11 days. Retention is a power curve with a long tail
    (10-day stability still predicts ~50% recall after 1,000 days), where
    SM-2's approximation falls towards 0.
  - Mastery follows whichever scheduler is active, so under FSRS patterns fade
    more slowly and "Needs review" shows up less often.
- **Pattern mastery**: computed on read from all attempts (nothing stored), so
  backdated attempts replay in order. All numbers live in `mastery_config.py`.
  - Score per attempt: clean solve 0.5 easy / 0.9 medium / 1.0 hard; hint or
    slow (over 15/25/35 min) is 0.6x that; failed is 0. Easies alone can't
    reach "mastered" (0.6).
  - Mastery is an EWMA (weight 0.5) over a pattern's attempts in date order,
    starting from the first score. A clean solve never lowers it; a hint or
    slow hard never drops it below the clean-medium level. Peak never decays.
  - Certainty is n / (n + 5) attempts; under 5 attempts is "low data" (faded,
    never a strength).
  - Displayed mastery = mastery x average retention of the pattern's problems,
    with retention floored at 0.2.
  - Overall rating averages only patterns with 2+ problems attempted.
    "Needs work" was never mastered; "Needs review" was, and has faded.
- **Timer**: one at a time, locked to its problem even while paused, saved in
  this browser's localStorage. "Start problem" starts it and opens LeetCode.
- **Workflow**: one branch per leaf with a PR to `main`. The user merges it by
  hand after CI passes; nothing merges automatically.
- **Hosting**: app on Render (free web service, Docker, `render.yaml`,
  deploys from `main` only after CI passes); Postgres on Neon (free plan, no
  expiry). Render's free Postgres was rejected because it expires after 30
  days. FastAPI serves the built frontend, so it's one origin with no CORS.
  Free Render services sleep after 15 minutes idle (~1 min cold start);
  upgrade the demo service once its link is shared.
- **Deploy plan**: (1) deploy plumbing, (2) password gate, then the private
  instance goes live, (3) demo mode: a second instance with writes blocked
  and seeded data dated relative to today, re-seeded daily.

## Open decisions

- **Single-user vs accounts**: single-user for now. The private instance and
  the demo are separate deployments with separate databases.
- **Backups**: Neon's free plan keeps only 6 hours of restore history.

## Notes and follow-ups

- **Adding a pattern** takes three steps: a hand-written Alembic migration
  (autogenerate doesn't see changes to the `ck_problems_pattern` CHECK),
  `npm run gen:api`, and a label in `frontend/src/api/labels.ts` (the build
  fails until it's there).
- **Switching to FSRS**: change the `schedule`/`retention` imports in
  `routes/mastery.py` and `routes/queue.py`; the mastery code and the UI only
  see neutral numbers (0-1 mastery, due dates), so neither changes.
- **Duration 0** counts as a fast solve when scoring mastery.
- **Long durations**: the API accepts up to 24h. Only the log-attempt form asks
  before submitting a timer over 3h; lower the API cap if other sources
  (e.g. GitHub linking) start logging attempts.
- **Network drop after a save**: the forms say "Couldn't reach the server"
  even if the save went through. Retrying an add-problem gets a clear 409;
  retrying a log-attempt would create a duplicate attempt.
- **`npm audit`**: 4 high-severity `js-yaml` warnings come from the dev-only
  `@hey-api/openapi-ts` (CPU slowdown on crafted YAML; we only feed it our own
  schema). Recheck after its next release; don't `npm audit fix --force`.
- **CI**: `astral-sh/setup-uv@v6` warns that Node 20 is deprecated; bump to a
  newer major when one exists. `ubuntu-latest` moves to Ubuntu 26 from
  2026-10-19.
