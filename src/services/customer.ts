import {
  doc,
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
  const batch = writeBatch(firestore);

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

  const createdAt = serverTimestamp();
  const updatedAt = serverTimestamp();

  batch.set(userRef, {
    role: 'customer',
    status: 'active',
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    createdAt,
    updatedAt,
  });

  batch.set(customerRef, {
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    phoneNumber: '',
    phoneVerified: false,
    status: 'active',
    createdAt,
    updatedAt,
  });

  await batch.commit();
}