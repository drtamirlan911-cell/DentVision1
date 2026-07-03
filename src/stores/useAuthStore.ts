import { create } from 'zustand';

interface User {
  id: string;
  login: string;
  role: string;
  name?: string;
}

interface Clinic {
  id: string;
  name: string;
  plan?: string;
}

interface RoleInfo {
  pages: string[];
}

interface AuthState {
  user: User | null;
  clinic: Clinic | null;
  roleInfo: RoleInfo | null;
  setUser: (user: User | null) => void;
  setClinic: (clinic: Clinic | null) => void;
  setRoleInfo: (roleInfo: RoleInfo | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  clinic: null,
  roleInfo: null,
  setUser: (user) => set({ user }),
  setClinic: (clinic) => set({ clinic }),
  setRoleInfo: (roleInfo) => set({ roleInfo }),
  clearAuth: () => set({ user: null, clinic: null, roleInfo: null }),
}));
