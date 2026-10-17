export const jobStatuses = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
] as const

export type JobStatus = (typeof jobStatuses)[number]

export const jobTypes = [
  'send_order_confirmation_email',
  'password_reset_email',
] as const

export type JobType = (typeof jobTypes)[number]

export interface Job {
  id: string
  name: string
  job_type: JobType | string
  status: JobStatus
  priority: number
  payload: Record<string, unknown>
  retry_count: number
  max_retries?: number | null
  failure_reason?: string | null
  created_at: string
  updated_at: string
  started_at?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
  duration_ms?: number | null
  result?: unknown
}

export interface JobsPage {
  jobs: Job[]
  page: number
  limit: number
  total: number
}

export interface CreateJobInput {
  name: string
  jobType: JobType
  payload: Record<string, unknown>
  priority: number
  maxRetries: number
  idempotencyKey: string
}

export interface JobStatusEvent {
  jobId: string
  status: JobStatus
  retryCount: number
  updatedAt: string
  failureReason?: string | null
}
