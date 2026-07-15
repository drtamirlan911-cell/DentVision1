import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
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

// ─── Register form shape (matches original formData destructuring) ───

interface RegisterFormData {
  clinicName?: string;
  city?: string;
  phone?: string;
  email?: string;
  directorName?: string;
  login: string;
  password: string;
  [key: string]: unknown;
}

// ─── Staff data shape (for addStaffMember) ───

interface StaffData {
  clinicId?: string;
  login?: string;
  password?: string;
  [key: string]: unknown;
}

// ─── Auth context value ───

interface AuthContextType {
  user: User | null;
  clinic: Clinic | null;
  loading: boolean;
  error: string | null;
  login: (loginStr: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (formData: RegisterFormData) => Promise<boolean>;
  forgotPassword: (loginStr: string) => Promise<unknown>;
  addStaffMember: (staffData: StaffData) => Promise<Record<string, unknown> | false>;
  getClinicStaff: (clinicId: string) => User[];
  isAuthenticated: boolean;
  role: UserRole | null;
  roleInfo: RoleConfig | null;
  can: (action: string) => boolean;
  allClinics: Clinic[];
  allUsers: User[];
}

// Persistent session store (survives HMR, resets on full reload)
const _store: { clinics: Clinic[]; users: User[] } = {
  clinics: [...INIT_CLINICS],
  users: [...INIT_USERS],
};

export const ROLES: Record<UserRole, RoleConfig> = {
  superadmin: {
    label: 'Super Admin',
    icon: '⚙️',
    pages: ['dashboard','schedule','patients','medical-card','visits','icd10','documents','cashier','pricelist','lab','ai','reminders','promotions','inventory','admin','audit','backup','shop','school','analytics','settings'],
    canSeeSalary: true, canSeeSuperAdmin: true, canAddStaff: true, canSeeAudit: true, canBackup: true,
  },
  director: {
    label: 'Руководитель',
    icon: '👔',
    pages: ['dashboard','schedule','patients','medical-card','visits','icd10','documents','cashier','pricelist','lab','ai','reminders','promotions','inventory','staff','audit','backup','shop','school','analytics','settings'],
    canSeeSalary: true, canSeeReports: true, canAddStaff: true, canSeeExpenses: true, canSeeAudit: true, canBackup: true,
  },
  admin: {
    label: 'Администратор',
    icon: '💼',
    pages: ['schedule','patients','medical-card','visits','icd10','documents','cashier','pricelist','lab','reminders','promotions','inventory','staff','documents','shop','school','analytics','settings'],
    canSeeSalary: false, canSeeExpenses: false, canAddStaff: true,
  },
  doctor: {
    label: 'Врач',
    icon: '👨‍⚕️',
    pages: ['schedule','patients','medical-card','visits','icd10','documents','lab','ai','reminders','school'],
    canSeeSalary: false, ownDataOnly: true,
  },
  assistant: {
    label: 'Ассистент',
    icon: '🤝',
    pages: ['schedule','patients','visits','documents','reminders','shop','school'],
    canSeeSalary: false, ownDataOnly: true, readOnly: true,
  },
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Restore session on mount ───
  useEffect(() => {
    (async () => {
      const tokens = api.loadTokens();
      if (tokens?.accessToken) {
        try {
          const userData = await api.getMe();
          setUser(userData);
          if (userData.clinicId) {
            try {
              const clinicData = await api.getClinic(userData.clinicId);
              setClinic(clinicData);
            } catch {}
          }
        } catch {
          // Token invalid — cleared by api.js
          api.clearTokens();
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (loginStr: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.login(loginStr, password) as unknown as { accessToken?: string; refreshToken?: string; user: User; clinic?: Clinic };
      if (result && result.accessToken) {
        api.setTokens(result.accessToken, result.refreshToken ?? null);
        setUser(result.user);
        if (result.user.clinicId) {
          try {
            const clinicData = await api.getClinic(result.user.clinicId);
            setClinic(clinicData);
          } catch {}
        }
        return true;
      }
      setError('Неверный логин или пароль');
      return false;
    } catch (err) {
      setError('Ошибка входа: ' + ((err as Error).message || 'неизвестная ошибка'));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    api.clearTokens();
    setUser(null);
    setClinic(null);
    setError(null);
  }, []);

  const forgotPassword = useCallback(async (loginStr: string): Promise<unknown> => {
    try {
      return await api.forgotPassword(loginStr);
    } catch {
      return { error: 'Ошибка соединения' };
    }
  }, []);

  const register = useCallback(async (formData: RegisterFormData): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { clinicName, city, phone, email, directorName, login: loginStr, password } = formData;
      if (!clinicName || !loginStr || !password || !directorName) {
        setError('Заполните все обязательные поля');
        return false;
      }
      if (password.length < 6) {
        setError('Пароль должен быть не менее 6 символов');
        return false;
      }
      const result = await api.register(formData);
      if (result && result.accessToken) {
        api.setTokens(result.accessToken, result.refreshToken);
        setUser(result.user);
        if (result.clinic) setClinic(result.clinic);
        _store.clinics.push(result.clinic);
        _store.users.push(result.user);
        return true;
      }
      setError('Ошибка при регистрации — сервер не вернул данные');
      return false;
    } catch (err) {
      setError('Ошибка регистрации: ' + ((err as Error).message || 'неизвестная ошибка'));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const addStaffMember = useCallback(async (staffData: StaffData): Promise<Record<string, unknown> | false> => {
    if (!staffData.clinicId || !staffData.login || !staffData.password) return false;
    if (_store.users.some(u => u.clinicId === staffData.clinicId && u.login === staffData.login)) return false;
    try {
      const result = await api.upsertUser(staffData);
      if (result) {
        const newUser = { ...staffData, id: result.id || gid() };
        _store.users.push(newUser as User);
        return newUser;
      }
    } catch (err) {
      console.error('API addStaff failed:', err);
    }
    const newUser = { ...staffData, id: gid() };
    _store.users.push(newUser as User);
    return newUser;
  }, []);

  const getClinicStaff = useCallback((clinicId: string): User[] =>
    _store.users.filter(u => u.clinicId === clinicId), []);

  const roleInfo: RoleConfig | null = user ? (ROLES[user.role] || ROLES.doctor) : null;

  return (
    <AuthContext.Provider value={{
      user, clinic, loading, error,
      login, logout, register, forgotPassword,
      addStaffMember, getClinicStaff,
      isAuthenticated: !!user,
      role: user?.role || null,
      roleInfo,
      can: (action: string): boolean => roleInfo ? !!roleInfo[action] : false,
      allClinics: _store.clinics,
      allUsers: _store.users,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
