import type {CustomerPickupHistoryItem} from '@/services/pickups';

const ACTIVE_PICKUP_STATUSES = new Set([
  'pending',
  'accepted',
  'in_progress',
  'awaiting_facility_receipt',
]);

function scheduledTimestamp(item: CustomerPickupHistoryItem): number | null {
  const date = item.scheduledDate;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const [year, month, day] = date.split('-').map(Number);
  const dayTimestamp = Date.UTC(year, month - 1, day);
  if (
    !Number.isFinite(dayTimestamp) ||
    new Date(dayTimestamp).toISOString().slice(0, 10) !== date
  ) {
    return null;
  }

  const time = item.scheduledTime;
  const match = time ? /^(\d{2}):(\d{2})$/.exec(time) : null;
  const hour = match ? Number(match[1]) : 23;
  const minute = match ? Number(match[2]) : 59;
  if (hour > 23 || minute > 59) {
    return dayTimestamp + 24 * 60 * 60_000 - 1;
  }

  return dayTimestamp + (hour * 60 + minute) * 60_000;
}

function comparePickups(
  left: CustomerPickupHistoryItem,
  right: CustomerPickupHistoryItem,
): number {
  const leftSchedule = scheduledTimestamp(left);
  const rightSchedule = scheduledTimestamp(right);
  if (leftSchedule !== null && rightSchedule === null) return -1;
  if (leftSchedule === null && rightSchedule !== null) return 1;
  if (leftSchedule !== null && rightSchedule !== null) {
    const scheduleOrder = leftSchedule - rightSchedule;
    if (scheduleOrder !== 0) return scheduleOrder;
  }

  const leftCreatedAt = left.createdAt ? Date.parse(left.createdAt) : NaN;
  const rightCreatedAt = right.createdAt ? Date.parse(right.createdAt) : NaN;
  if (Number.isFinite(leftCreatedAt) && Number.isFinite(rightCreatedAt)) {
    const creationOrder = leftCreatedAt - rightCreatedAt;
    if (creationOrder !== 0) return creationOrder;
  } else if (Number.isFinite(leftCreatedAt)) {
    return -1;
  } else if (Number.isFinite(rightCreatedAt)) {
    return 1;
  }

  return left.pickupId.localeCompare(right.pickupId);
}

export function getNextActivePickup(
  pickups: readonly CustomerPickupHistoryItem[],
): CustomerPickupHistoryItem | null {
  return pickups
    .filter((pickup) => ACTIVE_PICKUP_STATUSES.has(pickup.status))
    .slice()
    .sort(comparePickups)[0] ?? null;
}
