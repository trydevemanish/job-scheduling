import { useCallback, useEffect, useState } from 'react'
import { getJobs, type JobsQuery } from '../api/jobs'
import type { Job, JobsPage } from '../types/job'

type UseJobsOptions = JobsQuery

export function useJobs(options: UseJobsOptions = {}) {
  const { page, limit, status, jobType, from, to } = options
  const [data, setData] = useState<JobsPage>({ jobs: [], page: 1, limit: 20, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const refresh = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      getJobs({ page, limit, status, jobType, from, to })
        .then((result) => {
          if (active) setData(result)
        })
        .catch((cause: unknown) => {
          if (active) setError(cause instanceof Error ? cause.message : 'Unable to load jobs.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [page, limit, status, jobType, from, to, reloadToken])

  const updateJob = useCallback((job: Job) => {
    setData((current) => ({
      ...current,
      jobs: current.jobs.map((existing) => existing.id === job.id ? job : existing),
    }))
  }, [])

  return { ...data, loading, error, refresh, updateJob }
}
