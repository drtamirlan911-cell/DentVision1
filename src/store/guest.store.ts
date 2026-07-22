// ═══════════════════════════════════════════════════════════════
// Guest Store — anonymous sessions, demo mode, registration gate
// ═══════════════════════════════════════════════════════════════
import { create } from 'zustand';

const API_URL: string =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname.includes('vercel.app')
    ? 'https://dentvision-api.onrender.com'
    : 'http://localhost:3001');

const GUEST_STORAGE_KEY = 'dv_guest';
let _initInProgress = false;
let _initFailedAt = 0;
const INIT_RETRY_COOLDOWN_MS = 8_000;

interface GuestState {
  guestId: string | null;
  guestToken: string | null;
  isGuest: boolean;
  aiRequestsLeft: number;
  showRegistrationModal: boolean;
  pendingAction: (() => void) | null;
  initError: string | null;

  initGuest: () => Promise<void>;
  retryGuest: () => Promise<void>;
  setRegistrationModal: (show: boolean, pendingAction?: (() => void) | null) => void;
  convertGuest: (login: string, password: string, name?: string) => Promise<boolean>;
  isGuestRoute: (pathname: string) => boolean;
  requiresAuth: (pathname: string) => boolean;
  clearGuest: () => void;
}

const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/book/',
  '/sign/',
  '/shop',
  '/school',
  '/jobs',
  '/community',
  '/demo',
  '/pricing',
];

const AUTH_REQUIRED_ROUTES = [
  '/crm',
  '/analytics',
  '/settings',
  '/admin',
  '/audit',
  '/backup',
  '/profile',
  '/my-clinics',
  '/supplier',
];

async function createGuestSession(): Promise<{
  guestId: string;
  guestToken: string;
  aiRequestsLeft: number;
}> {
  const res = await fetch(`${API_URL}/api/guest/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Guest session ${res.status}`);
  const data = await res.json();
  const guestId = data.guestId || data.data?.guestId;
  const guestToken = data.token || data.data?.token;
  if (!guestId || !guestToken) throw new Error('Guest session incomplete');
  return {
    guestId,
    guestToken,
    aiRequestsLeft: data.aiRequestsLeft ?? data.data?.aiRequestsLeft ?? 20,
  };
}

export const useGuestStore = create<GuestState>((set, get) => ({
  guestId: null,
  guestToken: null,
  isGuest: false,
  aiRequestsLeft: 20,
  showRegistrationModal: false,
  pendingAction: null,
  initError: null,

  initGuest: async () => {
    if (_initInProgress) return;
    if (get().guestToken) return;
    if (_initFailedAt && Date.now() - _initFailedAt < INIT_RETRY_COOLDOWN_MS) return;

    // Restore from localStorage
    try {
      const stored = localStorage.getItem(GUEST_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.guestId && parsed.guestToken) {
          set({
            guestId: parsed.guestId,
            guestToken: parsed.guestToken,
            isGuest: true,
            aiRequestsLeft: parsed.aiRequestsLeft ?? 20,
            initError: null,
          });
          return;
        }
      }
    } catch { /* corrupted storage, continue to create */ }

    _initInProgress = true;
    try {
      const session = await createGuestSession();
      set({
        guestId: session.guestId,
        guestToken: session.guestToken,
        isGuest: true,
        aiRequestsLeft: session.aiRequestsLeft,
        initError: null,
      });
      _initFailedAt = 0;
      try {
        localStorage.setItem(
          GUEST_STORAGE_KEY,
          JSON.stringify({
            guestId: session.guestId,
            guestToken: session.guestToken,
            aiRequestsLeft: session.aiRequestsLeft,
          }),
        );
      } catch { /* storage full, ignore */ }
    } catch (err) {
      console.warn('Guest init failed (server may be deploying):', (err as Error).message);
      _initFailedAt = Date.now();
      set({ initError: (err as Error).message || 'guest_init_failed' });
    } finally {
      _initInProgress = false;
    }
  },

  retryGuest: async () => {
    _initFailedAt = 0;
    set({ initError: null });
    await get().initGuest();
  },

  setRegistrationModal: (show, pendingAction = null) => {
    set({ showRegistrationModal: show, pendingAction });
  },

  convertGuest: async (login, password, name) => {
    const { guestId } = get();
    if (!guestId) return false;
    try {
      const res = await fetch(`${API_URL}/api/guest/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, login, password, name }),
      });
      if (!res.ok) throw new Error('Conversion failed');
      localStorage.removeItem(GUEST_STORAGE_KEY);
      set({ guestId: null, guestToken: null, isGuest: false, showRegistrationModal: false });
      return true;
    } catch (err) {
      console.error('Guest convert failed:', err);
      return false;
    }
  },

  isGuestRoute: (pathname) => {
    return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));
  },

  requiresAuth: (pathname) => {
    return AUTH_REQUIRED_ROUTES.some((r) => pathname.startsWith(r));
  },

  clearGuest: () => {
    try { localStorage.removeItem(GUEST_STORAGE_KEY); } catch { /* storage may be unavailable */ }
    set({ guestId: null, guestToken: null, isGuest: false, showRegistrationModal: false, pendingAction: null, initError: null });
  },
}));
