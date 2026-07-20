import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/utils/api';
import { queryKeys } from './keys';
import type {
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

interface UseDataQueryReturn {
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
  upsertPatient: (data: Partial<Patient>) => Promise<any>;
  deletePatient: (id: string) => Promise<void>;
  upsertAppointment: (data: Partial<Appointment>) => Promise<any>;
  deleteAppointment: (id: string) => Promise<void>;
  upsertReceipt: (data: Partial<Receipt>) => Promise<any>;
  upsertTransaction: (data: Partial<Receipt>) => Promise<any>;
  upsertLabOrder: (data: Partial<LabOrder>) => Promise<any>;
  upsertExpense: (data: Partial<Expense>) => Promise<any>;
  upsertInventoryItem: (data: Partial<InventoryItem>) => Promise<any>;
  addTreatment: (treatment: any) => Promise<any>;
  upsertUser: (data: Partial<User>) => Promise<any>;
  upsertSubscription: (data: Partial<Subscription>) => Promise<any>;
  uploadPhoto: (data: Partial<Photo>) => Promise<any>;
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

export function useDataQuery(clinicId?: string | null): UseDataQueryReturn {
  const safeClinicId = clinicId || '';
  const queryClient = useQueryClient();
  const enabled = !!clinicId;

  // ─── Queries ───
  const patientsQ = useQuery({
    queryKey: queryKeys.patients,
    queryFn: () => api.getPatients(safeClinicId),
    enabled,
  });

  const appointmentsQ = useQuery({
    queryKey: queryKeys.appointments,
    queryFn: () => api.getAppointments(safeClinicId),
    enabled,
  });

  const receiptsQ = useQuery({
    queryKey: queryKeys.receipts,
    queryFn: () => api.getReceipts(safeClinicId),
    enabled,
  });

  const labOrdersQ = useQuery({
    queryKey: queryKeys.labOrders,
    queryFn: () => api.getLabOrders(safeClinicId),
    enabled,
  });

  const expensesQ = useQuery({
    queryKey: queryKeys.expenses,
    queryFn: () => api.getExpenses(safeClinicId),
    enabled,
  });

  const inventoryQ = useQuery({
    queryKey: queryKeys.inventory,
    queryFn: () => api.getInventory(safeClinicId),
    enabled,
  });

  const promotionsQ = useQuery({
    queryKey: queryKeys.promotions,
    queryFn: () => api.getPromotions(safeClinicId),
    enabled,
  });

  const bookingsQ = useQuery({
    queryKey: queryKeys.bookings,
    queryFn: () => api.getBookings(safeClinicId),
    enabled,
  });

  const visitsQ = useQuery({
    queryKey: queryKeys.visits(''),
    queryFn: () => api.getVisits(safeClinicId, ''),
    enabled,
  });

  const documentsQ = useQuery({
    queryKey: queryKeys.documents,
    queryFn: () => api.getDocuments(safeClinicId, ''),
    enabled,
  });

  const waitingListQ = useQuery({
    queryKey: queryKeys.waitingList,
    queryFn: () => api.getWaitingList(safeClinicId),
    enabled,
  });

  const staffQ = useQuery({
    queryKey: [...queryKeys.users, safeClinicId],
    queryFn: () => api.getClinicStaff(safeClinicId),
    enabled,
  });

  // ─── Optimistic Mutations: Patients ───
  const upsertPatientM = useMutation({
    mutationFn: (data: Partial<Patient>) => api.upsertPatient({ ...data, clinicId: safeClinicId }),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.patients });
      const prev = queryClient.getQueryData<Patient[]>(queryKeys.patients);
      queryClient.setQueryData<Patient[]>(queryKeys.patients, (old) => {
        const list = old || [];
        const idx = list.findIndex((p) => p.id === data.id);
        const record = { ...data, clinicId: safeClinicId } as Patient;
        if (idx >= 0) { const next = [...list]; next[idx] = record; return next; }
        return [...list, record];
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.patients, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.patients }),
  });

  const deletePatientM = useMutation({
    mutationFn: (id: string) => api.deletePatient(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.patients });
      const prev = queryClient.getQueryData<Patient[]>(queryKeys.patients);
      queryClient.setQueryData<Patient[]>(queryKeys.patients, (old) => (old || []).filter((p) => p.id !== id));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.patients, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.patients }),
  });

  // ─── Optimistic Mutations: Appointments ───
  const upsertAppointmentM = useMutation({
    mutationFn: (data: Partial<Appointment>) => api.upsertAppointment({ ...data, clinicId: safeClinicId }),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.appointments });
      const prev = queryClient.getQueryData<Appointment[]>(queryKeys.appointments);
      queryClient.setQueryData<Appointment[]>(queryKeys.appointments, (old) => {
        const list = old || [];
        const idx = list.findIndex((a) => a.id === data.id);
        const record = { ...data, clinicId: safeClinicId } as Appointment;
        if (idx >= 0) { const next = [...list]; next[idx] = record; return next; }
        return [...list, record];
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.appointments, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.appointments }),
  });

  const deleteAppointmentM = useMutation({
    mutationFn: (id: string) => api.deleteAppointment(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.appointments });
      const prev = queryClient.getQueryData<Appointment[]>(queryKeys.appointments);
      queryClient.setQueryData<Appointment[]>(queryKeys.appointments, (old) => (old || []).filter((a) => a.id !== id));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.appointments, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.appointments }),
  });

  // ─── Optimistic Mutations: Receipts ───
  const upsertReceiptM = useMutation({
    mutationFn: (data: Partial<Receipt>) => api.upsertReceipt({ ...data, clinicId: safeClinicId }),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.receipts });
      const prev = queryClient.getQueryData<Receipt[]>(queryKeys.receipts);
      queryClient.setQueryData<Receipt[]>(queryKeys.receipts, (old) => {
        const list = old || [];
        const idx = list.findIndex((r) => r.id === data.id);
        const record = { ...data, clinicId: safeClinicId } as Receipt;
        if (idx >= 0) { const next = [...list]; next[idx] = record; return next; }
        return [...list, record];
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.receipts, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.receipts }),
  });

  // ─── Optimistic Mutations: Documents ───
  const upsertDocumentM = useMutation({
    mutationFn: (data: Partial<Document>) => api.upsertDocument({ ...data, clinicId: safeClinicId }),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.documents });
      const prev = queryClient.getQueryData<Document[]>(queryKeys.documents);
      queryClient.setQueryData<Document[]>(queryKeys.documents, (old) => {
        const list = old || [];
        const idx = list.findIndex((d) => d.id === data.id);
        const record = { ...data, clinicId: safeClinicId } as Document;
        if (idx >= 0) { const next = [...list]; next[idx] = record; return next; }
        return [...list, record];
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.documents, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.documents }),
  });

  const deleteDocumentM = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.documents });
      const prev = queryClient.getQueryData<Document[]>(queryKeys.documents);
      queryClient.setQueryData<Document[]>(queryKeys.documents, (old) => (old || []).filter((d) => d.id !== id));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.documents, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.documents }),
  });

  // ─── Standard Mutations (no optimistic update needed — stub APIs) ───
  const upsertLabOrderM = useMutation({
    mutationFn: (data: Partial<LabOrder>) => api.upsertLabOrder({ ...data, clinicId: safeClinicId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.labOrders }),
  });

  const upsertExpenseM = useMutation({
    mutationFn: (data: Partial<Expense>) => api.upsertExpense({ ...data, clinicId: safeClinicId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.expenses }),
  });

  const upsertInventoryItemM = useMutation({
    mutationFn: (data: Partial<InventoryItem>) => api.upsertInventoryItem({ ...data, clinicId: safeClinicId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventory }),
  });

  const upsertPromotionM = useMutation({
    mutationFn: (data: Partial<Promotion>) => api.upsertPromotion({ ...data, clinicId: safeClinicId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.promotions }),
  });

  const deletePromotionM = useMutation({
    mutationFn: (id: string) => api.deletePromotion(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.promotions }),
  });

  const upsertBookingM = useMutation({
    mutationFn: (data: Partial<Booking>) => api.upsertBooking({ ...data, clinicId: safeClinicId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
  });

  const upsertMedicalCardM = useMutation({
    mutationFn: (data: Partial<MedicalCard>) => api.upsertMedicalCard({ ...data, clinicId: safeClinicId }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.visits('') });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents });
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
    },
  });

  const upsertVisitM = useMutation({
    mutationFn: (data: Partial<Visit>) => api.upsertVisit({ ...data, clinicId: safeClinicId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.visits('') }),
  });

  // ─── Derived Data ───
  const patients = (patientsQ.data as Patient[]) || [];
  const appointments = (appointmentsQ.data as Appointment[]) || [];
  const receipts = (receiptsQ.data as Receipt[]) || [];
  const labOrders = (labOrdersQ.data as LabOrder[]) || [];
  const expenses = (expensesQ.data as Expense[]) || [];
  const inventory = (inventoryQ.data as InventoryItem[]) || [];
  const promotions = (promotionsQ.data as Promotion[]) || [];
  const bookings = (bookingsQ.data as Booking[]) || [];
  const rawVisits = (visitsQ.data as Visit[]) || [];
  const documents = (documentsQ.data as Document[]) || [];
  const waitingList = (waitingListQ.data as WaitingListItem[]) || [];
  // Clinic team roster (real ClinicMember records via /api/clinics/:id).
  // "doctors" historically means "assignable staff" across Schedule/Cashier,
  // so it intentionally includes every role, not just DOCTOR.
  const users = ((staffQ.data as import('../utils/api').ClinicStaffMember[]) || []) as unknown as User[];
  const doctors = users;
  const subscriptions: Subscription[] = [];
  const photos: Photo[] = [];
  const treatments: any[] = [];
  // Structured medical-card fields live on Patient.medicalHistory (no
  // dedicated table on the deployed schema) — derive the list from patients
  // instead of a disconnected stub so MedicalCard.tsx can actually load data.
  const medicalCards: MedicalCard[] = patients
    .filter((p: any) => p.medicalHistory && typeof p.medicalHistory === 'object')
    .map((p: any) => ({ id: p.id, patientId: p.id, clinicId: p.clinicId, ...p.medicalHistory }));

  // Enrich visits with display names — the backend Visit model has no
  // patient/doctor join, so Visits.tsx/MedicalCard.tsx would otherwise
  // always show "—" for patient and doctor.
  const visits = rawVisits.map((v: any) => {
    const patient = patients.find((p: any) => p.id === (v.patientId || v.patient_id));
    const doctor = users.find((d: any) => d.id === (v.doctorId || v.doctor_id));
    return { ...v, patient_name: patient?.name, doctor_name: doctor?.name };
  });

  return {
    patients, appointments, receipts, labOrders, expenses, inventory, doctors,
    transactions: receipts, treatments, users, subscriptions, photos,
    promotions, bookings, medicalCards, visits, documents, waitingList,
    upsertPatient: (data) => upsertPatientM.mutateAsync(data),
    deletePatient: (id) => deletePatientM.mutateAsync(id),
    upsertAppointment: (data) => upsertAppointmentM.mutateAsync(data),
    deleteAppointment: (id) => deleteAppointmentM.mutateAsync(id),
    upsertReceipt: (data) => upsertReceiptM.mutateAsync(data),
    upsertTransaction: (data) => upsertReceiptM.mutateAsync(data),
    upsertLabOrder: (data) => upsertLabOrderM.mutateAsync(data),
    upsertExpense: (data) => upsertExpenseM.mutateAsync(data),
    upsertInventoryItem: (data) => upsertInventoryItemM.mutateAsync(data),
    addTreatment: (data) => upsertMedicalCardM.mutateAsync(data),
    upsertUser: (data) => Promise.resolve(data),
    upsertSubscription: (data) => Promise.resolve(data),
    uploadPhoto: (data) => Promise.resolve(data),
    deletePhoto: (id) => Promise.resolve(),
    upsertPromotion: (data) => upsertPromotionM.mutateAsync(data),
    deletePromotion: (id) => deletePromotionM.mutateAsync(id),
    upsertBooking: (data) => upsertBookingM.mutateAsync(data),
    upsertMedicalCard: (data) => upsertMedicalCardM.mutateAsync(data),
    upsertVisit: (data) => upsertVisitM.mutateAsync(data),
    upsertDocument: (data) => upsertDocumentM.mutateAsync(data),
    deleteDocument: (id) => deleteDocumentM.mutateAsync(id),
    upsertWaitingListItem: (data) => api.upsertWaitingListItem({ ...data, clinicId: safeClinicId }).then((r) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.waitingList });
      return r;
    }),
    deleteWaitingListItem: (id) => api.deleteWaitingListItem(id).then(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.waitingList });
    }),
  };
}
