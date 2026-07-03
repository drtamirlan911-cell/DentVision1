import { useState, useCallback, useEffect, useRef } from 'react';
import {
  INIT_PATIENTS, INIT_APPOINTMENTS, INIT_RECEIPTS,
  INIT_USERS, gid, today
} from '../utils/constants';

function trySync(table, row) {
  import('../utils/supabase').then(({ upsertRow }) => {
    upsertRow(table, row).catch(() => {});
  });
}

function tryDelete(table, id) {
  import('../utils/supabase').then(({ deleteRow }) => {
    deleteRow(table, id).catch(() => {});
  });
}

export function useData(clinicId) {
  const initRef = useRef(false);

  const [patients, _setPatients] = useState(() =>
    clinicId ? INIT_PATIENTS.filter(p => p.clinicId === clinicId) : []
  );
  const [appointments, _setAppointments] = useState(() =>
    clinicId ? INIT_APPOINTMENTS.filter(a => a.clinicId === clinicId) : []
  );
  const [receipts, _setReceipts] = useState(() =>
    clinicId ? INIT_RECEIPTS.filter(r => r.clinicId === clinicId) : []
  );
  const [labOrders, _setLabOrders] = useState([]);
  const [expenses, _setExpenses] = useState([]);
  const [inventory, _setInventory] = useState([
    { id: 'i1', clinicId, name: 'Пломбировочный материал', quantity: 45, unit: 'шт', min: 20 },
    { id: 'i2', clinicId, name: 'Анестетик Ультракаин', quantity: 12, unit: 'уп', min: 15 },
    { id: 'i3', clinicId, name: 'Перчатки латексные', quantity: 150, unit: 'пар', min: 100 },
    { id: 'i4', clinicId, name: 'Боры стоматологические', quantity: 8, unit: 'набор', min: 10 },
  ]);

  const doctors = INIT_USERS.filter(u => u.role === 'doctor' && (!clinicId || u.clinicId === clinicId));

  const upsertPatient = useCallback((patientData) => {
    const isNew = !patientData.id;
    const record = { ...patientData, id: patientData.id || gid(), clinicId };
    _setPatients(prev => {
      const exists = prev.find(p => p.id === record.id);
      return exists ? prev.map(p => p.id === record.id ? record : p) : [...prev, record];
    });
    trySync('patients', record);
    return Promise.resolve(record);
  }, [clinicId]);

  const deletePatient = useCallback((id) => {
    _setPatients(prev => prev.filter(p => p.id !== id));
    tryDelete('patients', id);
    return Promise.resolve();
  }, []);

  const upsertAppointment = useCallback((apptData) => {
    const record = { ...apptData, id: apptData.id || gid(), clinicId, date: apptData.date || today() };
    _setAppointments(prev => {
      const exists = prev.find(a => a.id === record.id);
      return exists ? prev.map(a => a.id === record.id ? record : a) : [...prev, record];
    });
    trySync('appointments', record);
    return Promise.resolve(record);
  }, [clinicId]);

  const deleteAppointment = useCallback((id) => {
    _setAppointments(prev => prev.filter(a => a.id !== id));
    tryDelete('appointments', id);
    return Promise.resolve();
  }, []);

  const upsertReceipt = useCallback((data) => {
    const record = { ...data, id: data.id || gid(), clinicId, date: data.date || today() };
    _setReceipts(prev => {
      const exists = prev.find(r => r.id === record.id);
      return exists ? prev.map(r => r.id === record.id ? record : r) : [...prev, record];
    });
    trySync('receipts', record);
    return Promise.resolve(record);
  }, [clinicId]);

  const upsertTransaction = upsertReceipt;

  const upsertLabOrder = useCallback((data) => {
    const record = { ...data, id: data.id || gid(), clinicId };
    _setLabOrders(prev => {
      const exists = prev.find(o => o.id === record.id);
      return exists ? prev.map(o => o.id === record.id ? record : o) : [...prev, record];
    });
    trySync('lab_orders', record);
    return Promise.resolve(record);
  }, [clinicId]);

  const upsertExpense = useCallback((data) => {
    const record = { ...data, id: data.id || gid(), clinicId, date: data.date || today() };
    _setExpenses(prev => {
      const exists = prev.find(e => e.id === record.id);
      return exists ? prev.map(e => e.id === record.id ? record : e) : [...prev, record];
    });
    trySync('expenses', record);
    return Promise.resolve(record);
  }, [clinicId]);

  const upsertInventoryItem = useCallback((data) => {
    const record = { ...data, id: data.id || gid(), clinicId };
    _setInventory(prev => {
      const exists = prev.find(i => i.id === record.id);
      return exists ? prev.map(i => i.id === record.id ? record : i) : [...prev, record];
    });
    trySync('inventory', record);
    return Promise.resolve(record);
  }, [clinicId]);

  const [treatments, _setTreatments] = useState([]);
  const addTreatment = useCallback((treatment) => {
    const record = { ...treatment, id: treatment.id || gid(), clinicId };
    _setTreatments(prev => [...prev, record]);
    trySync('treatments', record);
    return Promise.resolve(record);
  }, [clinicId]);

  const [users, _setUsers] = useState(doctors);
  const upsertUser = useCallback((userData) => {
    const record = { ...userData, id: userData.id || gid(), clinicId };
    _setUsers(prev => {
      const exists = prev.find(u => u.id === record.id);
      return exists ? prev.map(u => u.id === record.id ? record : u) : [...prev, record];
    });
    trySync('users', record);
    return Promise.resolve(record);
  }, [clinicId]);

  const [subscriptions, _setSubscriptions] = useState([]);
  const upsertSubscription = useCallback((subData) => {
    const record = { ...subData, id: subData.id || gid(), clinicId };
    _setSubscriptions(prev => {
      const exists = prev.find(s => s.id === record.id);
      return exists ? prev.map(s => s.id === record.id ? record : s) : [...prev, record];
    });
    trySync('subscriptions', record);
    return Promise.resolve(record);
  }, [clinicId]);

  const [photos, _setPhotos] = useState([]);
  const uploadPhoto = useCallback((photoData) => {
    const record = { ...photoData, id: photoData.id || gid(), clinicId, uploadDate: today() };
    _setPhotos(prev => [...prev, record]);
    trySync('photos', record);
    return Promise.resolve(record);
  }, [clinicId]);

  const deletePhoto = useCallback((id) => {
    _setPhotos(prev => prev.filter(p => p.id !== id));
    tryDelete('photos', id);
    return Promise.resolve();
  }, []);

  return {
    patients, appointments, receipts, labOrders, expenses, inventory, doctors,
    transactions: receipts, treatments, users, subscriptions, photos,
    upsertPatient, deletePatient,
    upsertAppointment, deleteAppointment,
    upsertReceipt, upsertTransaction,
    upsertLabOrder,
    upsertExpense,
    upsertInventoryItem,
    addTreatment,
    upsertUser,
    upsertSubscription,
    uploadPhoto, deletePhoto,
  };
}

export function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  return {
    toast,
    showToast,
    clearToast,
    success: (msg) => showToast(msg, 'success'),
    error: (msg) => showToast(msg, 'error'),
    warn: (msg) => showToast(msg, 'warning'),
    info: (msg) => showToast(msg, 'info'),
  };
}

export function useCloudTable(table, def) {
  const [state, setState] = useState(def);
  return [state, setState, setState, { online: true }];
}

export function useClinicData(clinicId) {
  return { data: null, loading: false, error: null };
}

export function useSubscription(clinicId) {
  const [subscription] = useState({ plan: 'pro', active: true });
  return { subscription, loading: false, checkStatus: () => {}, upgrade: () => {} };
}

export function usePhotoProtocol(clinicId) {
  const [photos, setPhotos] = useState([]);
  const uploadPhoto = useCallback(async (photoData) => {
    setPhotos(prev => [...prev, { ...photoData, id: gid() }]);
    return true;
  }, []);
  const deletePhoto = useCallback((id) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
    return true;
  }, []);
  return { photos, loading: false, uploadPhoto, deletePhoto };
}

export function useLabOrders(clinicId) {
  const { labOrders, upsertLabOrder } = useData(clinicId);
  return { labOrders, loading: false, upsertLabOrder, createOrder: upsertLabOrder };
}

export function useAppointmentsWithReminders() {
  return { scheduleReminder: () => {}, sendReminders: () => {}, reminderQueue: [] };
}
