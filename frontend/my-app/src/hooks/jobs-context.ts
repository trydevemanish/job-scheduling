import { createContext } from 'react'
import type { Job } from '../types/job'
import type { ConnectionStatus } from './useJobSocket'

export interface Notice {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
}

export interface JobsContextValue {
  jobs: Job[]
  loading: boolean
  error: string | null
  connection: ConnectionStatus
  notices: Notice[]
  refresh: () => Promise<void>
  notify: (message: string, tone?: Notice['tone']) => void
  dismissNotice: (id: number) => void
  saveJob: (job: Job) => void
}

export const JobsContext = createContext<JobsContextValue | null>(null)
