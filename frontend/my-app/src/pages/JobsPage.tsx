import { useMemo, useState } from 'react'
import { Ban, ChevronLeft, ChevronRight, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cancelJob } from '../api/jobs'
import { JobTable } from '../components/JobTable'
import { useJobsContext } from '../hooks/useJobsContext'
import { jobStatuses, jobTypes, type Job } from '../types/job'
import { formatJobType } from '../utils/job'

const PAGE_SIZE = 10

export function JobsPage() {
  const { jobs, loading, error, refresh, notify, saveJob } = useJobsContext()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [date, setDate] = useState('')
  const [page, setPage] = useState(1)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const filtered = useMemo(() => jobs.filter((job) => {
    const term = search.trim().toLowerCase()
    const matchesSearch = !term || job.name.toLowerCase().includes(term) || job.id.toLowerCase().includes(term)
    const matchesStatus = !status || job.status === status
    const matchesType = !type || job.job_type === type
    const matchesDate = !date || job.created_at.slice(0, 10) === date
    return matchesSearch && matchesStatus && matchesType && matchesDate
  }), [jobs, search, status, type, date])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const cancel = async (job: Job) => {
    if (!window.confirm(`Cancel "${job.name}"? The server will decide whether its current status allows cancellation.`)) return
    setCancelling(job.id)
    try {
      const updated = await cancelJob(job.id)
      saveJob(updated)
      notify(`Job cancellation accepted. Current status: ${updated.status}.`, 'success')
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Unable to cancel this job.', 'error')
      if (cause instanceof Error) void refresh().catch(() => undefined)
    } finally {
      setCancelling(null)
    }
  }

  return (
    <div className="space-y-5">
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h2 className="text-sm font-semibold text-slate-900">All jobs <span className="ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">{filtered.length}</span></h2><p className="mt-1 text-xs text-slate-500">Search and filter your submitted work.</p></div>
        <Link to="/jobs/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"><Plus size={16} /> New job</Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search by job name or ID…" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="sr-only" htmlFor="status-filter">Filter by status</label>
            <select id="status-filter" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-indigo-300">
              <option value="">All statuses</option>{jobStatuses.map((value) => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}
            </select>
            <label className="sr-only" htmlFor="type-filter">Filter by job type</label>
            <select id="type-filter" value={type} onChange={(event) => { setType(event.target.value); setPage(1) }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-indigo-300">
              <option value="">All types</option>{jobTypes.map((value) => <option key={value} value={value}>{formatJobType(value)}</option>)}
            </select>
            <label className="relative col-span-2 sm:col-span-1">
              <span className="sr-only">Filter by submission date</span>
              <input aria-label="Filter by submission date" type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1) }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-indigo-300" />
            </label>
          </div>
          <button onClick={() => void refresh().catch(() => undefined)} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><SlidersHorizontal size={14} /> Refresh</button>
        </div>

        {loading && !jobs.length ? (
          <div className="space-y-3 p-5">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}</div>
        ) : error && !jobs.length ? (
          <div role="alert" className="px-6 py-16 text-center"><Ban className="mx-auto mb-3 text-rose-400" size={24} /><p className="text-sm font-semibold text-slate-800">Could not load jobs</p><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{error}</p><button onClick={() => void refresh().catch(() => undefined)} className="mt-4 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Try again</button></div>
        ) : <JobTable jobs={visible} onCancel={(job) => void cancel(job)} />}

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">Showing {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} jobs</p>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            {cancelling && <span role="status" className="mr-2 text-xs text-slate-500">Cancelling…</span>}
            <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={15} /></button>
            <span className="min-w-20 text-center text-xs text-slate-600">Page {page} of {pages}</span>
            <button aria-label="Next page" disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-400">Filters and pagination use the jobs returned by the API. Retry history is not included in the current backend response.</p>
    </div>
  )
}
