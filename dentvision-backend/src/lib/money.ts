// Money helpers (Phase 0/4). All monetary amounts are stored and computed in
// MINOR units (тиын) as BigInt to avoid floating-point rounding errors.

export function tengeToMinor(tenge: number): bigint {
  return BigInt(Math.round(tenge * 100));
}

/**
 * Exact decimal-string → minor-unit BigInt conversion, e.g. "12500.50" → 1250050n.
 * Unlike `tengeToMinor`, this never multiplies the amount as a float — it parses
 * the decimal text directly into integer tenge/tiын parts and combines them as
 * BigInt, so it cannot inherit floating-point representation error. Accepts a
 * JS number for callers that still have one (converted via its own `toString()`,
 * the shortest decimal that round-trips to that exact double — still strictly
 * safer than tengeToMinor because no arithmetic is performed on it), but where
 * `tengeToMinor` would silently round away a third decimal digit, this throws:
 * a client-supplied amount with sub-tiын precision is a validation error, not
 * something to guess at.
 */
export function parseTengeToMinor(input: string | number): bigint {
  const raw = typeof input === 'number' ? input.toString() : input.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) {
    throw new Error(`Некорректная сумма: ${JSON.stringify(input)}`);
  }
  const [, sign, intPart, fracPartRaw] = match;
  const fracPart = (fracPartRaw ?? '').padEnd(2, '0');
  const minor = BigInt(intPart) * 100n + BigInt(fracPart);
  return sign === '-' ? -minor : minor;
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
