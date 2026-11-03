import type { PickupQuoteItemInput } from './pickups';

export function appendPickupQuoteItem(
  items: PickupQuoteItemInput[],
  item: PickupQuoteItemInput,
): PickupQuoteItemInput[] {
  return [...items, item];
}

export function snapshotPickupQuoteItems(
  items: PickupQuoteItemInput[],
): PickupQuoteItemInput[] {
  return items.map(({wasteTypeId, bagSizeId, quantity}) => ({
    wasteTypeId,
    bagSizeId,
    quantity,
  }));
}
