import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library only auto-unmounts between tests when Vitest globals are on.
afterEach(() => {
  cleanup()
})
