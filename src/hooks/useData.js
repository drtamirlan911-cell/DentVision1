import { useState, useCallback, useEffect, useRef } from 'react';
import {
  INIT_PATIENTS, INIT_APPOINTMENTS, INIT_RECEIPTS,
  INIT_USERS, gid, today
} from '../utils/constants';
import * as api from '../utils/api';

function trySync(table, row) {
  // Sync to API backend based on table type
  switch (table) {
    case 'patients':
      api.upsertPatient(row).catch(() => {});
      break;
    case 'appointments':
      api.upsertAppointment(row).catch(() => {});
      break;
    case 'receipts':
      api.upsertReceipt(row).catch(() => {});
      break;
    case 'lab_orders':
      api.upsertLabOrder(row).catch(() => {});
      break;
    case 'expenses':
      api.upsertExpense(row).catch(() => {});
      break;
    case 'inventory':
      api.upsertInventoryItem(row).catch(() => {});
      break;
    case 'users':
      api.upsertUser(row).catch(() => {});
      break;
    case 'subscriptions':
      api.upsertSubscription(row).catch(() => {});
      break;
    case 'photos':
      api.uploadPhoto(row).catch(() => {});
      break;
    default:
      console.log('Unknown table for sync:', table);
  }
}

function tryDelete(table, id) {
  // Delete from API backend
  if (table === 'patients') {
    api.deletePatient(id).catch(() => {});
  } else if (table === 'appointments') {
    api.deleteAppointment(id).catch(() => {});
  } else if (table === 'receipts') {
    api.deleteReceipt(id).catch(() => {});
  } else if (table === 'photos') {
    api.deletePhoto(id).catch(() => {});
  }
}

export function useData(clinicId) {
  const initRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const safeClinicId = clinicId || null;

  const [patients, _setPatients] = useState(() =>
    safeClinicId ? INIT_PATIENTS.filter(p => p.clinicId === safeClinicId) : []
  );
  const [appointments, _setAppointments] = useState(() =>
    safeClinicId ? INIT_APPOINTMENTS.filter(a => a.clinicId === safeClinicId) : []
  );
  const [receipts, _setReceipts] = useState(() =>
    safeClinicId ? INIT_RECEIPTS.filter(r => r.clinicId === safeClinicId) : []
  );
  const [labOrders, _setLabOrders] = useState([]);
  const [expenses, _setExpenses] = useState([]);
  const [inventory, _setInventory] = useState([
    { id: 'i1', clinicId: safeClinicId, name: 'Пломбировочный материал', quantity: 45, unit: 'шт', min: 20 },
    { id: 'i2', clinicId: safeClinicId, name: 'Анестетик Ультракаин', quantity: 12, unit: 'уп', min: 15 },
    { id: 'i3', clinicId: safeClinicId, name: 'Перчатки латексные', quantity: 150, unit: 'пар', min: 100 },
    { id: 'i4', clinicId: safeClinicId, name: 'Боры стоматологические', quantity: 8, unit: 'набор', min: 10 },
  ]);

  const doctors = INIT_USERS.filter(u => u.role === 'doctor' && (!safeClinicId || u.clinicId === safeClinicId));

  // Load data from API on mount
  useEffect(() => {
    if (!safeClinicId || initRef.current) return;
    initRef.current = true;

    const loadData = async () => {
      try {
        // Load patients
        const patientsData = await api.getPatients(safeClinicId).catch(() => []);
        if (patientsData && patientsData.length > 0) {
          _setPatients(patientsData);
        }

        // Load appointments
        const appointmentsData = await api.getAppointments(safeClinicId).catch(() => []);
        if (appointmentsData && appointmentsData.length > 0) {
          _setAppointments(appointmentsData);
        }

        // Load receipts
        const receiptsData = await api.getReceipts(safeClinicId).catch(() => []);
        if (receiptsData && receiptsData.length > 0) {
          _setReceipts(receiptsData);
        }

        // Load lab orders
        const labOrdersData = await api.getLabOrders(safeClinicId).catch(() => []);
        if (labOrdersData && labOrdersData.length > 0) {
          _setLabOrders(labOrdersData);
        }

        // Load expenses
        const expensesData = await api.getExpenses(safeClinicId).catch(() => []);
        if (expensesData && expensesData.length > 0) {
          _setExpenses(expensesData);
        }

        // Load inventory
        const inventoryData = await api.getInventory(safeClinicId).catch(() => []);
        if (inventoryData && inventoryData.length > 0) {
          _setInventory(inventoryData);
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to load data from API:', error);
        setIsInitialized(true);
      }
    };

    loadData();
  }, [safeClinicId]);

  const upsertPatient = useCallback((patientData) => {
    const isNew = !patientData.id;
    const record = { ...patientData, id: patientData.id || gid(), clinicId: safeClinicId };
    _setPatients(prev => {
      const exists = prev.find(p => p.id === record.id);
      return exists ? prev.map(p => p.id === record.id ? record : p) : [...prev, record];
    });
    trySync('patients', record);
    return Promise.resolve(record);
  }, [safeClinicId]);

  const deletePatient = useCallback((id) => {
    _setPatients(prev => prev.filter(p => p.id !== id));
    tryDelete('patients', id);
    return Promise.resolve();
  }, []);

  const upsertAppointment = useCallback((apptData) => {
    const record = { ...apptData, id: apptData.id || gid(), clinicId: safeClinicId, date: apptData.date || today() };
    _setAppointments(prev => {
      const exists = prev.find(a => a.id === record.id);
      return exists ? prev.map(a => a.id === record.id ? record : a) : [...prev, record];
    });
    trySync('appointments', record);
    return Promise.resolve(record);
  }, [safeClinicId]);

  const deleteAppointment = useCallback((id) => {
    _setAppointments(prev => prev.filter(a => a.id !== id));
    tryDelete('appointments', id);
    return Promise.resolve();
  }, []);

  const upsertReceipt = useCallback((data) => {
    const record = { ...data, id: data.id || gid(), clinicId: safeClinicId, date: data.date || today() };
    _setReceipts(prev => {
      const exists = prev.find(r => r.id === record.id);
      return exists ? prev.map(r => r.id === record.id ? record : r) : [...prev, record];
    });
    trySync('receipts', record);
    return Promise.resolve(record);
  }, [safeClinicId]);

  const upsertTransaction = upsertReceipt;

  const upsertLabOrder = useCallback((data) => {
    const record = { ...data, id: data.id || gid(), clinicId: safeClinicId };
    _setLabOrders(prev => {
      const exists = prev.find(o => o.id === record.id);
      return exists ? prev.map(o => o.id === record.id ? record : o) : [...prev, record];
    });
    trySync('lab_orders', record);
    return Promise.resolve(record);
  }, [safeClinicId]);

  const upsertExpense = useCallback((data) => {
    const record = { ...data, id: data.id || gid(), clinicId: safeClinicId, date: data.date || today() };
    _setExpenses(prev => {
      const exists = prev.find(e => e.id === record.id);
      return exists ? prev.map(e => e.id === record.id ? record : e) : [...prev, record];
    });
    trySync('expenses', record);
    return Promise.resolve(record);
  }, [safeClinicId]);

  const upsertInventoryItem = useCallback((data) => {
    const record = { ...data, id: data.id || gid(), clinicId: safeClinicId };
    _setInventory(prev => {
      const exists = prev.find(i => i.id === record.id);
      return exists ? prev.map(i => i.id === record.id ? record : i) : [...prev, record];
    });
    trySync('inventory', record);
    return Promise.resolve(record);
  }, [safeClinicId]);

  const [treatments, _setTreatments] = useState([]);
  const addTreatment = useCallback((treatment) => {
    const record = { ...treatment, id: treatment.id || gid(), clinicId: safeClinicId };
    _setTreatments(prev => [...prev, record]);
    trySync('treatments', record);
    return Promise.resolve(record);
  }, [safeClinicId]);

  const [users, _setUsers] = useState(doctors);
  const upsertUser = useCallback((userData) => {
    const record = { ...userData, id: userData.id || gid(), clinicId: safeClinicId };
    _setUsers(prev => {
      const exists = prev.find(u => u.id === record.id);
      return exists ? prev.map(u => u.id === record.id ? record : u) : [...prev, record];
    });
    trySync('users', record);
    return Promise.resolve(record);
  }, [safeClinicId]);

  const [subscriptions, _setSubscriptions] = useState([]);
  const upsertSubscription = useCallback((subData) => {
    const record = { ...subData, id: subData.id || gid(), clinicId: safeClinicId };
    _setSubscriptions(prev => {
      const exists = prev.find(s => s.id === record.id);
      return exists ? prev.map(s => s.id === record.id ? record : s) : [...prev, record];
    });
    trySync('subscriptions', record);
    return Promise.resolve(record);
  }, [safeClinicId]);

  const [photos, _setPhotos] = useState([]);
  const uploadPhoto = useCallback((photoData) => {
    const record = { ...photoData, id: photoData.id || gid(), clinicId: safeClinicId, uploadDate: today() };
    _setPhotos(prev => [...prev, record]);
    trySync('photos', record);
    return Promise.resolve(record);
  }, [safeClinicId]);

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
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
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
