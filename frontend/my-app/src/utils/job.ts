import type { Job, JobStatus } from '../types/job'

export const statusLabels: Record<JobStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatDuration(milliseconds?: number | null): string {
  if (milliseconds === undefined || milliseconds === null || !Number.isFinite(milliseconds)) return '—'
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

export function jobDuration(job: Job, now = Date.now()): string {
  if (job.duration_ms !== undefined && job.duration_ms !== null) return formatDuration(job.duration_ms)
  if (!job.started_at) return '—'
  const end = job.completed_at ?? job.cancelled_at ?? (job.status === 'processing' ? new Date(now).toISOString() : null)
  return end ? formatDuration(Date.parse(end) - Date.parse(job.started_at)) : '—'
}

export function formatJobType(value: string): string {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}
