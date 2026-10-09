import { postJson } from './errors'

/** Swap this visitor's demo workspace for a fresh copy of the sample data. */
export async function resetDemo(): Promise<boolean> {
  const response = await postJson('/api/demo/reset', {})
  return response?.ok ?? false
}
