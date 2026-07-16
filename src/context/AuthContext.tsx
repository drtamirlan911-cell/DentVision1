import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { INIT_CLINICS, INIT_USERS, gid } from '../utils/constants';
import * as api from '../utils/api';
import type { User, Clinic, UserRole } from '../types';

// ─── Local role config type (superset of RoleInfo from types.ts) ───

interface RoleConfig {
  label: string;
  icon: string;
  pages: string[];
  canSeeSalary?: boolean;
  canSeeSuperAdmin?: boolean;
  canAddStaff?: boolean;
  canSeeAudit?: boolean;
  canBackup?: boolean;
  canSeeReports?: boolean;
  canSeeExpenses?: boolean;
  ownDataOnly?: boolean;
  readOnly?: boolean;
  [key: string]: string | boolean | string[] | undefined;
}

interface RegisterFormData {
  name?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  login: string;
  password: string;
  [key: string]: unknown;
}

interface StaffData {
  clinicId?: string;
  login?: string;
  password?: string;
  [key: string]: unknown;
}

interface Membership {
  id: string;
  clinicId: string;
  role: string;
  spec?: string | null;
  department?: string | null;
  status: string;
  joinedAt: string;
  clinic?: Clinic;
}

interface AuthContextType {
  user: User | null;
  clinic: Clinic | null;
  clinics: Membership[];
  activeMembership: Membership | null;
  activeClinic: Clinic | null;
  mode: 'personal' | 'workspace';
  loading: boolean;
  error: string | null;
  login: (loginStr: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (formData: RegisterFormData) => Promise<boolean>;
  forgotPassword: (loginStr: string) => Promise<unknown>;
  addStaffMember: (staffData: StaffData) => Promise<Record<string, unknown> | false>;
  getClinicStaff: (clinicId: string) => User[];
  switchClinic: (clinicId: string | null) => Promise<void>;
  isAuthenticated: boolean;
  role: UserRole | null;
  roleInfo: RoleConfig | null;
  can: (action: string) => boolean;
  allClinics: Clinic[];
  allUsers: User[];
}

const _store: { clinics: Clinic[]; users: User[] } = {
  clinics: [...INIT_CLINICS],
  users: [...INIT_USERS],
};

// Organization roles → nav pages (within a workspace/CRM)
export const ORG_ROLES: Record<string, RoleConfig> = {
  owner: {
    label: 'Владелец', icon: '👑',
    pages: ['dashboard','schedule','patients','medical-card','visits','icd10','documents','cashier','pricelist','lab','ai','reminders','promotions','inventory','staff','audit','backup','shop','school','analytics','settings'],
    canSeeSalary: true, canSeeSuperAdmin: true, canAddStaff: true, canSeeAudit: true, canBackup: true,
  },
  director: {
    label: 'Руководитель', icon: '👔',
    pages: ['dashboard','schedule','patients','medical-card','visits','icd10','documents','cashier','pricelist','lab','ai','reminders','promotions','inventory','staff','audit','backup','shop','school','analytics','settings'],
    canSeeSalary: true, canSeeReports: true, canAddStaff: true, canSeeExpenses: true, canSeeAudit: true, canBackup: true,
  },
  admin: {
    label: 'Администратор', icon: '💼',
    pages: ['schedule','patients','medical-card','visits','icd10','documents','cashier','pricelist','lab','reminders','promotions','inventory','staff','documents','shop','school','analytics','settings'],
    canSeeSalary: false, canSeeExpenses: false, canAddStaff: true,
  },
  doctor: {
    label: 'Врач', icon: '👨‍⚕️',
    pages: ['schedule','patients','medical-card','visits','icd10','documents','lab','ai','reminders','school'],
    canSeeSalary: false, ownDataOnly: true,
  },
  assistant: {
    label: 'Ассистент', icon: '🤝',
    pages: ['schedule','patients','visits','documents','reminders','shop','school'],
    canSeeSalary: false, ownDataOnly: true, readOnly: true,
  },
  reception: {
    label: 'Регистратор', icon: '📋',
    pages: ['schedule','patients','documents','reminders','shop'],
    canAddStaff: false, readOnly: true,
  },
  cashier: {
    label: 'Кассир', icon: '💰',
    pages: ['cashier','pricelist','receipts','shop'],
    readOnly: true,
  },
  accountant: {
    label: 'Бухгалтер', icon: '📊',
    pages: ['analytics','cashier','pricelist','dashboard'],
    canSeeSalary: true, canSeeExpenses: true,
  },
  laboratory: {
    label: 'Лаборатория', icon: '🔬',
    pages: ['lab','shop'],
  },
  manager: {
    label: 'Менеджер', icon: '🧭',
    pages: ['dashboard','schedule','patients','analytics','staff','promotions','shop'],
    canSeeReports: true, canAddStaff: true,
  },
  intern: {
    label: 'Стажёр', icon: '🌱',
    pages: ['schedule','patients','visits','documents','school'],
    ownDataOnly: true, readOnly: true,
  },
};

// Platform roles (global, independent of any clinic)
export const PLATFORM_ROLES: Record<string, RoleConfig> = {
  superadmin: {
    label: 'Super Admin', icon: '⚙️',
    pages: ['dashboard','schedule','patients','medical-card','visits','icd10','documents','cashier','pricelist','lab','ai','reminders','promotions','inventory','admin','audit','backup','shop','school','analytics','settings'],
    canSeeSalary: true, canSeeSuperAdmin: true, canAddStaff: true, canSeeAudit: true, canBackup: true,
  },
  support: {
    label: 'Поддержка', icon: '🛟',
    pages: ['admin','analytics','settings'],
  },
  user: {
    label: 'Пользователь', icon: '👤',
    pages: ['shop','school','ai'],
  },
  verified: {
    label: 'Проверенный', icon: '✅',
    pages: ['shop','school','ai'],
  },
};

const AuthContext = createContext<AuthContextType | null>(null);

function buildClinicFromMembership(m: Membership | null): Clinic | null {
  if (!m) return null;
  return (m.clinic as Clinic) || null;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [clinics, setClinics] = useState<Membership[]>([]);
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const activeClinic = activeMembership ? buildClinicFromMembership(activeMembership) : null;

  // ─── Restore session ───
  useEffect(() => {
    (async () => {
      const tokens = api.loadTokens();
      if (tokens?.accessToken) {
        try {
          const { user: u, memberships, activeMembership: am } = await api.getMe();
          setUser(u);
          setClinics(memberships || []);
          setActiveMembership(am || null);
          if (am?.clinic) setClinic(am.clinic);
        } catch {
          api.clearTokens();
        }
      }
      setLoading(false);
    })();
  }, []);

  const applyLoginResult = useCallback(async (result: any) => {
    if (!result || !result.accessToken) return false;
    api.setTokens(result.accessToken, result.refreshToken ?? null);
    let u = result.user;
    let memberships = result.memberships;
    let am = result.activeMembership;
    if (!u) {
      const me = await api.getMe();
      u = me.user; memberships = me.memberships; am = me.activeMembership;
    }
    setUser(u);
    setClinics(memberships || []);
    setActiveMembership(am || null);
    if (am?.clinic) setClinic(am.clinic);
    return true;
  }, []);

  const login = useCallback(async (loginStr: string, password: string): Promise<boolean> => {
    setLoading(true); setError(null);
    try {
      const result = await api.login(loginStr, password);
      const ok = await applyLoginResult(result);
      if (!ok) { setError('Неверный логин или пароль'); return false; }
      return true;
    } catch (err) {
      setError('Ошибка входа: ' + ((err as Error).message || 'неизвестная ошибка'));
      return false;
    } finally { setLoading(false); }
  }, [applyLoginResult]);

  const logout = useCallback(() => {
    api.clearTokens();
    setUser(null); setClinics([]); setActiveMembership(null); setClinic(null); setError(null);
  }, []);

  const forgotPassword = useCallback(async (loginStr: string): Promise<unknown> => {
    try { return await api.forgotPassword(loginStr); } catch { return { error: 'Ошибка соединения' }; }
  }, []);

  const register = useCallback(async (formData: RegisterFormData): Promise<boolean> => {
    setLoading(true); setError(null);
    try {
      const result = await api.register(formData);
      const ok = await applyLoginResult(result);
      if (!ok) { setError('Ошибка при регистрации — сервер не вернул данные'); return false; }
      return true;
    } catch (err) {
      setError('Ошибка регистрации: ' + ((err as Error).message || 'неизвестная ошибка'));
      return false;
    } finally { setLoading(false); }
  }, [applyLoginResult]);

  const switchClinic = useCallback(async (clinicId: string | null): Promise<void> => {
    const result = await api.switchClinic(clinicId);
    if (result?.accessToken) api.setTokens(result.accessToken, result.refreshToken ?? null);
    setActiveMembership(result.activeMembership || null);
    if (result.activeMembership?.clinic) setClinic(result.activeMembership.clinic);
    else {
      const m = clinics.find(c => c.clinicId === clinicId);
      setClinic(m?.clinic || null);
    }
  }, [clinics]);

  const addStaffMember = useCallback(async (staffData: StaffData): Promise<Record<string, unknown> | false> => {
    if (!staffData.clinicId || !staffData.login || !staffData.password) return false;
    try {
      const result = await api.upsertUser(staffData);
      if (result) {
        const newUser = { ...staffData, id: result.id || gid() } as User;
        _store.users.push(newUser);
        return newUser;
      }
    } catch (err) { console.error('API addStaff failed:', err); }
    const newUser = { ...staffData, id: gid() } as User;
    _store.users.push(newUser);
    return newUser;
  }, []);

  const getClinicStaff = useCallback((clinicId: string): User[] =>
    _store.users.filter(u => u.clinicId === clinicId), []);

  // Role resolution: prefer active membership org-role, else platform role
  const resolvedRole: string = activeMembership?.role || user?.platformRole || user?.role || 'user';
  const roleInfo: RoleConfig | null = activeMembership
    ? (ORG_ROLES[resolvedRole] || ORG_ROLES.doctor)
    : (PLATFORM_ROLES[user?.platformRole || user?.role || 'user'] || PLATFORM_ROLES.user);

  const mode: 'personal' | 'workspace' = activeMembership ? 'workspace' : 'personal';

  const value: AuthContextType = {
    user, clinic, clinics, activeMembership, activeClinic, mode, loading, error,
    login, logout, register, forgotPassword,
    addStaffMember, getClinicStaff, switchClinic,
    isAuthenticated: !!user,
    role: resolvedRole as UserRole,
    roleInfo,
    can: (action: string): boolean => roleInfo ? !!roleInfo[action] : false,
    allClinics: _store.clinics,
    allUsers: _store.users,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
