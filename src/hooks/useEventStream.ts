import { useEffect, useRef } from 'react'

/**
 * A minimal, correct SSE consumer — connect, parse each `data:` frame as
 * JSON, reconnect on drop.
 *
 * `getUrl` is a factory, not a plain string: SSE streams here authenticate
 * with a short-lived, one-time ticket (see `utils/api.ts::conversationStreamUrl`/
 * `inboxStreamUrl`), and `EventSource`'s native auto-reconnect always retries
 * against the exact same URL it was constructed with — which would replay an
 * already-consumed ticket and fail permanently. Calling `getUrl()` again on
 * every reconnect attempt mints a fresh ticket each time instead.
 *
 * `onMessage` is read through a ref rather than taken as a hook dependency,
 * so passing an inline arrow function at the call site (the common case)
 * does not tear the connection down and reopen it on every render. `getUrl`
 * *is* a real dependency — unlike a plain string it can't be compared by
 * value, so callers must memoize it (`useCallback`) when it depends on
 * something like a selected clinic id; otherwise the stream reconnects on
 * every render.
 */
export function useEventStream(getUrl: (() => Promise<string>) | null, onMessage: (data: unknown) => void) {
  const handlerRef = useRef(onMessage)
  handlerRef.current = onMessage

  useEffect(() => {
    if (!getUrl) return

    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let stopped = false

    const connect = async () => {
      if (stopped) return
      let url: string
      try {
        url = await getUrl()
      } catch {
        if (!stopped) reconnectTimer = setTimeout(connect, 3000)
        return
      }
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
  }, [getUrl])
}
