import React, { createContext, useContext, useState, useCallback } from 'react';
import { SUPER_ADMIN, INIT_CLINICS, INIT_USERS, gid, today } from '../utils/constants';
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
    pages: ['dashboard','schedule','patients','medical-card','visits','icd10','documents','cashier','pricelist','lab','ai','reminders','promotions','inventory','admin','audit','backup'],
    canSeeSalary: true, canSeeSuperAdmin: true, canAddStaff: true, canSeeAudit: true, canBackup: true,
  },
  director: {
    label: 'Руководитель',
    icon: '👔',
    pages: ['dashboard','schedule','patients','medical-card','visits','icd10','documents','cashier','pricelist','lab','ai','reminders','promotions','inventory','staff','audit','backup'],
    canSeeSalary: true, canSeeReports: true, canAddStaff: true, canSeeExpenses: true, canSeeAudit: true, canBackup: true,
  },
  admin: {
    label: 'Администратор',
    icon: '💼',
    pages: ['schedule','patients','medical-card','visits','icd10','documents','cashier','pricelist','lab','reminders','promotions','inventory','staff','documents'],
    canSeeSalary: false, canSeeExpenses: false, canAddStaff: true,
  },
  doctor: {
    label: 'Врач',
    icon: '👨‍⚕️',
    pages: ['schedule','patients','medical-card','visits','icd10','documents','lab','ai','reminders'],
    canSeeSalary: false, ownDataOnly: true,
  },
  assistant: {
    label: 'Ассистент',
    icon: '🤝',
    pages: ['schedule','patients','visits','documents','reminders'],
    canSeeSalary: false, ownDataOnly: true, readOnly: true,
  },
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const resolveClinic = (clinicId) =>
    _store.clinics.find(c => c.id === clinicId) || null;

  const login = useCallback(async (loginStr, password) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.login(loginStr, password);
      if (result && result.user) {
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
    setUser(null);
    setClinic(null);
    setError(null);
  }, []);

  const forgotPassword = useCallback(async (loginStr) => {
const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001');
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginStr }),
      });
      return await res.json();
    } catch {
      return { error: 'Ошибка соединения' };
    }
  }, []);

  // Register a brand-new clinic + director account
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

      // Persist to PostgreSQL via API
      const result = await api.register(formData);
      if (result && result.user && result.clinic) {
        setUser(result.user);
        setClinic(result.clinic);
        _store.clinics.push(result.clinic);
        _store.users.push(result.user);
        return true;
      }

      setError('Ошибка при регистрации — сервер не вернул данные');
      return false;
    } catch (err) {
      const msg = err.message || 'Ошибка при регистрации';
      setError('Ошибка регистрации: ' + msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Add staff to existing clinic (director/admin only)
  const addStaffMember = useCallback(async (staffData) => {
    if (!staffData.clinicId || !staffData.login || !staffData.password) return false;
    // Check uniqueness within this clinic
    if (_store.users.some(u => u.clinicId === staffData.clinicId && u.login === staffData.login)) return false;

    // Persist to DB via API
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

    // Fallback to local-only
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
