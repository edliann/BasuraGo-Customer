import type { User } from 'firebase/auth';
import {
  getFunctions,
  httpsCallable,
  type HttpsCallableResult,
} from 'firebase/functions';

import app, { firebaseAuth } from '@/services/firebase';

const functions = getFunctions(app, 'us-central1');

interface CustomerOnboardingResult {
  membershipCreated: boolean;
  customerProfileCreated: boolean;
  customerProfileUpdated: boolean;
}

const onboardCustomerCallable = httpsCallable<
  Record<string, never>,
  CustomerOnboardingResult
>(functions, 'onboardCustomerFunction');

export function getCustomerOnboardingErrorCode(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }

  return 'unknown';
}

export function getCustomerOnboardingErrorMessage(error: unknown) {
  const code = getCustomerOnboardingErrorCode(error)
    .replace(/^functions\//, '');

  if (code === 'permission-denied' || code === 'unauthenticated') {
    return 'This account is not eligible to use BasuraGo Customer. If you believe this is a mistake, switch accounts or contact support.';
  }

  if (code === 'failed-precondition') {
    return 'This customer account is currently inactive. Please contact support.';
  }

  if (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'network-request-failed' ||
    code === 'internal'
  ) {
    return 'We could not finish setting up your customer account. Check your connection and try again.';
  }

  return 'We could not finish setting up your customer account. Please try again.';
}

export function isCustomerOnboardingError(error: unknown) {
  const code = getCustomerOnboardingErrorCode(error);
  return code.startsWith('functions/') ||
    code === 'customer/auth-user-mismatch';
}

export async function onboardCustomer(user: User) {
  if (firebaseAuth.currentUser?.uid !== user.uid) {
    throw Object.assign(
      new Error('The signed-in account changed before onboarding.'),
      { code: 'customer/auth-user-mismatch' },
    );
  }

  let result: HttpsCallableResult<CustomerOnboardingResult>;
  try {
    // The callable receives no UID or role data. It derives the UID from
    // Firebase's verified callable authentication context.
    result = await onboardCustomerCallable({});
  } catch (error) {
    if (__DEV__) {
      console.error('[Customer onboarding] callable failed', {
        code: getCustomerOnboardingErrorCode(error),
      });
    }
    throw error;
  }

  try {
    // The server assigns the Supabase-compatible custom claim before it
    // returns. Refresh once here so the next Storage request uses that claim.
    await user.getIdToken(true);
  } catch (error) {
    if (__DEV__) {
      console.error('[Customer onboarding] token refresh failed', {
        code: getCustomerOnboardingErrorCode(error),
      });
    }
    throw error;
  }

  return result.data;
}

export type CustomerProvisioningStage =
  | 'customer role validation'
  | 'customer provisioning';

export type CustomerProvisioningStageLogger = (
  stage: CustomerProvisioningStage,
  event: 'started' | 'completed',
) => void;

export async function provisionCustomer(
  user: User,
  logStage?: CustomerProvisioningStageLogger,
) {
  logStage?.('customer role validation', 'started');
  logStage?.('customer role validation', 'completed');
  logStage?.('customer provisioning', 'started');
  await onboardCustomer(user);
  logStage?.('customer provisioning', 'completed');

  return user;
}
