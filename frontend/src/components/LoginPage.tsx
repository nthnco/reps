import { useQueryClient } from '@tanstack/react-query'
import { useState, type SubmitEvent } from 'react'
import { login } from '../api/auth'
import { queryKeys } from '../api/queries'
import { Field, inputClass, submitClass } from './fields'

export function LoginPage() {
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    const result = await login({ username, password })
    setSubmitting(false)

    if (result.ok) {
      // Refetching "me" swaps this page for the app.
      void queryClient.invalidateQueries({ queryKey: queryKeys.me })
    } else {
      setMessage(result.message)
      setPassword('')
    }
  }

  return (
    <main className="mx-auto max-w-sm space-y-6 p-4 pt-16">
      <h1 className="text-2xl font-bold">Reps</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field id="username" label="Username">
          <input
            id="username"
            required
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field id="password" label="Password">
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </Field>
        {message && (
          <p role="alert" className="text-red-600 dark:text-red-400">
            {message}
          </p>
        )}
        <button type="submit" disabled={submitting} className={submitClass}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </main>
  )
}
