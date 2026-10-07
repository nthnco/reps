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

1. **Pattern mastery view**: per-pattern confidence and speed
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
  `/problems/:id` is a problem's page with the log-attempt form.
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
