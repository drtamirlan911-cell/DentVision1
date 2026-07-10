import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiReply } from './aiHelpers.js';
import { INIT_USERS } from './constants.js';

test('demo users are available for login flow', () => {
  const found = INIT_USERS.find(u => u.login === 'admin_c1' && u.password === 'admin123');
  assert.ok(found);
});

test('ai reply uses clinic context for pricing questions', () => {
  const reply = buildAiReply({
    message: 'Какая цена на имплантацию?',
    clinicName: 'DentVision Almaty',
    patients: [{ id: 1 }],
    appointments: [{ id: 1 }],
    receipts: [{ total: 100000, status: 'paid' }],
    doctors: INIT_USERS.filter(u => u.role === 'doctor'),
  });
  assert.match(reply, /DentVision Almaty/i);
  assert.match(reply, /имплант/i);
});
