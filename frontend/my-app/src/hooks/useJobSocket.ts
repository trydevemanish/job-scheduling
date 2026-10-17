import { useEffect, useRef, useState } from 'react'
import { jobStatuses, type JobStatus, type JobStatusEvent } from '../types/job'

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws'
const MAX_RECONNECT_DELAY = 30_000

function isStatusEvent(value: unknown): value is { type: 'job.status_changed'; data: JobStatusEvent } {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Record<string, unknown>
  if (message.type !== 'job.status_changed' || typeof message.data !== 'object' || message.data === null) return false
  const data = message.data as Record<string, unknown>
  return typeof data.jobId === 'string'
    && typeof data.status === 'string'
    && jobStatuses.includes(data.status as JobStatus)
    && typeof data.retryCount === 'number'
    && typeof data.updatedAt === 'string'
}

export function useJobSocket(onEvent: (event: JobStatusEvent) => void, onReconnect: () => void) {
  const [status, setStatus] = useState<ConnectionStatus>('reconnecting')
  const callbacks = useRef({ onEvent, onReconnect })

  useEffect(() => {
    callbacks.current = { onEvent, onReconnect }
  }, [onEvent, onReconnect])

  useEffect(() => {
    let socket: WebSocket | null = null
    let retryTimer: number | undefined
    let reconnectDelay = 1000
    let active = true
    let hasConnected = false

    const connect = () => {
      if (!active) return
      setStatus(hasConnected ? 'reconnecting' : 'disconnected')
      socket = new WebSocket(WS_URL)

      socket.onmessage = (message) => {
        let parsed: unknown
        try {
          parsed = JSON.parse(String(message.data)) as unknown
        } catch {
          return
        }
        if (typeof parsed === 'object' && parsed !== null && 'type' in parsed && parsed.type === 'connected') {
          const wasConnected = hasConnected
          hasConnected = true
          reconnectDelay = 1000
          setStatus('connected')
          if (wasConnected) callbacks.current.onReconnect()
        } else if (isStatusEvent(parsed)) {
          callbacks.current.onEvent(parsed.data)
        }
      }

      socket.onerror = () => socket?.close()
      socket.onclose = () => {
        if (!active) return
        setStatus('reconnecting')
        retryTimer = window.setTimeout(connect, reconnectDelay)
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY)
      }
    }

    connect()
    return () => {
      active = false
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
      socket?.close()
    }
  }, [])

  return status
}
