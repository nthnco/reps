import { apiFetch, postJson, UNREACHABLE_MESSAGE } from './errors'
import type { LoginBody, Me } from './generated'

/** Who's logged in, or null if nobody is (the login page should show). */
export async function getMe(): Promise<Me | null> {
  const response = await apiFetch('/api/auth/me')
  if (response.status === 401) return null
  if (!response.ok) {
    throw new Error(`Couldn't check your login (HTTP ${response.status}).`)
  }
  return (await response.json()) as Me
}

export type LoginResult = { ok: true } | { ok: false; message: string }

export async function login(body: LoginBody): Promise<LoginResult> {
  const response = await postJson('/api/auth/login', body)
  if (response === null) return { ok: false, message: UNREACHABLE_MESSAGE }
  if (response.ok) return { ok: true }
  if (response.status === 401) return { ok: false, message: 'Wrong username or password.' }
  return { ok: false, message: `Something went wrong (HTTP ${response.status}).` }
}

export async function logout(): Promise<void> {
  await postJson('/api/auth/logout', {})
}
