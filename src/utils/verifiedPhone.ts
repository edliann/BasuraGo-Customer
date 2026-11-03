export function getVerifiedPhoneNumber(
  phoneVerified: unknown,
  profilePhoneNumber: unknown,
  authPhoneNumber: unknown,
): string | null {
  if (phoneVerified !== true) return null;

  const profileNumber = typeof profilePhoneNumber === 'string'
    ? profilePhoneNumber.trim()
    : '';
  const authNumber = typeof authPhoneNumber === 'string'
    ? authPhoneNumber.trim()
    : '';
  return profileNumber || authNumber || null;
}

export function formatPhoneNumberForDisplay(
  phoneNumber: string,
  phoneCountryCode?: string,
): string {
  const storedValue = phoneNumber.trim();
  const countryCode = phoneCountryCode?.trim() ?? '';
  const countryDigits = countryCode.replace(/\D/g, '');

  if (
    !storedValue.startsWith('+') ||
    !countryCode.startsWith('+') ||
    !countryDigits ||
    !storedValue.slice(1).startsWith(countryDigits)
  ) {
    return storedValue;
  }

  const nationalDigits = storedValue.slice(1 + countryDigits.length);
  if (!/^\d+$/.test(nationalDigits)) return storedValue;

  let groups: string[];
  if (nationalDigits.length === 10) {
    groups = [
      nationalDigits.slice(0, 3),
      nationalDigits.slice(3, 6),
      nationalDigits.slice(6),
    ];
  } else if (nationalDigits.length === 8) {
    groups = [nationalDigits.slice(0, 4), nationalDigits.slice(4)];
  } else {
    groups = [];
    for (let end = nationalDigits.length; end > 0; end -= 3) {
      groups.unshift(nationalDigits.slice(Math.max(0, end - 3), end));
    }
  }

  return `${countryCode} ${groups.join(' ')}`;
}
