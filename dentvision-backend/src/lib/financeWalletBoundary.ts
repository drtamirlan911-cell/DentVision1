import type { AuthUser } from '../types/index.js';

export type FinanceWalletOwner = {
  ownerType: string;
  ownerId: string;
};

/**
 * A finance.manage permission is not sufficient to mutate an arbitrary wallet.
 * Platform-wide wallets remain SUPERADMIN-only; organization wallets must map
 * to the authenticated user's own clinic/supplier/organization context.
 */
export function canAccessFinanceWallet(
  user: Pick<AuthUser, 'role' | 'clinicId' | 'supplierId' | 'organizationId'>,
  wallet: FinanceWalletOwner,
): boolean {
  if (user.role === 'SUPERADMIN') return true;
  if (!wallet.ownerId || !wallet.ownerType) return false;

  switch (wallet.ownerType.toUpperCase()) {
    case 'CLINIC':
      return wallet.ownerId === user.clinicId;
    case 'SUPPLIER':
      return wallet.ownerId === user.supplierId;
    case 'ACADEMY':
    case 'LECTURER':
    case 'PARTNER':
      return wallet.ownerId === user.organizationId;
    case 'PLATFORM':
    case 'GATEWAY':
      return false;
    default:
      return false;
  }
}

export function assertFinanceWalletAccess(allowed: boolean): void {
  if (!allowed) throw new Error('FINANCE_WALLET_FORBIDDEN');
}
