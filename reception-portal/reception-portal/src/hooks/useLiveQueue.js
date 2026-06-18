import { useState, useEffect, useRef, useCallback } from 'react'
import receptionApi from '../services/receptionApi'

const WS_BASE = import.meta.env.VITE_API_BASE_URL?.replace('https://', 'wss://').replace('http://', 'ws://') || 'wss://api.hospyn.in'

export function useLiveQueue(hospitalId) {
  const [queue, setQueue]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const wsRef               = useRef(null)
  const retryRef            = useRef(0)

  // Initial fetch
  const fetchQueue = useCallback(async () => {
    if (!hospitalId) return
    try {
      const data = await receptionApi.getQueue(hospitalId)
      setQueue(Array.isArray(data) ? data : data.queue || [])
      setError(null)
    } catch (err) {
      setError('Failed to load queue')
    } finally {
      setLoading(false)
    }
  }, [hospitalId])

  // WebSocket connection
  const connect = useCallback(() => {
    if (!hospitalId) return
    const token = localStorage.getItem('reception_token')
    const ws = new WebSocket(`${WS_BASE}/ws/reception/${hospitalId}?token=${token}`)

    ws.onopen    = () => { retryRef.current = 0 }
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'QUEUE_UPDATE') setQueue(msg.data)
        if (msg.type === 'NEW_TOKEN')    setQueue(prev => [...prev, msg.data])
        if (msg.type === 'TOKEN_CALLED') setQueue(prev => prev.map(t => t.id === msg.data.id ? msg.data : t))
        if (msg.type === 'TOKEN_DONE')   setQueue(prev => prev.filter(t => t.id !== msg.data.id))
      } catch {}
    }
    ws.onerror = () => {}
    ws.onclose = () => {
      if (retryRef.current < 5) {
        retryRef.current++
        setTimeout(connect, 2000 * retryRef.current)
      }
    }
    wsRef.current = ws
  }, [hospitalId])

  useEffect(() => {
    fetchQueue()
    connect()
    return () => { wsRef.current?.close() }
  }, [fetchQueue, connect])

  return { queue, loading, error, refetch: fetchQueue, setQueue }
}
