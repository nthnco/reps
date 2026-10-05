import type { HttpValidationError, ProblemCreate, ProblemRead } from './generated'

// Throws on failure: TanStack Query treats a thrown error as the query's error state.
export async function listProblems(): Promise<ProblemRead[]> {
  const response = await fetch('/api/problems')
  if (!response.ok) {
    throw new Error(`Couldn't load problems (HTTP ${response.status}).`)
  }
  return (await response.json()) as ProblemRead[]
}

export type FieldErrors = Partial<Record<keyof ProblemCreate, string>>

export type CreateProblemResult =
  | { ok: true; problem: ProblemRead }
  | { ok: false; message: string; fieldErrors: FieldErrors }

export async function createProblem(body: ProblemCreate): Promise<CreateProblemResult> {
  let response: Response
  try {
    response = await fetch('/api/problems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, message: "Couldn't reach the server. Is the backend running?", fieldErrors: {} }
  }

  if (response.ok) {
    return { ok: true, problem: (await response.json()) as ProblemRead }
  }

  if (response.status === 409) {
    const { detail } = (await response.json()) as { detail: string }
    return { ok: false, message: detail, fieldErrors: { number: detail } }
  }

  if (response.status === 422) {
    const { detail = [] } = (await response.json()) as HttpValidationError
    const fieldErrors: FieldErrors = {}
    for (const error of detail) {
      // FastAPI reports locations like ["body", "link"].
      const field = error.loc[1] as keyof ProblemCreate
      // Pydantic prefixes messages from custom validators with "Value error, ".
      fieldErrors[field] = error.msg.replace(/^Value error, /, '')
    }
    return { ok: false, message: 'Please fix the fields below.', fieldErrors }
  }

  return { ok: false, message: `Something went wrong (HTTP ${response.status}).`, fieldErrors: {} }
}
