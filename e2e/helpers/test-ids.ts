export const TEST_IDS = {
  CLINIC_A: 'test-clinic-a-e2e',
  CLINIC_B: 'test-clinic-b-e2e',

  users: {
    OWNER_A: {
      email: 'owner-a-e2e@test.dentvision',
      firstName: 'Owner',
      lastName: 'ClinicA',
    },
    ADMIN_A: {
      email: 'admin-a-e2e@test.dentvision',
      firstName: 'Admin',
      lastName: 'ClinicA',
    },
    DOCTOR_A: {
      email: 'doctor-a-e2e@test.dentvision',
      firstName: 'Doctor',
      lastName: 'ClinicA',
    },
    ASSISTANT_A: {
      email: 'assistant-a-e2e@test.dentvision',
      firstName: 'Assistant',
      lastName: 'ClinicA',
    },
    OWNER_B: {
      email: 'owner-b-e2e@test.dentvision',
      firstName: 'Owner',
      lastName: 'ClinicB',
    },
    ADMIN_B: {
      email: 'admin-b-e2e@test.dentvision',
      firstName: 'Admin',
      lastName: 'ClinicB',
    },
    DOCTOR_B: {
      email: 'doctor-b-e2e@test.dentvision',
      firstName: 'Doctor',
      lastName: 'ClinicB',
    },
    ASSISTANT_B: {
      email: 'assistant-b-e2e@test.dentvision',
      firstName: 'Assistant',
      lastName: 'ClinicB',
    },
    REGULAR_USER: {
      email: 'regular-e2e@test.dentvision',
      firstName: 'Regular',
      lastName: 'User',
    },
  },

  passwords: {
    DEFAULT: 'TestPass123!',
    WEAK: '123',
    STRONG: 'Str0ng!P@ssw0rd#2026',
  },

  prefixes: {
    PATIENT: 'e2e-patient',
    APPOINTMENT: 'e2e-appt',
    RECEIPT: 'e2e-receipt',
    LAB_ORDER: 'e2e-lab',
    EXPENSE: 'e2e-expense',
    INVENTORY: 'e2e-inv',
    PROMOTION: 'e2e-promo',
    BOOKING: 'e2e-booking',
  },
} as const;
