import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import { firebaseConfig } from '@/config/env';

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);
export const firestore = getFirestore(app);
export const firebaseStorage = getStorage(app);

if (__DEV__) {
  connectFirestoreEmulator(
    firestore,
    '192.168.1.13',
    8081,
  );
}

export default app;