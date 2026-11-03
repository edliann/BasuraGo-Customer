const PICKUP_TIMEZONE = 'Asia/Manila';
const PICKUP_TIMEZONE_OFFSET_MINUTES = 8 * 60;

export interface PickerValueChangeEvent {
  nativeEvent: {
    timestamp: number;
    utcOffset: number;
  };
}

/** Format the backend's 24-hour HH:mm value for customer display. */
export function formatPickupTime(value: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return '';

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return '';

  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${match[2]} ${period}`;
}

/** Build a Date representing a Manila wall-clock value for the native picker. */
export function createPickupTimePickerValue(
  dateValue: string,
  timeValue: string,
): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (!dateMatch || !timeMatch) return new Date();

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return new Date();
  }

  const manilaWallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(
    manilaWallClockAsUtc - PICKUP_TIMEZONE_OFFSET_MINUTES * 60_000,
  );
}

/** Convert the picker instant and its selected timezone offset to HH:mm. */
export function pickupTimeFromPickerEvent(
  event: PickerValueChangeEvent,
): string | null {
  const {timestamp, utcOffset} = event.nativeEvent;
  if (!Number.isFinite(timestamp) || !Number.isFinite(utcOffset)) return null;

  const wallClock = new Date(timestamp + utcOffset * 60_000);
  if (Number.isNaN(wallClock.getTime())) return null;

  const hour = String(wallClock.getUTCHours()).padStart(2, '0');
  const minute = String(wallClock.getUTCMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

export {PICKUP_TIMEZONE};
