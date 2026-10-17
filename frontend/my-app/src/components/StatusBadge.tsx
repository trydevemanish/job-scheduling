import type { JobStatus } from '../types/job'
import { statusLabels } from '../utils/job'

const statusClasses: Record<JobStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  processing: 'bg-sky-50 text-sky-700 ring-sky-200',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  failed: 'bg-rose-50 text-rose-700 ring-rose-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClasses[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'processing' ? 'animate-pulse bg-sky-500' : 'bg-current'}`} />
      {statusLabels[status]}
    </span>
  )
}
