import {
  apiFetch,
  postJson,
  readFieldErrors,
  UNREACHABLE_MESSAGE,
  type FieldErrorsFor,
} from './errors'
import type { ProblemCreate, ProblemRead } from './generated'

// Throws on failure: TanStack Query treats a thrown error as the query's error state.
export async function listProblems(): Promise<ProblemRead[]> {
  const response = await apiFetch('/api/problems')
  if (!response.ok) {
    throw new Error(`Couldn't load problems (HTTP ${response.status}).`)
  }
  return (await response.json()) as ProblemRead[]
}

export type FieldErrors = FieldErrorsFor<ProblemCreate>

export type CreateProblemResult =
  | { ok: true; problem: ProblemRead }
  | { ok: false; message: string; fieldErrors: FieldErrors }

export async function createProblem(body: ProblemCreate): Promise<CreateProblemResult> {
  const response = await postJson('/api/problems', body)
  if (response === null) {
    return { ok: false, message: UNREACHABLE_MESSAGE, fieldErrors: {} }
  }

  if (response.ok) {
    return { ok: true, problem: (await response.json()) as ProblemRead }
  }

  if (response.status === 409) {
    const { detail } = (await response.json()) as { detail: string }
    return { ok: false, message: detail, fieldErrors: { link: detail } }
  }

  if (response.status === 422) {
    const fieldErrors = await readFieldErrors<ProblemCreate>(response)
    return { ok: false, message: 'Please fix the fields below.', fieldErrors }
  }

  return { ok: false, message: `Something went wrong (HTTP ${response.status}).`, fieldErrors: {} }
}
