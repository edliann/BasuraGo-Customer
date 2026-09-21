import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions';

import firebaseApp from '@/services/firebase';

const functions = getFunctions(firebaseApp);

if (__DEV__) {
  connectFunctionsEmulator(functions, '192.168.1.13', 5001);
}

interface RequestVerificationResponse {
  verificationId: string;
  expiresInSeconds: number;
}

interface ConfirmVerificationResponse {
  success: boolean;
}

export async function requestPhoneVerification(
  phoneNumber: string,
): Promise<RequestVerificationResponse> {
  const callable = httpsCallable<
    { phoneNumber: string },
    RequestVerificationResponse
  >(
    functions,
    'requestPhoneVerificationFunction',
  );

  const result = await callable({
    phoneNumber,
  });

  return result.data;
}

export async function confirmPhoneVerification(
  verificationId: string,
  otp: string,
): Promise<ConfirmVerificationResponse> {
  const callable = httpsCallable<
    {
      verificationId: string;
      otp: string;
    },
    ConfirmVerificationResponse
  >(
    functions,
    'confirmPhoneVerificationFunction',
  );

  const result = await callable({
    verificationId,
    otp,
  });

  return result.data;
}