import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiReply } from './aiHelpers.ts';

test('buildAiReply returns practical pricing guidance for price questions', () => {
  const reply = buildAiReply({
    message: 'Какая цена на имплантацию?',
    clinicName: 'DentVision Taldykorgan',
    patients: [],
    appointments: [],
    receipts: [],
    doctors: [],
  });

  assert.match(reply, /имплант/i);
  assert.match(reply, /DentVision Taldykorgan/i);
});

test('buildAiReply summarises clinic performance for report questions', () => {
  const reply = buildAiReply({
    message: 'Сделай отчёт за сегодня',
    clinicName: 'DentVision Almaty',
    patients: [{ id: 1 }, { id: 2 }],
    appointments: [{ id: 1 }, { id: 2 }, { id: 3 }],
    receipts: [{ status: 'paid', total: 150000 }, { status: 'paid', total: 300000 }],
    doctors: [{ id: 1 }, { id: 2 }],
  });

  assert.match(reply, /2 пациента/i);
  assert.match(reply, /3 записи/i);
  assert.match(reply, /450000/i);
});
