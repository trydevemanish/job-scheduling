import { ArrowUpRight, Ban, Clock3, MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Job } from '../types/job'
import { formatDate, formatJobType, jobDuration } from '../utils/job'
import { StatusBadge } from './StatusBadge'

interface JobTableProps {
  jobs: Job[]
  onCancel: (job: Job) => void
}

export function JobTable({ jobs, onCancel }: JobTableProps) {
  if (!jobs.length) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Clock3 size={21} /></span>
        <h3 className="text-sm font-semibold text-slate-800">No jobs match this view</h3>
        <p className="mt-1 text-sm text-slate-500">Try changing your filters, or create a new job.</p>
        <Link to="/jobs/new" className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-700">Create a job</Link>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] border-collapse text-left">
        <thead>
          <tr className="border-y border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <th className="px-5 py-3.5">Job name</th>
            <th className="px-4 py-3.5">Job type</th>
            <th className="px-4 py-3.5">Status</th>
            <th className="px-4 py-3.5">Priority</th>
            <th className="px-4 py-3.5">Retries</th>
            <th className="px-4 py-3.5">Submitted</th>
            <th className="px-4 py-3.5">Duration</th>
            <th className="px-4 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {jobs.map((job) => (
            <tr key={job.id} className="transition-colors hover:bg-slate-50/70">
              <td className="px-5 py-4">
                <Link to={`/jobs/${encodeURIComponent(job.id)}`} className="group block max-w-[260px]">
                  <span className="flex items-center gap-1 text-sm font-semibold text-slate-800 group-hover:text-indigo-600">
                    <span className="truncate">{job.name || 'Untitled job'}</span><ArrowUpRight size={13} className="shrink-0 opacity-0 group-hover:opacity-100" />
                  </span>
                  <span className="mt-1 block truncate font-mono text-[11px] text-slate-400">{job.id}</span>
                  {job.status === 'failed' && job.failure_reason && (
                    <span className="mt-1 block max-w-[240px] truncate text-xs text-rose-600" title={job.failure_reason}>{job.failure_reason}</span>
                  )}
                </Link>
              </td>
              <td className="px-4 py-4 text-xs text-slate-600">{formatJobType(job.job_type)}</td>
              <td className="px-4 py-4"><StatusBadge status={job.status} /></td>
              <td className="px-4 py-4"><span className="text-sm font-medium text-slate-700">P{job.priority}</span></td>
              <td className="px-4 py-4 text-sm text-slate-600">{job.retry_count}{job.max_retries !== undefined && job.max_retries !== null ? ` / ${job.max_retries}` : ''}</td>
              <td className="px-4 py-4 text-xs text-slate-500">{formatDate(job.created_at)}</td>
              <td className="px-4 py-4 text-xs text-slate-500">{jobDuration(job)}</td>
              <td className="px-4 py-4 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Link aria-label={`View ${job.name}`} to={`/jobs/${encodeURIComponent(job.id)}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><MoreHorizontal size={17} /></Link>
                  {(job.status === 'pending' || job.status === 'processing') && (
                    <button aria-label={`Cancel ${job.name}`} onClick={() => onCancel(job)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Ban size={16} /></button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
