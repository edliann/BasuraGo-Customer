import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

import { firebaseAuth } from '@/services/firebase';

export async function registerCustomer(
  email: string,
  password: string,
  fullName: string,
) {
  const credential = await createUserWithEmailAndPassword(
    firebaseAuth,
    email.trim(),
    password,
  );

  await updateProfile(credential.user, {
    displayName: fullName.trim(),
  });

  return credential.user;
}

export async function loginCustomer(
  email: string,
  password: string,
) {
  const credential = await signInWithEmailAndPassword(
    firebaseAuth,
    email.trim(),
    password,
  );

  return credential.user;
}

export async function logoutCustomer() {
  await signOut(firebaseAuth);
}