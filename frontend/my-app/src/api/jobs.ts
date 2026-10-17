import { apiRequest } from './client'
import { jobStatuses, type CreateJobInput, type Job, type JobsPage, type JobStatus } from '../types/job'

export interface JobsQuery {
  page?: number
  limit?: number
  status?: string
  jobType?: string
  from?: string
  to?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && jobStatuses.some((status) => status === value)
}

function parseJob(value: unknown): Job {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || typeof value.job_type !== 'string'
    || !isJobStatus(value.status)
    || typeof value.priority !== 'number'
    || typeof value.retry_count !== 'number'
    || typeof value.created_at !== 'string'
    || typeof value.updated_at !== 'string'
    || !isRecord(value.payload)) {
    throw new Error('The API returned a job with an unsupported response shape.')
  }
  return {
    id: value.id,
    name: value.name,
    job_type: value.job_type,
    status: value.status,
    priority: value.priority,
    retry_count: value.retry_count,
    payload: value.payload,
    created_at: value.created_at,
    updated_at: value.updated_at,
    ...(typeof value.max_retries === 'number' || value.max_retries === null ? { max_retries: value.max_retries } : {}),
    ...(typeof value.failure_reason === 'string' || value.failure_reason === null ? { failure_reason: value.failure_reason } : {}),
    ...(typeof value.started_at === 'string' || value.started_at === null ? { started_at: value.started_at } : {}),
    ...(typeof value.completed_at === 'string' || value.completed_at === null ? { completed_at: value.completed_at } : {}),
    ...(typeof value.cancelled_at === 'string' || value.cancelled_at === null ? { cancelled_at: value.cancelled_at } : {}),
    ...(typeof value.duration_ms === 'number' || value.duration_ms === null ? { duration_ms: value.duration_ms } : {}),
    ...(value.result !== undefined ? { result: value.result } : {}),
  }
}

function normalizeJobsResponse(response: unknown): JobsPage {
  if (Array.isArray(response)) {
    const jobs = response.map(parseJob)
    return { jobs, page: 1, limit: jobs.length, total: jobs.length }
  }
  if (!isRecord(response)) throw new Error('The API returned an unsupported jobs response.')
  const values = Array.isArray(response.jobs)
    ? response.jobs
    : response.job
      ? [response.job]
      : []
  const jobs = values.map(parseJob)
  return {
    jobs,
    page: typeof response.page === 'number' ? response.page : 1,
    limit: typeof response.limit === 'number' ? response.limit : jobs.length,
    total: typeof response.total === 'number' ? response.total : jobs.length,
  }
}

export async function getJobs(query: JobsQuery = {}): Promise<JobsPage> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const search = params.size ? `?${params.toString()}` : ''
  const response = await apiRequest<unknown>(`/api/jobs${search}`)
  return normalizeJobsResponse(response)
}

export async function getAllJobs(): Promise<Job[]> {
  const firstPage = await getJobs({ page: 1, limit: 100 })
  const jobs = [...firstPage.jobs]
  const pages = Math.ceil(firstPage.total / Math.max(firstPage.limit, 1))
  for (let page = 2; page <= pages; page += 1) {
    const nextPage = await getJobs({ page, limit: firstPage.limit })
    jobs.push(...nextPage.jobs)
  }
  return jobs
}

function unwrapJob(response: unknown): Job {
  if (isRecord(response) && 'job' in response) return parseJob(response.job)
  return parseJob(response)
}

export async function getJob(id: string): Promise<Job> {
  return unwrapJob(await apiRequest<unknown>(`/api/jobs/${encodeURIComponent(id)}`))
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  const response = await apiRequest<unknown>('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return unwrapJob(response)
}

export async function cancelJob(id: string): Promise<Job> {
  const response = await apiRequest<unknown>(
    `/api/jobs/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' },
  )
  return unwrapJob(response)
}

export async function checkHealth(): Promise<void> {
  await apiRequest<unknown>('/health')
}
