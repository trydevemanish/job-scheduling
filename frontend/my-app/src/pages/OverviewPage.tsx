import { Activity, ArrowRight, ArrowUpRight, CheckCircle2, CircleDashed, Clock3, Layers3, RefreshCw, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useJobsContext } from '../hooks/useJobsContext'
import type { JobStatus } from '../types/job'
import { formatDate, formatJobType } from '../utils/job'
import { StatusBadge } from '../components/StatusBadge'

const metrics: { status: JobStatus | 'all'; label: string; icon: typeof Layers3; tone: string }[] = [
  { status: 'all', label: 'Total jobs', icon: Layers3, tone: 'indigo' },
  { status: 'pending', label: 'Pending', icon: Clock3, tone: 'amber' },
  { status: 'processing', label: 'Processing', icon: Activity, tone: 'sky' },
  { status: 'completed', label: 'Completed', icon: CheckCircle2, tone: 'emerald' },
  { status: 'failed', label: 'Failed', icon: XCircle, tone: 'rose' },
]

const iconTones: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  amber: 'bg-amber-50 text-amber-600',
  sky: 'bg-sky-50 text-sky-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  rose: 'bg-rose-50 text-rose-600',
}

export function OverviewPage() {
  const { jobs, loading, error, refresh } = useJobsContext()
  const counts = jobs.reduce<Record<string, number>>((result, job) => {
    result[job.status] = (result[job.status] ?? 0) + 1
    return result
  }, {})
  const recent = [...jobs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 6)
  const distribution: { status: JobStatus; label: string; color: string }[] = [
    { status: 'completed', label: 'Completed', color: 'bg-emerald-500' },
    { status: 'processing', label: 'Processing', color: 'bg-sky-500' },
    { status: 'pending', label: 'Pending', color: 'bg-amber-400' },
    { status: 'failed', label: 'Failed', color: 'bg-rose-500' },
    { status: 'cancelled', label: 'Cancelled', color: 'bg-slate-400' },
  ]
  const successRate = jobs.length ? Math.round(((counts.completed ?? 0) / jobs.length) * 100) : 0

  return (
    <div className="space-y-6">
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(({ status, label, icon: Icon, tone }) => {
          const value = status === 'all' ? jobs.length : counts[status] ?? 0
          return (
            <article key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card sm:p-5">
              <div className="flex items-center justify-between">
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${iconTones[tone]}`}><Icon size={17} /></span>
                <span className="text-xs font-medium text-slate-400">{loading ? 'Updating' : 'All time'}</span>
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{loading && !jobs.length ? '—' : value.toLocaleString()}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
            </article>
          )
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
          <div className="flex items-center justify-between px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Recent jobs</h2>
              <p className="mt-1 text-xs text-slate-500">The latest submitted work across your queue</p>
            </div>
            <Link to="/jobs" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">View all <ArrowRight size={14} /></Link>
          </div>
          {loading && !jobs.length ? (
            <div className="space-y-4 px-6 py-6">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100" />)}</div>
          ) : recent.length ? (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {recent.map((job) => (
                <Link key={job.id} to={`/jobs/${encodeURIComponent(job.id)}`} className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50 sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{job.name || 'Untitled job'}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{formatJobType(job.job_type)} <span className="px-1 text-slate-300">·</span> {formatDate(job.created_at)}</p>
                  </div>
                  <StatusBadge status={job.status} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <CircleDashed className="mx-auto mb-3 text-slate-300" size={25} />
              <p className="text-sm font-semibold text-slate-700">Your queue is ready</p>
              <p className="mt-1 text-xs text-slate-500">Jobs will appear here after they are submitted.</p>
              <Link to="/jobs/new" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600">Create your first job <ArrowRight size={14} /></Link>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Job status</h2>
              <p className="mt-1 text-xs text-slate-500">Distribution across loaded jobs</p>
            </div>
            <button onClick={() => void refresh().catch(() => undefined)} aria-label="Refresh status" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><RefreshCw size={15} /></button>
          </div>
          <div className="mt-6 flex items-center gap-5">
            <div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full" style={{
              background: jobs.length
                ? `conic-gradient(#10b981 0% ${((counts.completed ?? 0) / jobs.length) * 100}%, #0ea5e9 ${((counts.completed ?? 0) / jobs.length) * 100}% ${(((counts.completed ?? 0) + (counts.processing ?? 0)) / jobs.length) * 100}%, #fbbf24 ${(((counts.completed ?? 0) + (counts.processing ?? 0)) / jobs.length) * 100}% ${(((counts.completed ?? 0) + (counts.processing ?? 0) + (counts.pending ?? 0)) / jobs.length) * 100}%, #f43f5e ${(((counts.completed ?? 0) + (counts.processing ?? 0) + (counts.pending ?? 0) + (counts.failed ?? 0)) / jobs.length) * 100}%, #94a3b8 ${(((counts.completed ?? 0) + (counts.processing ?? 0) + (counts.pending ?? 0) + (counts.failed ?? 0)) / jobs.length) * 100}% 100%)`
                : '#f1f5f9',
            }}>
              <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-white">
                <div className="text-center"><p className="text-xl font-semibold text-slate-900">{successRate}%</p><p className="text-[10px] text-slate-400">success</p></div>
              </div>
            </div>
            <div className="w-full space-y-2.5">
              {distribution.map(({ status, label, color }) => (
                <div key={status} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 text-slate-600"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</span>
                  <span className="font-semibold tabular-nums text-slate-800">{counts[status] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 border-t border-slate-100 pt-4">
            <div className="mb-2 flex justify-between text-xs"><span className="text-slate-500">Completed jobs</span><span className="font-semibold text-slate-700">{successRate}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${successRate}%` }} /></div>
          </div>
        </article>
      </section>

      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-white p-5 sm:flex-row sm:items-center sm:px-6">
        <div className="flex gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm"><Activity size={18} /></span>
          <div><h2 className="text-sm font-semibold text-slate-900">Queue activity</h2><p className="mt-1 text-xs text-slate-500">Live events update job status as your workers process the queue.</p></div>
        </div>
        <Link to="/jobs/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700">Submit a job <ArrowUpRight size={14} /></Link>
      </section>
    </div>
  )
}
