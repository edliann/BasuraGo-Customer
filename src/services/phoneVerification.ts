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

export interface PhoneVerificationStatus {
  verificationId: string | null;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
  lockoutRemainingSeconds: number;
}

export interface PhoneVerificationCallableError extends Error {
  code?: string;
  details?: {
    reason?: string;
    retryAfterSeconds?: number;
  };
}

export async function getPhoneVerificationStatus():
  Promise<PhoneVerificationStatus> {
  const callable = httpsCallable<
    Record<string, never>,
    PhoneVerificationStatus
  >(
    functions,
    'getPhoneVerificationStatusFunction',
  );
  const result = await callable({});
  return result.data;
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
  attemptId: string,
): Promise<ConfirmVerificationResponse> {
  const callable = httpsCallable<
    {
      verificationId: string;
      otp: string;
      attemptId: string;
    },
    ConfirmVerificationResponse
  >(
    functions,
    'confirmPhoneVerificationFunction',
  );

  const result = await callable({
    verificationId,
    otp,
    attemptId,
  });

  return result.data;
}
