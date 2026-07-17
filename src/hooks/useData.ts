import { useState, useCallback, useEffect } from 'react';
import {
  INIT_PATIENTS, INIT_APPOINTMENTS, INIT_RECEIPTS,
  INIT_USERS, gid, today
} from '../utils/constants';
import * as api from '../utils/api';
import type {
  DataStore,
  Patient,
  Appointment,
  Receipt,
  LabOrder,
  Expense,
  InventoryItem,
  User,
  Subscription,
  Photo,
  Promotion,
  Booking,
  MedicalCard,
  Visit,
  Document,
  WaitingListItem,
} from '../types';

const DEFAULT_INVENTORY: Omit<InventoryItem, 'clinicId'>[] = [
  { id: 'i1', name: 'Пломбировочный материал', quantity: 45, unit: 'шт', min: 20 },
  { id: 'i2', name: 'Анестетик Ультракаин', quantity: 12, unit: 'уп', min: 15 },
  { id: 'i3', name: 'Перчатки латексные', quantity: 150, unit: 'пар', min: 100 },
  { id: 'i4', name: 'Боры стоматологические', quantity: 8, unit: 'набор', min: 10 },
];

const store: DataStore = {
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
  medicalCards: [],
  visits: [],
  documents: [],
  waitingList: [],
  loadedClinics: new Set<string>(),
  listeners: new Set<() => void>(),
};

type StoreKey = keyof Omit<DataStore, 'loadedClinics' | 'listeners'>;

type SyncTable =
  | 'patients'
  | 'appointments'
  | 'receipts'
  | 'lab_orders'
  | 'expenses'
  | 'inventory'
  | 'users'
  | 'subscriptions'
  | 'photos'
  | 'promotions'
  | 'bookings'
  | 'medical_cards'
  | 'visits'
  | 'documents'
  | 'waiting_list'
  | 'treatments';

type DeleteTable = 'patients' | 'appointments' | 'receipts' | 'photos' | 'waiting_list';

function notify(): void {
  store.listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => boolean {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

function rowsForClinic<T extends { clinicId?: string }>(rows: T[], clinicId: string | null): T[] {
  return clinicId ? rows.filter((row) => row.clinicId === clinicId) : [];
}

function upsertRow(table: StoreKey, row: any): void {
  const rows = store[table] as any[];
  const index = rows.findIndex((item: any) => item.id === row.id);
  if (index >= 0) rows[index] = row;
  else rows.push(row);
  notify();
}

function replaceClinicRows(table: StoreKey, clinicId: string, rows: any[] | undefined): void {
  if (!rows?.length) return;
  const normalizedRows = rows.map((row: any) => ({ ...row, clinicId: row.clinicId || clinicId }));
  store[table] = [...(store[table] as any[]).filter((row: any) => row.clinicId !== clinicId), ...normalizedRows] as any;
  notify();
}

function removeRow(table: StoreKey, id: string): void {
  store[table] = (store[table] as any[]).filter((row: any) => row.id !== id) as any;
  notify();
}

function ensureInventory(clinicId: string): void {
  if (!clinicId) return;
  const hasInventory = store.inventory.some((item) => item.clinicId === clinicId);
  if (hasInventory) return;
  DEFAULT_INVENTORY.forEach((item) => upsertRow('inventory', { ...item, id: `${clinicId}_${item.id}`, clinicId }));
}

function trySync(table: SyncTable, row: any): void {
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
    case 'medical_cards': api.upsertMedicalCard(row).catch(() => {}); break;
    case 'visits': api.upsertVisit(row).catch(() => {}); break;
    case 'documents': api.upsertDocument(row).catch(() => {}); break;
    default: break;
  }
}

function tryDelete(table: DeleteTable, id: string): void {
  if (table === 'patients') api.deletePatient(id).catch(() => {});
  else if (table === 'appointments') api.deleteAppointment(id).catch(() => {});
  else if (table === 'receipts') api.deleteReceipt(id).catch(() => {});
  else if (table === 'photos') api.deletePhoto(id).catch(() => {});
}

export interface UseDataReturn {
  patients: Patient[];
  appointments: Appointment[];
  receipts: Receipt[];
  labOrders: LabOrder[];
  expenses: Expense[];
  inventory: InventoryItem[];
  doctors: User[];
  transactions: Receipt[];
  treatments: any[];
  users: User[];
  subscriptions: Subscription[];
  photos: Photo[];
  promotions: Promotion[];
  bookings: Booking[];
  medicalCards: MedicalCard[];
  visits: Visit[];
  documents: Document[];
  waitingList: WaitingListItem[];
  upsertPatient: (patientData: Partial<Patient>) => Promise<any>;
  deletePatient: (id: string) => Promise<void>;
  upsertAppointment: (apptData: Partial<Appointment>) => Promise<any>;
  deleteAppointment: (id: string) => Promise<void>;
  upsertReceipt: (data: Partial<Receipt>) => Promise<any>;
  upsertTransaction: (data: Partial<Receipt>) => Promise<any>;
  upsertLabOrder: (data: Partial<LabOrder>) => Promise<any>;
  upsertExpense: (data: Partial<Expense>) => Promise<any>;
  upsertInventoryItem: (data: Partial<InventoryItem>) => Promise<any>;
  addTreatment: (treatment: any) => Promise<any>;
  upsertUser: (userData: Partial<User>) => Promise<any>;
  upsertSubscription: (subData: Partial<Subscription>) => Promise<any>;
  uploadPhoto: (photoData: Partial<Photo>) => Promise<any>;
  deletePhoto: (id: string) => Promise<void>;
  upsertPromotion: (data: Partial<Promotion>) => Promise<any>;
  deletePromotion: (id: string) => Promise<void>;
  upsertBooking: (data: Partial<Booking>) => Promise<any>;
  upsertMedicalCard: (data: Partial<MedicalCard>) => Promise<any>;
  upsertVisit: (data: Partial<Visit>) => Promise<any>;
  upsertDocument: (data: Partial<Document>) => Promise<any>;
  deleteDocument: (id: string) => Promise<void>;
  upsertWaitingListItem: (data: Partial<WaitingListItem>) => Promise<any>;
  deleteWaitingListItem: (id: string) => Promise<void>;
}

export function useData(clinicId?: string | null): UseDataReturn {
  const safeClinicId = clinicId || null;
  const [, setVersion] = useState(0);

  useEffect(() => subscribe(() => setVersion((value) => value + 1)), []);

  useEffect(() => {
    if (!safeClinicId) return;
    ensureInventory(safeClinicId);
    if (store.loadedClinics.has(safeClinicId)) return;
    store.loadedClinics.add(safeClinicId);

    const loadData = async (): Promise<void> => {
      try {
        const [patientsData, appointmentsData, receiptsData, labOrdersData, expensesData, inventoryData, promotionsData, bookingsData, visitsData, documentsData, waitingListData] = await Promise.all([
          api.getPatients(safeClinicId).catch(() => []),
          api.getAppointments(safeClinicId).catch(() => []),
          api.getReceipts(safeClinicId).catch(() => []),
          api.getLabOrders(safeClinicId).catch(() => []),
          api.getExpenses(safeClinicId).catch(() => []),
          api.getInventory(safeClinicId).catch(() => []),
          api.getPromotions(safeClinicId).catch(() => []),
          api.getBookings(safeClinicId).catch(() => []),
          api.getVisits(safeClinicId, '').catch(() => []),
          api.getDocuments(safeClinicId, '').catch(() => []),
          api.getWaitingList(safeClinicId).catch(() => []),
        ]);

        replaceClinicRows('patients', safeClinicId, patientsData);
        replaceClinicRows('appointments', safeClinicId, appointmentsData);
        replaceClinicRows('receipts', safeClinicId, receiptsData);
        replaceClinicRows('labOrders', safeClinicId, labOrdersData);
        replaceClinicRows('expenses', safeClinicId, expensesData);
        replaceClinicRows('inventory', safeClinicId, inventoryData);
        replaceClinicRows('promotions', safeClinicId, promotionsData);
        replaceClinicRows('bookings', safeClinicId, bookingsData);
        replaceClinicRows('visits', safeClinicId, visitsData);
        replaceClinicRows('documents', safeClinicId, documentsData);
        replaceClinicRows('waitingList', safeClinicId, waitingListData);
      } catch (error) {
        console.error('Failed to load data from API:', error);
      }
    };

    loadData();
  }, [safeClinicId]);

  const scopedRecord = useCallback((data: Record<string, any>, defaults: Record<string, any> = {}): Record<string, any> => {
    const cleanData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    const record = { ...defaults, ...cleanData, id: data.id || gid(), clinicId: safeClinicId };
    Object.keys(record).forEach((key) => {
      if (record[key] === undefined) delete record[key];
    });
    return record;
  }, [safeClinicId]);

  const upsertPatient = useCallback((patientData: Partial<Patient>): Promise<any> => {
    const record = scopedRecord(patientData as Record<string, any>);
    upsertRow('patients', record);
    trySync('patients', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const deletePatient = useCallback((id: string): Promise<void> => {
    removeRow('patients', id);
    tryDelete('patients', id);
    return Promise.resolve();
  }, []);

  const upsertAppointment = useCallback((apptData: Partial<Appointment>): Promise<any> => {
    const record = scopedRecord(apptData as Record<string, any>, { date: today() });
    upsertRow('appointments', record);
    trySync('appointments', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const deleteAppointment = useCallback((id: string): Promise<void> => {
    removeRow('appointments', id);
    tryDelete('appointments', id);
    return Promise.resolve();
  }, []);

  const upsertReceipt = useCallback((data: Partial<Receipt>): Promise<any> => {
    const record = scopedRecord(data as Record<string, any>, { date: today() });
    upsertRow('receipts', record);
    trySync('receipts', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const upsertLabOrder = useCallback((data: Partial<LabOrder>): Promise<any> => {
    const record = scopedRecord(data as Record<string, any>);
    upsertRow('labOrders', record);
    trySync('lab_orders', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const upsertExpense = useCallback((data: Partial<Expense>): Promise<any> => {
    const record = scopedRecord(data as Record<string, any>, { date: today() });
    upsertRow('expenses', record);
    trySync('expenses', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const upsertInventoryItem = useCallback((data: Partial<InventoryItem>): Promise<any> => {
    const record = scopedRecord(data as Record<string, any>);
    upsertRow('inventory', record);
    trySync('inventory', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const addTreatment = useCallback((treatment: any): Promise<any> => {
    const record = scopedRecord(treatment);
    upsertRow('treatments', record);
    trySync('treatments', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const upsertUser = useCallback((userData: Partial<User>): Promise<any> => {
    const record = scopedRecord(userData as Record<string, any>);
    upsertRow('users', record);
    trySync('users', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const upsertSubscription = useCallback((subData: Partial<Subscription>): Promise<any> => {
    const record = scopedRecord(subData as Record<string, any>);
    upsertRow('subscriptions', record);
    trySync('subscriptions', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const uploadPhoto = useCallback((photoData: Partial<Photo>): Promise<any> => {
    const record = scopedRecord(photoData as Record<string, any>, { uploadDate: today() });
    upsertRow('photos', record);
    trySync('photos', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const deletePhoto = useCallback((id: string): Promise<void> => {
    removeRow('photos', id);
    tryDelete('photos', id);
    return Promise.resolve();
  }, []);

  const upsertPromotion = useCallback((data: Partial<Promotion>): Promise<any> => {
    const record = scopedRecord(data as Record<string, any>);
    upsertRow('promotions', record);
    trySync('promotions', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const deletePromotion = useCallback((id: string): Promise<void> => {
    removeRow('promotions', id);
    return Promise.resolve();
  }, []);

  const upsertBooking = useCallback((data: Partial<Booking>): Promise<any> => {
    const record = scopedRecord(data as Record<string, any>);
    upsertRow('bookings', record);
    trySync('bookings', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const upsertMedicalCard = useCallback((data: Partial<MedicalCard>): Promise<any> => {
    const record = scopedRecord(data as Record<string, any>);
    upsertRow('medicalCards', record);
    trySync('medical_cards', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const upsertVisit = useCallback((data: Partial<Visit>): Promise<any> => {
    const record = scopedRecord(data as Record<string, any>);
    upsertRow('visits', record);
    trySync('visits', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const upsertDocument = useCallback((data: Partial<Document>): Promise<any> => {
    const record = scopedRecord(data as Record<string, any>);
    upsertRow('documents', record);
    trySync('documents', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const deleteDocument = useCallback((id: string): Promise<void> => {
    removeRow('documents', id);
    api.deleteDocument(id).catch(() => {});
    return Promise.resolve();
  }, []);

  const upsertWaitingListItem = useCallback((data: Partial<WaitingListItem>): Promise<any> => {
    const record = scopedRecord(data as Record<string, any>);
    upsertRow('waitingList', record);
    trySync('waiting_list', record);
    return Promise.resolve(record);
  }, [scopedRecord]);

  const deleteWaitingListItem = useCallback((id: string): Promise<void> => {
    removeRow('waitingList', id);
    tryDelete('waitingList', id);
    return Promise.resolve();
  }, []);

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
  const medicalCards = rowsForClinic(store.medicalCards, safeClinicId);
  const visits = rowsForClinic(store.visits, safeClinicId);
  const documents = rowsForClinic(store.documents, safeClinicId);
  const waitingList = rowsForClinic(store.waitingList, safeClinicId);

  return {
    patients, appointments, receipts, labOrders, expenses, inventory, doctors,
    transactions: receipts, treatments, users, subscriptions, photos,
    promotions, bookings, medicalCards, visits, documents, waitingList,
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
    upsertMedicalCard,
    upsertVisit,
    upsertDocument, deleteDocument,
    upsertWaitingListItem, deleteWaitingListItem,
  };
}
