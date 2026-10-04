# Reps: Project Tree

## Trunk

add a problem -> log an attempt -> scheduler sets next review -> today's
queue shows what's due

## MVP leaves

- [ ] **Data model**: `Problem` (number, title, link, pattern, difficulty,
      notes) and `Attempt` (problem, date, solved, minutes, confidence 1-5,
      used_hint)
- [ ] **Add-problem form** with pattern dropdown (API endpoint + React form)
- [ ] **Log-attempt form** (API endpoint + React form)
- [ ] **Scheduler**: SM-2 style next-review date from result and confidence,
      as a pure function with unit tests
- [ ] **Today's queue page** (API endpoint + React page)
- [ ] **Tests** for the scheduler, the main API routes, and the key React
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

## Open decisions

- **Single-user vs accounts**: assumed single-user for now (no auth).
- **Hosting**: undecided. Local-only for the MVP. Needs managed Postgres
  wherever it lands.
- **Keeping frontend types in sync with the API**: hand-written TypeScript
  types vs generating them from FastAPI's OpenAPI schema. Decide before the
  first form is built.
- **Styling**:  Tailwind
- **Frontend data fetching**: plain `fetch` vs TanStack Query (caching,
  loading states). Decide with the first page that reads data.
