import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { INIT_CLINICS, INIT_USERS, gid, today } from '../utils/constants';
import * as api from '../utils/api';

// Persistent session store (survives HMR, resets on full reload)
const _store = {
  clinics: [...INIT_CLINICS],
  users: [...INIT_USERS],
};

export const ROLES = {
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

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const login = useCallback(async (loginStr, password) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.login(loginStr, password);
      if (result && result.accessToken) {
        api.setTokens(result.accessToken, result.refreshToken);
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
      setError('Ошибка входа: ' + (err.message || 'неизвестная ошибка'));
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

  const forgotPassword = useCallback(async (loginStr) => {
    try {
      return await api.forgotPassword(loginStr);
    } catch {
      return { error: 'Ошибка соединения' };
    }
  }, []);

  const register = useCallback(async (formData) => {
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
      setError('Ошибка регистрации: ' + (err.message || 'неизвестная ошибка'));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const addStaffMember = useCallback(async (staffData) => {
    if (!staffData.clinicId || !staffData.login || !staffData.password) return false;
    if (_store.users.some(u => u.clinicId === staffData.clinicId && u.login === staffData.login)) return false;
    try {
      const result = await api.upsertUser(staffData);
      if (result) {
        const newUser = { ...staffData, id: result.id || gid() };
        _store.users.push(newUser);
        return newUser;
      }
    } catch (err) {
      console.error('API addStaff failed:', err);
    }
    const newUser = { ...staffData, id: gid() };
    _store.users.push(newUser);
    return newUser;
  }, []);

  const getClinicStaff = useCallback((clinicId) =>
    _store.users.filter(u => u.clinicId === clinicId), []);

  const roleInfo = user ? (ROLES[user.role] || ROLES.doctor) : null;

  return (
    <AuthContext.Provider value={{
      user, clinic, loading, error,
      login, logout, register, forgotPassword,
      addStaffMember, getClinicStaff,
      isAuthenticated: !!user,
      role: user?.role || null,
      roleInfo,
      can: (action) => roleInfo ? !!roleInfo[action] : false,
      allClinics: _store.clinics,
      allUsers: _store.users,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
