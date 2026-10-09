import { useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router'
import { logout } from './api/auth'
import { setUnauthorizedHandler } from './api/errors'
import { queryKeys, useMe } from './api/queries'
import { AddProblemForm } from './components/AddProblemForm'
import { ghostButtonClass, primaryButtonClass, secondaryButtonClass } from './components/fields'
import { LoginPage } from './components/LoginPage'
import { PatternMasteryList } from './components/PatternMasteryList'
import { ProblemList } from './components/ProblemList'
import { ProblemPage } from './components/ProblemPage'
import { ProfileSummary } from './components/ProfileSummary'
import { TodaysPlan } from './components/TodaysPlan'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `rounded-md px-3 py-1.5 font-medium ${
    isActive
      ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
  }`
}

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
      <Link to="/" className={`inline-block text-sm ${secondaryButtonClass}`}>
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
    <>
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold tracking-tight">
              <Link to="/">Reps</Link>
            </h1>
            {/* Links, not buttons, so open-in-new-tab still works. */}
            <nav className="flex items-center gap-1 text-sm">
              <NavLink to="/" end className={navLinkClass}>
                Today
              </NavLink>
              <NavLink to="/patterns" className={navLinkClass}>
                Mastery
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link to="/problems/new" className={primaryButtonClass}>
              Add problem
            </Link>
            {/* Gate off (local dev): there's no username and nothing to log out of. */}
            {me.data.username && (
              <button type="button" onClick={handleLogout} className={ghostButtonClass}>
                Log out
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/patterns" element={<Narrow><MasteryPage /></Narrow>} />
          <Route path="/problems/new" element={<Narrow><AddProblemPage /></Narrow>} />
          <Route path="/problems/:id" element={<Narrow><ProblemPage /></Narrow>} />
        </Routes>
      </main>
    </>
  )
}

export default App
