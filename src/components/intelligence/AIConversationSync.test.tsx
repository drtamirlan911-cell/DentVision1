import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  startNewAiThread: vi.fn(),
  getActiveAiThread: vi.fn(),
  deleteAiThread: vi.fn(),
  rememberAiSessionId: vi.fn(),
  clearAiSessionId: vi.fn(),
  aiProactive: vi.fn(),
  authUser: { id: 'user-1', clinicId: 'clinic-1' },
  workspaceState: {
    activeWorkspace: {
      id: 'workspace-1',
      scopeType: 'CLINIC',
      name: 'Clinic One',
      roleLabel: 'Doctor',
    },
  },
}))

vi.mock('@/utils/api', () => ({
  apiRequest: mocks.apiRequest,
  startNewAiThread: mocks.startNewAiThread,
  getActiveAiThread: mocks.getActiveAiThread,
  deleteAiThread: mocks.deleteAiThread,
  rememberAiSessionId: mocks.rememberAiSessionId,
  clearAiSessionId: mocks.clearAiSessionId,
  aiProactive: mocks.aiProactive,
}))

vi.mock('@/store/auth.store', () => ({
  useAuth: () => ({ isAuthenticated: true, user: mocks.authUser }),
}))

vi.mock('@/store/workspace.store', () => ({
  useWorkspaceStore: (selector: (state: typeof mocks.workspaceState) => unknown) =>
    selector(mocks.workspaceState),
}))

import { useAIStore } from '@/store/ai.store'
import { AIConversationSync } from './AIConversationSync'

describe('AIConversationSync conversation generation guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useAIStore.setState({
      messages: [{ id: 'old-ui', role: 'user', content: 'old ui transcript', timestamp: new Date(0) }],
      conversationContext: [{ role: 'user', content: 'old context' }],
      sessionId: 'previous-session',
      status: 'idle',
      errorMessage: null,
    })
    mocks.startNewAiThread.mockResolvedValue({ sessionId: 'new-session-123' })
    mocks.aiProactive.mockResolvedValue({ alerts: [] })
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('discards a late workspace history response after a new conversation starts', async () => {
    let resolveHistory!: (value: unknown) => void
    let markHistoryStarted!: () => void
    const historyStarted = new Promise<void>((resolve) => {
      markHistoryStarted = resolve
    })

    mocks.apiRequest.mockImplementation((path: string) => {
      if (path === '/api/ai/threads/new') {
        return Promise.resolve({ sessionId: 'workspace-old-session' })
      }
      if (path === '/api/ai/history') {
        markHistoryStarted()
        return new Promise((resolve) => {
          resolveHistory = resolve
        })
      }
      throw new Error(`Unexpected API request: ${path}`)
    })

    render(<AIConversationSync />)
    await historyStarted

    await act(async () => {
      await useAIStore.getState().startNewConversation(true, {
        userId: 'user-1',
        workspaceId: 'workspace-1',
        clinicId: 'clinic-1',
      })
    })

    expect(useAIStore.getState().sessionId).toBe('new-session-123')
    expect(useAIStore.getState().messages).toEqual([])

    await act(async () => {
      resolveHistory([
        {
          id: 'workspace-old-session',
          messages: [
            {
              id: 'old-persisted-message',
              role: 'assistant',
              content: 'old persisted transcript',
              timestamp: new Date(0).toISOString(),
            },
          ],
        },
      ])
    })

    await waitFor(() => {
      expect(useAIStore.getState().sessionId).toBe('new-session-123')
      expect(useAIStore.getState().messages).toEqual([])
      expect(useAIStore.getState().conversationContext).toEqual([])
    })
  })
})
