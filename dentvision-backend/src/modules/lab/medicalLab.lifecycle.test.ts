import { describe, expect, it } from 'vitest';
import { isMedicalLabTransitionAllowed } from './medicalLab.routes.js';

describe('medical laboratory lifecycle', () => {
  it('permits ordered → specimen → received → processing → result → verified', () => {
    expect(isMedicalLabTransitionAllowed('draft', 'ordered')).toBe(true);
    expect(isMedicalLabTransitionAllowed('ordered', 'sample_collected')).toBe(true);
    expect(isMedicalLabTransitionAllowed('sample_collected', 'received')).toBe(true);
    expect(isMedicalLabTransitionAllowed('received', 'processing')).toBe(true);
    expect(isMedicalLabTransitionAllowed('processing', 'result_ready')).toBe(true);
    expect(isMedicalLabTransitionAllowed('result_ready', 'verified')).toBe(true);
  });

  it('does not allow skipping directly to verified', () => {
    expect(isMedicalLabTransitionAllowed('ordered', 'verified')).toBe(false);
    expect(isMedicalLabTransitionAllowed('processing', 'verified')).toBe(false);
  });

  it('allows cancellation only before verification', () => {
    expect(isMedicalLabTransitionAllowed('draft', 'cancelled')).toBe(true);
    expect(isMedicalLabTransitionAllowed('ordered', 'cancelled')).toBe(true);
    expect(isMedicalLabTransitionAllowed('processing', 'cancelled')).toBe(true);
    expect(isMedicalLabTransitionAllowed('verified', 'cancelled')).toBe(false);
  });

  it('allows result reprocessing but keeps verified terminal', () => {
    expect(isMedicalLabTransitionAllowed('result_ready', 'processing')).toBe(true);
    expect(isMedicalLabTransitionAllowed('verified', 'processing')).toBe(false);
  });
});
