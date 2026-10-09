import { useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { Link, Route, Routes } from 'react-router'
import { logout } from './api/auth'
import { setUnauthorizedHandler } from './api/errors'
import { queryKeys, useMe } from './api/queries'
import { AddProblemForm } from './components/AddProblemForm'
import { primaryButtonClass, secondaryButtonClass } from './components/fields'
import { LoginPage } from './components/LoginPage'
import { PatternMasteryList } from './components/PatternMasteryList'
import { ProblemList } from './components/ProblemList'
import { ProblemPage } from './components/ProblemPage'
import { ProfileSummary } from './components/ProfileSummary'
import { TodaysPlan } from './components/TodaysPlan'

function HomePage() {
  return (
    <>
      <div className="max-w-3xl">
        <TodaysPlan />
      </div>
      <ProblemList />
    </>
  )
}

// Every page but home keeps the narrow column; only the pattern cards use the width.
function Narrow({ children }: { children: ReactNode }) {
  return <div className="max-w-3xl space-y-10">{children}</div>
}

function AddProblemPage() {
  return (
    <div className="space-y-6">
      <Link to="/" className="text-blue-700 hover:underline dark:text-blue-400">
        ← All problems
      </Link>
      <AddProblemForm />
    </div>
  )
}

function MasteryPage() {
  return (
    <>
      <ProfileSummary />
      <PatternMasteryList />
    </>
  )
}

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
    <main className="mx-auto max-w-6xl space-y-10 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          <Link to="/">Reps</Link>
        </h1>
        {/* Navigation stays as links (styled as buttons) so open-in-new-tab still works. */}
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/problems/new" className={primaryButtonClass}>
            Add problem
          </Link>
          <Link to="/patterns" className={secondaryButtonClass}>
            Mastery
          </Link>
          {/* Gate off (local dev): there's no username and nothing to log out of. */}
          {me.data.username && (
            <button type="button" onClick={handleLogout} className={secondaryButtonClass}>
              Log out
            </button>
          )}
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/patterns" element={<Narrow><MasteryPage /></Narrow>} />
        <Route path="/problems/new" element={<Narrow><AddProblemPage /></Narrow>} />
        <Route path="/problems/:id" element={<Narrow><ProblemPage /></Narrow>} />
      </Routes>
    </main>
  )
}

export default App
