import {
  doc,
  serverTimestamp,
  setDoc,
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

  await setDoc(userRef, {
    role: 'customer',
    status: 'active',
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}