import type { HttpValidationError } from './generated'

export type FieldErrorsFor<Body> = Partial<Record<keyof Body, string>>

export const UNREACHABLE_MESSAGE = "Couldn't reach the server. Is the backend running?"

/** POST JSON; resolves to null if the server couldn't be reached at all. */
export async function postJson(url: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return null
  }
}

/** Turn FastAPI's 422 body into one message per field. */
export async function readFieldErrors<Body>(response: Response): Promise<FieldErrorsFor<Body>> {
  const { detail = [] } = (await response.json()) as HttpValidationError
  const fieldErrors: FieldErrorsFor<Body> = {}
  for (const error of detail) {
    // FastAPI reports locations like ["body", "link"].
    const field = error.loc[1] as keyof Body
    // Pydantic prefixes messages from custom validators with "Value error, ".
    fieldErrors[field] = error.msg.replace(/^Value error, /, '')
  }
  return fieldErrors
}
