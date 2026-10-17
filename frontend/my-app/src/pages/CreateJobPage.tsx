import { useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, Braces, ChevronDown, Info, KeyRound, Send } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { createJob } from '../api/jobs'
import { useJobsContext } from '../hooks/useJobsContext'
import { jobTypes, type CreateJobInput, type JobType } from '../types/job'
import { formatJobType } from '../utils/job'

const payloadExamples: Record<JobType, Record<string, unknown>> = {
  send_order_confirmation_email: {
    customerEmail: 'customer@example.com',
    orderId: 'order_123',
  },
  password_reset_email: {
    email: 'customer@example.com',
  },
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function CreateJobPage() {
  const navigate = useNavigate()
  const { notify, refresh, saveJob } = useJobsContext()
  const [name, setName] = useState('')
  const [jobType, setJobType] = useState<JobType>(jobTypes[0])
  const [payloadText, setPayloadText] = useState('{\n  \n}')
  const [priority, setPriority] = useState('2')
  const [maxRetries, setMaxRetries] = useState('3')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const pendingSubmission = useRef<{ fingerprint: string; key: string } | null>(null)

  const useExample = () => setPayloadText(JSON.stringify(payloadExamples[jobType], null, 2))

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submittingRef.current) return
    const nextErrors: Record<string, string> = {}
    if (!name.trim()) nextErrors.name = 'Enter a job name.'
    else if (name.trim().length > 200) nextErrors.name = 'Name must be 200 characters or fewer.'
    const parsedPriority = Number(priority)
    if (!Number.isInteger(parsedPriority) || parsedPriority < 1 || parsedPriority > 5) nextErrors.priority = 'Choose a priority from 1 to 5.'
    const parsedRetries = Number(maxRetries)
    if (!Number.isSafeInteger(parsedRetries) || parsedRetries < 0) nextErrors.maxRetries = 'Enter a non-negative whole number.'

    let payload: Record<string, unknown> | undefined
    try {
      const parsed: unknown = JSON.parse(payloadText)
      if (!isObject(parsed)) nextErrors.payload = 'Payload must be a JSON object (not an array or null).'
      else payload = parsed
    } catch {
      nextErrors.payload = 'Enter valid JSON.'
    }

    setErrors(nextErrors)
    setApiError('')
    if (Object.keys(nextErrors).length || !payload) return

    const base: Omit<CreateJobInput, 'idempotencyKey'> = {
      name: name.trim(),
      jobType,
      payload,
      priority: parsedPriority,
      maxRetries: parsedRetries,
    }
    const fingerprint = JSON.stringify(base)
    const previous = pendingSubmission.current
    const key = previous?.fingerprint === fingerprint
      ? previous.key
      : previous
        ? crypto.randomUUID()
        : idempotencyKey.trim() || crypto.randomUUID()
    pendingSubmission.current = { fingerprint, key }
    setIdempotencyKey(key)

    submittingRef.current = true
    setSubmitting(true)
    try {
      const created = await createJob({ ...base, idempotencyKey: key })
      saveJob(created)
      pendingSubmission.current = null
      setIdempotencyKey('')
      notify('Job submitted successfully.', 'success')
      await refresh().catch(() => undefined)
      navigate('/jobs')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to create this job.'
      setApiError(message)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link to="/jobs" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"><ArrowLeft size={14} /> Back to jobs</Link>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Create a job</h2>
        <p className="mt-1 text-sm text-slate-500">Submit work to your distributed processing queue.</p>
      </div>

      {(apiError || Object.keys(errors).length > 0) && apiError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{apiError}</div>
      )}

      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <section className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-7">
          <div className="border-b border-slate-100 pb-4"><h3 className="text-sm font-semibold text-slate-900">Job details</h3><p className="mt-1 text-xs text-slate-500">Give your job a name and select a supported handler.</p></div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Job name <span className="text-rose-500">*</span></span>
              <input autoFocus required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Confirm order #123" className={`h-11 w-full rounded-xl border bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-4 ${errors.name ? 'border-rose-300 focus:ring-rose-50' : 'border-slate-200 focus:border-indigo-300 focus:ring-indigo-50'}`} />
              {errors.name && <span className="mt-1 block text-xs text-rose-600">{errors.name}</span>}
            </label>

            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Job type <span className="text-rose-500">*</span></span>
              <span className="relative block">
                <select value={jobType} onChange={(event) => setJobType(event.target.value as JobType)} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50">
                  {jobTypes.map((type) => <option key={type} value={type}>{formatJobType(type)}</option>)}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </span>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Priority</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value)} className={`h-11 w-full rounded-xl border bg-white px-3 text-sm text-slate-800 outline-none focus:ring-4 ${errors.priority ? 'border-rose-300 focus:ring-rose-50' : 'border-slate-200 focus:border-indigo-300 focus:ring-indigo-50'}`}>
                {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} {value === 1 ? '· Highest' : value === 5 ? '· Lowest' : ''}</option>)}
              </select>
              {errors.priority && <span className="mt-1 block text-xs text-rose-600">{errors.priority}</span>}
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Maximum retries</span>
              <input type="number" min={0} step={1} value={maxRetries} onChange={(event) => setMaxRetries(event.target.value)} className={`h-11 w-full rounded-xl border bg-white px-3 text-sm text-slate-800 outline-none focus:ring-4 ${errors.maxRetries ? 'border-rose-300 focus:ring-rose-50' : 'border-slate-200 focus:border-indigo-300 focus:ring-indigo-50'}`} />
              {errors.maxRetries && <span className="mt-1 block text-xs text-rose-600">{errors.maxRetries}</span>}
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-7">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
            <div><h3 className="text-sm font-semibold text-slate-900">Payload</h3><p className="mt-1 text-xs text-slate-500">Provide a JSON object for your worker handler.</p></div>
            <button type="button" onClick={useExample} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Braces size={14} /> Use example</button>
          </div>
          <label>
            <span className="sr-only">JSON payload</span>
            <textarea spellCheck={false} value={payloadText} onChange={(event) => setPayloadText(event.target.value)} rows={8} className={`w-full resize-y rounded-xl border bg-slate-950 px-4 py-3 font-mono text-xs leading-6 text-slate-100 outline-none focus:ring-4 ${errors.payload ? 'border-rose-400 focus:ring-rose-50' : 'border-slate-800 focus:border-indigo-400 focus:ring-indigo-50'}`} />
            {errors.payload && <span className="mt-1 block text-xs text-rose-600">{errors.payload}</span>}
          </label>
          <div className="flex gap-2 rounded-xl bg-indigo-50/70 px-3.5 py-3 text-xs leading-5 text-indigo-800"><Info size={15} className="mt-0.5 shrink-0" /><p>The backend accepts a JSON object. Examples use fields referenced by the current worker implementation; confirm any additional requirements with your handler.</p></div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-7">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Idempotency key <span className="font-normal text-slate-400">· optional</span></span>
            <span className="relative block">
              <input value={idempotencyKey} onChange={(event) => { setIdempotencyKey(event.target.value); pendingSubmission.current = null }} maxLength={200} placeholder="Generated automatically on submit" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 pr-10 font-mono text-xs text-slate-800 outline-none placeholder:font-sans placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" />
              <KeyRound size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </span>
            <span className="mt-1.5 block text-xs text-slate-500">A generated key is reused if the same submission is retried after a network error.</span>
          </label>
          <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800"><Info size={15} className="mt-0.5 shrink-0" /><p>The backend schema currently does not store maximum retries, and its create-job insert may reject requests. If it does, the API error will be shown here; no job will be reported as created.</p></div>
        </section>

        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Link to="/jobs" className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</Link>
          <button type="submit" disabled={submitting} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Submitting…</> : <><Send size={15} /> Submit job</>}
          </button>
        </div>
      </form>
    </div>
  )
}
