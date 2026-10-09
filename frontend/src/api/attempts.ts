import { postJson, readFieldErrors, UNREACHABLE_MESSAGE, type FieldErrorsFor } from './errors'
import type { AttemptCreate, AttemptRead } from './generated'

export type AttemptFieldErrors = FieldErrorsFor<AttemptCreate>

export type CreateAttemptResult =
  | { ok: true; attempt: AttemptRead }
  | { ok: false; message: string; fieldErrors: AttemptFieldErrors }

export async function createAttempt(
  problemId: number,
  body: AttemptCreate,
): Promise<CreateAttemptResult> {
  const response = await postJson(`/api/problems/${problemId}/attempts`, body)
  if (response === null) {
    return { ok: false, message: UNREACHABLE_MESSAGE, fieldErrors: {} }
  }

  if (response.ok) {
    return { ok: true, attempt: (await response.json()) as AttemptRead }
  }

  if (response.status === 404) {
    return {
      ok: false,
      message: 'That problem no longer exists. Refresh and pick another.',
      fieldErrors: {},
    }
  }

  if (response.status === 403) {
    // The demo's limit on new attempts; the server words it.
    const { detail } = (await response.json()) as { detail: string }
    return { ok: false, message: detail, fieldErrors: {} }
  }
  if (response.status === 422) {
    const fieldErrors = await readFieldErrors<AttemptCreate>(response)
    return { ok: false, message: 'Please fix the fields below.', fieldErrors }
  }

  return { ok: false, message: `Something went wrong (HTTP ${response.status}).`, fieldErrors: {} }
}
