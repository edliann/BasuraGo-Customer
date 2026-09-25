import {
  getFunctions,
  httpsCallable,
} from 'firebase/functions';

import firebaseApp from '@/services/firebase';

const functions = getFunctions(
  firebaseApp,
  'us-central1',
);

interface RequestVerificationResponse {
  verificationId: string;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
}

interface ConfirmVerificationResponse {
  success: boolean;
}

export async function requestPhoneVerification(
  phoneNumber: string,
): Promise<RequestVerificationResponse> {
  const callable = httpsCallable<
    {phoneNumber: string},
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