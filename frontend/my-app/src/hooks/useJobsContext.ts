import { useContext } from 'react'
import { JobsContext } from './jobs-context'

export function useJobsContext() {
  const context = useContext(JobsContext)
  if (!context) throw new Error('useJobsContext must be used inside JobsProvider.')
  return context
}
