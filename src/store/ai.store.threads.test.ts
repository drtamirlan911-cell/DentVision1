import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  getActiveAiThread: vi.fn(),
  startNewAiThread: vi.fn(),
  deleteAiThread: vi.fn(),
  rememberAiSessionId: vi.fn(),
  clearAiSessionId: vi.fn(),
}));

vi.mock('@/utils/api', () => apiMocks);
vi.mock('@/utils/alertTone', () => ({ normalizeAlertTone: (tone: string) => tone }));

import { useAIStore } from './ai.store';

describe('AI conversation lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAIStore.setState({
      status: 'idle',
      currentIntent: null,
      currentAction: null,
      query: '',
      conversationContext: [{ role: 'user', content: 'old context' }],
      messages: [{ id: 'old-message', role: 'user', content: 'old text', timestamp: new Date(0) }],
      suggestions: [{ id: 'old-suggestion', label: 'old suggestion' }],
      sessionId: 'old-session-123',
      errorMessage: null,
    });
  });

  it('starts a new persisted thread and clears only the active UI transcript', async () => {
    apiMocks.startNewAiThread.mockResolvedValue({ sessionId: 'new-session-123' });

    await useAIStore.getState().startNewConversation(true, {
      userId: 'user-1', workspaceId: 'workspace-1', clinicId: 'clinic-1',
    });

    const state = useAIStore.getState();
    expect(state.sessionId).toBe('new-session-123');
    expect(state.messages).toEqual([]);
    expect(state.conversationContext).toEqual([]);
    expect(state.suggestions).toEqual([]);
    expect(state.status).toBe('idle');
    expect(apiMocks.rememberAiSessionId).toHaveBeenCalledWith('new-session-123', {
      userId: 'user-1', workspaceId: 'workspace-1', clinicId: 'clinic-1',
    });
  });

  it('ignores late active-thread hydration after a new conversation starts', async () => {
    let resolveLoad!: (value: unknown) => void;
    apiMocks.getActiveAiThread.mockReturnValue(new Promise((resolve) => { resolveLoad = resolve; }));
    const pendingLoad = useAIStore.getState().loadConversation();

    apiMocks.startNewAiThread.mockResolvedValue({ sessionId: 'new-session-123' });
    await useAIStore.getState().startNewConversation(true);

    resolveLoad({
      sessionId: 'old-session-123',
      messages: [{ id: 'old-persisted', role: 'user', content: 'old persisted transcript' }],
    });
    await pendingLoad;

    expect(useAIStore.getState().sessionId).toBe('new-session-123');
    expect(useAIStore.getState().messages).toEqual([]);
    expect(useAIStore.getState().conversationContext).toEqual([]);
  });

  it('keeps guest new-chat local and does not create an authenticated server thread', async () => {
    await useAIStore.getState().startNewConversation(false);

    expect(apiMocks.startNewAiThread).not.toHaveBeenCalled();
    expect(apiMocks.clearAiSessionId).toHaveBeenCalledWith('guest');
    expect(useAIStore.getState().messages).toEqual([]);
    expect(useAIStore.getState().sessionId).toBeNull();
  });

  it('deletes the active persisted thread and uses the replacement returned by the server', async () => {
    apiMocks.deleteAiThread.mockResolvedValue({ deleted: true, nextSessionId: 'replacement-123' });

    await useAIStore.getState().deleteConversation({
      userId: 'user-1', workspaceId: 'workspace-1', clinicId: 'clinic-1',
    });

    expect(apiMocks.deleteAiThread).toHaveBeenCalledWith('old-session-123');
    expect(apiMocks.rememberAiSessionId).toHaveBeenCalledWith('replacement-123', {
      userId: 'user-1', workspaceId: 'workspace-1', clinicId: 'clinic-1',
    });
    expect(useAIStore.getState().sessionId).toBe('replacement-123');
    expect(useAIStore.getState().messages).toEqual([]);
    expect(useAIStore.getState().status).toBe('idle');
  });

  it('preserves the visible transcript when server deletion fails', async () => {
    apiMocks.deleteAiThread.mockRejectedValue(new Error('Delete unavailable'));

    await useAIStore.getState().deleteConversation();

    expect(useAIStore.getState().sessionId).toBe('old-session-123');
    expect(useAIStore.getState().messages[0]?.content).toBe('old text');
    expect(useAIStore.getState().status).toBe('error');
    expect(useAIStore.getState().errorMessage).toBe('Delete unavailable');
  });

  it('does not start deletion or new chat while a request is already executing', async () => {
    useAIStore.setState({ status: 'thinking' });

    await useAIStore.getState().startNewConversation(true);
    await useAIStore.getState().deleteConversation();

    expect(apiMocks.startNewAiThread).not.toHaveBeenCalled();
    expect(apiMocks.deleteAiThread).not.toHaveBeenCalled();
    expect(useAIStore.getState().sessionId).toBe('old-session-123');
  });
});
