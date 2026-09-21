import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

import { firestore } from '@/services/firebase';

interface CreateCustomerProfileInput {
  userId: string;
  fullName: string;
  email: string;
}

export async function createCustomerProfile({
  userId,
  fullName,
  email,
}: CreateCustomerProfileInput) {
  const userRef = doc(
    firestore,
    'users',
    userId,
  );

  const customerRef = doc(
    firestore,
    'customers',
    userId,
  );

  const [
    userSnapshot,
    customerSnapshot,
  ] = await Promise.all([
    getDoc(userRef),
    getDoc(customerRef),
  ]);

  const batch = writeBatch(firestore);
  const now = serverTimestamp();

  // Only CREATE the users document if it doesn't exist.
  if (!userSnapshot.exists()) {
    batch.set(userRef, {
      role: 'customer',
      status: 'active',
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      createdAt: now,
      updatedAt: now,
    });
  }

  // Only CREATE the customers document if it doesn't exist.
  if (!customerSnapshot.exists()) {
    batch.set(customerRef, {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phoneNumber: '',
      phoneVerified: false,
      onboardingCompleted: false,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Nothing to write if both documents already exist.
  if (!userSnapshot.exists() || !customerSnapshot.exists()) {
    await batch.commit();
  }
}