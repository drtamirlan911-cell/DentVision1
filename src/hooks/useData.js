import { useState, useCallback, useEffect } from 'react';
import {
  INIT_PATIENTS, INIT_APPOINTMENTS, INIT_RECEIPTS,
  INIT_USERS, gid, today
} from '../utils/constants';
import * as api from '../utils/api';

const DEFAULT_INVENTORY = [
  { id: 'i1', name: 'Пломбировочный материал', quantity: 45, unit: 'шт', min: 20 },
  { id: 'i2', name: 'Анестетик Ультракаин', quantity: 12, unit: 'уп', min: 15 },
  { id: 'i3', name: 'Перчатки латексные', quantity: 150, unit: 'пар', min: 100 },
  { id: 'i4', name: 'Боры стоматологические', quantity: 8, unit: 'набор', min: 10 },
];

const store = {
  patients: [...INIT_PATIENTS],
  appointments: [...INIT_APPOINTMENTS],
  receipts: [...INIT_RECEIPTS],
  labOrders: [],
  expenses: [],
  inventory: [],
  treatments: [],
  users: [...INIT_USERS],
  subscriptions: [],
  photos: [],
  promotions: [],
  bookings: [],
  loadedClinics: new Set(),
  listeners: new Set(),
};

function notify() {
  store.listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

function rowsForClinic(rows, clinicId) {
  return clinicId ? rows.filter((row) => row.clinicId === clinicId) : [];
}

function upsertRow(table, row) {
  const rows = store[table];
  const index = rows.findIndex((item) => item.id === row.id);
  if (index >= 0) rows[index] = row;
  else rows.push(row);
  notify();
}

function replaceClinicRows(table, clinicId, rows) {
  if (!rows?.length) return;
  const normalizedRows = rows.map((row) => ({ ...row, clinicId: row.clinicId || clinicId }));
  store[table] = [...store[table].filter((row) => row.clinicId !== clinicId), ...normalizedRows];
  notify();
}

function removeRow(table, id) {
  store[table] = store[table].filter((row) => row.id !== id);
  notify();
}

function ensureInventory(clinicId) {
  if (!clinicId) return;
  const hasInventory = store.inventory.some((item) => item.clinicId === clinicId);
  if (hasInventory) return;
  DEFAULT_INVENTORY.forEach((item) => upsertRow('inventory', { ...item, id: `${clinicId}_${item.id}`, clinicId }));
}

function trySync(table, row) {
  switch (table) {
    case 'patients': api.upsertPatient(row).catch(() => {}); break;
    case 'appointments': api.upsertAppointment(row).catch(() => {}); break;
    case 'receipts': api.upsertReceipt(row).catch(() => {}); break;
    case 'lab_orders': api.upsertLabOrder(row).catch(() => {}); break;
    case 'expenses': api.upsertExpense(row).catch(() => {}); break;
    case 'inventory': api.upsertInventoryItem(row).catch(() => {}); break;
    case 'users': api.upsertUser(row).catch(() => {}); break;
    case 'subscriptions': api.upsertSubscription(row).catch(() => {}); break;
    case 'photos': api.uploadPhoto(row).catch(() => {}); break;
    case 'promotions': api.upsertPromotion(row).catch(() => {}); break;
    case 'bookings': api.upsertBooking(row).catch(() => {}); break;
    default: break;
  }
}

function tryDelete(table, id) {
  if (table === 'patients') api.deletePatient(id).catch(() => {});
  else if (table === 'appointments') api.deleteAppointment(id).catch(() => {});
  else if (table === 'receipts') api.deleteReceipt(id).catch(() => {});
  else if (table === 'photos') api.deletePhoto(id).catch(() => {});
}

export function useData(clinicId) {
  const safeClinicId = clinicId || null;
  const [, setVersion] = useState(0);

  useEffect(() => subscribe(() => setVersion((value) => value + 1)), []);

  useEffect(() => {
    if (!safeClinicId) return;
    ensureInventory(safeClinicId);
    if (store.loadedClinics.has(safeClinicId)) return;
    store.loadedClinics.add(safeClinicId);

    const loadData = async () => {
      try {
        const [patientsData, appointmentsData, receiptsData, labOrdersData, expensesData, inventoryData, promotionsData, bookingsData] = await Promise.all([
          api.getPatients(safeClinicId).catch(() => []),
          api.getAppointments(safeClinicId).catch(() => []),
          api.getReceipts(safeClinicId).catch(() => []),
          api.getLabOrders(safeClinicId).catch(() => []),
          api.getExpenses(safeClinicId).catch(() => []),
          api.getInventory(safeClinicId).catch(() => []),
          api.getPromotions(safeClinicId).catch(() => []),
          api.getBookings(safeClinicId).catch(() => []),
        ]);

        replaceClinicRows('patients', safeClinicId, patientsData);
        replaceClinicRows('appointments', safeClinicId, appointmentsData);
        replaceClinicRows('receipts', safeClinicId, receiptsData);
        replaceClinicRows('labOrders', safeClinicId, labOrdersData);
        replaceClinicRows('expenses', safeClinicId, expensesData);
        replaceClinicRows('inventory', safeClinicId, inventoryData);
        replaceClinicRows('promotions', safeClinicId, promotionsData);
        replaceClinicRows('bookings', safeClinicId, bookingsData);
      } catch (error) {
        console.error('Failed to load data from API:', error);
      }
    };

    loadData();
  }, [safeClinicId]);

  const scopedRecord = useCallback((data, defaults = {}) => {
    const cleanData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    const record = { ...defaults, ...cleanData, id: data.id || gid(), clinicId: safeClinicId };
    Object.keys(record).forEach((key) => {
      if (record[key] === undefined) delete record[key];
    });
    return record;
  }, [safeClinicId]);

  const upsertPatient = useCallback((patientData) => {
    const record = scopedRecord(patientData);
    upsertRow('patients', record);
    trySync('patients', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const deletePatient = useCallback((id) => {
    removeRow('patients', id);
    tryDelete('patients', id);
    return Promise.resolve();
  }, []);

  const upsertAppointment = useCallback((apptData) => {
    const record = scopedRecord(apptData, { date: today() });
    upsertRow('appointments', record);
    trySync('appointments', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const deleteAppointment = useCallback((id) => {
    removeRow('appointments', id);
    tryDelete('appointments', id);
    return Promise.resolve();
  }, []);

  const upsertReceipt = useCallback((data) => {
    const record = scopedRecord(data, { date: today() });
    upsertRow('receipts', record);
    trySync('receipts', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const upsertLabOrder = useCallback((data) => {
    const record = scopedRecord(data);
    upsertRow('labOrders', record);
    trySync('lab_orders', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const upsertExpense = useCallback((data) => {
    const record = scopedRecord(data, { date: today() });
    upsertRow('expenses', record);
    trySync('expenses', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const upsertInventoryItem = useCallback((data) => {
    const record = scopedRecord(data);
    upsertRow('inventory', record);
    trySync('inventory', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const addTreatment = useCallback((treatment) => {
    const record = scopedRecord(treatment);
    upsertRow('treatments', record);
    trySync('treatments', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const upsertUser = useCallback((userData) => {
    const record = scopedRecord(userData);
    upsertRow('users', record);
    trySync('users', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const upsertSubscription = useCallback((subData) => {
    const record = scopedRecord(subData);
    upsertRow('subscriptions', record);
    trySync('subscriptions', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const uploadPhoto = useCallback((photoData) => {
    const record = scopedRecord(photoData, { uploadDate: today() });
    upsertRow('photos', record);
    trySync('photos', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const deletePhoto = useCallback((id) => {
    removeRow('photos', id);
    tryDelete('photos', id);
    return Promise.resolve();
  }, []);

  const upsertPromotion = useCallback((data) => {
    const record = scopedRecord(data);
    upsertRow('promotions', record);
    trySync('promotions', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const deletePromotion = useCallback((id) => {
    removeRow('promotions', id);
    return Promise.resolve();
  }, []);

  const upsertBooking = useCallback((data) => {
    const record = scopedRecord(data);
    upsertRow('bookings', record);
    trySync('bookings', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const patients = rowsForClinic(store.patients, safeClinicId);
  const appointments = rowsForClinic(store.appointments, safeClinicId);
  const receipts = rowsForClinic(store.receipts, safeClinicId);
  const labOrders = rowsForClinic(store.labOrders, safeClinicId);
  const expenses = rowsForClinic(store.expenses, safeClinicId);
  const inventory = rowsForClinic(store.inventory, safeClinicId);
  const treatments = rowsForClinic(store.treatments, safeClinicId);
  const users = rowsForClinic(store.users, safeClinicId);
  const doctors = users.filter((user) => user.role === 'doctor');
  const subscriptions = rowsForClinic(store.subscriptions, safeClinicId);
  const photos = rowsForClinic(store.photos, safeClinicId);
  const promotions = rowsForClinic(store.promotions, safeClinicId);
  const bookings = rowsForClinic(store.bookings, safeClinicId);

  return {
    patients, appointments, receipts, labOrders, expenses, inventory, doctors,
    transactions: receipts, treatments, users, subscriptions, photos,
    promotions, bookings,
    upsertPatient, deletePatient,
    upsertAppointment, deleteAppointment,
    upsertReceipt, upsertTransaction: upsertReceipt,
    upsertLabOrder,
    upsertExpense,
    upsertInventoryItem,
    addTreatment,
    upsertUser,
    upsertSubscription,
    uploadPhoto, deletePhoto,
    upsertPromotion, deletePromotion,
    upsertBooking,
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

export function useClinicData(_clinicId) {
  return { data: null, loading: false, error: null };
}

export function useSubscription(_clinicId) {
  const [subscription] = useState({ plan: 'pro', active: true });
  return { subscription, loading: false, checkStatus: () => {}, upgrade: () => {} };
}

export function usePhotoProtocol(_clinicId) {
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
