import { useEffect, useRef } from 'react'

/**
 * A minimal, correct SSE consumer — connect, parse each `data:` frame as
 * JSON, reconnect on drop.
 *
 * `onMessage` is read through a ref rather than taken as a hook dependency,
 * so passing an inline arrow function at the call site (the common case)
 * does not tear the connection down and reopen it on every render.
 */
export function useEventStream(url: string | null, onMessage: (data: unknown) => void) {
  const handlerRef = useRef(onMessage)
  handlerRef.current = onMessage

  useEffect(() => {
    if (!url) return

    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let stopped = false

    const connect = () => {
      if (stopped) return
      es = new EventSource(url)
      es.onmessage = (event) => {
        try {
          handlerRef.current(JSON.parse(event.data))
        } catch {
          // Keepalive comment lines never reach onmessage; a malformed
          // payload is simply not worth tearing the connection down for.
        }
      }
      es.onerror = () => {
        es?.close()
        if (!stopped) reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      stopped = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      es?.close()
    }
  }, [url])
}
