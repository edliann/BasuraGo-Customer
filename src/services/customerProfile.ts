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

export async function completeCustomerOnboarding(
  userId: string,
  data: {
    fullName: string;
    phoneNumber: string;
  },
) {
  const customerRef = doc(
    firestore,
    'customers',
    userId,
  );

  await updateDoc(customerRef, {
    fullName: data.fullName.trim(),
    phoneNumber: data.phoneNumber.trim(),
    onboardingCompleted: true,
  });
}