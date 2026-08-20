import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A lab order recorded no doctor. The dental-lab workflow is
 * doctor → patient → tooth → order, and the first step existed only as an
 * unvalidated string inside the `files` JSON blob: any user id at all, from any
 * clinic, could be written there as the author of this clinic's clinical work,
 * and nothing could query it afterwards.
 *
 * `doctorId` is a real column and a real foreign key now. These tests are about
 * the two consequences of that: it has to be someone who works here, and an
 * edit that says nothing about the doctor must not erase the attribution.
 */

const { isClinicMember } = vi.hoisted(() => ({ isClinicMember: vi.fn() }));

vi.mock('../../lib/orgContext.js', () => ({ isClinicMember }));
vi.mock('../../lib/prisma.js', () => ({ default: { labOrder: {} } }));
vi.mock('../../middleware/auth.js', () => ({ authenticate: vi.fn() }));
vi.mock('../../middleware/rbac.js', () => ({ requirePermission: () => vi.fn() }));
vi.mock('../../middleware/planGate.js', () => ({
  loadClinicAccess: vi.fn(),
  blockClinicWrites: vi.fn(),
}));

const { prepareLabOrderWrite } = await import('./lab.routes.js');

beforeEach(() => {
  vi.clearAllMocks();
  isClinicMember.mockResolvedValue(true);
});

describe('who may be recorded as the ordering doctor', () => {
  it('refuses a doctor who does not work at this clinic', async () => {
    isClinicMember.mockResolvedValue(false);
    const result = await prepareLabOrderWrite('clinic-1', { doctorId: 'outsider' });
    expect(result.error).toBeTruthy();
    expect(result.data).toBeUndefined();
    expect(isClinicMember).toHaveBeenCalledWith('outsider', 'clinic-1');
  });

  it('accepts a doctor who does, and writes them to the column', async () => {
    const result = await prepareLabOrderWrite('clinic-1', { doctorId: 'staff-doctor' });
    expect(result.error).toBeUndefined();
    expect(result.data!.doctorId).toBe('staff-doctor');
  });

  it('asks the database rather than trusting the body', async () => {
    // The whole point: before this, the id was written verbatim.
    await prepareLabOrderWrite('clinic-1', { doctorId: 'anybody' });
    expect(isClinicMember).toHaveBeenCalledTimes(1);
  });

  it('does not check, or write, when no doctor was supplied', async () => {
    const result = await prepareLabOrderWrite('clinic-1', { labType: 'Коронка' });
    expect(isClinicMember).not.toHaveBeenCalled();
    expect('doctorId' in result.data!).toBe(false);
  });
});

describe('the doctor lives in a column, not in the JSON blob', () => {
  it('never puts doctorId into meta', async () => {
    const result = await prepareLabOrderWrite('clinic-1', { doctorId: 'staff-doctor' });
    const meta = (result.data!.files as { meta: Record<string, unknown> }).meta;
    expect('doctorId' in meta).toBe(false);
  });

  it('leaves a legacy doctorId already in meta alone', async () => {
    // Rewriting it would be a silent edit of an old attribution; the serializer
    // falls back to it for exactly these rows.
    const result = await prepareLabOrderWrite('clinic-1', { labType: 'Винир' }, { doctorId: 'legacy-doc' });
    const meta = (result.data!.files as { meta: Record<string, unknown> }).meta;
    expect(meta.doctorId).toBe('legacy-doc');
  });

  it('keeps carrying the other meta fields it always did', async () => {
    const result = await prepareLabOrderWrite('clinic-1', {
      patientName: 'Иванов И.',
      material: 'Цирконий',
      toothNumber: 16,
      shade: 'A2',
    });
    const meta = (result.data!.files as { meta: Record<string, unknown> }).meta;
    expect(meta).toMatchObject({ patientName: 'Иванов И.', material: 'Цирконий', toothNumber: 16, shade: 'A2' });
  });
});

describe('an edit must not lose what it does not mention', () => {
  it('omits doctorId entirely when the body has none, so the column is untouched', async () => {
    // `doctorId: undefined` in a Prisma update means "leave it"; `null` would
    // mean "clear it". Omitting the key is the only safe shape here.
    const result = await prepareLabOrderWrite('clinic-1', { status: 'ready' });
    expect(Object.prototype.hasOwnProperty.call(result.data!, 'doctorId')).toBe(false);
  });

  it('still writes the fields the body did mention', async () => {
    const result = await prepareLabOrderWrite('clinic-1', { status: 'ready', price: 45000 });
    expect(result.data).toMatchObject({ status: 'ready', price: 45000 });
  });

  it('defaults an order with no status to pending, as before', async () => {
    const result = await prepareLabOrderWrite('clinic-1', {});
    expect(result.data!.status).toBe('pending');
  });
});
