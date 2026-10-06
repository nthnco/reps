import { AddProblemForm } from './components/AddProblemForm'
import { LogAttemptForm } from './components/LogAttemptForm'
import { TodaysQueue } from './components/TodaysQueue'

function App() {
  return (
    <main className="mx-auto max-w-3xl space-y-10 p-4">
      <h1 className="text-2xl font-bold">Reps</h1>
      <TodaysQueue />
      <LogAttemptForm />
      <AddProblemForm />
    </main>
  )
}

export default App
