import {
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';

import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isSuccessResponse,
} from 'react-native-nitro-google-signin';

import { onboardCustomer } from '@/services/customerAuth';
import { firebaseAuth } from '@/services/firebase';

export function getGoogleSignInErrorDetails(error: unknown) {
  let code = 'unknown';
  let message = 'Unknown error';

  if (typeof error === 'object' && error !== null) {
    if ('code' in error && typeof error.code === 'string') {
      code = error.code;
    }
    if ('message' in error && typeof error.message === 'string') {
      message = error.message;
    }
  }

  const safeCode = /^[A-Za-z0-9._/-]{1,100}$/.test(code)
    ? code
    : 'unknown';
  const safeMessage = message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted email]')
    .replace(/https?:\/\/\S+/gi, '[redacted URL]')
    .replace(/(["']?)(access[_ -]?token|id[_ -]?token|password|secret|credential)(["']?)\s*[:=]\s*(["']?)[^"',\s}]+["']?/gi, '$2=[redacted]')
    .replace(/\b(?:ya29\.|eyJ)[A-Za-z0-9._-]{10,}\b/g, '[redacted token]')
    .replace(/\b[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}\b/gi, '[redacted ID]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[redacted value]')
    .replace(/(?<!\w)\+?\d[\d\s().-]{6,}\d(?!\w)/g, '[redacted number]')
    .slice(0, 240);

  return { code: safeCode, message: safeMessage || 'No error message' };
}

function logGoogleSignInError(stage: string, error: unknown) {
  if (__DEV__) {
    console.error('[Google sign-in] failed', {
      stage,
      ...getGoogleSignInErrorDetails(error),
    });
  }
}

try {
  GoogleOneTapSignIn.configure({
    webClientId: 'autoDetect',
  });
} catch (error) {
  logGoogleSignInError('Google SDK initialization', error);
  throw error;
}

export async function signInWithGoogle() {
  let stage = 'Google SDK initialization/account selection';

  try {
    await GoogleOneTapSignIn.checkPlayServices();

    const response =
      await GoogleOneTapSignIn.createAccount();

    if (isCancelledResponse(response)) {
      return null;
    }

    if (!isSuccessResponse(response)) {
      return null;
    }

    const { idToken } = response.data;

    if (!idToken) {
      throw new Error(
        'Google did not return an ID token.',
      );
    }

    stage = 'Firebase sign-in';

    const credential =
      GoogleAuthProvider.credential(idToken);

    const userCredential =
      await signInWithCredential(
        firebaseAuth,
        credential,
      );

    stage = 'customer onboarding';

    await onboardCustomer(userCredential.user);
    return userCredential.user;
  } catch (error) {
    logGoogleSignInError(stage, error);
    throw error;
  }
}
