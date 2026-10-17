import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { getAllJobs } from '../api/jobs'
import type { Job, JobStatusEvent } from '../types/job'
import { useJobSocket } from './useJobSocket'
import { JobsContext, type Notice } from './jobs-context'

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notices, setNotices] = useState<Notice[]>([])
  const noticeId = useRef(0)
  const eventRefreshTimer = useRef<number | undefined>(undefined)
  const eventTimes = useRef(new Map<string, string>())
  const noticeTimers = useRef(new Map<number, number>())
  const jobsRef = useRef<Job[]>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const latest = await getAllJobs()
      const merged = latest.map((job) => {
        const current = jobsRef.current.find((item) => item.id === job.id)
        return current && Date.parse(current.updated_at) > Date.parse(job.updated_at) ? current : job
      })
      jobsRef.current = merged
      setJobs(merged)
      setError(null)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to load jobs.'
      setError(message)
      throw cause
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch(() => undefined)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  const notify = useCallback((message: string, tone: Notice['tone'] = 'info') => {
    const id = ++noticeId.current
    setNotices((current) => [...current, { id, message, tone }])
    const timer = window.setTimeout(() => {
      setNotices((current) => current.filter((notice) => notice.id !== id))
      noticeTimers.current.delete(id)
    }, 4200)
    noticeTimers.current.set(id, timer)
  }, [])

  const dismissNotice = useCallback((id: number) => {
    const timer = noticeTimers.current.get(id)
    if (timer !== undefined) window.clearTimeout(timer)
    noticeTimers.current.delete(id)
    setNotices((current) => current.filter((notice) => notice.id !== id))
  }, [])

  const saveJob = useCallback((job: Job) => {
    const index = jobsRef.current.findIndex((item) => item.id === job.id)
    if (index >= 0 && Date.parse(jobsRef.current[index].updated_at) > Date.parse(job.updated_at)) return
    const next = [...jobsRef.current]
    if (index < 0) next.unshift(job)
    else next[index] = job
    jobsRef.current = next
    setJobs(next)
  }, [])

  const handleEvent = useCallback((event: JobStatusEvent) => {
    const incomingTime = Date.parse(event.updatedAt)
    if (Number.isNaN(incomingTime)) return
    const lastTime = Date.parse(eventTimes.current.get(event.jobId) ?? '')
    if (!Number.isNaN(lastTime) && incomingTime <= lastTime) return
    eventTimes.current.set(event.jobId, event.updatedAt)

    const previous = jobsRef.current.find((job) => job.id === event.jobId)
    if (!previous) {
      if (eventRefreshTimer.current !== undefined) window.clearTimeout(eventRefreshTimer.current)
      eventRefreshTimer.current = window.setTimeout(() => {
        void refresh().catch(() => undefined)
      }, 300)
      return
    }
    if (Date.parse(previous.updated_at) > incomingTime) return
    if (event.status !== previous.status && (event.status === 'completed' || event.status === 'failed')) {
      notify(
        event.status === 'completed' ? `${previous.name} completed.` : `${previous.name} failed.`,
        event.status === 'completed' ? 'success' : 'error',
      )
    }
    const next = jobsRef.current.map((job) => job.id === event.jobId
      ? {
          ...job,
          status: event.status,
          retry_count: event.retryCount,
          failure_reason: event.failureReason ?? (event.status === 'processing' || event.status === 'completed' ? null : job.failure_reason),
          updated_at: event.updatedAt,
        }
      : job)
    jobsRef.current = next
    setJobs(next)

    if (eventRefreshTimer.current !== undefined) window.clearTimeout(eventRefreshTimer.current)
    eventRefreshTimer.current = window.setTimeout(() => {
      void refresh().catch(() => undefined)
    }, 350)
  }, [notify, refresh])

  const connection = useJobSocket(handleEvent, () => {
    void refresh().catch(() => undefined)
  })

  useEffect(() => () => {
    if (eventRefreshTimer.current !== undefined) window.clearTimeout(eventRefreshTimer.current)
    for (const timer of noticeTimers.current.values()) window.clearTimeout(timer)
  }, [])

  return (
    <JobsContext.Provider value={{
      jobs, loading, error, connection, notices, refresh, notify, dismissNotice, saveJob,
    }}>
      {children}
    </JobsContext.Provider>
  )
}
