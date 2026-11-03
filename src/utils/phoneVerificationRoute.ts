export function getPhoneVerificationRedirect(
  phoneVerified: boolean,
  firstSegment: string,
): '/phone-verification' | null {
  if (!phoneVerified && firstSegment !== 'phone-verification') {
    return '/phone-verification';
  }

  return null;
}
