const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function calculateWasteTypeSubtotal(
  pickupFeePerBag: number | null | undefined,
  quantity: number,
): number | null {
  if (
    typeof pickupFeePerBag !== 'number' ||
    !Number.isFinite(pickupFeePerBag) ||
    pickupFeePerBag < 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  ) {
    return null;
  }

  const subtotal = pickupFeePerBag * quantity;
  return Number.isFinite(subtotal) ? subtotal : null;
}

export function formatPesoAmount(amountPesos: number | null | undefined): string {
  return typeof amountPesos === 'number' && Number.isFinite(amountPesos)
    ? pesoFormatter.format(amountPesos)
    : '—';
}

export function formatPesoCentavos(
  amountCentavos: number | null | undefined,
): string {
  return typeof amountCentavos === 'number' &&
      Number.isSafeInteger(amountCentavos) && amountCentavos >= 0
    ? pesoFormatter.format(amountCentavos / 100)
    : '—';
}
