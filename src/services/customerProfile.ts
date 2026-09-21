import {
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';

import { firestore } from '@/services/firebase';
import type { CustomerProfile } from '@/types/user';

export async function getCustomerProfile(
  userId: string,
): Promise<CustomerProfile | null> {
  const customerRef = doc(
    firestore,
    'customers',
    userId,
  );

  const snapshot = await getDoc(customerRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    userId,
    ...snapshot.data(),
  } as CustomerProfile;
}

interface CompleteCustomerOnboardingInput {
  fullName: string;
  phoneNumber: string;
  phoneCountryCode: string;
}

export async function completeCustomerOnboarding(
  userId: string,
  data: CompleteCustomerOnboardingInput,
) {
  const customerRef = doc(
    firestore,
    'customers',
    userId,
  );

  await updateDoc(customerRef, {
    fullName: data.fullName.trim(),
    phoneNumber: data.phoneNumber.trim(),
    phoneCountryCode:
      data.phoneCountryCode.trim(),
    onboardingCompleted: true,
  });
}