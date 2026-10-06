import { Link, Route, Routes } from 'react-router'
import { AddProblemForm } from './components/AddProblemForm'
import { ProblemList } from './components/ProblemList'
import { ProblemPage } from './components/ProblemPage'
import { TodaysQueue } from './components/TodaysQueue'

function HomePage() {
  return (
    <>
      <TodaysQueue />
      <ProblemList />
      <AddProblemForm />
    </>
  )
}

function App() {
  return (
    <main className="mx-auto max-w-3xl space-y-10 p-4">
      <h1 className="text-2xl font-bold">
        <Link to="/">Reps</Link>
      </h1>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/problems/:id" element={<ProblemPage />} />
      </Routes>
    </main>
  )
}

export default App
