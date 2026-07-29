import { useAuthStore } from '@/store/auth.store'

type MessageHandler = (data: any) => void

class WebSocketClient {
  private ws: WebSocket | null = null
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectDelay = 5000
  private failed = false

  connect() {
    if (this.failed) return
    const token = useAuthStore.getState().token
    if (!token) return

    const base = import.meta.env.VITE_WS_URL
    if (!base) { this.failed = true; return }

    try {
      const url = `${base}/ws?token=${token}`
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        console.log('[WS] Connected')
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          const handlers = this.handlers.get(message.event)
          if (handlers) {
            handlers.forEach(handler => handler(message.data))
          }
        } catch (e) {
          console.warn('[WS] Parse error:', e)
        }
      }

      this.ws.onclose = (event) => {
        if (event.code === 1000 || event.code === 1001) return
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts)
          this.reconnectAttempts++
          setTimeout(() => this.connect(), delay)
        }
      }

      this.ws.onerror = () => {
        this.failed = true
        this.ws?.close()
      }
    } catch {
      this.failed = true
    }
  }

  reset() {
    this.failed = false
    this.reconnectAttempts = 0
  }

  disconnect() {
    this.ws?.close()
    this.ws = null
  }

  on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)
    return () => this.handlers.get(event)?.delete(handler)
  }

  send(event: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }))
    }
  }
}

export const socketClient = new WebSocketClient()
