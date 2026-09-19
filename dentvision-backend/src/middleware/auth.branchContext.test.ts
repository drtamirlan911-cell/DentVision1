import { describe, expect, it } from 'vitest';
import { mergeBranchIds } from './auth.js';

describe('mergeBranchIds', () => {
  it('combines universal and legacy branch assignments without duplicates', () => {
    expect(mergeBranchIds(['branch-a', 'branch-b'], ['branch-b', 'branch-c'])).toEqual([
      'branch-a',
      'branch-b',
      'branch-c',
    ]);
  });

  it('drops empty branch ids', () => {
    expect(mergeBranchIds(['', 'branch-a'], ['', 'branch-b'])).toEqual(['branch-a', 'branch-b']);
  });
});
