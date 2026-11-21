export type SupplierOrderLine = {
  product_id?: unknown;
  productId?: unknown;
  supplier_id?: unknown;
  supplierId?: unknown;
};

/**
 * A marketplace order may contain lines from multiple sellers. The canonical
 * order.supplierId is only a legacy/primary-seller pointer; the line snapshot
 * supplier_id is authoritative for a line. Older snapshots without seller ID
 * fall back to the current product ownership relation.
 */
export function orderHasSupplierLine(
  rawItems: unknown,
  supplierId: string,
  supplierProductIds: ReadonlySet<string>,
): boolean {
  if (!supplierId || !Array.isArray(rawItems)) return false;

  return rawItems.some((rawItem) => {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) return false;
    const item = rawItem as SupplierOrderLine;
    const lineSupplierId = String(item.supplier_id ?? item.supplierId ?? '').trim();
    if (lineSupplierId) return lineSupplierId === supplierId;

    const productId = String(item.product_id ?? item.productId ?? '').trim();
    return productId.length > 0 && supplierProductIds.has(productId);
  });
}
