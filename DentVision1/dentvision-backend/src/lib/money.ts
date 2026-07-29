// Money helpers (Phase 0/4). All monetary amounts are stored and computed in
// MINOR units (тиын) as BigInt to avoid floating-point rounding errors.

export function tengeToMinor(tenge: number): bigint {
  return BigInt(Math.round(tenge * 100));
}

export function minorToTenge(minor: bigint): number {
  return Number(minor) / 100;
}

/** Commission in minor units from an amount and basis points (1000 = 10%). */
export function commissionMinor(amountMinor: bigint, bps: number): bigint {
  return (amountMinor * BigInt(bps)) / 10000n;
}

/** JSON-safe view of a value tree, converting BigInt -> string. */
export function serializeBigInt<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );
}
