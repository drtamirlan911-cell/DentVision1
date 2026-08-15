import { test as base, APIRequestContext } from '@playwright/test';
import { api, login, BASE_URL } from './api';
import { TEST_IDS } from './test-ids';

type DentFixtures = {
  apiContext: APIRequestContext;
  ownerAToken: string;
  adminAToken: string;
  doctorAToken: string;
  assistantAToken: string;
  ownerBToken: string;
  testClinic: { id: string; name: string };
  testClinicB: { id: string; name: string };
};

export const test = base.extend<DentFixtures>({
  apiContext: async ({}, use) => {
    const ctx = await api();
    await use(ctx);
  },

  ownerAToken: async ({}, use) => {
    const { tokens } = await login(TEST_IDS.users.OWNER_A.email, TEST_IDS.passwords.DEFAULT);
    await use(tokens.accessToken);
  },

  adminAToken: async ({}, use) => {
    const { tokens } = await login(TEST_IDS.users.ADMIN_A.email, TEST_IDS.passwords.DEFAULT);
    await use(tokens.accessToken);
  },

  doctorAToken: async ({}, use) => {
    const { tokens } = await login(TEST_IDS.users.DOCTOR_A.email, TEST_IDS.passwords.DEFAULT);
    await use(tokens.accessToken);
  },

  assistantAToken: async ({}, use) => {
    const { tokens } = await login(TEST_IDS.users.ASSISTANT_A.email, TEST_IDS.passwords.DEFAULT);
    await use(tokens.accessToken);
  },

  ownerBToken: async ({}, use) => {
    const { tokens } = await login(TEST_IDS.users.OWNER_B.email, TEST_IDS.passwords.DEFAULT);
    await use(tokens.accessToken);
  },

  testClinic: async ({ ownerAToken }, use) => {
    const ctx = await api();
    const res = await ctx.get('/api/auth/my-clinics', {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    const body = await res.json();
    const clinics = body.data || body;
    const clinic = Array.isArray(clinics) ? clinics[0] : clinics;
    await use({ id: clinic.id, name: clinic.name });
  },

  testClinicB: async ({ ownerBToken }, use) => {
    const ctx = await api();
    const res = await ctx.get('/api/auth/my-clinics', {
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });
    const body = await res.json();
    const clinics = body.data || body;
    const clinic = Array.isArray(clinics) ? clinics[0] : clinics;
    await use({ id: clinic.id, name: clinic.name });
  },
});

export { expect } from '@playwright/test';
