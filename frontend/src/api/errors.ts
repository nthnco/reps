import type { HttpValidationError } from './generated'

export type FieldErrorsFor<Body> = Partial<Record<keyof Body, string>>

export const UNREACHABLE_MESSAGE = "Couldn't reach the server. Is the backend running?"

let onUnauthorized = () => {}

/** App registers this so any 401 (e.g. an expired login cookie) shows the login page. */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

/** fetch, plus the 401 check. Every API call goes through here. */
export async function apiFetch(...args: Parameters<typeof fetch>): Promise<Response> {
  const response = await fetch(...args)
  if (response.status === 401) onUnauthorized()
  return response
}

/** POST JSON; resolves to null if the server couldn't be reached at all. */
export async function postJson(url: string, body: unknown): Promise<Response | null> {
  try {
    return await apiFetch(url, {
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
