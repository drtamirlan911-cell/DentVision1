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
let _initFailed = false;

interface GuestState {
  guestId: string | null;
  guestToken: string | null;
  isGuest: boolean;
  aiRequestsLeft: number;
  showRegistrationModal: boolean;
  pendingAction: (() => void) | null;

  initGuest: () => Promise<void>;
  setRegistrationModal: (show: boolean, pendingAction?: (() => void) | null) => void;
  convertGuest: (login: string, password: string, name?: string) => Promise<boolean>;
  isGuestRoute: (pathname: string) => boolean;
  requiresAuth: (pathname: string) => boolean;
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
  '/ai',
  '/profile',
  '/my-clinics',
  '/supplier',
];

export const useGuestStore = create<GuestState>((set, get) => ({
  guestId: null,
  guestToken: null,
  isGuest: false,
  aiRequestsLeft: 20,
  showRegistrationModal: false,
  pendingAction: null,

  initGuest: async () => {
    if (_initInProgress || _initFailed) return;

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
          });
          return;
        }
      }
    } catch { /* corrupted storage, continue to create */ }

    _initInProgress = true;
    try {
      const res = await fetch(`${API_URL}/api/guest/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Guest session ${res.status}`);
      const data = await res.json();

      const state = {
        guestId: data.guestId,
        guestToken: data.token,
        isGuest: true,
        aiRequestsLeft: data.aiRequestsLeft ?? 20,
      };
      set(state);
      try {
        localStorage.setItem(
          GUEST_STORAGE_KEY,
          JSON.stringify({ guestId: data.guestId, guestToken: data.token, aiRequestsLeft: data.aiRequestsLeft })
        );
      } catch { /* storage full, ignore */ }
    } catch (err) {
      console.warn('Guest init failed (server may be deploying):', (err as Error).message);
      _initFailed = true;
    } finally {
      _initInProgress = false;
    }
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
    try { localStorage.removeItem(GUEST_STORAGE_KEY); } catch {}
    set({ guestId: null, guestToken: null, isGuest: false, showRegistrationModal: false, pendingAction: null });
  },
}));
