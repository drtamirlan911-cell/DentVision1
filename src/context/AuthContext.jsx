import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { SUPER_ADMIN, INIT_CLINICS, INIT_USERS, gid, today } from '../utils/constants';

// Persistent session store (survives HMR, resets on full reload)
const _store = {
  clinics: [...INIT_CLINICS],
  users: [...INIT_USERS],
};

export const ROLES = {
  superadmin: {
    label: 'Super Admin',
    icon: '⚙️',
    pages: ['dashboard','schedule','patients','cashier','lab','ai','reminders','admin'],
    canSeeSalary: true, canSeeSuperAdmin: true, canAddStaff: true,
  },
  director: {
    label: 'Руководитель',
    icon: '👔',
    pages: ['dashboard','schedule','patients','cashier','lab','ai','reminders','staff'],
    canSeeSalary: true, canSeeReports: true, canAddStaff: true, canSeeExpenses: true,
  },
  admin: {
    label: 'Администратор',
    icon: '💼',
    pages: ['schedule','patients','cashier','lab','reminders'],
    canSeeSalary: false, canSeeExpenses: false,
  },
  doctor: {
    label: 'Врач',
    icon: '👨‍⚕️',
    pages: ['schedule','patients','lab','ai','reminders'],
    canSeeSalary: false, ownDataOnly: true,
  },
  assistant: {
    label: 'Ассистент',
    icon: '🤝',
    pages: ['schedule','patients','reminders'],
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
      if (loginStr === SUPER_ADMIN.login && password === SUPER_ADMIN.password) {
        setUser(SUPER_ADMIN);
        setClinic(null);
        return true;
      }

      const localUser = _store.users.find(
        u => u.login === loginStr && u.password === password
      );
      if (localUser) {
        setUser(localUser);
        setClinic(resolveClinic(localUser.clinicId));
        return true;
      }

      try {
        const { verifyLogin, loadClinicData } = await import('../utils/supabase');
        const result = await verifyLogin(loginStr, password);
        if (result) {
          setUser(result);
          if (result.clinicId) {
            const clinicData = await loadClinicData(result.clinicId).catch(() => null);
            setClinic(clinicData);
          }
          return true;
        }
      } catch (_) {}

      setError('Неверный логин или пароль');
      return false;
    } catch {
      setError('Ошибка соединения с сервером');
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
      if (_store.users.some(u => u.login === loginStr)) {
        setError('Такой логин уже занят — выберите другой');
        return false;
      }

      const newClinic = {
        id: gid(),
        name: clinicName,
        city: city || '',
        phone: phone || '',
        email: email || '',
        address: '',
        plan: 'starter',
        active: true,
        createdAt: today(),
        color: '#C9A96E',
      };

      const newDirector = {
        id: gid(),
        clinicId: newClinic.id,
        login: loginStr,
        password,
        role: 'director',
        name: directorName,
        spec: 'Руководитель',
      };

      _store.clinics.push(newClinic);
      _store.users.push(newDirector);

      setUser(newDirector);
      setClinic(newClinic);
      return true;
    } catch {
      setError('Ошибка при регистрации');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Add staff to existing clinic (director/admin only)
  const addStaffMember = useCallback((staffData) => {
    if (!staffData.clinicId || !staffData.login || !staffData.password) return false;
    if (_store.users.some(u => u.login === staffData.login)) return false;
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
      login, logout, register,
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
