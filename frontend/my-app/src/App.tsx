import { Activity, BriefcaseBusiness, Check, CirclePlus, LayoutDashboard, RefreshCw, Wifi, WifiOff, X } from 'lucide-react'
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { CreateJobPage } from './pages/CreateJobPage'
import { JobDetailPage } from './pages/JobDetailPage'
import { JobsPage } from './pages/JobsPage'
import { OverviewPage } from './pages/OverviewPage'
import { JobsProvider } from './hooks/JobsContext'
import { useJobsContext } from './hooks/useJobsContext'
import type { Notice } from './hooks/jobs-context'
import './App.css'

const navItems = [
  { label: 'Overview', to: '/', icon: LayoutDashboard, end: true },
  { label: 'All jobs', to: '/jobs', icon: BriefcaseBusiness, end: false },
  { label: 'Create job', to: '/jobs/new', icon: CirclePlus, end: false },
]

function ConnectionPill({ status }: { status: ReturnType<typeof useJobsContext>['connection'] }) {
  const connected = status === 'connected'
  const connecting = status === 'reconnecting'
  const Icon = connected ? Wifi : WifiOff
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold ${connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : connecting ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
      <Icon size={12} />
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : connecting ? 'animate-pulse bg-amber-500' : 'bg-slate-400'}`} />
      <span className="hidden sm:inline">{connected ? 'Connected' : connecting ? 'Reconnecting' : 'Disconnected'}</span>
    </span>
  )
}

function Toast({ notice, dismiss }: { notice: Notice; dismiss: () => void }) {
  const tone = notice.tone === 'success'
    ? 'border-emerald-200 bg-white text-emerald-800'
    : notice.tone === 'error'
      ? 'border-rose-200 bg-white text-rose-800'
      : 'border-slate-200 bg-white text-slate-700'
  return (
    <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex min-w-[260px] max-w-sm items-start gap-3 rounded-xl border p-3.5 shadow-lg ${tone}`}>
      <span className="mt-0.5"><Check size={15} /></span>
      <p className="flex-1 text-xs font-medium leading-5">{notice.message}</p>
      <button aria-label="Dismiss notification" onClick={dismiss} className="rounded-md p-0.5 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

function DashboardLayout() {
  const location = useLocation()
  const { connection, loading, error, refresh, notices, dismissNotice } = useJobsContext()
  const page = location.pathname === '/'
    ? { title: 'Overview', subtitle: 'Monitor your distributed job queue at a glance.' }
    : location.pathname === '/jobs'
      ? { title: 'All jobs', subtitle: 'Browse, search, and manage your submitted jobs.' }
      : location.pathname === '/jobs/new'
        ? { title: 'Create job', subtitle: 'Add a new task to your processing queue.' }
        : { title: 'Job details', subtitle: 'Inspect the status and execution information for a job.' }

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-slate-200/80 bg-white px-4 py-6 lg:flex">
        <Link to="/" className="mb-10 flex items-center gap-3 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200"><Activity size={20} strokeWidth={2.2} /></span>
          <span><span className="block text-sm font-bold tracking-tight text-slate-900">QueuePilot</span><span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.13em] text-slate-400">Job operations</span></span>
        </Link>
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Workspace</p>
        <nav aria-label="Main navigation" className="space-y-1">
          {navItems.map(({ label, to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              {({ isActive }) => <><Icon size={17} className={isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} />{label}{isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500" />}</>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2"><span className="text-xs font-semibold text-slate-700">Live connection</span></div>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">Status events are synchronized from the job service.</p>
          <div className="mt-3 border-t border-slate-200 pt-3"><ConnectionPill status={connection} /></div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3.5 sm:px-7 lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <Link to="/" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white lg:hidden"><Activity size={18} /></Link>
              <div className="min-w-0"><h1 className="truncate text-base font-bold tracking-tight text-slate-900">{page.title}</h1><p className="hidden truncate text-xs text-slate-500 sm:block">{page.subtitle}</p></div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <ConnectionPill status={connection} />
              <button onClick={() => void refresh().catch(() => undefined)} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50" aria-label="Refresh jobs">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /><span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-6 sm:px-7 sm:pt-8 lg:px-10 lg:pb-10">
          {error && <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><WifiOff size={16} className="mt-0.5 shrink-0" /><div><p className="font-semibold">Unable to sync with the API</p><p className="mt-0.5 text-xs leading-5">{error}</p></div><button onClick={() => void refresh().catch(() => undefined)} className="ml-auto shrink-0 text-xs font-semibold underline">Retry</button></div>}
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/new" element={<CreateJobPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage key={location.pathname} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur lg:hidden">
          {navItems.map(({ label, to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-semibold ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
              <Icon size={18} />{label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2 sm:right-6 sm:top-6">
        {notices.map((notice) => <Toast key={notice.id} notice={notice} dismiss={() => dismissNotice(notice.id)} />)}
      </div>
    </div>
  )
}

export default function App() {
  return <BrowserRouter><JobsProvider><DashboardLayout /></JobsProvider></BrowserRouter>
}
