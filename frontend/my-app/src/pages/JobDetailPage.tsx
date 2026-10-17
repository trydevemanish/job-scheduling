import { useEffect, useState } from 'react'
import { ArrowLeft, Ban, Braces, Clock3, Info, RefreshCw } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { cancelJob, getJob } from '../api/jobs'
import { StatusBadge } from '../components/StatusBadge'
import { useJobsContext } from '../hooks/useJobsContext'
import type { Job } from '../types/job'
import { formatDate, formatDuration, formatJobType, jobDuration } from '../utils/job'

export function JobDetailPage() {
  const { id = '' } = useParams()
  const { jobs, notify, saveJob } = useJobsContext()
  const [job, setJob] = useState<Job | null>(jobs.find((item) => item.id === id) ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [now, setNow] = useState(0)

  useEffect(() => {
    let active = true
    getJob(id)
      .then((result) => {
        if (!active) return
        setJob(result)
        saveJob(result)
        setError('')
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load this job.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, saveJob])

  useEffect(() => {
    if (job?.status !== 'processing') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [job?.status])

  const handleCancel = async () => {
    if (!job || !window.confirm(`Cancel "${job.name}"? The server will decide whether cancellation is allowed.`)) return
    setCancelling(true)
    try {
      const updated = await cancelJob(job.id)
      setJob(updated)
      saveJob(updated)
      notify(`Current status: ${updated.status}.`, 'success')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to cancel this job.'
      notify(message, 'error')
      setError(message)
      void getJob(job.id)
        .then((latest) => {
          setJob(latest)
          saveJob(latest)
        })
        .catch((refreshCause: unknown) => {
          setError(refreshCause instanceof Error ? `${message} ${refreshCause.message}` : message)
        })
    } finally {
      setCancelling(false)
    }
  }

  if (loading && !job) return <div className="space-y-4"><div className="h-8 w-52 animate-pulse rounded-lg bg-slate-200" /><div className="h-64 animate-pulse rounded-2xl bg-white" /></div>
  if (!job) return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-card">
      <p className="text-sm font-semibold text-slate-800">{error || 'Job not found.'}</p>
      <Link to="/jobs" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600"><ArrowLeft size={14} /> Back to jobs</Link>
    </div>
  )

  const timestamps = [
    ['Submitted', job.created_at],
    ['Last updated', job.updated_at],
    ['Started', job.started_at],
    ['Completed', job.completed_at],
    ['Cancelled', job.cancelled_at],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <Link to="/jobs" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"><ArrowLeft size={14} /> Back to jobs</Link>
          <h2 className="truncate text-lg font-semibold tracking-tight text-slate-900">{job.name}</h2>
          <p className="mt-1 break-all font-mono text-xs text-slate-400">{job.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} />
          {(job.status === 'pending' || job.status === 'processing') && (
            <button onClick={() => void handleCancel()} disabled={cancelling} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Ban size={14} /> {cancelling ? 'Cancelling…' : 'Cancel job'}</button>
          )}
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Job type', value: formatJobType(job.job_type) },
          { label: 'Priority', value: `P${job.priority}` },
          { label: 'Retry count', value: `${job.retry_count}${job.max_retries !== undefined && job.max_retries !== null ? ` / ${job.max_retries}` : ''}` },
          { label: 'Duration', value: jobDuration(job, now) },
        ].map(({ label, value }) => <article key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 truncate text-sm font-semibold text-slate-900">{value}</p></article>)}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6">
          <div className="mb-4 flex items-center gap-2"><Braces size={16} className="text-indigo-500" /><h3 className="text-sm font-semibold text-slate-900">Payload</h3></div>
          <pre className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{JSON.stringify(job.payload ?? {}, null, 2)}</pre>
        </article>
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6">
          <div className="mb-4 flex items-center gap-2"><Clock3 size={16} className="text-indigo-500" /><h3 className="text-sm font-semibold text-slate-900">Timeline</h3></div>
          <div className="space-y-4">
            {timestamps.map(([label, value], index) => (
              <div key={label} className="flex gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${index === 0 ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                <div><p className="text-xs font-semibold text-slate-700">{label}</p><p className="mt-0.5 text-xs text-slate-500">{formatDate(value)}</p></div>
              </div>
            ))}
            {timestamps.length === 0 && <p className="text-sm text-slate-500">No timestamps are available.</p>}
          </div>
        </article>
      </section>

      {job.failure_reason && <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 sm:p-6"><h3 className="text-sm font-semibold text-rose-800">Failure reason</h3><p className="mt-2 whitespace-pre-wrap text-sm text-rose-700">{job.failure_reason}</p></section>}

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6">
          <div className="mb-3 flex items-center gap-2"><Braces size={15} className="text-slate-400" /><h3 className="text-sm font-semibold text-slate-900">Result</h3></div>
          {job.result !== undefined && job.result !== null ? <pre className="max-h-64 overflow-auto rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-700">{JSON.stringify(job.result, null, 2)}</pre> : <p className="text-xs text-slate-500">No result is included in this job response.</p>}
        </article>
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6">
          <div className="mb-3 flex items-center gap-2"><RefreshCw size={15} className="text-slate-400" /><h3 className="text-sm font-semibold text-slate-900">Retry history</h3></div>
          <div className="flex gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><Info size={14} className="mt-0.5 shrink-0 text-slate-400" />The backend response includes a retry count, but does not expose per-attempt history.</div>
        </article>
      </section>
      <p className="text-right text-xs text-slate-400">Duration: {formatDuration(job.duration_ms)}</p>
    </div>
  )
}
