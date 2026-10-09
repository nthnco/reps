import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { resetDemo } from '../api/demo'
import { secondaryButtonClass } from './fields'

export function DemoBanner() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [resetting, setResetting] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleReset() {
    setResetting(true)
    const ok = await resetDemo()
    setResetting(false)
    setFailed(!ok)
    if (!ok) return
    // A problem the visitor added is gone after a reset, so leave its page.
    navigate('/')
    await queryClient.invalidateQueries()
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
        <p>
          <strong className="font-semibold">Demo</strong> with eight weeks of sample practice. Try
          anything: your changes are private to you and reset after an hour.
          {failed && <span role="alert"> Couldn't reset; try again.</span>}
        </p>
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting}
          className={secondaryButtonClass}
        >
          {resetting ? 'Resetting…' : 'Reset demo'}
        </button>
      </div>
    </div>
  )
}
