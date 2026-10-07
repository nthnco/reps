import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { logout } from './api/auth'
import { setUnauthorizedHandler } from './api/errors'
import { queryKeys, useMe } from './api/queries'
import { AddProblemForm } from './components/AddProblemForm'
import { LoginPage } from './components/LoginPage'
import { LogAttemptForm } from './components/LogAttemptForm'
import { TodaysQueue } from './components/TodaysQueue'

function App() {
  const queryClient = useQueryClient()
  const me = useMe()

  // Any 401, e.g. the login cookie expiring mid-session, flips to the login page.
  useEffect(() => {
    setUnauthorizedHandler(() => queryClient.setQueryData(queryKeys.me, null))
  }, [queryClient])

  if (me.isPending) return null
  if (me.isError) {
    return (
      <p role="alert" className="p-4 text-red-600 dark:text-red-400">
        {me.error.message}
      </p>
    )
  }
  if (me.data === null) return <LoginPage />

  async function handleLogout() {
    await logout()
    queryClient.setQueryData(queryKeys.me, null)
    // Drop the rest of the cache so nothing from this session lingers. Not
    // clear(): that would also detach useMe from the "me" entry set above.
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.me[0] })
  }

  return (
    <main className="mx-auto max-w-3xl space-y-10 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reps</h1>
        {/* Gate off (local dev): there's no username and nothing to log out of. */}
        {me.data.username && (
          <button type="button" onClick={handleLogout} className="text-sm underline">
            Log out
          </button>
        )}
      </header>
      <TodaysQueue />
      <LogAttemptForm />
      <AddProblemForm />
    </main>
  )
}

export default App
