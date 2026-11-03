import {
  FacebookAuthProvider,
  linkWithCredential,
  signInWithCredential,
  type AuthCredential,
  type User,
  type UserCredential,
} from 'firebase/auth';

import {
  AccessToken,
  LoginManager,
} from 'react-native-fbsdk-next';

import { firebaseAuth } from '@/services/firebase';
import { provisionCustomer } from '@/services/customerAuth';

interface PendingFacebookLink {
  credential: AuthCredential;
  email: string | null;
}

let pendingFacebookLink: PendingFacebookLink | null = null;

export function getFacebookAuthErrorCode(error: unknown) {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error
    ? String(error.code)
    : '';
}

function getFacebookConflictEmail(error: unknown) {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('customData' in error) ||
    typeof error.customData !== 'object' ||
    error.customData === null ||
    !('email' in error.customData) ||
    typeof error.customData.email !== 'string'
  ) {
    return null;
  }

  return error.customData.email.trim().toLowerCase() || null;
}

function createFacebookLinkError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

export function hasPendingFacebookCredential() {
  return pendingFacebookLink !== null;
}

export function clearPendingFacebookCredential() {
  pendingFacebookLink = null;
}

export async function linkPendingFacebookCredential(user: User) {
  const pending = pendingFacebookLink;

  if (!pending) {
    throw createFacebookLinkError(
      'auth/facebook-link-expired',
      'The pending Facebook sign-in has expired.',
    );
  }

  const userEmail = user.email?.trim().toLowerCase() || null;
  if (!pending.email || userEmail !== pending.email) {
    throw createFacebookLinkError(
      'auth/facebook-link-account-mismatch',
      'Sign in with the account that matches the Facebook sign-in email.',
    );
  }

  if (!user.providerData.some(({ providerId }) => providerId === 'password')) {
    throw createFacebookLinkError(
      'auth/facebook-link-password-required',
      'Sign in to the existing account with its email and password.',
    );
  }

  if (user.providerData.some(({ providerId }) => providerId === 'facebook.com')) {
    clearPendingFacebookCredential();
    return user;
  }

  try {
    const result = await linkWithCredential(user, pending.credential);
    clearPendingFacebookCredential();
    return result.user;
  } catch (error) {
    const code = getFacebookAuthErrorCode(error);

    if (code === 'auth/provider-already-linked') {
      clearPendingFacebookCredential();
      return user;
    }

    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/credential-already-in-use'
    ) {
      clearPendingFacebookCredential();
    }

    throw error;
  }
}

export async function signInWithFacebook() {
  console.log('[Facebook diagnostic] signInWithFacebook started');
  clearPendingFacebookCredential();

  console.log('[Facebook diagnostic] Calling LoginManager.logInWithPermissions');
  const result = await LoginManager.logInWithPermissions([
    'public_profile',
    'email',
  ]);

  if (result.isCancelled) {
    return null;
  }

  const accessToken = await AccessToken.getCurrentAccessToken();

  if (!accessToken?.accessToken) {
    throw new Error(
      'Facebook did not return an access token. Please try again.',
    );
  }

  const credential = FacebookAuthProvider.credential(
    accessToken.accessToken,
  );

  let userCredential: UserCredential;
  try {
    userCredential = await signInWithCredential(
      firebaseAuth,
      credential,
    );
  } catch (error) {
    const code = getFacebookAuthErrorCode(error);
    if (
      code === 'auth/account-exists-with-different-credential' ||
      code === 'auth/email-already-in-use'
    ) {
      pendingFacebookLink = {
        credential,
        email: getFacebookConflictEmail(error),
      };
    }

    throw error;
  }

  await provisionCustomer(userCredential.user);

  return userCredential.user;
}
